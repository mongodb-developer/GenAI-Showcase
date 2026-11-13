"""Generate a cited answer with an LLM via OpenRouter, with model fallbacks."""

import asyncio
import json
import logging

from config import LLM_MODELS, LLM_TIMEOUT_S, MAX_TOKENS, openrouter_client

SYSTEM_PROMPT = (
    "Answer the question using only the numbered sources, "
    "and list the number of every source you used in `citations`. "
    "If the sources don't answer the question, say so and leave `citations` empty. "
    "Don't mention source numbers in the answer."
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
    """Number the sources so the model can cite them."""
    sources = "\n\n".join(
        f"[{i}] {chunk['title']}\n{chunk['text']}"
        for i, chunk in enumerate(chunks, start=1)
    )
    return f"Sources:\n\n{sources}\n\nQuestion: {question}"


def check_answer(result: dict, num_sources: int) -> None:
    """Raise ValueError if the answer is empty or cites incorrect sources."""
    if not result["answer"].strip():
        raise ValueError("the answer is empty")
    unknown = set(result["citations"]) - set(range(1, num_sources + 1))
    if unknown:
        raise ValueError(
            f"the answer cites sources that don't exist: {sorted(unknown)}"
        )


async def call_llm(messages: list[dict]) -> tuple[dict, str]:
    """Return the parsed answer and the model that wrote it."""
    async with asyncio.timeout(LLM_TIMEOUT_S):
        response = await openrouter_client.chat.send_async(
            # OpenRouter tries each model in order, and each model's providers in turn.
            models=LLM_MODELS,
            messages=messages,
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
    # A cut-off or filtered answer would end the same way if asked again.
    if choice.finish_reason != "stop":
        raise ValueError(f"generation ended with {choice.finish_reason!r}")
    return json.loads(choice.message.content), response.model


async def generate(question: str, chunks: list[dict]) -> tuple[dict, str]:
    """Return the answer and its model, re-asking once if its citations are invalid."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_prompt(question, chunks)},
    ]
    result, model = await call_llm(messages)
    # No citations means the sources don't cover the question, so there's nothing to check.
    if not result["citations"]:
        return result, model
    try:
        check_answer(result, len(chunks))
    except ValueError as error:
        logging.warning("Re-asking because %s", error)
        messages += [
            {"role": "assistant", "content": json.dumps(result)},
            {
                "role": "user",
                "content": f"That answer is invalid because {error}. "
                f"Answer again, citing only sources 1 to {len(chunks)}.",
            },
        ]
        result, model = await call_llm(messages)
        check_answer(result, len(chunks))
    return result, model
