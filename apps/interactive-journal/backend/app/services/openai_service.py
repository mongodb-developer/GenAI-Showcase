import json
import logging
import os
from typing import Optional

from openai import OpenAI

logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

JOURNAL_SYSTEM_PROMPT = """You are a thoughtful and empathetic AI journaling companion called Memoir.
Your role is to help users reflect on their thoughts, feelings, and experiences through conversation.

Guidelines:
- Ask thoughtful follow-up questions to help users explore their thoughts deeper
- Be supportive and non-judgmental
- Help users identify patterns and insights in their reflections
- Keep responses concise but meaningful
- Encourage self-reflection without being preachy
- If users share something difficult, acknowledge their feelings first

Remember: You're a journaling companion, not a therapist. Focus on reflection and exploration."""

MEMORY_EXTRACTION_PROMPT = """You are a memory extraction system. Analyze the user's journal entry and extract meaningful memories, insights, and facts about the user.

Extract information such as:
- Personal facts (relationships, work, hobbies, preferences)
- Emotional patterns and feelings
- Goals, aspirations, and plans
- Significant events or experiences
- Insights and realizations

Return a JSON array of memory strings. Each memory should be a concise, standalone statement ending in a period.
If no meaningful memories can be extracted, return an empty array.

Example output:
["User has a sister named Sarah.", "User feels anxious about their job interview next week.", "User enjoys morning walks."]"""


def extract_memories(user_message: str) -> list[str]:
    """Extract memories/insights from a user's journal entry."""
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    logger.info(f"Extracting memories using {model}")

    response = client.chat.completions.create(
        model=model,
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
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    logger.info(
        f"Generating response using {model} with {len(memories) if memories else 0} memories"
    )

    system_prompt = JOURNAL_SYSTEM_PROMPT
    if memories:
        memory_context = "\n".join(f"- {m}" for m in memories)
        system_prompt += f"\n\nRelevant memories about this user:\n{memory_context}\n\nUse these memories to provide more personalized and contextual responses when relevant."

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system_prompt}, *messages],
        temperature=0.7,
        max_tokens=500,
    )

    logger.info("Response generated successfully")
    return response.choices[0].message.content
