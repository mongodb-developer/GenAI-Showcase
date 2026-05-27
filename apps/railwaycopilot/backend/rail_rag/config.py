import os

MONGODB_URI          = os.getenv("MONGODB_URI")  
MONGO_DB_NAME        = os.getenv("DB_NAME", "rail_ops")
MONGO_COLLECTION_NAME = os.getenv("COLLECTION_NAME", "rulebook_chunks")
VECTOR_INDEX_NAME    = os.getenv("VECTOR_INDEX_NAME", "vector_index")

# --- Mistral models ---
EMBED_MODEL = os.getenv("MISTRAL_EMBED_MODEL", "mistral-embed")
CHAT_MODEL  = os.getenv("MISTRAL_CHAT_MODEL", "mistral-small-latest")

# --- Field names ---
TEXT_KEY = "content"
VEC_KEY  = "content_vector"
SRC_KEY  = "source"
PAGE_KEY = "page"

SYSTEM_PROMPT = """You are a Rail Operations & Safety assistant.
Answer ONLY using the provided context.
If the answer is not in the context, say “I don’t have that in the documents.”
Cite sources as (filename p.page). Be concise and correct. Do not reveal internal reasoning steps.
"""
