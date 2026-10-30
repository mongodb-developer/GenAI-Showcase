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
EMBEDDING_MODEL = "voyage-4-large"


def create_indexes(collection) -> None:
    vector_index = SearchIndexModel(
        name=VECTOR_INDEX,
        type="vectorSearch",
        definition={
            "fields": [
                {
                    "type": "autoEmbed",
                    "modality": "text",
                    "path": "text",
                    "model": EMBEDDING_MODEL,
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
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    # The Hugging Face client logs every download request at INFO level.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    load_dotenv()
    client = MongoClient(
        os.environ["MONGODB_URI"], appname="devrel.showcase.openrouter"
    )
    collection = client[DB_NAME][COLLECTION_NAME]

    chunks = load_dataset(HF_DATASET, split="train").to_list()
    collection.drop()
    collection.insert_many(chunks)
    logging.info("Inserted %d chunks into %s.%s", len(chunks), DB_NAME, COLLECTION_NAME)
    create_indexes(collection)


if __name__ == "__main__":
    main()
