import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import UploadFile

from app.config import USER_ID, VECTOR_INDEX_NAME, VECTOR_NUM_CANDIDATES
from app.services.anthropic import extract_memories
from app.services.voyage import get_multimodal_embedding, get_text_embedding

logger = logging.getLogger(__name__)

# Store images in frontend's public folder for direct access
UPLOADS_DIR = (
    Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "uploads"
)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def get_conversation_history(db, entry_id: str) -> list[dict]:
    """Get conversation history for an entry."""
    history = list(
        db.messages.find(
            {"entry_id": entry_id}, {"role": 1, "content": 1, "_id": 0}
        ).sort("created_at", 1)
    )
    return [
        {"role": msg["role"], "content": msg["content"]}
        for msg in history
        if msg.get("content")
    ]


def save_user_message(
    db, entry_id: str, content: str | Path, version: int, msg_date: datetime
) -> None:
    """Save a user message (text or image) with its embedding."""
    message = {
        "entry_id": entry_id,
        "user_id": USER_ID,
        "role": "user",
        "version": version,
        "created_at": msg_date,
    }

    if version == 2:
        is_image = isinstance(content, Path)
        mode = "image" if is_image else "text"
        message["embedding"] = get_multimodal_embedding(
            content, mode=mode, input_type="document"
        )
        if is_image:
            message["image"] = content.name
        else:
            message["content"] = content
    else:
        message["embedding"] = get_text_embedding(content, input_type="document")
        message["content"] = content

    db.messages.insert_one(message)
    logger.info(f"Saved message for entry {entry_id}")


def retrieve_relevant_memories(db, query: str) -> list[str]:
    """Retrieve relevant memories via vector search."""
    query_embedding = get_text_embedding(query, input_type="query")
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": VECTOR_NUM_CANDIDATES,
                "limit": 10,
                "filter": {"user_id": USER_ID},
            }
        },
        {"$project": {"content": 1, "score": {"$meta": "vectorSearchScore"}}},
    ]
    results = list(db.memories.aggregate(pipeline))
    memories = [r["content"] for r in results]
    logger.info(f"Retrieved {len(memories)} memories for context")
    return memories


def extract_and_save_memories(
    db, entry_id: str, conversation: list[dict], entry_date: datetime
) -> None:
    """Extract memories from conversation and save them."""
    context = "\n".join(f"{msg['role']}: {msg['content']}" for msg in conversation)
    memories = extract_memories(context)

    if memories:
        memory_docs = [
            {
                "user_id": USER_ID,
                "entry_id": entry_id,
                "content": memory_content,
                "embedding": get_text_embedding(memory_content, input_type="document"),
                "created_at": entry_date,
            }
            for memory_content in memories
        ]
        db.memories.insert_many(memory_docs)
        logger.info(f"Extracted and saved {len(memories)} memories: {memories}")


def save_assistant_message(db, entry_id: str, content: str, msg_date: datetime) -> None:
    """Save an assistant response message."""
    db.messages.insert_one(
        {
            "entry_id": entry_id,
            "role": "assistant",
            "content": content,
            "created_at": msg_date,
        }
    )
    logger.info(f"Saved AI response for entry {entry_id}")


def save_image_file(image_file: UploadFile) -> Path:
    """Save uploaded image file and return the path."""
    filename = f"{uuid.uuid4()}{Path(image_file.filename).suffix or '.jpg'}"
    image_path = UPLOADS_DIR / filename
    with open(image_path, "wb") as f:
        f.write(image_file.file.read())
    return image_path


def get_monthly_filter(user_id: str) -> dict:
    """Get common filter for monthly v2 entries."""
    thirty_days_ago = datetime.now() - timedelta(days=30)
    return {
        "user_id": user_id,
        "version": 2,
        "created_at": {"$gte": thirty_days_ago},
    }


def get_total_entries(db, user_id: str) -> int:
    """Get total entries count for past 30 days."""
    return db.entries.count_documents(get_monthly_filter(user_id))


def get_longest_streak(db, user_id: str) -> int:
    """Get longest consecutive days streak in past 30 days."""
    pipeline = [
        {"$match": get_monthly_filter(user_id)},
        {"$project": {"date": {"$dateTrunc": {"date": "$created_at", "unit": "day"}}}},
        {"$group": {"_id": "$date"}},
        {"$sort": {"_id": 1}},
    ]
    dates = [doc["_id"] for doc in db.entries.aggregate(pipeline)]

    if not dates:
        return 0

    longest = current = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1

    return longest


def get_mood_distribution(db, user_id: str) -> dict:
    """Get sentiment distribution for past 30 days."""
    filter = get_monthly_filter(user_id)
    filter["sentiment"] = {"$exists": True}
    pipeline = [
        {"$match": filter},
        {"$group": {"_id": "$sentiment", "count": {"$sum": 1}}},
    ]
    results = list(db.entries.aggregate(pipeline))
    counts = {r["_id"]: r["count"] for r in results}
    total = sum(counts.values()) or 1
    return {
        "positive": round(counts.get("positive", 0) / total * 100),
        "neutral": round(counts.get("neutral", 0) / total * 100),
        "mixed": round(counts.get("mixed", 0) / total * 100),
        "negative": round(counts.get("negative", 0) / total * 100),
    }


def get_themes(db, user_id: str) -> list[dict]:
    """Get all themes with counts for past 30 days."""
    filter = get_monthly_filter(user_id)
    filter["themes"] = {"$exists": True}
    pipeline = [
        {"$match": filter},
        {"$unwind": "$themes"},
        {"$group": {"_id": "$themes", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = list(db.entries.aggregate(pipeline))
    return [{"theme": r["_id"], "count": r["count"]} for r in results]
