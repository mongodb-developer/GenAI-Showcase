# Mastra + MongoDB Atlas

Four notebooks that build a movie-discovery agent with [Mastra](https://mastra.ai), the
TypeScript agent framework, backed entirely by a free Atlas M0 cluster. Retrieval, hybrid
search, reranking, and conversation memory all land in the same database.

The code is TypeScript, run by the [tslab](https://github.com/yunabe/tslab) kernel rather
than IPython. That is a deliberate trade. Mastra is a TypeScript framework, and a cookbook
that taught it through a Python wrapper would be teaching the wrapper. The cost is real:
these notebooks do not open in Colab. You need a local clone and `npm install`.

## The notebooks

Reading them in order is best -- each builds on ideas from the last -- but each one
creates the Atlas indexes it needs, so any of them runs on a clean cluster.

| # | Notebook | Covers | Runtime |
|---|----------|--------|---------|
| 1 | [Setup, Voyage Embeddings & Vector Search](./01_setup_voyage_and_vector_search.ipynb) | `MongoDBVector`, Voyage embeddings three ways, `$vectorSearch`, filter pushdown | 25s |
| 2 | [Bring Your Own Operational Collections](./02_byo_operational_collections.ipynb) | Querying a collection Mastra did not create, the read-only guard, `allowWrites`, the index registry | 63s |
| 3 | [Full-Text, Hybrid Search & Reranking](./03_hybrid_search_and_reranking.ipynb) | `textQuery` (BM25), `hybridQuery` (`$rankFusion`), weights, `rerank-2.5` | 20s |
| 4 | [Agents, Tools & Persistent Memory](./04_agent_with_tools_and_memory.ipynb) | `createTool`, tool selection, `Memory` on `MongoDBStore`, proving persistence | 58s |

Runtime is wall-clock for a full `nbconvert --execute` run against a live M0 cluster with
the shared indexes already built, which is a floor rather than an estimate of your time.
Notebook 02 is the slowest because it always creates an Atlas Search index and waits for
it to become queryable. On a genuinely clean cluster add a minute or two to whichever
notebook you run first, since it builds the shared indexes the others then find.

Every notebook here has its outputs committed, so you can read what these actually return
before running anything yourself.

## What you need

- A MongoDB Atlas cluster with the **`sample_mflix` sample dataset** loaded. M0 works, with
  one caveat about the index budget below.
- **MongoDB 8.0 or later.** `$rankFusion` in notebook 03 needs it.
- **Node.js 22.13 or later.** The Mastra packages and `@ai-sdk/anthropic` require it.
- An **Atlas API key**, used for the hosted Voyage embedding and rerank endpoints at
  `ai.mongodb.com`.
- A **Claude API key**, or an Anthropic-compatible gateway via `ANTHROPIC_BASE_URL`. Only
  notebook 04 calls a model, but `loadNotebookConfig` validates all three secrets up front,
  so the key has to be present for any of them to start.

Copy [`.env.example`](./.env.example) to `.env` in this folder and fill it in.

## Setup

There is no `%pip install` cell here. The kernel resolves imports from
`partners/mastra/node_modules`, so dependencies have to be installed before Jupyter starts:

```bash
cd partners/mastra
npm install
npx tslab install --python="$(which python3)"   # registers the kernel with Jupyter
jupyter lab
```

Then pick the **TypeScript** kernel when you open a notebook.

`npm install` also downloads the `voyage-3-large` tokenizer from Hugging Face, through a
`postinstall` step. `voyageEmbedding()` needs it, and if the first download instead happens
inside the kernel, the file write trips tslab: the next cell, and every cell after it, fails
with `Unexpected pending rebuildTimer`. If the install could not reach Hugging Face, it
prints a warning and carries on; re-run `node scripts/prefetch-tokenizer.mjs` once you are
back online, or restart the kernel once after the first embedding cell.

## A note on the version pin

`package.json` pins `@mastra/mongodb` to **1.23.0**, and it must never drop below **1.15.0**.
Three of the things these notebooks teach, bring-your-own collections, `textQuery`, and
`hybridQuery`, do not exist in 1.14.0. All four notebooks depend on at least one of them:
even notebook 01 reaches `sample_mflix` through a bring-your-own registration. Downgrade
below 1.15.0 and they fail on a missing method.

This set was originally written against `1.15.0-alpha.1`, which was the only version with
those three features at the time. 1.15.0 shipped stable on 2026-07-28 and the pin moved off
the prerelease. It moved again, to 1.23.0, on 2026-10-14, when every dependency was brought
to its latest release and all four notebooks were re-run against it.

## The one dependency advisory we do not fix

**`sprintf-js` (moderate, GHSA-hp3w-g68c-fv3c).** No patched version exists: the advisory
covers every release through 1.1.3, the newest published. Two copies arrive transitively,
1.0.3 through `@mastra/core -> gray-matter -> js-yaml@3 -> argparse@1` and 1.1.3 through
`@huggingface/transformers -> onnxruntime-node -> global-agent -> roarr`. The bug is a
denial of service through an attacker-chosen format string, and neither path lets one in.
`argparse` is loaded only by js-yaml's command-line tool, which gray-matter never runs, and
roarr only ever formats global-agent's own constant log messages. Waiting on upstream.

Two others are fixed by the `overrides` block in `package.json` rather than by upgrading the
parent: `sharp` to 0.35.5 and `adm-zip` to 0.6.1. `@huggingface/transformers` and
`onnxruntime-node` still declare the vulnerable ranges, and both packages load and run
correctly against the overridden versions.

## Search indexes, and the M0 budget

This set creates the Atlas Search indexes it needs, and skips creation if it finds them
already there. **No other notebook has to run first** — start at 01 on a clean cluster and
it will build what it needs. `sample_mflix` ships plot *vectors*, not indexes over them,
so somebody has to do it.

Three indexes, which is exactly what a free M0 cluster allows:

| Index | Collection | Created by |
|-------|-----------|-----------|
| `movies_vector_index` | `embedded_movies` | notebook 01, if absent |
| `movies_fulltext_index` | `embedded_movies` | notebook 03, if absent |
| `mastra_cookbook_reviews_vector_index` | `mastra_cookbook_reviews` | notebook 02, dropped in its cleanup |

The first two use the same names as the LangChain notebooks in this repository, and both
sets create-if-absent. That is deliberate and it is what makes eight notebooks fit in three
slots: whichever set you run first builds them, and the other finds them. Neither set
depends on the other having run. **On a paid tier none of this is binding** — the budget is
an M0 constraint, not a property of the notebooks.

Two consequences worth knowing before you deviate from the happy path:

- **A managed `createIndex` costs two slots**, not one, because Mastra provisions a
  companion full-text index alongside the vector one. There is no room for that here, which
  is why the notebooks register indexes they created via the driver instead of letting
  Mastra provision them.
- **`deleteIndex` on a bring-your-own registration drops the underlying Atlas index.** The
  collection survives; the index does not. Notebook 01 explains this and deliberately does
  not call it, because doing so would destroy `movies_vector_index` for every other notebook
  in the repository. A later run would rebuild it, but slowly.

If an index limit is reported, the notebooks stop and list what is occupying the slots
rather than freeing one. That is deliberate: an index they did not create could be behind
something you depend on. The safe leftovers to drop yourself are notebook 02's
`mastra_cookbook_reviews` collection and its index, from an interrupted run. Notebook 02's
scratch collection name is settable with `MASTRA_REVIEWS_COLLECTION` if that name is
already taken on your cluster -- it refuses to reuse a collection it did not create.

## Shared helpers

Two modules hold the setup boilerplate the notebooks share. Teaching code stays in the
notebooks where you can read it.

- **`src/config.ts`** reads `partners/mastra/.env` and validates what it finds. One
  deliberate difference from the Python set: a tunable the file omits falls back to its
  documented default rather than to the surrounding shell. A stray `ANTHROPIC_MODEL` left in
  a shell by unrelated work is otherwise silently the model your notebook uses, and the
  resulting error points nowhere near the cause.
- **`src/utils.ts`** wraps the Atlas embedding and rerank endpoints, builds the Claude
  model, and opens the MongoDB connection.

## Verifying it

```bash
npm test            # 86 offline unit tests, plus a credential scan of every notebook output
npm run typecheck   # tsc --noEmit over src/ and scripts/
npm run smoke       # 8 steps against real Atlas, real Voyage, real Claude
```

`npm test` needs no cluster and no keys. It also runs
`scripts/check-notebook-outputs.ts`, which scans these four notebooks and the four LangChain
ones in `partners/langchain/` for connection strings and API keys in committed output,
including the live values in your `.env`. That check is why these notebooks can ship their results.

`npm run smoke` is the opposite tier: it needs a populated `.env` and crosses every
boundary the notebooks cross in a single run. The failures it exists to catch are the ones
a fake cannot reproduce, an index that reports READY but is not queryable, a 2048-d query
vector against a 1024-d index, an agent whose tool never fires. It cleans up what it
creates, and it reports skipped steps as SKIP rather than passing them silently.

## What this set leaves out

Mastra's semantic recall, working memory, and workflows are all absent, and not because
they are uninteresting. Each needs either vector-index budget or model calls beyond what a
free M0 cluster can spare. They are the natural next step on a paid cluster.
