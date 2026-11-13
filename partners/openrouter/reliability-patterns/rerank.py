"""Rerank candidate chunks with Voyage AI via OpenRouter."""

import asyncio
import logging

from config import (
    RERANK_MODEL,
    RERANK_TIMEOUT_S,
    TOP_N,
    openrouter_client,
)


async def call_reranker(question: str, documents: list[str]):
    """Rerank documents within a time limit."""
    async with asyncio.timeout(RERANK_TIMEOUT_S):
        return await openrouter_client.rerank.rerank_async(
            model=RERANK_MODEL, query=question, documents=documents, top_n=TOP_N
        )


async def rerank(question: str, chunks: list[dict]) -> tuple[list[dict], str]:
    """Return the top chunks (reranked if possible) and a status message."""
    try:
        response = await call_reranker(question, [chunk["text"] for chunk in chunks])
        reranked = [chunks[result.index] for result in response.results]
    except Exception as error:
        logging.warning("Reranking failed: %s: %s", type(error).__name__, error)
        return chunks[:TOP_N], "reranking skipped (error)"
    return reranked, "reranked"
