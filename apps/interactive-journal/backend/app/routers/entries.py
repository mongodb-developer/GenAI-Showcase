import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, File, Form, UploadFile

from app.services.database import create_vector_index, get_database
from app.services.openai_service import extract_memories, generate_response
from app.services.voyage_service import get_embedding, get_text_embedding

logger = logging.getLogger(__name__)

# Store images in frontend's public folder for direct access
UPLOADS_DIR = (
    Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "uploads"
)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


router = APIRouter()

USER_ID = "Apoorva"


def utc_now():
    return datetime.now(timezone.utc)


@router.post("/")
def create_entry(version: int = Form(1)):
    db = get_database()
    now = utc_now()
    entry_data = {
        "user_id": USER_ID,
        "title": now.strftime("%d/%m/%Y"),
        "version": version,
        "created_at": now,
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


@router.post("/init-v2")
def init_v2():
    """Initialize V2 features by creating the vector search index."""
    success = create_vector_index()
    return {"success": success}


@router.get("/search")
def search_entries(q: str):
    """Search through entries using MongoDB Atlas Vector Search."""
    db = get_database()
    logger.info(f"Searching entries with query: {q[:50]}...")

    query_embedding = get_embedding(q, mode="text", input_type="query")

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": 100,
                "limit": 10,
            }
        },
        {
            "$project": {
                "_id": 1,
                "entry_id": 1,
                "content": 1,
                "image": 1,
                "role": 1,
                "created_at": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    results = list(db.messages.aggregate(pipeline))
    for result in results:
        result["_id"] = str(result["_id"])

    logger.info(f"Search returned {len(results)} results")
    return results


@router.get("/{entry_id}/messages")
def get_messages(entry_id: str):
    db = get_database()
    messages = list(db.messages.find({"entry_id": entry_id}).sort("created_at", 1))
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
):
    db = get_database()
    is_v2 = version == 2
    logger.info(f"Processing message for entry {entry_id} (v{version})")

    # Save text message if provided
    if content:
        embedding = get_embedding(content, mode="text", input_type="document")
        text_msg = {
            "entry_id": entry_id,
            "role": "user",
            "content": content,
            "embedding": embedding,
            "created_at": utc_now(),
        }
        db.messages.insert_one(text_msg)
        logger.info(f"Saved text message for entry {entry_id}")

    # Save each image as a separate message
    for image_file in images:
        filename = f"{uuid.uuid4()}{Path(image_file.filename).suffix or '.jpg'}"
        image_path = UPLOADS_DIR / filename
        with open(image_path, "wb") as f:
            f.write(image_file.file.read())

        embedding = get_embedding(image_path, mode="image", input_type="document")
        image_msg = {
            "entry_id": entry_id,
            "role": "user",
            "image": filename,
            "embedding": embedding,
            "created_at": utc_now(),
        }
        db.messages.insert_one(image_msg)
        logger.info(f"Saved image {filename} for entry {entry_id}")

    # V2 only: Extract and save memories, then retrieve relevant ones
    retrieved_memories = []
    if is_v2 and content:
        # Extract memories from user message
        memories = extract_memories(content)
        if memories:
            memory_docs = []
            for memory_content in memories:
                memory_embedding = get_text_embedding(
                    memory_content, input_type="document"
                )
                memory_docs.append(
                    {
                        "user_id": USER_ID,
                        "entry_id": entry_id,
                        "content": memory_content,
                        "embedding": memory_embedding,
                        "created_at": utc_now(),
                    }
                )
            db.memories.insert_many(memory_docs)
            logger.info(f"Extracted and saved {len(memories)} memories: {memories}")

        # Retrieve relevant memories via vector search
        query_embedding = get_text_embedding(content, input_type="query")
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": 100,
                    "limit": 10,
                    "filter": {"user_id": USER_ID},
                }
            },
            {"$project": {"content": 1, "score": {"$meta": "vectorSearchScore"}}},
        ]
        results = list(db.memories.aggregate(pipeline))
        retrieved_memories = [r["content"] for r in results]
        logger.info(f"Retrieved {len(retrieved_memories)} memories for context")

    # Get conversation history (text only for AI context)
    history = list(db.messages.find({"entry_id": entry_id}).sort("created_at", 1))
    conversation = []
    for msg in history:
        if msg.get("content"):
            conversation.append({"role": msg["role"], "content": msg["content"]})
        elif msg.get("image") and msg["role"] == "user":
            conversation.append({"role": "user", "content": "[User shared an image]"})

    # Generate AI response with retrieved memories
    ai_content = generate_response(conversation, memories=retrieved_memories)

    # Save AI response
    ai_msg = {
        "entry_id": entry_id,
        "role": "assistant",
        "content": ai_content,
        "created_at": utc_now(),
    }
    db.messages.insert_one(ai_msg)
    logger.info(f"Generated and saved AI response for entry {entry_id}")

    return {"response": ai_content}


@router.delete("/{entry_id}")
def delete_entry(entry_id: str):
    db = get_database()
    db.entries.delete_one({"_id": ObjectId(entry_id)})
    messages_deleted = db.messages.delete_many({"entry_id": entry_id})
    memories_deleted = db.memories.delete_many({"entry_id": entry_id})
    logger.info(
        f"Deleted entry {entry_id}: {messages_deleted.deleted_count} messages, "
        f"{memories_deleted.deleted_count} memories"
    )
    return {"deleted": True}
