# LangChain + MongoDB Atlas

Two notebook sets built on LangChain and LangGraph, in Python. Both run on a free Atlas M0
cluster against the `sample_mflix` sample dataset, and both open in Colab.

| Set | What you'll build | Notebooks |
|-----|-------------------|-----------|
| [Advanced RAG](./advanced-rag/) | A movie-discovery assistant that retrieves with vector, full-text, hybrid, graph, and auto-embedding techniques | 3 |
| [Claude Code & MCP](./claude-code-mcp/) | An agent that answers questions about your cluster by calling MongoDB MCP Server tools | 1 |

The MCP set lives here because its agent is built with `langgraph` and
`langchain-mcp-adapters`. MongoDB's MCP Server is the subject; LangChain is how the agent
around it is assembled.

## What you need

- A free Atlas **M0** cluster with **Load Sample Dataset** run (see
  [Load Sample Data](https://www.mongodb.com/docs/atlas/sample-data/)).
- An **Atlas API key** for the hosted embedding and rerank services at `ai.mongodb.com`.
- A **Claude API key**, or an Anthropic-compatible gateway via `ANTHROPIC_BASE_URL`.
- **Node.js 20+** for the MCP set only. The MCP Server runs on Node.

## Running locally

```bash
cd partners/langchain
pip install -r requirements.txt
cp .env.example .env      # then fill in your connection string and keys
jupyter lab
```

`requirements.txt` pins every version, verified together on Python 3.12. The notebooks read
credentials from `partners/langchain/.env` when there is one and prompt for anything missing,
which is what lets the same notebook run in Colab or on your machine.

Or click the **Open in Colab** badge at the top of any notebook and skip the install.

## The index budget

An M0 cluster allows three Atlas Search indexes, and these notebooks are built to fit.
Notebook 1 of Advanced RAG creates `movies_vector_index`, notebook 2 creates
`movies_fulltext_index`, and notebook 3 creates a short-lived index for the auto-embedding
demo that it drops when it finishes. Each creation is guarded by an existence check, so
re-running is free.

At the limit they stop and list what is occupying the slots rather than freeing one: an
index these notebooks did not create might be behind something you depend on, so asking
for a fresh cluster is the safe failure. Notebook 3's scratch collection works the same
way -- it refuses to reuse a collection it did not create, and
`LANGCHAIN_AUTO_EMBED_COLLECTION` renames it if the default is taken on your cluster.

The Mastra set uses the same two index names and also creates them if absent. The two sets
are independent — run either first — and sharing the names is what keeps the pair inside the
M0 budget. On a paid tier the limit is not binding.

If you hit an index limit, look for leftovers from an interrupted run: the
`auto_embed_demo` collection, or a demo index that outlived its notebook. Both are safe
for you to drop. No notebook here deletes a collection or an index it did not create.
