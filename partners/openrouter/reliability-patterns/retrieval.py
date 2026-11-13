"""Find candidate chunks with vector search, falling back to keyword search."""

import asyncio
import logging

import pymongo
from config import (
    COLLECTION_NAME,
    EMBED_TIMEOUT_S,
    FTS_INDEX,
    QUERY_MODELS,
    RERANK_CANDIDATES,
    SEARCH_TIMEOUT_S,
    VECTOR_INDEX,
    db,
    openrouter_client,
)

collection = db[COLLECTION_NAME]
PROJECTION = {"$project": {"_id": 0, "title": 1, "url": 1, "text": 1}}


async def embed_query(question: str) -> tuple[list[float], str]:
    """Return the query embedding and the model that generated it."""
    for model in QUERY_MODELS:
        try:
            async with asyncio.timeout(EMBED_TIMEOUT_S):
                response = await openrouter_client.embeddings.generate_async(
                    model=model, input=[question], input_type="query"
                )
            return response.data[0].embedding, model
        except Exception as error:
            logging.warning(
                "Embedding with %s failed: %s: %s",
                model,
                type(error).__name__,
                error,
            )
    raise RuntimeError("every query model failed")


async def vector_search(query_vector: list[float]) -> list[dict]:
    """Find the chunks closest to the query vector."""
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX,
                "path": "embedding",
                "queryVector": query_vector,
                # Approximate search considers 10x more neighbors than it returns.
                "numCandidates": RERANK_CANDIDATES * 10,
                "limit": RERANK_CANDIDATES,
            }
        },
        PROJECTION,
    ]
    return await run_pipeline(pipeline)


async def keyword_search(question: str) -> list[dict]:
    """Find chunks that match the question's keywords."""
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
    """Run an aggregation pipeline against a MongoDB collection."""
    # The server stops the query once the timeout passes, not just the client.
    with pymongo.timeout(SEARCH_TIMEOUT_S):
        cursor = await collection.aggregate(pipeline)
        return await cursor.to_list()


async def search(question: str) -> tuple[list[dict], str]:
    """Retrieve candidate chunks."""
    try:
        query_vector, model = await embed_query(question)
        return await vector_search(query_vector), f"vector search ({model})"
    except Exception as error:
        logging.warning("Vector search failed: %s: %s", type(error).__name__, error)
    return await keyword_search(question), "keyword search"
