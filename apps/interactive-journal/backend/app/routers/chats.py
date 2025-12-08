from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter

from app.models.schemas import Message
from app.services.database import get_database
from app.services.openai_service import generate_response

router = APIRouter()

USER_ID = "Apoorva"


@router.post("/")
def create_chat():
    db = get_database()
    chat_data = {
        "user_id": USER_ID,
        "title": datetime.utcnow().strftime("%d/%m/%Y"),
        "created_at": datetime.utcnow(),
    }
    result = db.chats.insert_one(chat_data)
    return {"_id": str(result.inserted_id)}


@router.get("/")
def get_chats():
    db = get_database()
    chats = list(db.chats.find({"user_id": USER_ID}).sort("created_at", -1))
    for chat in chats:
        chat["_id"] = str(chat["_id"])
    return chats


@router.get("/{chat_id}/messages")
def get_messages(chat_id: str):
    db = get_database()
    messages = list(db.messages.find({"chat_id": chat_id}).sort("created_at", 1))
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    return messages


@router.post("/{chat_id}/messages")
def send_message(chat_id: str, message: Message):
    db = get_database()

    # Save user message
    user_msg = {
        "chat_id": chat_id,
        "role": "user",
        "content": message.content,
        "created_at": datetime.utcnow(),
    }
    db.messages.insert_one(user_msg)

    # Get conversation history
    history = list(db.messages.find({"chat_id": chat_id}).sort("created_at", 1))
    conversation = [{"role": msg["role"], "content": msg["content"]} for msg in history]

    # Generate AI response
    ai_content = generate_response(conversation)

    # Save AI response
    ai_msg = {
        "chat_id": chat_id,
        "role": "assistant",
        "content": ai_content,
        "created_at": datetime.utcnow(),
    }
    db.messages.insert_one(ai_msg)

    return {"response": ai_content}


@router.delete("/{chat_id}")
def delete_chat(chat_id: str):
    db = get_database()
    db.chats.delete_one({"_id": ObjectId(chat_id)})
    db.messages.delete_many({"chat_id": chat_id})
    return {"deleted": True}
