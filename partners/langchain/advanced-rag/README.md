# Advanced RAG on MongoDB Atlas

Three notebooks that build a movie-discovery assistant one retrieval technique at a time. By the
end you'll have used every major retrieval pattern MongoDB Atlas supports on a single free cluster,
with no separate vector database, search engine, or graph store.

## The notebooks

Run them in order; each builds on indexes and concepts from the previous one.

| # | Notebook | Techniques | Time |
|---|----------|-----------|------|
| 1 | [Setup & Vector Search](./01_atlas_setup_and_vector_search.ipynb) | Atlas connection, embeddings, vector search, metadata filtering, a first RAG chain | ~30 min |
| 2 | [Full-Text, Hybrid & Reranking](./02_fulltext_hybrid_and_reranking.ipynb) | Full-text (BM25) search, hybrid `$rankFusion`, reranking, side-by-side comparison | ~30 min |
| 3 | [GraphLookup & Auto-Embedding](./03_graphlookup_and_auto_embedding.ipynb) | `$graphLookup` traversal, Atlas auto-embedding | ~30 min |

## What you need

- A free Atlas **M0** cluster with the **sample dataset** loaded (see the [root README](../../../README.md)).
- An **Atlas API key**. The notebooks call MongoDB's hosted embedding and rerank services at
  `ai.mongodb.com`.
- A **Claude API key** for the RAG generation step. An Anthropic-compatible gateway works too; set
  `ANTHROPIC_BASE_URL` (see [`.env.example`](../../../.env.example)).

Copy `../../../.env.example` to `../../../.env` and fill it in, or let the notebooks prompt you for each value.

## How the data is set up

The `sample_mflix.embedded_movies` collection ships with pre-computed plot embeddings
(`plot_embedding_voyage_3_large`, 2048 dimensions from Voyage AI's `voyage-3-large`). The notebooks
use those directly, so there's no bulk embedding step. You create an index and start searching.
Query embeddings use the same model so they share the vector space.

## A note on the free tier

M0 clusters allow up to **3 search indexes**. These notebooks create two on `embedded_movies`
(vector and full-text) and one short-lived index for the auto-embedding demo, which notebook 3
drops when it finishes. At the limit the notebooks stop and name what is using the slots rather than
freeing one. If you hit it, drop the `auto_embed_demo`
collection or any leftover demo indexes from a previous run.

## Shared helpers

`utils.py` holds the setup boilerplate the notebooks share: reading secrets, connecting to Atlas,
calling the embedding and rerank endpoints, configuring the LLM, and the two guards described above
(`assert_room_for_index`, `claim_scratch_collection`). The teaching code stays in the notebooks.
`test_utils.py` covers the helpers with 28 fast, offline unit tests:

```bash
cd partners/langchain/advanced-rag
python -m pytest test_utils.py -v
```

### Secrets vs. tunables

Two helpers read configuration, and the difference matters:

- `get_secret(name, prompt)` — a required credential. Checks the environment, then prompts
  interactively. The environment fallback is what makes Colab and CI work without a `.env`.
- `setting(name, default)` — a tunable such as `ANTHROPIC_MODEL` or `EMBEDDING_DIMENSIONS`. Reads
  the `.env` file *directly* and otherwise returns the documented default. It never consults the
  surrounding shell.

That second one is deliberate, not fussiness. `load_dotenv` only overlays the variables the file
declares, so anything it omits keeps whatever the shell holds — an `ANTHROPIC_MODEL` left in a
shell by unrelated work silently became the model a notebook used, and the resulting
`DeploymentNotFound` pointed nowhere near the cause. An omitted variable means "use the documented
default". The Mastra set's `src/config.ts` makes the same distinction for the same reason.
