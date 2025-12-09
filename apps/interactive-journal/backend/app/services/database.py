import logging
import os

from pymongo import MongoClient
from pymongo.errors import OperationFailure

logger = logging.getLogger(__name__)

client: MongoClient = None
db = None


def connect_db():
    global client, db
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "memoir")
    client = MongoClient(uri)
    db = client[db_name]
    client.admin.command("ping")
    logger.info(f"Connected to MongoDB: {db_name}")


def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_database():
    return db


def create_vector_index():
    """Create vector search indexes on messages and memories collections."""
    if db is None:
        return False

    # Index config (same for both collections)
    index_model = {
        "name": "vector_index",
        "type": "vectorSearch",
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "numDimensions": 1024,
                    "path": "embedding",
                    "similarity": "cosine",
                }
            ]
        },
    }

    success = True
    for collection in ["messages", "memories"]:
        try:
            logger.info(f"Creating vector_index on {collection}")
            getattr(db, collection).create_search_index(model=index_model)
            logger.info(f"Vector search index created on {collection}")
        except OperationFailure:
            logger.info(f"Vector search index on {collection} already exists")
        except Exception as e:
            logger.error(f"Error creating vector search index on {collection}: {e}")
            success = False

    return success
