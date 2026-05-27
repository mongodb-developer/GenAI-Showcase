from typing import Optional

from pymongo import MongoClient
from pymongo.collection import Collection

from rail_rag.config import (
    MONGODB_URI,
    MONGO_DB_NAME,
    MONGO_COLLECTION_NAME,
)


def get_mongo_collection(
    uri: Optional[str] = None,
    db_name: Optional[str] = None,
    coll_name: Optional[str] = None,
) -> Collection:

    uri = uri or MONGODB_URI
    db_name = db_name or MONGO_DB_NAME
    coll_name = coll_name or MONGO_COLLECTION_NAME

    if not uri:
        raise RuntimeError("Missing MONGODB_URI in environment.")

    client = MongoClient(uri)
    db = client[db_name]
    coll = db[coll_name]
    return coll

