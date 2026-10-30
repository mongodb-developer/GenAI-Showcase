# Reliability Patterns for AI Applications with OpenRouter and MongoDB

A command-line Q&A app over MongoDB documentation that shows four reliability patterns for production AI applications. Each question goes through three model calls: an embedding model, a reranker, and an LLM. Each one fails differently, and the app keeps answering when they do.

## How it works

```
question
  → Atlas Vector Search        (Atlas autoembeds the query with a Voyage AI embedding model)
  → rerank                     (Voyage AI reranker via OpenRouter)
  → generate a cited answer    (Claude Sonnet, falling back to GPT, via OpenRouter)
```

## Reliability patterns

| Pattern | What the app does | Where |
|---|---|---|
| Timeouts and retries with exponential backoff | Bounded retries with jitter for 5XX and connection errors (OpenRouter SDK), a total time limit per call (`asyncio.timeout`), and server-side query timeouts (`pymongo.timeout`) | `config.py`, `rerank.py`, `generate.py`, `retrieval.py` |
| Model fallbacks and provider failover | OpenRouter's `models` list falls back from Claude to GPT and fails over between each model's providers. Vector search falls back from `voyage-4` to `voyage-4-lite`, which share an embedding space. | `generate.py`, `retrieval.py` |
| Graceful degradation | A circuit breaker skips a failing reranker, keyword search replaces failing vector search, and the app returns the most relevant docs if no answer can be generated | `rerank.py`, `retrieval.py`, `ask.py` |
| Output guardrails | OpenRouter structured outputs enforce the answer format, and the app checks that every citation refers to a real source | `generate.py` |

## What you need

- Python 3.11 or later
- A MongoDB Atlas cluster that supports [Automated Embedding](https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/), and its connection string
- An [OpenRouter](https://openrouter.ai/) API key with credits

## Usage

1. Create a virtual environment and install the dependencies:

   ```bash
   cd partners/openrouter/reliability-patterns
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in `MONGODB_URI` and `OPENROUTER_API_KEY`.

3. Load the data. This downloads [`MongoDB/mongodb-docs-chunked`](https://huggingface.co/datasets/MongoDB/mongodb-docs-chunked) from Hugging Face, inserts it into `docs_qa.mongodb_docs`, and creates a vector search index and a keyword search index:

   ```bash
   python load_data.py
   ```

   Atlas embeds the documents in the background. Wait a minute or two, until both indexes show as ready in the Atlas UI, before asking questions. Rerunning the script reloads the collection from scratch.

4. Ask questions:

   ```bash
   python ask.py
   ```
