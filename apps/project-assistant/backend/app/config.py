import os

# User config
USER_ID = "Apoorva"

# MongoDB config
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "mongodb_projects")

# Anthropic config
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

# Voyage AI config
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
VOYAGE_MULTIMODAL_MODEL = os.getenv("VOYAGE_MULTIMODAL_MODEL", "voyage-multimodal-3.5")
VOYAGE_TEXT_MODEL = os.getenv("VOYAGE_TEXT_MODEL", "voyage-4")

# Vector search config
VECTOR_INDEX_NAME = "vector_index"
VECTOR_DIMENSIONS = 1024
VECTOR_NUM_CANDIDATES = 100

# Image config
IMAGE_SIZE = (1024, 1024)
