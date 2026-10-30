"""Find candidate chunks with vector search, falling back to keyword search."""

import logging

import pymongo
from config import (
    COLLECTION_NAME,
    FTS_INDEX,
    QUERY_MODELS,
    RERANK_CANDIDATES,
    SEARCH_TIMEOUT_S,
    VECTOR_INDEX,
    db,
)
from pymongo.errors import PyMongoError

collection = db[COLLECTION_NAME]
PROJECTION = {"$project": {"_id": 0, "title": 1, "url": 1, "text": 1}}


async def vector_search(question: str, model: str) -> list[dict]:
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX,
                "path": "text",
                # Atlas embeds the query text with this model.
                "query": question,
                "model": model,
                # Approximate search considers 10x more neighbors than it returns.
                "numCandidates": RERANK_CANDIDATES * 10,
                "limit": RERANK_CANDIDATES,
            }
        },
        PROJECTION,
    ]
    return await run_pipeline(pipeline)


async def keyword_search(question: str) -> list[dict]:
    pipeline = [
        {
            "$search": {
                "index": FTS_INDEX,
                "text": {"query": question, "path": ["title", "text"]},
            }
        },
        {"$limit": RERANK_CANDIDATES},
        PROJECTION,
    ]
    return await run_pipeline(pipeline)


async def run_pipeline(pipeline: list[dict]) -> list[dict]:
    # The server stops the query once the timeout passes, not just the client.
    with pymongo.timeout(SEARCH_TIMEOUT_S):
        cursor = await collection.aggregate(pipeline)
        return await cursor.to_list()


async def search(question: str) -> tuple[list[dict], str]:
    """Return candidate chunks and how they were found."""
    for model in QUERY_MODELS:
        try:
            return await vector_search(question, model), f"vector search ({model})"
        except PyMongoError as error:
            logging.warning("Vector search with %s failed: %s", model, error)
    return await keyword_search(question), "keyword search"
