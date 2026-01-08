import logging

from pymongo import MongoClient
from pymongo.errors import CollectionInvalid, OperationFailure

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
    setup_collections()
    setup_indexes()


def setup_collections():
    for name in ["projects", "messages", "memories"]:
        try:
            db.create_collection(name)
            logger.info(f"Created collection: {name}")
        except CollectionInvalid:
            logger.info(f"Collection already exists: {name}")


def setup_indexes():
    create_vector_index("messages", filter_paths=["user_id", "version"])
    create_vector_index("memories", filter_paths=["user_id", "type"])


def create_vector_index(collection_name: str, filter_paths: list[str]):
    collection = db[collection_name]

    existing = list(collection.list_search_indexes())
    if any(idx.get("name") == VECTOR_INDEX_NAME for idx in existing):
        logger.info(f"Vector index already exists on {collection_name}")
        return

    fields = [
        {
            "type": "vector",
            "numDimensions": VECTOR_DIMENSIONS,
            "path": "embedding",
            "similarity": "cosine",
        },
    ] + [{"type": "filter", "path": p} for p in filter_paths]

    try:
        collection.create_search_index(
            model={
                "name": VECTOR_INDEX_NAME,
                "type": "vectorSearch",
                "definition": {"fields": fields},
            }
        )
        logger.info(f"Created vector index on {collection_name}")
    except OperationFailure as e:
        logger.error(f"Failed to create index on {collection_name}: {e}")


def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_database():
    return db
