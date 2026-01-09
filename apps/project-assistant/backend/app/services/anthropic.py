import logging
from typing import Literal, Optional

import anthropic
from pydantic import BaseModel

from app.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from app.services.prompts import (
    SYSTEM_PROMPT,
    MEMORY_EXTRACTION_PROMPT,
)

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


class MemoryItem(BaseModel):
    type: Literal["todo", "semantic", "procedural"]
    content: str


class MemoriesOutput(BaseModel):
    memories: list[MemoryItem]


def extract_memories(user_message: str) -> list[dict]:
    """Extract structured memories from a conversation."""
    logger.info(f"Extracting memories using {ANTHROPIC_MODEL}")

    try:
        response = client.beta.messages.parse(
            model=ANTHROPIC_MODEL,
            max_tokens=2000,
            temperature=1,
            betas=["structured-outputs-2025-11-13"],
            system=MEMORY_EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            output_format=MemoriesOutput,
        )
        memories = [
            {"type": m.type, "content": m.content}
            for m in response.parsed_output.memories
        ]
        logger.info(f"Extracted {len(memories)} memories: {memories}")
        return memories
    except Exception as e:
        logger.error(f"Failed to extract memories: {e}")
        return []


def generate_response(messages: list[dict], memories: Optional[list[str]] = None):
    """Generate a response with extended thinking."""
    logger.info(
        f"Generating response using {ANTHROPIC_MODEL} with {len(memories) if memories else 0} memories"
    )

    system_prompt = SYSTEM_PROMPT
    if memories:
        memory_context = "\n".join(f"- {m}" for m in memories)
        system_prompt += f"\n\nMemories about this user:\n{memory_context}"

    with client.messages.stream(
        model=ANTHROPIC_MODEL,
        max_tokens=16000,
        temperature=1,
        thinking={
            "type": "enabled",
            "budget_tokens": 8000,
        },
        system=system_prompt,
        messages=messages,
    ) as stream:
        for event in stream:
            if event.type == "content_block_delta":
                if hasattr(event.delta, "thinking"):
                    yield {"type": "thinking", "content": event.delta.thinking}
                elif hasattr(event.delta, "text"):
                    yield {"type": "response", "content": event.delta.text}
