"""CompositeBackend wiring — two planes, two guarantees.

Corpus (discovery):  searched by meaning via grep/glob/ls, eventually consistent.
Workspace (coordination): read/written by exact path, read-after-write consistent.

See plan 4.1-4.2.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from deepagents.backends import CompositeBackend
from deepagents.backends.protocol import GrepResult
from langchain_mongodb_deepagents_vfs import MongoFilesystemBackend

APP_NAME = "devrel-tutorial-deepagents-langchain-vfs"


class _CompositeRoutedBackend(MongoFilesystemBackend):
    """Wrapper that bridges MongoFilesystemBackend with CompositeBackend routing.

    CompositeBackend strips route prefixes before calling the routed backend.
    For example, `/corpus/analysis/tsd.pdf` becomes `/analysis/tsd.pdf`.
    MongoFilesystemBackend expects paths to include its s3_prefix (e.g.
    `corpus/analysis/tsd.pdf`). This wrapper normalizes in both directions:

    - Inbound: strips leading '/' and prepends s3_prefix
    - Outbound (grep): strips s3_prefix and adds leading '/' so
      CompositeBackend's _remap_grep_path reconstructs the full path
    """

    def _normalize_path(self, path: str | None) -> str:
        """Convert a CompositeBackend-stripped path back to s3_prefix-relative."""
        if path is None or path == "/" or path == "":
            return ""
        # Strip leading slash that CompositeBackend leaves
        p = path.lstrip("/")
        # If it already starts with the prefix, leave it
        if p.startswith(self._prefix):
            return p
        # Prepend prefix
        return f"{self._prefix}{p}"

    def read(self, file_path, **kwargs):
        return super().read(self._normalize_path(file_path), **kwargs)

    def write(self, file_path, content, **kwargs):
        return super().write(self._normalize_path(file_path), content, **kwargs)

    def grep(self, pattern, path=None, glob=None, **kwargs) -> GrepResult:
        result = super().grep(pattern, self._normalize_path(path), glob)
        if result.matches:
            prefix = self._prefix

            def _strip(p: str) -> str:
                if p.startswith(prefix):
                    p = p[len(prefix) :]
                return f"/{p}" if not p.startswith("/") else p

            result = GrepResult(
                matches=[{**m, "path": _strip(m["path"])} for m in result.matches],
                truncated=getattr(result, "truncated", False),
            )
        return result

    def ls(self, path="", **kwargs):
        return super().ls(self._normalize_path(path))

    def glob(self, pattern, path="", **kwargs):
        return super().glob(pattern, self._normalize_path(path))


def _uri_with_appname(uri: str) -> str:
    """Append appName to a MongoDB URI if not already present."""
    if "appName=" in uri or "appname=" in uri:
        return uri
    sep = "&" if "?" in uri else "?"
    return f"{uri}{sep}appName={APP_NAME}"


@contextmanager
def create_backend() -> Generator[CompositeBackend, None, None]:
    """Build the two-plane CompositeBackend from environment variables.

    Use with `with`:

        with create_backend() as backend:
            ...
    """
    mongodb_uri = _uri_with_appname(os.environ["MONGODB_URI"])
    s3_bucket = os.environ["S3_BUCKET_NAME"]
    aws_region = os.environ.get("AWS_REGION", "us-east-1")

    # Workspace: the default plane. Agents write findings here and read
    # by exact path. Read-after-write — never searched.
    workspace_backend = _CompositeRoutedBackend(
        s3_bucket_name=s3_bucket,
        mongodb_connection_string=mongodb_uri,
        s3_prefix="workspace/",
        aws_region=aws_region,
        debug=True,
    )

    # Corpus: routed plane. Settled documents, searched by meaning via
    # hybrid $rankFusion. Eventually consistent (10s watcher + index lag).
    corpus_backend = _CompositeRoutedBackend(
        s3_bucket_name=s3_bucket,
        mongodb_connection_string=mongodb_uri,
        s3_prefix="corpus/",
        aws_region=aws_region,
        debug=True,
    )

    with workspace_backend, corpus_backend:
        yield CompositeBackend(
            default=workspace_backend,
            routes={"/corpus/": corpus_backend},
        )
