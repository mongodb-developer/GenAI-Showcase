import logging
from datetime import datetime
from typing import Literal, Optional

import anthropic
from pydantic import BaseModel

from app.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from app.services.prompts import (
    INSIGHTS_PROMPT,
    JOURNAL_SYSTEM_PROMPT,
    MEMORY_EXTRACTION_PROMPT,
    PROMPT_GENERATOR,
)

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


class MemoriesOutput(BaseModel):
    memories: list[str]


class EntryAnalysis(BaseModel):
    sentiment: Literal["positive", "negative", "neutral", "mixed"]
    themes: list[str]


def extract_memories(user_message: str) -> list[str]:
    """Extract memories/insights from a user's journal entry."""
    logger.info(f"Extracting memories using {ANTHROPIC_MODEL}")

    try:
        response = client.beta.messages.parse(
            model=ANTHROPIC_MODEL,
            max_tokens=500,
            temperature=0.8,
            betas=["structured-outputs-2025-11-13"],
            system=MEMORY_EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            output_format=MemoriesOutput,
        )
        memories = response.parsed_output.memories
        logger.info(f"Extracted {len(memories)} memories")
        return memories
    except Exception as e:
        logger.error(f"Failed to extract memories: {e}")
        return []


def analyze_entry(conversation: list[dict]) -> dict:
    """Analyze a journal entry for sentiment and themes."""
    logger.info(f"Analyzing entry with {len(conversation)} messages")

    content = "\n".join(f"{msg['role']}: {msg['content']}" for msg in conversation)

    try:
        response = client.beta.messages.parse(
            model=ANTHROPIC_MODEL,
            max_tokens=200,
            temperature=0.8,
            betas=["structured-outputs-2025-11-13"],
            system=INSIGHTS_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_format=EntryAnalysis,
        )
        result = {
            "sentiment": response.parsed_output.sentiment,
            "themes": response.parsed_output.themes,
        }
        logger.info(f"Entry analysis: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to analyze entry: {e}")
        return {"sentiment": "neutral", "themes": []}


def generate_response(messages: list[dict], memories: Optional[list[str]] = None):
    """Generate a streaming response using Anthropic's Claude."""
    logger.info(
        f"Generating response using {ANTHROPIC_MODEL} with {len(memories) if memories else 0} memories"
    )

    system_prompt = JOURNAL_SYSTEM_PROMPT
    if memories:
        memory_context = "\n".join(f"- {m}" for m in memories)
        system_prompt += f"\n\nMemories about this user:\n{memory_context}"

    with client.messages.stream(
        model=ANTHROPIC_MODEL,
        max_tokens=500,
        temperature=0.8,
        system=system_prompt,
        messages=messages,
    ) as stream:
        yield from stream.text_stream


def generate_journal_prompt(memories: list[str]) -> str:
    """Generate a reflective journal prompt based on past memories."""
    logger.info(f"Generating journal prompt from {len(memories)} memories")

    if not memories:
        return "What's on your mind today?"

    today = datetime.now().strftime("%Y-%m-%d")
    memory_context = "\n".join(f"- {m}" for m in memories)
    user_content = f"Today's date: {today}\n\nMemories:\n{memory_context}"

    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=150,
        temperature=0.8,
        system=PROMPT_GENERATOR,
        messages=[{"role": "user", "content": user_content}],
    )

    return response.content[0].text
