"""Rerank candidate chunks with Voyage AI via OpenRouter, behind a circuit breaker."""

import asyncio
import logging

import httpx
from circuitbreaker import CircuitBreakerError, circuit
from config import (
    BREAKER_COOLDOWN_S,
    BREAKER_FAILURE_THRESHOLD,
    RERANK_MODEL,
    RERANK_TIMEOUT_S,
    TOP_N,
    openrouter_client,
)
from openrouter import errors


def is_transient(error_type: type, error: Exception) -> bool:
    """Only rate limits, server errors, and timeouts count toward opening the circuit."""
    if isinstance(error, errors.OpenRouterError):
        return error.status_code == 429 or error.status_code >= 500
    return isinstance(
        error, (TimeoutError, httpx.TransportError, errors.NoResponseError)
    )


# The reranker has a single provider, so OpenRouter can't route around an outage.
@circuit(
    failure_threshold=BREAKER_FAILURE_THRESHOLD,
    recovery_timeout=BREAKER_COOLDOWN_S,
    expected_exception=is_transient,
)
async def call_reranker(question: str, documents: list[str]):
    async with asyncio.timeout(RERANK_TIMEOUT_S):
        return await openrouter_client.rerank.rerank_async(
            model=RERANK_MODEL, query=question, documents=documents, top_n=TOP_N
        )


async def rerank(question: str, chunks: list[dict]) -> tuple[list[dict], str]:
    """Return the top chunks (reranked if possible) and a status message."""
    try:
        response = await call_reranker(question, [chunk["text"] for chunk in chunks])
    except CircuitBreakerError:
        return chunks[:TOP_N], "reranking skipped (circuit open)"
    except Exception as error:
        logging.warning("Reranking failed: %s", error)
        return chunks[:TOP_N], "reranking skipped (error)"
    return [chunks[result.index] for result in response.results], "reranked"
