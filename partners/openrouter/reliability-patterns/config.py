"""Settings and shared clients for the docs Q&A app."""

import os

from dotenv import load_dotenv
from openrouter import OpenRouter
from openrouter.utils import BackoffStrategy, RetryConfig
from pymongo import AsyncMongoClient

load_dotenv()

MONGODB_URI = os.environ["MONGODB_URI"]
OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]

# MongoDB config.
DB_NAME = "docs_qa"
COLLECTION_NAME = "mongodb_docs"
VECTOR_INDEX = "vector_index"
FTS_INDEX = "fts_index"

# Model config.
# The documents were embedded with voyage-4-large. All Voyage 4 models share an
# embedding space, so queries can be embedded with any of them.
QUERY_MODELS = ["voyageai/voyage-4", "voyageai/voyage-4-lite"]
RERANK_MODEL = "voyageai/rerank-3"
# Two vendors, each served by several cloud providers.
LLM_MODELS = ["anthropic/claude-sonnet-5.5", "openai/gpt-6.1-sol"]

# Number of chunks retrieved by vector search for reranking.
RERANK_CANDIDATES = 50
# Chunks kept after reranking and passed to the LLM as numbered sources.
TOP_N = 5
# Maximum length of the generated answer.
MAX_TOKENS = 1024

EMBED_TIMEOUT_S = 3
SEARCH_TIMEOUT_S = 3
RERANK_TIMEOUT_S = 3
LLM_TIMEOUT_S = 20

# Retry 5XX and connection errors with exponential backoff and jitter, and stop retrying after 3 seconds.
RETRY_CONFIG = RetryConfig(
    "backoff",
    BackoffStrategy(
        initial_interval=250,
        max_interval=1000,
        exponent=2,
        max_elapsed_time=3000,
        jitter_ms=100,
    ),
    retry_connection_errors=True,
)

# Stop calling the reranker after 5 failures in a row, and try again after 60 seconds.
BREAKER_FAILURE_THRESHOLD = 5
BREAKER_COOLDOWN_S = 60

# Initialize MongoDB client and select the database.
mongo_client = AsyncMongoClient(MONGODB_URI, appname="devrel.showcase.openrouter")
db = mongo_client[DB_NAME]

# Initialize OpenRouter client with retry configuration.
openrouter_client = OpenRouter(api_key=OPENROUTER_API_KEY, retry_config=RETRY_CONFIG)
