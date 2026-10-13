# MongoDB MCP Server & AI Agents

Connect AI agents and developer tools to MongoDB through the **Model Context Protocol (MCP)**. The
MongoDB MCP Server exposes your Atlas cluster as a set of tools an agent can call (list collections,
run aggregations, inspect schema) with no custom tool code.

## The notebook

| Notebook | What you'll build | Time |
|----------|-------------------|------|
| [MongoDB MCP Server + AI Agents](./01_mongodb_mcp_and_agent.ipynb) | A LangGraph agent that answers questions about `sample_mflix` by calling MongoDB MCP tools | ~30 min |

## What you need

- **Node.js 20+**. The MCP Server runs on Node. The notebook installs the server with
  `npm install -g mongodb-mcp-server`.
- A **MongoDB Atlas connection string** and a **Claude API key** (an Anthropic-compatible gateway
  works; set `ANTHROPIC_BASE_URL`).
- Any Atlas cluster with sample data. The cluster from the Advanced RAG notebooks is a good fit.

## Beyond the notebook

Three related capabilities live in your terminal and IDE rather than a notebook:

- **The MongoDB plugin for Claude Code**: explore and query a cluster in natural language from the
  command line, powered by the same MCP Server.
- **Agent Skills**: reusable MongoDB expertise (schema design, query optimization, search patterns)
  that an agent loads on demand.
- **Deploying agents**: moving the local agent to a hosted platform.

The MongoDB documentation for the [MCP Server](https://www.mongodb.com/docs/mcp-server/) covers
these in depth.
