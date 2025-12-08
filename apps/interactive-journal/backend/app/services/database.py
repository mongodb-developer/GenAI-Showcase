from pymongo import MongoClient

from app.config import get_settings

settings = get_settings()

client: MongoClient = None
db = None


def connect_db():
    global client, db
    client = MongoClient(settings.mongodb_uri)
    db = client[settings.database_name]
    # Test connection
    client.admin.command("ping")
    print(f"Connected to MongoDB: {settings.database_name}")


def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


def get_database():
    return db
