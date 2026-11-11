import os
from glob import glob
from typing import List, Dict
import numpy as np
import requests
import certifi

from pymongo import MongoClient
from pymongo.errors import OperationFailure
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from pymongo.errors import OperationFailure

MONGODB_URI   = os.getenv("MONGODB_URI")  
DB_NAME       = os.getenv("DB_NAME", "rail_ops")
COLL_NAME     = os.getenv("COLLECTION_NAME", "rulebook_chunks")

EMBED_MODEL   = os.getenv("MISTRAL_EMBED_MODEL", "mistral-embed")
EMBED_DIM     = 1024  
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

CORPUS_DIR    = os.getenv("CORPUS_DIR", "corpus")

# Field names 
TEXT_KEY  = "content"
VEC_KEY   = "content_vector"
SRC_KEY   = "source"
PAGE_KEY  = "page"


class SimpleMistralEmbedder:
    def __init__(self, model: str, api_key: str):
        if not api_key:
            raise RuntimeError("Missing MISTRAL_API_KEY in environment.")
        self.model = model
        self.api_key = api_key
        self.url = "https://api.mistral.ai/v1/embeddings"
        self.session = requests.Session()
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        payload = {"model": self.model, "input": texts}
        r = self.session.post(self.url, headers=self.headers, json=payload, timeout=60)
        try:
            j = r.json()
        except Exception:
            raise RuntimeError(f"Embeddings HTTP {r.status_code}: {r.text[:500]}")
        # Accept multiple shapes to be version-tolerant
        if "data" in j and isinstance(j["data"], list):
            return [item["embedding"] for item in j["data"]]
        if "embeddings" in j and isinstance(j["embeddings"], list):
            return j["embeddings"]
        if "error" in j:
            raise RuntimeError(f"Mistral embeddings error: {j['error']}")
        raise RuntimeError(f"Unexpected embeddings response shape: {str(j)[:500]}")

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]

# ---------------------------------------------------------------------
# Data loading & chunking
# ---------------------------------------------------------------------
def load_docs(corpus_dir: str):
    docs = []
    for p in glob(os.path.join(corpus_dir, "*.pdf")):
        for d in PyPDFLoader(p).load():
            d.metadata[SRC_KEY] = os.path.basename(p)
            d.metadata[PAGE_KEY] = d.metadata.get("page")
            docs.append(d)
    return docs

def chunk_docs(docs):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=120,
        add_start_index=True,
    )
    return splitter.split_documents(docs)

# ---------------------------------------------------------------------
# Build Mongo-ready documents
# ---------------------------------------------------------------------
def build_records(chunks, embedder: SimpleMistralEmbedder) -> List[Dict]:
    texts = [c.page_content or "" for c in chunks]
    vectors = embedder.embed_documents(texts)
    recs = []
    for i, c in enumerate(chunks):
        vec = vectors[i]
        # Ensure correct dtype/dim for safety
        if len(vec) != EMBED_DIM:
            raise ValueError(f"Unexpected embedding dim {len(vec)} (expected {EMBED_DIM})")
        # Mongo expects an array of numbers
        vec = [float(x) for x in vec]

        rec = {
            TEXT_KEY: c.page_content or "",
            VEC_KEY: vec,
            SRC_KEY: c.metadata.get(SRC_KEY),
        }
        page_val = c.metadata.get(PAGE_KEY)
        if page_val is not None:
            try:
                rec[PAGE_KEY] = int(page_val)
            except Exception:
                rec[PAGE_KEY] = -1
        recs.append(rec)
    return recs

# ---------------------------------------------------------------------
# Ensure Atlas Vector Search index exists (vectorSearch)
# ---------------------------------------------------------------------
def ensure_vector_index(coll, index_name="vector_index"):
    """
    Creates a Vector Search index on content_vector if it doesn't already exist.
    """

    print(f"[info] Checking existing search indexes on {coll.full_name}…")

    existing = []
    try:
        existing = list(coll.aggregate([{"$listSearchIndexes": {}}]))
    except OperationFailure as e:
        print(f"[warn] $listSearchIndexes not supported or failed: {e}")
    except Exception as e:
        print(f"[warn] Unexpected error listing search indexes: {e}")

    for idx in existing:
        if idx.get("name") == index_name:
            print(f"[info] Search index '{index_name}' already exists.")
            return

    print(f"[info] Creating VECTOR SEARCH index '{index_name}'…")

    definition = {
        "name": index_name,
        "type": "vectorSearch",          
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "path": "content_vector",
                    "numDimensions": 1024,
                    "similarity": "cosine",
                },
                {
                    "type": "filter",
                    "path": "source",
                },
                {
                    "type": "filter",
                    "path": "page",
                },
            ]
        },
    }

    try:
        result = coll.database.command({
            "createSearchIndexes": coll.name,
            "indexes": [definition],
        })
        print(f"[info] createSearchIndexes result: {result}")
    except Exception as e:
        print(f"[error] Failed to create search index '{index_name}': {e}")

# ---------------------------------------------------------------------
def main():
    if not MISTRAL_API_KEY:
        raise SystemExit("Missing MISTRAL_API_KEY in environment!")
    if not MONGODB_URI:
        raise SystemExit("Missing MONGODB_URI in environment!")

    # 1) Load & chunk PDFs
    docs = load_docs(CORPUS_DIR)
    if not docs:
        raise SystemExit(f"No PDFs found in '{CORPUS_DIR}'")
    chunks = chunk_docs(docs)

    # 2) Embed
    embedder = SimpleMistralEmbedder(model=EMBED_MODEL, api_key=MISTRAL_API_KEY)
    records = build_records(chunks, embedder)

    # 3) Connect to MongoDB Atlas
    #client = MongoClient(MONGODB_URI)
    client = MongoClient(MONGODB_URI, tlsCAFile=certifi.where())
    db = client[DB_NAME]
    coll = db[COLL_NAME]

    # 4) Create / ensure vector index
    try:
        ensure_vector_index(coll, index_name="vector_index")
    except Exception as e:
        # If running locally (no Atlas) or on an older server this may fail; ingestion can still proceed.
        print(f"[warn] Could not ensure vector index now: {e}")

    # 5) Fresh load: optional cleanup for a clean re-ingest
    if os.getenv("FRESH_LOAD", "true").lower() in ("1", "true", "yes"):
        coll.delete_many({})

    # 6) Insert records
    if records:
        # Insert in batches
        BATCH = 500
        for i in range(0, len(records), BATCH):
            coll.insert_many(records[i:i+BATCH])
        print(f"[✅] Ingested {len(records)} chunks into '{DB_NAME}.{COLL_NAME}'")
    else:
        print("[ℹ️] No records to insert.")

if __name__ == "__main__":
    main()
