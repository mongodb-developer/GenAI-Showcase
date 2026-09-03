"""Seed the corpus into S3 and block until MongoDB is searchable.

Uploads all files from corpus/ to S3 under the corpus/ prefix, then
blocks until grep returns results and both health instruments are green.

Gate: a grep for "CADR" returns hits from at least three distinct file types.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_mongodb_deepagents_vfs import MongoFilesystemBackend

load_dotenv()

CORPUS_DIR = Path(__file__).resolve().parent.parent / "corpus"
S3_PREFIX = "corpus/"
APP_NAME = "devrel-tutorial-deepagents-langchain-vfs"


def collect_corpus_files() -> list[tuple[str, bytes]]:
    """Walk corpus/ and return (s3_key, bytes) tuples."""
    files: list[tuple[str, bytes]] = []
    for path in sorted(CORPUS_DIR.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            relative = path.relative_to(CORPUS_DIR)
            s3_key = f"{S3_PREFIX}{relative}"
            files.append((s3_key, path.read_bytes()))
    return files


def main() -> None:
    if not CORPUS_DIR.exists():
        print(f"ERROR: corpus directory not found at {CORPUS_DIR}")
        sys.exit(1)

    files = collect_corpus_files()
    if not files:
        print("ERROR: no files found in corpus/")
        sys.exit(1)

    print(f"Found {len(files)} corpus files to upload:")
    for key, data in files:
        print(f"  {key} ({len(data):,} bytes)")

    mongodb_uri = os.environ["MONGODB_URI"]
    if "appName=" not in mongodb_uri and "appname=" not in mongodb_uri:
        sep = "&" if "?" in mongodb_uri else "?"
        mongodb_uri = f"{mongodb_uri}{sep}appName={APP_NAME}"

    with MongoFilesystemBackend(
        s3_bucket_name=os.environ["S3_BUCKET_NAME"],
        mongodb_connection_string=mongodb_uri,
        s3_prefix=S3_PREFIX,
        aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        debug=True,
    ) as backend:
        # Upload
        print("\nUploading to S3...")
        results = backend.upload_files(files)
        failed_uploads = [r for r in results if r.error]
        if failed_uploads:
            for r in failed_uploads:
                print(f"  FAILED: {r.path} — {r.error}")
            sys.exit(1)
        print(f"  Uploaded {len(results)} files.")

        # Block until searchable — the first grep blocks internally until
        # initial sync completes. This is not a hang; the constructor is
        # non-blocking and the first search waits for the daemon thread.
        print("\nWaiting for initial sync and index build...")
        t0 = time.monotonic()
        warmup = backend.grep("warmup")
        sync_lag = time.monotonic() - t0
        print(f"  First grep returned in {sync_lag:.1f}s")

        # Assert both health instruments
        assert not backend.init_errors, f"Init errors: {backend.init_errors}"
        report = backend.initial_sync_report
        assert report is not None, "initial_sync_report is None — sync raised"
        assert (
            report.failed == 0
        ), f"{report.failed}/{report.seen} objects not searchable"
        print(
            f"  Sync healthy: {report.seen} seen, {report.processed} processed, "
            f"{report.skipped} skipped, {report.failed} failed"
        )

        # Gate: grep for "CADR" must hit at least 3 file types
        print("\nGate check: grep for 'CADR'...")
        result = backend.grep("CADR")
        if result.error:
            print(f"  ERROR: {result.error}")
            sys.exit(1)

        hit_types: set[str] = set()
        for match in result.matches or []:
            ext = Path(match["path"]).suffix.lower()
            hit_types.add(ext)
            print(f"  Hit: {match['path']}:{match['line']} — {match['text'][:80]}...")

        print(f"\n  File types with hits: {sorted(hit_types)}")
        if len(hit_types) < 3:
            print(
                f"  WARNING: expected hits from >= 3 file types, got {len(hit_types)}. "
                f"Beat 1's format argument depends on cross-format search."
            )
        else:
            print("  GATE PASSED: hits from 3+ file types.")

        print(f"\nCorpus seeded. Observed sync lag: {sync_lag:.1f}s")


if __name__ == "__main__":
    main()
