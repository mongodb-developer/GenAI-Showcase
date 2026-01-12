import logging
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse

from app.config import USER_ID, VECTOR_INDEX_NAME, VECTOR_NUM_CANDIDATES
from app.routers.helpers import (
    extract_and_save_memories,
    get_conversation_history,
    image_to_base64,
    retrieve_relevant_memories,
    save_assistant_message,
    save_image_file,
    save_user_message,
)
from app.services.anthropic import generate_response
from app.services.mongodb import get_database
from app.services.voyage import get_multimodal_embedding, get_text_embedding

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{project_id}/messages")
def send_message(
    project_id: str,
    content: Optional[str] = Form(None),
    images: list[UploadFile] = File([]),
    version: int = Form(1),
    project_date: Optional[str] = Form(None),
    project_title: str = Form(...),
):
    db = get_database()
    is_v2 = version == 2
    msg_date = datetime.fromisoformat(project_date)

    # Save image files to disk
    image_paths = [save_image_file(image) for image in images]

    # Build current message (text, images, or both)
    messages = []
    if content:
        messages.append({"type": "text", "text": content})
    for path in image_paths:
        messages.append(image_to_base64(path))

    # Get conversation history and add current message
    conversation = get_conversation_history(db, project_id)
    if messages:
        conversation.append({"role": "user", "content": messages})

    # Retrieve relevant memories for context (V2 only)
    memories = retrieve_relevant_memories(db, content) if is_v2 and content else []

    def stream_and_save():
        response_content = ""
        for text in generate_response(conversation, memories=memories):
            yield text
            response_content += text

        # Save messages to DB after streaming completes
        if content:
            save_user_message(db, project_id, project_title, content, version, msg_date)
        for path in image_paths:
            save_user_message(db, project_id, project_title, path, version, msg_date)
        save_assistant_message(
            db, project_id, project_title, response_content, version, msg_date
        )

    return StreamingResponse(stream_and_save(), media_type="text/plain")


@router.get("/search")
def search_projects(q: str, version: int = 1):
    """Search projects using vector search."""
    db = get_database()
    logger.info(f"Searching projects with query: {q[:50]}... (version={version})")

    # Use appropriate embedding based on version
    if version == 2:
        query_embedding = get_multimodal_embedding(q, mode="text", input_type="query")
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
                "project_id": 1,
                "project_title": 1,
                "content": 1,
                "image": 1,
                "created_at": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
        {
            "$group": {
                "_id": "$project_id",
                "project_title": {"$first": "$project_title"},
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

    logger.info(f"Search returned {len(results)} projects")
    return results


@router.post("/")
def create_project(version: int = Form(1), title: str = Form(...)):
    db = get_database()
    project_data = {
        "user_id": USER_ID,
        "title": title,
        "version": version,
        "created_at": datetime.now(),
    }
    result = db.projects.insert_one(project_data)
    logger.info(f"Created project '{title}' for user {USER_ID}")
    return {"_id": str(result.inserted_id)}


@router.post("/{project_id}/save")
def save_project(
    project_id: str, project_date: str = Form(...), project_title: str = Form(...)
):
    """Extract and save memories from the conversation."""
    db = get_database()
    conversation = get_conversation_history(db, project_id, include_images=False)

    if not conversation:
        return {"error": "No messages in project"}

    extract_and_save_memories(
        db,
        project_id,
        project_title,
        conversation,
        datetime.fromisoformat(project_date),
    )

    return {"success": True}


@router.get("/")
def get_projects(version: int = 1):
    db = get_database()
    query = {"user_id": USER_ID, "version": version}
    projects = list(db.projects.find(query).sort("created_at", -1))
    for project in projects:
        project["_id"] = str(project["_id"])
    return projects


@router.get("/{project_id}/messages")
def get_messages(project_id: str):
    db = get_database()
    messages = list(db.messages.find({"project_id": project_id}).sort("created_at", 1))
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        msg.pop("embedding", None)
    return messages


@router.delete("/{project_id}")
def delete_project(project_id: str):
    db = get_database()
    db.projects.delete_one({"_id": ObjectId(project_id)})
    messages = db.messages.delete_many({"project_id": project_id})
    logger.info(f"Deleted project {project_id}: {messages.deleted_count} messages")
    return {"deleted": True}
