import os
from functools import lru_cache

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database

load_dotenv()


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    server_selection_timeout_ms = int(os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000"))
    # Keep driver pool defaults for this low-concurrency demo, but fail fast
    # during rehearsals if the configured Atlas/local endpoint is unreachable.
    return MongoClient(
        uri,
        appname="ambient-inventory-agent",
        serverSelectionTimeoutMS=server_selection_timeout_ms,
    )


def get_database() -> Database:
    database_name = os.getenv("MONGODB_DATABASE", "ambient_inventory_agent")
    return get_client()[database_name]
