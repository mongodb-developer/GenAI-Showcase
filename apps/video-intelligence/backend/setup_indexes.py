#!/usr/bin/env python3
"""
MongoDB Atlas Search Index Setup Script
Creates the required vector search and text search indexes for the Video Intelligence app.
"""

import json
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel


def setup_indexes():
    """Setup MongoDB Atlas search indexes"""

    # Get embedding dimensions from environment variable
    EMBEDDING_DIM_SIZE = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))
    print(f"Using embedding dimensions: {EMBEDDING_DIM_SIZE}")
    print("🔧 Setting up MongoDB Atlas Search Indexes")
    print("=" * 50)

    # Load environment variables
    load_dotenv()

    # Get MongoDB connection details
    mongodb_uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("DATABASE_NAME", "video_intelligence")

    if not mongodb_uri:
        print("❌ MONGODB_URI environment variable not set")
        return False

    try:
        # Connect to MongoDB
        client = MongoClient(mongodb_uri)
        db = client[database_name]

        # Test connection
        client.admin.command("ping")
        print(f"✅ Connected to MongoDB database: {database_name}")

        # Create indexes programmatically using pymongo
        print("\n🎯 Creating search indexes programmatically...")
        print("=" * 50)

        frame_collection = db["frame_intelligence"]

        # Create vector search index
        print("Creating vector search index...")
        try:
            existing_indexes = list(frame_collection.list_search_indexes())
            vector_exists = any(
                idx["name"] == "vector_search_index" for idx in existing_indexes
            )

            if not vector_exists:
                vector_index_definition = {
                    "fields": [
                        {
                            "type": "vector",
                            "path": "embedding",
                            "numDimensions": EMBEDDING_DIM_SIZE,
                            "similarity": "cosine",
                            "quantization": "scalar",
                        }
                    ]
                }

                vector_search_model = SearchIndexModel(
                    definition=vector_index_definition,
                    name="vector_search_index",
                    type="vectorSearch",
                )

                result = frame_collection.create_search_index(model=vector_search_model)
                print(f"✅ Vector search index '{result}' created and building...")
            else:
                print("✅ Vector search index already exists")

        except Exception as e:
            print(f"❌ Error creating vector search index: {e}")

        # Create text search index
        print("Creating text search index...")
        try:
            text_exists = any(
                idx["name"] == "text_search_index" for idx in existing_indexes
            )

            if not text_exists:
                text_index_definition = {
                    "mappings": {
                        "dynamic": False,
                        "fields": {
                            "description": {
                                "type": "string",
                                "analyzer": "lucene.standard",
                            },
                            "metadata.scene_type": {"type": "string"},
                            "metadata.objects": {"type": "string"},
                        },
                    }
                }

                text_search_model = SearchIndexModel(
                    definition=text_index_definition,
                    name="text_search_index",
                    type="search",
                )

                result = frame_collection.create_search_index(model=text_search_model)
                print(f"✅ Text search index '{result}' created and building...")
            else:
                print("✅ Text search index already exists")

        except Exception as e:
            print(f"❌ Error creating text search index: {e}")

        print()
        print("⏳ Indexes are now building in the background...")
        print(
            "🚀 Your Video Intelligence app will have full search capabilities once ready!"
        )

        # Check if collections exist and show data
        collections = db.list_collection_names()
        print(f"📦 Available collections: {collections}")

        if "frame_intelligence" in collections:
            frame_count = db.frame_intelligence.count_documents({})
            print(f"🎬 Frame documents in database: {frame_count}")

            if frame_count > 0:
                sample_doc = db.frame_intelligence.find_one(
                    {}, {"_id": 0, "frame_number": 1, "description": 1, "timestamp": 1}
                )
                print(f"📄 Sample frame document: {sample_doc}")

        print()
        print("💡 Pro tip: You can also use the Atlas CLI to create indexes:")
        print("   atlas clusters search indexes create --clusterName <cluster-name>")
        print()
        print("🚀 Once indexes are created, restart your Video Intelligence app!")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    finally:
        if "client" in locals():
            client.close()


def main():
    success = setup_indexes()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
