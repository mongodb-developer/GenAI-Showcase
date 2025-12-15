import json
import logging
from datetime import datetime
from typing import Optional

from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.services.prompts import (
    INSIGHTS_PROMPT,
    JOURNAL_SYSTEM_PROMPT,
    MEMORY_EXTRACTION_PROMPT,
    PROMPT_GENERATOR,
)

logger = logging.getLogger(__name__)

client = OpenAI(api_key=OPENAI_API_KEY)


def extract_memories(user_message: str) -> list[str]:
    """Extract memories/insights from a user's journal entry."""
    logger.info(f"Extracting memories using {OPENAI_MODEL}")

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": MEMORY_EXTRACTION_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=500,
        response_format={"type": "json_object"},
    )

    try:
        result = json.loads(response.choices[0].message.content)
        # Handle both {"memories": [...]} and direct array formats
        if isinstance(result, list):
            memories = result
        else:
            memories = result.get("memories", [])
        logger.info(f"Extracted {len(memories)} memories")
        return memories
    except (json.JSONDecodeError, AttributeError) as e:
        logger.error(f"Failed to parse memory extraction response: {e}")
        return []


def generate_response(
    messages: list[dict], memories: Optional[list[str]] = None
) -> str:
    """Generate a response using OpenAI's chat completion."""
    logger.info(
        f"Generating response using {OPENAI_MODEL} with {len(memories) if memories else 0} memories"
    )

    system_prompt = JOURNAL_SYSTEM_PROMPT
    if memories:
        memory_context = "\n".join(f"- {m}" for m in memories)
        system_prompt += f"\n\nRelevant memories about this user:\n{memory_context}\n\nUse these memories to provide more personalized and contextual responses when relevant."

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": system_prompt}, *messages],
        temperature=0.7,
        max_tokens=500,
    )

    logger.info("Response generated successfully")
    return response.choices[0].message.content


def generate_journal_prompt(memories: list[str]) -> str:
    """Generate a reflective journal prompt based on past memories."""
    logger.info(f"Generating journal prompt from {len(memories)} memories")

    if not memories:
        return "What's on your mind today?"

    today = datetime.now().strftime("%Y-%m-%d")
    memory_context = "\n".join(f"- {m}" for m in memories)
    user_content = f"Today's date: {today}\n\nMemories:\n{memory_context}"

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": PROMPT_GENERATOR},
            {"role": "user", "content": user_content},
        ],
        temperature=0.8,
        max_tokens=150,
    )

    return response.choices[0].message.content


def analyze_entry(conversation: list[dict]) -> dict:
    """Analyze a journal entry for sentiment and themes."""
    logger.info(f"Analyzing entry with {len(conversation)} messages")

    content = "\n".join(f"{msg['role']}: {msg['content']}" for msg in conversation)

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": INSIGHTS_PROMPT},
            {"role": "user", "content": content},
        ],
        temperature=0.8,
        max_tokens=200,
        response_format={"type": "json_object"},
    )

    try:
        result = json.loads(response.choices[0].message.content)
        logger.info(f"Entry analysis: {result}")
        return result
    except (json.JSONDecodeError, AttributeError) as e:
        logger.error(f"Failed to parse entry analysis: {e}")
        return {"sentiment": "neutral", "themes": []}
