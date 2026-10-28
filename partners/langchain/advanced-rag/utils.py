"""Shared setup helpers for the Advanced RAG workshop notebooks.

Teaching code (retrievers, comparisons, chains) stays inline in the notebooks.
This module holds only the boilerplate every notebook repeats: reading secrets,
connecting to Atlas, calling the Atlas-hosted embedding and rerank endpoints, and
configuring ChatAnthropic against either the Anthropic API or a compatible gateway.

Nothing here talks to the network at import time, so it is safe to `import utils`
in any cell. The one HTTP dependency (`requests`) is injected as a `poster` seam so
the unit tests in test_utils.py run without a network or API keys.
"""

from __future__ import annotations

import getpass
import os
from typing import Any, Callable, List
from urllib.parse import urlparse, urlunparse

from langchain_core.embeddings import Embeddings

# Endpoints for MongoDB's Atlas-hosted AI services.
ATLAS_EMBEDDINGS_URL = "https://ai.mongodb.com/v1/embeddings"
ATLAS_RERANK_URL = "https://ai.mongodb.com/v1/rerank"
ANTHROPIC_VERSION = "2023-06-01"

# Telemetry tag so MongoDB can attribute this workload (GenAI-Showcase convention).
APPNAME = "devrel.partner.advanced_rag.python"


class EmbeddingDimensionMismatch(RuntimeError):
    """Raised when the embedding service returns a vector of unexpected length."""


# --------------------------------------------------------------------------
# Secrets: environment first, interactive prompt as a fallback.
# --------------------------------------------------------------------------
def get_secret(name: str, prompt: str | None = None) -> str:
    """Return a secret from the environment, or prompt for it if unset/blank.

    Reading the environment first lets a local `.env` (loaded via python-dotenv)
    drive the notebooks unattended, while the getpass fallback keeps them working
    in Google Colab where no `.env` exists.
    """
    value = os.environ.get(name)
    if value and value.strip():
        return value
    return getpass.getpass(prompt or f"Enter {name}: ")


# --------------------------------------------------------------------------
# LLM configuration: direct Anthropic API vs. an Anthropic-compatible gateway.
# --------------------------------------------------------------------------
def setting(name: str, default: str) -> str:
    """Return a tunable from the .env file, or its documented default.

    Deliberately NOT `os.getenv(name, default)`. `load_dotenv` only overlays the
    variables the file declares, so anything it omits keeps whatever the surrounding
    shell holds. An `ANTHROPIC_MODEL` left in a shell by unrelated work then silently
    becomes the model a notebook uses, and the resulting `DeploymentNotFound` points
    nowhere near the cause. That happened during development, which is why this exists.

    This reads the .env file directly rather than the process environment, so an omitted
    variable means "use the documented default", not "use whatever the shell has".
    Required *secrets* still fall back to the shell via `get_secret`, because Colab and
    CI legitimately have no .env file.
    """
    from dotenv import dotenv_values, find_dotenv

    path = find_dotenv(usecwd=True)
    if not path:
        return default
    value = (dotenv_values(path).get(name) or "").strip()
    return value or default


def _strip_messages_path(base_url: str) -> str:
    """Drop a trailing /v1/messages from a gateway URL.

    The Anthropic SDK appends `/v1/messages` itself, so `base_url` must be the API
    root. Users often paste the full endpoint from a curl example, so we normalise.
    """
    parsed = urlparse(base_url)
    path = parsed.path.rstrip("/")
    for suffix in ("/v1/messages", "/messages"):
        if path.endswith(suffix):
            path = path[: -len(suffix)]
            break
    return urlunparse(parsed._replace(path=path))


def build_llm_kwargs(
    *,
    api_key: str,
    model: str,
    base_url: str | None,
    max_tokens: int = 1024,
) -> dict:
    """Build kwargs for ChatAnthropic for either a direct or gateway connection.

    Direct Anthropic API: pass the key through as usual.
    Gateway (e.g. Azure API Management fronting Grove): the SDK's default
    `x-api-key` header is rejected, so we also send an `api-key` header and
    normalise the base URL to the API root.
    """
    kwargs: dict[str, Any] = {"model": model, "max_tokens": max_tokens}
    if base_url:
        kwargs["base_url"] = _strip_messages_path(base_url)
        # The SDK always sends api_key as x-api-key. Gateways that read that header
        # first reject a placeholder, so it carries the real key as well.
        kwargs["api_key"] = api_key
        kwargs["default_headers"] = {
            "api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
        }
    else:
        kwargs["api_key"] = api_key
    return kwargs


# --------------------------------------------------------------------------
# Embeddings: LangChain Embeddings backed by the Atlas-hosted endpoint.
# --------------------------------------------------------------------------
def _default_poster(url, headers, json, timeout):  # pragma: no cover - thin wrapper
    import requests

    return requests.post(url, headers=headers, json=json, timeout=timeout)


class AtlasEmbeddings(Embeddings):
    """Voyage embeddings via MongoDB's Atlas-hosted embedding endpoint.

    By default one model embeds both documents and queries -- required when querying
    a collection whose stored vectors come from a single model (e.g. sample_mflix's
    `voyage-3-large` plot vectors), since query and document vectors must share a
    space. Pass `query_model` to use an asymmetric pair instead. The returned
    dimension is validated on every call so a misconfiguration fails fast.
    """

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "voyage-3-large",
        query_model: str | None = None,
        dimensions: int = 2048,
        url: str = ATLAS_EMBEDDINGS_URL,
        timeout: float = 60.0,
        poster: Callable = _default_poster,
    ):
        self.api_key = api_key
        self.doc_model = model
        self.query_model = query_model or model
        self.dimensions = dimensions
        self.url = url
        self.timeout = timeout
        self._poster = poster

    def _embed(
        self, texts: List[str], *, model: str, input_type: str
    ) -> List[List[float]]:
        resp = self._poster(
            self.url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "input": texts,
                "input_type": input_type,
                "output_dimension": self.dimensions,
            },
            timeout=self.timeout,
        )
        if not resp.ok:
            raise RuntimeError(
                f"Atlas embeddings request failed ({resp.status_code}): {resp.text[:300]}"
            )
        vectors = [item["embedding"] for item in resp.json()["data"]]
        for vec in vectors:
            if len(vec) != self.dimensions:
                raise EmbeddingDimensionMismatch(
                    f"Expected {self.dimensions}-d vectors, got {len(vec)}"
                )
        return vectors

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._embed(list(texts), model=self.doc_model, input_type="document")

    def embed_query(self, text: str) -> List[float]:
        return self._embed([text], model=self.query_model, input_type="query")[0]


# --------------------------------------------------------------------------
# Reranking: reorder candidate documents via the Atlas-hosted rerank endpoint.
# --------------------------------------------------------------------------
def atlas_rerank(
    query: str,
    documents: List[str],
    *,
    api_key: str,
    top_n: int | None = None,
    model: str = "rerank-2.5",
    url: str = ATLAS_RERANK_URL,
    timeout: float = 60.0,
    poster: Callable = _default_poster,
) -> List[str]:
    """Return `documents` reordered most-relevant-first, truncated to `top_n`."""
    resp = poster(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "query": query,
            "documents": documents,
            "top_k": top_n if top_n is not None else len(documents),
        },
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(
            f"Atlas rerank request failed ({resp.status_code}): {resp.text[:300]}"
        )
    results = sorted(
        resp.json()["data"], key=lambda r: r["relevance_score"], reverse=True
    )
    ordered = [documents[r["index"]] for r in results]
    return ordered[:top_n] if top_n is not None else ordered


# --------------------------------------------------------------------------
# Atlas connection.
# --------------------------------------------------------------------------
def connect(uri: str, *, appname: str = APPNAME):  # pragma: no cover - needs live Atlas
    """Return a MongoClient, verifying the connection with a ping."""
    from pymongo import MongoClient

    client = MongoClient(uri, appname=appname, serverSelectionTimeoutMS=20000)
    client.admin.command("ping")
    return client


# --------------------------------------------------------------------------
# Guards for the two destructive things a notebook could otherwise do to a
# reader's cluster: exceed the search index budget, and reuse a collection it
# did not create.
# --------------------------------------------------------------------------
#: Atlas Search index limit on the free M0 tier. Paid tiers allow more.
M0_SEARCH_INDEX_LIMIT = 3


class SearchIndexBudgetExceeded(RuntimeError):
    """Raised when creating an index would exceed the cluster's search index limit.

    Deliberately stops rather than freeing a slot. An index these notebooks did
    not create belongs to the reader and might be behind a running application,
    so asking for a fresh cluster is the safe failure.
    """

    def __init__(self, wanted: str, existing: List[tuple], limit: int):
        inventory = "\n".join(f"  {coll}: {idx}" for coll, idx in existing)
        tier = " on a free M0 tier" if limit == M0_SEARCH_INDEX_LIMIT else ""
        super().__init__(
            f'Cannot create "{wanted}": this cluster already has {len(existing)} Atlas '
            f"Search index(es), which is the limit{tier}:\n{inventory}\n\n"
            "Use a fresh Atlas cluster, upgrade the tier, or drop an index you no longer "
            "need from the Atlas UI. This notebook will not delete indexes it did not "
            "create.\nIf a previous run of this cookbook was interrupted, the leftover is "
            "most likely an index on a scratch collection (an 'auto_embed_demo' or "
            "'mastra_cookbook_*' collection) -- those are safe for you to remove."
        )


def list_all_search_indexes(db) -> List[tuple]:  # pragma: no cover - needs live Atlas
    """Every Atlas Search index in the database, as (collection, index) pairs."""
    found = []
    for name in db.list_collection_names():
        try:
            indexes = list(db[name].list_search_indexes())
        except Exception:
            continue  # a view, or a collection we cannot introspect
        found.extend((name, ix["name"]) for ix in indexes)
    return found


def assert_room_for_index(db, wanted: str, limit: int = M0_SEARCH_INDEX_LIMIT) -> None:
    """Raise SearchIndexBudgetExceeded if creating `wanted` would exceed `limit`.

    Call this only when `wanted` does not already exist, so an index that is
    already there never trips it.
    """
    existing = list_all_search_indexes(db)
    if len(existing) >= limit:
        raise SearchIndexBudgetExceeded(wanted, existing, limit)


class ScratchCollectionExists(RuntimeError):
    """Raised when a scratch collection already exists and is not ours to reuse."""

    def __init__(self, name: str, env_var: str):
        super().__init__(
            f'"{name}" already exists on this cluster. This notebook creates that '
            "collection and drops it during housekeeping, so it will not reuse or "
            "overwrite one it did not create -- the contents might be yours.\n\n"
            "If it is a leftover from an interrupted run of this notebook, drop it (and "
            f"any search index on it) and re-run. If it is your data, set {env_var} in "
            "your .env to a name this notebook can own."
        )


def claim_scratch_collection(
    db, name: str, *, env_var: str = "LANGCHAIN_AUTO_EMBED_COLLECTION"
) -> str:
    """Claim `name` as a scratch collection this run owns, or raise if it exists.

    Pairing this with a drop at the end is what makes a run idempotent *without*
    an unconditional drop at the start: the destructive step is then only ever
    reachable for a collection we just created.
    """
    if name in db.list_collection_names():
        raise ScratchCollectionExists(name, env_var)
    return name
