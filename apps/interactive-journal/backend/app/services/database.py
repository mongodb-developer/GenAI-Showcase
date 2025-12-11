import logging

from pymongo import MongoClient
from pymongo.errors import OperationFailure

from app.config import (
    DATABASE_NAME,
    MONGODB_URI,
    VECTOR_DIMENSIONS,
    VECTOR_INDEX_NAME,
)

logger = logging.getLogger(__name__)

client: MongoClient = None
db = None


def connect_db():
    global client, db
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    client.admin.command("ping")
    logger.info(f"Connected to MongoDB: {DATABASE_NAME}")


def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_database():
    return db


# Track which collections have had their vector index created this session
_index_created = set()


def vector_index_exists(collection_name: str) -> bool:
    """Create vector search index on first write to a collection.

    The index includes a filter field for user_id to support filtered vector search.
    """
    if db is None:
        logger.error("Database not connected")
        return False

    if collection_name in _index_created:
        return True

    collection = getattr(db, collection_name)

    # Check if index already exists
    existing_indexes = list(collection.list_search_indexes())
    if any(idx.get("name") == VECTOR_INDEX_NAME for idx in existing_indexes):
        logger.info(f"Vector index already exists on {collection_name}")
        _index_created.add(collection_name)
        return True

    index_model = {
        "name": VECTOR_INDEX_NAME,
        "type": "vectorSearch",
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "numDimensions": VECTOR_DIMENSIONS,
                    "path": "embedding",
                    "similarity": "cosine",
                },
                {
                    "type": "filter",
                    "path": "user_id",
                },
            ]
        },
    }

    try:
        logger.info(f"Creating vector_index on {collection_name}")
        collection.create_search_index(model=index_model)
        logger.info(f"Vector search index created on {collection_name}")
        _index_created.add(collection_name)
        return True
    except OperationFailure as e:
        logger.error(f"OperationFailure creating index on {collection_name}: {e}")
        return False
    except Exception as e:
        logger.error(f"Error creating vector search index on {collection_name}: {e}")
        return False
