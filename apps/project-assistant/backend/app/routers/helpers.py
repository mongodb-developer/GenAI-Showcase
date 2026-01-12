import base64
import logging
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from PIL import Image

from app.config import IMAGE_SIZE, USER_ID, VECTOR_INDEX_NAME, VECTOR_NUM_CANDIDATES
from app.services.anthropic import extract_memories
from app.services.voyage import get_multimodal_embedding, get_text_embedding

logger = logging.getLogger(__name__)

# Store images in frontend's public folder for direct access
UPLOADS_DIR = (
    Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "uploads"
)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def retrieve_relevant_memories(db, query: str) -> list[str]:
    """Retrieve relevant procedural and semantic memories via vector search."""
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


def save_user_message(
    db,
    project_id: str,
    project_title: str,
    content: str | Path,
    version: int,
    msg_date: datetime,
) -> None:
    """Save a user message (text or image) with its embedding."""
    message = {
        "project_id": project_id,
        "project_title": project_title,
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
    logger.info(f"Saved message for project {project_id}")


def extract_and_save_memories(
    db,
    project_id: str,
    project_title: str,
    conversation: list[dict],
    created_at: datetime,
) -> None:
    """Extract memories from conversation: todos, preferences, and procedures."""
    context = "\n".join(f"{msg['role']}: {msg['content']}" for msg in conversation)
    memories = extract_memories(context)

    if memories:
        memory_docs = []
        for memory in memories:
            doc = {
                "user_id": USER_ID,
                "project_id": project_id,
                "project_title": project_title,
                "type": memory["type"],
                "content": memory["content"],
                "created_at": created_at,
            }
            if memory["type"] != "todo":
                doc["embedding"] = get_text_embedding(
                    memory["content"], input_type="document"
                )
            memory_docs.append(doc)

        db.memories.insert_many(memory_docs)
        logger.info(f"Extracted and saved {len(memories)} items")


def get_conversation_history(
    db, project_id: str, include_images: bool = True
) -> list[dict]:
    """Get conversation history for a project."""
    history = list(
        db.messages.find(
            {"project_id": project_id}, {"role": 1, "content": 1, "image": 1, "_id": 0}
        ).sort("created_at", 1)
    )

    messages = []
    for msg in history:
        if msg.get("content"):
            messages.append({"role": msg["role"], "content": msg["content"]})
        elif msg.get("image") and include_images:
            image_path = UPLOADS_DIR / msg["image"]
            if image_path.exists():
                messages.append(
                    {
                        "role": msg["role"],
                        "content": [image_to_base64(image_path)],
                    }
                )
    return messages


def image_to_base64(image_path: Path) -> dict:
    """Convert an image file to Claude's base64 format, resizing to fit limits."""
    with Image.open(image_path) as img:
        img = img.resize(IMAGE_SIZE, Image.Resampling.LANCZOS)
        # Convert RGBA to RGB (JPEG doesn't support transparency)
        if img.mode == "RGBA":
            img = img.convert("RGB")
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        data = base64.standard_b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/jpeg", "data": data},
    }


def save_assistant_message(
    db,
    project_id: str,
    project_title: str,
    content: str,
    version: int,
    msg_date: datetime,
) -> None:
    """Save an assistant response message."""
    db.messages.insert_one(
        {
            "project_id": project_id,
            "project_title": project_title,
            "user_id": USER_ID,
            "role": "assistant",
            "version": version,
            "content": content,
            "created_at": msg_date,
        }
    )
    logger.info(f"Saved AI response for project {project_id}")


def save_image_file(image_file: UploadFile) -> Path:
    """Save uploaded image file."""
    filename = f"{uuid.uuid4()}{Path(image_file.filename).suffix or '.jpg'}"
    image_path = UPLOADS_DIR / filename
    with open(image_path, "wb") as f:
        f.write(image_file.file.read())
    return image_path
