import os

# User config
USER_ID = "Apoorva"

# MongoDB config
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "memoir")

# OpenAI config
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Voyage AI config
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
VOYAGE_MULTIMODAL_MODEL = "voyage-multimodal-3"
VOYAGE_TEXT_MODEL = "voyage-3-large"

# Vector search config
VECTOR_INDEX_NAME = "vector_index"
VECTOR_DIMENSIONS = 1024
VECTOR_NUM_CANDIDATES = 100

# Image config
IMAGE_SIZE = (1024, 1024)
