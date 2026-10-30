"""Generate a cited answer with an LLM via OpenRouter, with model fallbacks."""

import asyncio
import json

from config import LLM_MODELS, LLM_TIMEOUT_S, MAX_TOKENS, openrouter_client

SYSTEM_PROMPT = (
    "Answer the question using only the numbered sources. "
    "Cite sources inline by number in square brackets, like [1], "
    "and list every source number you cite in `citations`."
)

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "citations": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["answer", "citations"],
    "additionalProperties": False,
}


def build_prompt(question: str, chunks: list[dict]) -> str:
    sources = "\n\n".join(
        f"[{i}] {chunk['title']}\n{chunk['text']}"
        for i, chunk in enumerate(chunks, start=1)
    )
    return f"Sources:\n\n{sources}\n\nQuestion: {question}"


def check_answer(result: dict, num_sources: int) -> None:
    """Raise ValueError unless the answer is non-empty and cites real sources."""
    if not result["answer"].strip():
        raise ValueError("the answer is empty")
    if not result["citations"]:
        raise ValueError("the answer cites no sources")
    unknown = set(result["citations"]) - set(range(1, num_sources + 1))
    if unknown:
        raise ValueError(
            f"the answer cites sources that don't exist: {sorted(unknown)}"
        )


async def generate(question: str, chunks: list[dict]) -> tuple[str, str]:
    """Return the answer and the model that wrote it."""
    async with asyncio.timeout(LLM_TIMEOUT_S):
        response = await openrouter_client.chat.send_async(
            # OpenRouter tries each model in order, and each model's providers in turn.
            models=LLM_MODELS,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_prompt(question, chunks)},
            ],
            max_tokens=MAX_TOKENS,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "cited_answer",
                    "strict": True,
                    "schema": ANSWER_SCHEMA,
                },
            },
            # Only route to providers that can enforce the schema.
            provider={"require_parameters": True},
        )
    choice = response.choices[0]
    if choice.finish_reason != "stop":
        raise ValueError(f"generation ended with {choice.finish_reason!r}")
    result = json.loads(choice.message.content)
    check_answer(result, len(chunks))
    return result["answer"], response.model
