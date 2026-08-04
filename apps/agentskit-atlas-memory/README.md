# AgentsKit memory with MongoDB Atlas Vector Search

This minimal TypeScript example uses MongoDB Atlas as a replaceable vector-memory
backend for an agent. It exercises the complete memory lifecycle: store three
documents, retrieve the closest context, print the result, and remove the demo
documents.

The sample uses small deterministic vectors so the integration is easy to
inspect. In an application, replace them with vectors from any embedding
provider; the MongoDB collection and AgentsKit memory contract stay unchanged.

## Prerequisites

- Node.js 20 or newer
- A MongoDB Atlas cluster
- An Atlas Vector Search index named `agentskit_vector_index` on
  `agentskit_demo.memory`

Use this index definition for the sample's three-dimensional vectors:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3,
      "similarity": "cosine"
    }
  ]
}
```

## Run the example

```bash
cp .env.example .env
npm install
node --env-file=.env --import tsx src/index.ts
```

Set `MONGODB_URI` in `.env` before running. The database, collection, and index
names can also be changed there.

The script deletes its sample records before and after the run, so repeated
executions do not leave demo data behind.

## Validate without credentials

```bash
npm run typecheck
npm test
```

The deterministic test exercises the collection boundary and verifies the
generated `$vectorSearch` pipeline without contacting Atlas.
