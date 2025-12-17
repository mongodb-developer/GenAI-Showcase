import logging
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, File, Form, UploadFile

from app.config import USER_ID, VECTOR_INDEX_NAME, VECTOR_NUM_CANDIDATES
from app.routers.helpers import (
    extract_and_save_memories,
    get_conversation_history,
    get_longest_streak,
    get_mood_distribution,
    get_themes,
    get_total_entries,
    retrieve_relevant_memories,
    save_assistant_message,
    save_image_file,
    save_user_message,
)
from app.services.mongodb import get_database
from app.services.anthropic import analyze_entry, generate_journal_prompt, generate_response
from app.services.voyage import get_multimodal_embedding, get_text_embedding

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/")
def create_entry(version: int = Form(1), entry_date: str = Form(...)):
    db = get_database()
    entry_dt = datetime.fromisoformat(entry_date)
    entry_data = {
        "user_id": USER_ID,
        "title": entry_dt.strftime("%d/%m/%Y"),
        "version": version,
        "created_at": entry_dt,
    }
    result = db.entries.insert_one(entry_data)
    logger.info(f"Created entry {result.inserted_id} for user {USER_ID}")
    return {"_id": str(result.inserted_id)}


@router.get("/")
def get_entries(version: int = 1):
    db = get_database()
    query = {"user_id": USER_ID, "version": version}
    entries = list(db.entries.find(query).sort("created_at", -1))
    for entry in entries:
        entry["_id"] = str(entry["_id"])
    return entries


@router.get("/search")
def search_entries(q: str, version: int = 1):
    """Search entries using vector search, grouped by entry."""
    db = get_database()
    logger.info(f"Searching entries with query: {q[:50]}... (version={version})")

    # Use appropriate embedding based on version
    if version == 2:
        query_embedding = get_multimodal_embedding(
            q, mode="text", input_type="query"
        )
    else:
        query_embedding = get_text_embedding(q, input_type="query")

    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": VECTOR_NUM_CANDIDATES,
                "limit": 20,
                "filter": {"user_id": USER_ID, "version": version},
            }
        },
        {
            "$project": {
                "entry_id": 1,
                "content": 1,
                "image": 1,
                "created_at": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
        {
            "$group": {
                "_id": "$entry_id",
                "content": {"$first": "$content"},
                "image": {"$first": "$image"},
                "created_at": {"$first": "$created_at"},
                "score": {"$max": "$score"},
            }
        },
        {"$sort": {"score": -1}},
        {"$limit": 5},
    ]

    results = list(db.messages.aggregate(pipeline))
    for result in results:
        result["_id"] = str(result["_id"])

    logger.info(f"Search returned {len(results)} entries")
    return results


@router.post("/generate-prompt")
def generate_prompt(entry_id: str = Form(...), entry_date: str = Form(...)):
    """Generate a journal prompt based on the last month's memories."""
    db = get_database()
    one_month_ago = datetime.now() - timedelta(days=30)

    memories = list(
        db.memories.find(
            {"user_id": USER_ID, "created_at": {"$gte": one_month_ago}},
            {"content": 1, "created_at": 1, "_id": 0},
        )
    )
    memory_contents = [
        f"Date: {m['created_at'].strftime('%Y-%m-%d')}, Memory: {m['content']}"
        for m in memories
    ]
    logger.info(f"Found {len(memory_contents)} memories from the last month")

    prompt = generate_journal_prompt(memory_contents)

    # Save the prompt as an assistant message
    msg_date = datetime.fromisoformat(entry_date)
    prompt_msg = {
        "entry_id": entry_id,
        "role": "assistant",
        "content": prompt,
        "created_at": msg_date,
    }
    db.messages.insert_one(prompt_msg)
    logger.info(f"Saved generated prompt for entry {entry_id}")

    return {"prompt": prompt}


@router.get("/{entry_id}/messages")
def get_messages(entry_id: str):
    db = get_database()
    messages = list(
        db.messages.find({"entry_id": entry_id}).sort("created_at", 1)
    )
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        msg.pop("embedding", None)
    return messages


@router.post("/{entry_id}/messages")
def send_message(
    entry_id: str,
    content: Optional[str] = Form(None),
    images: list[UploadFile] = File([]),
    version: int = Form(1),
    entry_date: Optional[str] = Form(None),
):
    db = get_database()
    is_v2 = version == 2
    msg_date = datetime.fromisoformat(entry_date)
    logger.info(f"Processing message for entry {entry_id} (v{version})")

    # Save user messages
    if content:
        save_user_message(db, entry_id, content, version, msg_date)
    for image_file in images:
        image_path = save_image_file(image_file)
        save_user_message(db, entry_id, image_path, version, msg_date)

    # V2 only: Extract and retrieve memories
    retrieved_memories = []
    if is_v2 and content:
        extract_and_save_memories(db, entry_id, msg_date)
        retrieved_memories = retrieve_relevant_memories(db, content)

    # Generate and save AI response
    conversation = get_conversation_history(db, entry_id)
    ai_content = generate_response(conversation, memories=retrieved_memories)
    save_assistant_message(db, entry_id, ai_content, msg_date)

    return {"response": ai_content}


@router.post("/{entry_id}/analyze")
def save_entry(entry_id: str):
    """Analyze entry for sentiment and themes."""
    db = get_database()
    conversation = get_conversation_history(db, entry_id)

    if not conversation:
        return {"error": "No messages in entry"}

    analysis = analyze_entry(conversation)

    db.entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {
            "sentiment": analysis["sentiment"],
            "themes": analysis["themes"],
        }}
    )

    logger.info(f"Analyzed entry {entry_id}: {analysis}")
    return analysis


@router.get("/insights")
def get_insights():
    """Get user insights: stats, mood distribution, and themes."""
    db = get_database()
    return {
        "total_entries": get_total_entries(db, USER_ID),
        "longest_streak": get_longest_streak(db, USER_ID),
        "mood": get_mood_distribution(db, USER_ID),
        "themes": get_themes(db, USER_ID),
    }


@router.delete("/{entry_id}")
def delete_entry(entry_id: str):
    db = get_database()
    db.entries.delete_one({"_id": ObjectId(entry_id)})
    messages = db.messages.delete_many({"entry_id": entry_id})
    memories = db.memories.delete_many({"entry_id": entry_id})
    logger.info(
        f"Deleted entry {entry_id}: "
        f"{messages.deleted_count} messages, {memories.deleted_count} memories"
    )
    return {"deleted": True}
