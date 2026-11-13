"""Load the MongoDB docs dataset into Atlas and create its vector and keyword search indexes.

Needs MONGODB_URI in .env. Run: python load_data.py
"""

import logging
import os

from datasets import load_dataset
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel

HF_DATASET = "MongoDB/mongodb-docs-chunked"
DB_NAME = "docs_qa"
COLLECTION_NAME = "mongodb_docs"
VECTOR_INDEX = "vector_index"
FTS_INDEX = "fts_index"

logger = logging.getLogger(__name__)


def create_indexes(collection) -> None:
    """Create the vector search and keyword search indexes."""
    vector_index = SearchIndexModel(
        name=VECTOR_INDEX,
        type="vectorSearch",
        definition={
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": 1024,
                    "similarity": "cosine",
                },
                {"type": "filter", "path": "source_name"},
            ]
        },
    )
    search_index = SearchIndexModel(
        name=FTS_INDEX,
        type="search",
        definition={
            "mappings": {
                "dynamic": False,
                "fields": {
                    "title": {"type": "string"},
                    "text": {"type": "string"},
                },
            }
        },
    )
    collection.create_search_indexes([vector_index, search_index])


def main() -> None:
    """Reload the dataset into Atlas and create its search indexes."""
    # Libraries log at WARNING and above; this script also logs INFO messages.
    logging.basicConfig(format="%(levelname)s: %(message)s")
    logger.setLevel(logging.INFO)
    load_dotenv()
    client = MongoClient(
        os.environ["MONGODB_URI"], appname="devrel.showcase.openrouter"
    )
    collection = client[DB_NAME][COLLECTION_NAME]

    chunks = load_dataset(HF_DATASET, split="train").to_list()
    collection.drop()
    collection.insert_many(chunks)
    logger.info("Inserted %d chunks into %s.%s", len(chunks), DB_NAME, COLLECTION_NAME)
    create_indexes(collection)


if __name__ == "__main__":
    main()
