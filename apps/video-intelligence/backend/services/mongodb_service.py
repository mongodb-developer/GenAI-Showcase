import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.operations import SearchIndexModel

logger = logging.getLogger(__name__)


class MongoDBService:
    def __init__(self):
        self.client: Optional[MongoClient] = None
        self.db: Optional[Database] = None
        self.frame_collection: Optional[Collection] = None
        self.video_collection: Optional[Collection] = None

        # Collection names
        self.FRAME_COLLECTION = "frame_intelligence"
        self.VIDEO_COLLECTION = "video_metadata"

        # Get embedding dimensions from environment variable
        self.EMBEDDING_DIM_SIZE = int(os.getenv("EMBEDDING_DIM_SIZE", "1024"))
        logger.info(
            f"MongoDB service initialized with embedding dimensions: {self.EMBEDDING_DIM_SIZE}"
        )

    async def connect(self):
        """Connect to MongoDB Atlas"""
        try:
            mongodb_uri = os.getenv("MONGODB_URI")
            database_name = os.getenv("DATABASE_NAME", "video_intelligence")

            if not mongodb_uri:
                raise ValueError("MONGODB_URI environment variable not set")

            self.client = MongoClient(mongodb_uri)
            self.db = self.client[database_name]

            # Test connection
            self.client.admin.command("ping")
            logger.info(f"Connected to MongoDB database: {database_name}")

            # Ensure database and collections exist
            await self.ensure_database_and_collections()

            # Get collections
            self.frame_collection = self.db[self.FRAME_COLLECTION]
            self.video_collection = self.db[self.VIDEO_COLLECTION]

            # Ensure indexes exist
            await self.ensure_indexes()

        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def ensure_database_and_collections(self):
        """Ensure database and collections exist"""
        try:
            # List existing databases
            database_names = self.client.list_database_names()
            database_name = self.db.name

            if database_name not in database_names:
                logger.info(
                    f"Database '{database_name}' does not exist, it will be created when first collection is created"
                )

            # List existing collections in the database
            existing_collections = self.db.list_collection_names()

            # Ensure frame collection exists
            if self.FRAME_COLLECTION not in existing_collections:
                logger.info(f"Creating collection '{self.FRAME_COLLECTION}'")
                # Create collection with a dummy document, then remove it
                self.db[self.FRAME_COLLECTION].insert_one({"_temp": "init"})
                self.db[self.FRAME_COLLECTION].delete_one({"_temp": "init"})
                logger.info(f"Collection '{self.FRAME_COLLECTION}' created")
            else:
                logger.info(f"Collection '{self.FRAME_COLLECTION}' already exists")

            # Ensure video metadata collection exists
            if self.VIDEO_COLLECTION not in existing_collections:
                logger.info(f"Creating collection '{self.VIDEO_COLLECTION}'")
                # Create collection with a dummy document, then remove it
                self.db[self.VIDEO_COLLECTION].insert_one({"_temp": "init"})
                self.db[self.VIDEO_COLLECTION].delete_one({"_temp": "init"})
                logger.info(f"Collection '{self.VIDEO_COLLECTION}' created")
            else:
                logger.info(f"Collection '{self.VIDEO_COLLECTION}' already exists")

        except Exception as e:
            logger.error(f"Failed to ensure database and collections exist: {e}")
            # Don't raise exception here as this is not critical for basic functionality

    async def ensure_indexes(self):
        """Create necessary indexes for optimal performance"""
        try:
            # Ensure collections exist before creating indexes
            if self.frame_collection is None:
                logger.warning(
                    "Frame collection not available, skipping index creation"
                )
                return

            # Create vector search index
            self.create_vector_search_index(
                self.frame_collection,
                "vector_search_index",
                dimensions=self.EMBEDDING_DIM_SIZE,
                quantization="scalar",
            )

            # Create text search index
            self.create_text_search_index(self.frame_collection, "text_search_index")

            logger.info("Database indexes setup completed")

        except Exception as e:
            logger.warning(f"Could not create search indexes: {e}")
            logger.info(
                "The application will continue to work, but search performance may be reduced"
            )

    def create_vector_search_index(
        self,
        collection,
        vector_index_name,
        dimensions=None,
        quantization="scalar",
        embedding_path="embedding",
    ):
        """Create vector search index if it doesn't exist"""
        # Use environment variable if dimensions not specified
        if dimensions is None:
            dimensions = self.EMBEDDING_DIM_SIZE

        logger.info(f"Creating vector search index with {dimensions} dimensions")
        try:
            # Check if index already exists
            existing_indexes = list(collection.list_search_indexes())
            for index in existing_indexes:
                if index["name"] == vector_index_name:
                    logger.info(
                        f"Vector search index '{vector_index_name}' already exists."
                    )
                    return
        except Exception as e:
            logger.warning(f"Could not list search indexes: {e}")
            return

        # Define index structure
        index_definition = {
            "fields": [
                {
                    "type": "vector",
                    "path": embedding_path,
                    "numDimensions": dimensions,
                    "similarity": "cosine",
                },
                {"type": "filter", "path": "video_id"},
            ]
        }

        if quantization in ["scalar", "binary"]:
            index_definition["fields"][0]["quantization"] = quantization

        # Create vector search index
        search_index_model = SearchIndexModel(
            definition=index_definition,
            name=vector_index_name,
            type="vectorSearch",
        )

        try:
            # Check if collection exists first
            if collection.name not in self.db.list_collection_names():
                logger.warning(
                    f"Collection '{collection.name}' does not exist, cannot create vector search index"
                )
                return

            result = collection.create_search_index(model=search_index_model)
            logger.info(f"New vector search index '{result}' is building.")

            # Wait for index to be ready (non-blocking)
            self._wait_for_index_ready(collection, result)

        except Exception as e:
            error_msg = str(e)
            if "does not exist" in error_msg:
                logger.warning(
                    "Cannot create vector search index: Collection does not exist"
                )
            elif "already exists" in error_msg:
                logger.info(f"Vector search index '{vector_index_name}' already exists")
            else:
                logger.error(f"Error creating vector search index: {e}")
            return

    def create_text_search_index(self, collection, text_index_name):
        """Create text search index if it doesn't exist"""
        try:
            # Check if index already exists
            existing_indexes = list(collection.list_search_indexes())
            for index in existing_indexes:
                if index["name"] == text_index_name:
                    logger.info(
                        f"Text search index '{text_index_name}' already exists."
                    )
                    return
        except Exception as e:
            logger.warning(f"Could not list search indexes: {e}")
            return

        # Define text search index
        index_definition = {
            "mappings": {
                "dynamic": False,
                "fields": {
                    "description": {"type": "string", "analyzer": "lucene.standard"},
                    "metadata.scene_type": {"type": "string"},
                    "metadata.objects": {"type": "string"},
                },
            }
        }

        search_index_model = SearchIndexModel(
            definition=index_definition,
            name=text_index_name,
            type="search",
        )

        try:
            # Check if collection exists first
            if collection.name not in self.db.list_collection_names():
                logger.warning(
                    f"Collection '{collection.name}' does not exist, cannot create text search index"
                )
                return

            result = collection.create_search_index(model=search_index_model)
            logger.info(f"New text search index '{result}' is building.")

        except Exception as e:
            error_msg = str(e)
            if "does not exist" in error_msg:
                logger.warning(
                    "Cannot create text search index: Collection does not exist"
                )
            elif "already exists" in error_msg:
                logger.info(f"Text search index '{text_index_name}' already exists")
            else:
                logger.error(f"Error creating text search index: {e}")
            return

    def _wait_for_index_ready(self, collection, index_name, timeout=300):
        """Wait for index to be ready (runs in background)"""

        def check_index():
            start_time = time.time()
            logger.info(f"Polling to check if index '{index_name}' is ready...")

            while time.time() - start_time < timeout:
                try:
                    indices = list(collection.list_search_indexes(index_name))
                    if indices and indices[0].get("queryable") is True:
                        logger.info(f"✅ Index '{index_name}' is ready for querying!")
                        return
                    time.sleep(10)  # Check every 10 seconds
                except Exception as e:
                    logger.warning(f"Error checking index readiness: {e}")
                    time.sleep(10)

            logger.warning(f"⏰ Timeout waiting for index '{index_name}' to be ready")

        # Run index checking in background (don't block startup)
        import threading

        thread = threading.Thread(target=check_index)
        thread.daemon = True
        thread.start()

    async def insert_frame_batch(
        self, video_id: str, frame_batch: List[Dict[str, Any]]
    ):
        """Insert a batch of frames for a video (progressive ingestion)"""
        try:
            if not frame_batch:
                return []

            # Add video_id and timestamp to each frame document
            for frame in frame_batch:
                frame["video_id"] = video_id
                frame["created_at"] = datetime.utcnow()

            result = self.frame_collection.insert_many(frame_batch)
            logger.info(
                f"Inserted batch of {len(result.inserted_ids)} frames for video {video_id}"
            )
            return result.inserted_ids

        except Exception as e:
            logger.error(f"Failed to insert frame batch: {e}")
            raise

    async def insert_frame_data(self, video_id: str, frame_data: List[Dict[str, Any]]):
        """Insert frame data for a video (legacy method - kept for compatibility)"""
        try:
            # Add video_id to each frame document
            for frame in frame_data:
                frame["video_id"] = video_id
                frame["created_at"] = datetime.utcnow()

            result = self.frame_collection.insert_many(frame_data)
            logger.info(
                f"Inserted {len(result.inserted_ids)} frames for video {video_id}"
            )
            return result.inserted_ids

        except Exception as e:
            logger.error(f"Failed to insert frame data: {e}")
            raise

    async def get_video_frame_count(self, video_id: str) -> int:
        """Get the number of frames already inserted for a video"""
        try:
            count = self.frame_collection.count_documents({"video_id": video_id})
            return count
        except Exception as e:
            logger.error(f"Failed to get frame count: {e}")
            return 0

    async def insert_video_metadata(self, video_metadata: Dict[str, Any]):
        """Insert video metadata"""
        try:
            video_metadata["created_at"] = datetime.utcnow()
            result = self.video_collection.insert_one(video_metadata)
            logger.info(f"Inserted video metadata with ID: {result.inserted_id}")
            return str(result.inserted_id)

        except Exception as e:
            logger.error(f"Failed to insert video metadata: {e}")
            raise

    async def semantic_search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        video_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Perform semantic search using vector similarity"""

        print(
            f"Performing semantic search with query embedding: {len(query_embedding)}"
        )
        try:
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "vector_search_index",
                        "path": "embedding",
                        "queryVector": query_embedding,
                        "numCandidates": top_k * 2,
                        "filter": {"video_id": video_filter},
                        "limit": top_k,
                    }
                }
            ]

            pipeline.append(
                {
                    "$project": {
                        "frame_number": 1,
                        "timestamp": 1,
                        "description": 1,
                        "file_path": 1,
                        "metadata": 1,
                        "video_id": 1,
                        "similarity_score": {"$meta": "vectorSearchScore"},
                        "_id": 0,
                    }
                }
            )

            results = list(self.frame_collection.aggregate(pipeline))
            logger.info(f"Found {len(results)} semantic search results")
            return results

        except Exception as e:
            error_msg = str(e).lower()
            if "index not found" in error_msg or "no search index" in error_msg:
                logger.error(
                    "Vector search index 'vector_search_index' not found. Please create it in MongoDB Atlas."
                )
                logger.error("See README.md for setup instructions.")
                # Fall back to basic text search or return empty results
                return await self._fallback_text_search(top_k)
            else:
                logger.error(f"Semantic search failed: {e}")
                return []

    async def text_search(
        self, query_text: str, top_k: int = 5, video_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Perform text search using MongoDB text search index"""
        try:
            # Build text search pipeline
            pipeline = [
                {
                    "$search": {
                        "index": "text_search_index",
                        "text": {"query": query_text, "path": ["description"]},
                    }
                }
            ]

            # Add video filter if specified
            if video_filter:
                pipeline.append({"$match": {"video_id": video_filter}})

            # Add limit
            pipeline.append({"$limit": top_k})

            # Add fields and score
            pipeline.extend(
                [
                    {
                        "$project": {
                            "frame_number": 1,
                            "timestamp": 1,
                            "description": 1,
                            "file_path": 1,
                            "metadata": 1,
                            "video_id": 1,
                            "similarity_score": {"$meta": "searchScore"},
                            "_id": 0,
                        }
                    },
                ]
            )

            results = list(self.frame_collection.aggregate(pipeline))
            logger.info(f"Found {len(results)} text search results")
            return results

        except Exception as e:
            error_msg = str(e).lower()
            if "index not found" in error_msg or "no search index" in error_msg:
                logger.warning(
                    "Text search index 'text_search_index' not found. Falling back to basic text matching."
                )
                return await self._fallback_basic_text_search(
                    query_text, top_k, video_filter
                )
            else:
                logger.error(f"Text search failed: {e}")
                return []

    async def _fallback_basic_text_search(
        self, query_text: str, top_k: int = 5, video_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fallback text search using MongoDB regex when text search index is not available"""
        try:
            # Build basic text search using regex
            match_filter = {
                "description": {
                    "$regex": query_text,
                    "$options": "i",
                }  # case-insensitive
            }

            # Add video filter if specified
            if video_filter:
                match_filter["video_id"] = video_filter

            results = list(
                self.frame_collection.find(
                    match_filter,
                    {
                        "_id": 0,
                        "frame_number": 1,
                        "timestamp": 1,
                        "description": 1,
                        "file_path": 1,
                        "metadata": 1,
                        "video_id": 1,
                    },
                )
                .sort("timestamp", 1)
                .limit(top_k)
            )

            # Add dummy similarity scores based on position
            for i, result in enumerate(results):
                result["similarity_score"] = 1.0 - (i * 0.1)  # Decreasing score

            logger.info(f"Fallback text search returned {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Fallback text search failed: {e}")
            return []

    async def hybrid_search(
        self,
        query_text: str,
        query_embedding: List[float],
        top_k: int = 5,
        vector_weight: float = 0.5,
        text_weight: float = 0.5,
        video_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search combining text and vector search"""
        try:
            # Build vector search pipeline
            vector_pipeline = [
                {
                    "$vectorSearch": {
                        "index": "vector_search_index",
                        "path": "embedding",
                        "queryVector": query_embedding,
                        "numCandidates": 100,
                        "limit": 20,
                    }
                }
            ]

            # Build text search pipeline
            text_pipeline = [
                {
                    "$search": {
                        "index": "text_search_index",
                        "phrase": {"query": query_text, "path": "description"},
                    }
                },
                {"$limit": 20},
            ]

            # Add video filter if specified
            if video_filter:
                vector_pipeline.append({"$match": {"video_id": video_filter}})
                text_pipeline.append({"$match": {"video_id": video_filter}})

            pipeline = [
                {
                    "$rankFusion": {
                        "input": {
                            "pipelines": {
                                "vectorPipeline": vector_pipeline,
                                "textPipeline": text_pipeline,
                            }
                        },
                        "combination": {
                            "weights": {
                                "vectorPipeline": vector_weight,
                                "textPipeline": text_weight,
                            }
                        },
                        "scoreDetails": True,
                    }
                },
                {"$addFields": {"scoreDetails": {"$meta": "scoreDetails"}}},
                {"$addFields": {"similarity_score": "$scoreDetails.value"}},
                {"$limit": top_k},
                {
                    "$project": {
                        "frame_number": 1,
                        "timestamp": 1,
                        "description": 1,
                        "file_path": 1,
                        "metadata": 1,
                        "video_id": 1,
                        "similarity_score": 1,
                        "_id": 0,
                    }
                },
            ]

            results = list(self.frame_collection.aggregate(pipeline))
            logger.info(f"Found {len(results)} hybrid search results")
            return results

        except Exception as e:
            logger.warning(
                f"Hybrid search failed, falling back to semantic search: {e}"
            )
            return await self.semantic_search(query_embedding, top_k, video_filter)

    async def get_all_videos(self) -> List[Dict[str, Any]]:
        """Get all uploaded videos"""
        try:
            cursor = self.video_collection.find(
                {"status": "completed"},
                {
                    "_id": 0,
                    "video_id": 1,
                    "original_filename": 1,
                    "duration": 1,
                    "fps": 1,
                    "width": 1,
                    "height": 1,
                    "processed_at": 1,
                    "created_at": 1,
                    "total_frames": 1,
                    "frontend_path": 1,
                },
            ).sort("created_at", -1)

            results = list(cursor)
            logger.info(f"Found {len(results)} uploaded videos")
            return results
        except Exception as e:
            logger.error(f"Failed to get all videos: {e}")
            return []

    async def get_video_metadata(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get video metadata by ID"""
        try:
            result = self.video_collection.find_one({"video_id": video_id})
            return result
        except Exception as e:
            logger.error(f"Failed to get video metadata: {e}")
            return None

    async def update_video_status(self, video_id: str, status: str):
        """Update video status"""
        try:
            from datetime import datetime

            result = self.video_collection.update_one(
                {"video_id": video_id},
                {
                    "$set": {
                        "status": status,
                        "processed_at": (
                            datetime.utcnow() if status == "completed" else None
                        ),
                    }
                },
            )
            logger.info(f"Updated video {video_id} status to {status}")
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update video status: {e}")
            return False

    async def cleanup_video_data(self, video_id: str):
        """Clean up all data for a video"""
        try:
            # Delete frame data
            frame_result = self.frame_collection.delete_many({"video_id": video_id})
            # Delete video metadata
            video_result = self.video_collection.delete_many({"video_id": video_id})

            logger.info(
                f"Cleaned up video {video_id}: {frame_result.deleted_count} frames, {video_result.deleted_count} metadata records"
            )

        except Exception as e:
            logger.error(f"Failed to cleanup video data: {e}")

    async def _fallback_text_search(self, top_k: int = 5) -> List[Dict[str, Any]]:
        """Fallback to basic MongoDB query when vector search is not available"""
        try:
            # Simple fallback: return recent frames
            results = list(
                self.frame_collection.find(
                    {},
                    {
                        "_id": 0,
                        "frame_number": 1,
                        "timestamp": 1,
                        "description": 1,
                        "file_path": 1,
                        "metadata": 1,
                        "video_id": 1,
                    },
                )
                .sort("timestamp", 1)
                .limit(top_k)
            )

            # Add dummy similarity scores
            for result in results:
                result["similarity_score"] = 0.5

            logger.info(f"Fallback search returned {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Fallback search failed: {e}")
            return []

    async def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")


# Global instance
mongodb_service = MongoDBService()
