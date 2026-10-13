/**
 * Live smoke test: cross every boundary the notebooks cross, in one run.
 *
 *   npm run smoke          # from partners/mastra/, needs a populated ../../.env
 *
 * The unit tests use fakes. This uses nothing but the real thing -- real Atlas, real
 * Voyage, real Claude, real Mastra store -- because the failures that matter here are
 * the ones a fake cannot reproduce: an index that is READY but not queryable, a 2048-d
 * query vector against a 1024-d index, an agent whose tool never gets called.
 *
 * Everything it creates, it removes: a transient vector index in step 5 and a memory
 * thread in step 7. Failing before teardown leaves them behind, so the messages name
 * what to clean up.
 *
 * Two things this script learned the hard way, both worth knowing before you edit it:
 *
 * 1. `deleteIndex` on a BYO registration DROPS the Atlas search index the registration
 *    points at. Pointing a BYO index at `movies_vector_index` and then deleting the
 *    registration therefore destroys the index the notebooks (and the LangChain set,
 *    which uses the same name) rely on. So the BYO registration here is never deleted --
 *    only its registry row is cleared.
 *
 * 2. A managed `createIndex` provisions TWO Atlas Search indexes: the vectorSearch one
 *    and a companion dynamic full-text one. On an M0 (3-index limit) with the two
 *    sample_mflix indexes already present, that is 4 and the create fails. Step 5 is
 *    skipped unless there is room, and says so.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MongoDBStore, MongoDBVector } from '@mastra/mongodb';
import { MongoClient } from 'mongodb';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  APP_NAME,
  MFLIX_FULLTEXT_INDEX,
  MFLIX_VECTOR_INDEX,
  atlasRerank,
  buildAnthropicModel,
  createAtlasEmbedder,
  ensureFullTextSearchIndex,
  ensureVectorSearchIndex,
  getSecret,
} from '../src/utils.js';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/** Parse ../../.env. tsx does not read .env, and neither does node. */
function parseEnvFile(): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
  } catch {
    console.error(`No .env at ${REPO_ROOT}. Copy .env.example and fill it in.`);
    process.exit(1);
  }
  const parsed: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match) parsed[match[1]!] = match[2]!.trim().replace(/^['"]|['"]$/g, '');
  }
  return parsed;
}

const ENV_FILE = parseEnvFile();
Object.assign(process.env, ENV_FILE);

/** Read a value the .env file actually declares, ignoring the ambient shell. */
function envFileValue(name: string): string | undefined {
  return ENV_FILE[name];
}

const MONGODB_URI = getSecret('MONGODB_URI');
const ATLAS_AI_KEY = getSecret('MDB_ATLAS_API_KEY');
const ANTHROPIC_KEY = getSecret('ANTHROPIC_API_KEY');
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || undefined;
const DB_NAME = process.env.MONGODB_DB || 'sample_mflix';

/**
 * `ANTHROPIC_MODEL` is read from the .env file only, never from the ambient shell.
 *
 * loadEnv() writes .env into process.env, so a variable the .env omits keeps whatever
 * the surrounding shell had. That is how a Bedrock model id from an unrelated project
 * reached the Anthropic gateway here and came back `DeploymentNotFound`. An unset
 * variable should fall back to the documented default, not to someone's shell.
 */
const ANTHROPIC_MODEL = envFileValue('ANTHROPIC_MODEL') || 'claude-haiku-4-5';

const QUERY = 'deep sea creature attacks a research vessel';
const SMOKE_INDEX = 'mastra_smoke_index';
const BYO_INDEX = 'smoke_byo';
const SMOKE_RESOURCE = 'mastra-smoke-resource';

/** Atlas Search index limit on the free tier. Higher tiers allow more. */
const SEARCH_INDEX_LIMIT = 3;
/** A managed createIndex provisions a vectorSearch index AND a dynamic full-text one. */
const MANAGED_INDEX_SLOT_COST = 2;

let passed = 0;
let failed = 0;
let skipped = 0;

async function step(name: string, body: () => Promise<string>): Promise<void> {
  const started = Date.now();
  try {
    const detail = await body();
    passed += 1;
    console.log(`  PASS  ${name}  (${Date.now() - started}ms)\n        ${detail}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL  ${name}  (${Date.now() - started}ms)`);
    console.error(`        ${(error as Error).message}`);
  }
}

/** Report a step as skipped. Not a pass: silence here would read as coverage. */
function skip(name: string, reason: string): void {
  skipped += 1;
  console.log(`  SKIP  ${name}\n        ${reason}`);
}

console.log(`\nSmoke test: ${DB_NAME} on ${new URL(MONGODB_URI.replace(/^mongodb\+srv/, 'https')).host}\n`);

const vector = new MongoDBVector({
  id: 'smoke',
  uri: MONGODB_URI,
  dbName: DB_NAME,
  options: { appName: APP_NAME },
  embeddingFieldPath: 'plot_embedding_voyage_3_large',
});
await vector.connect();

const store = new MongoDBStore({ id: 'smoke-store', url: MONGODB_URI, dbName: DB_NAME });
const embedder = createAtlasEmbedder({ apiKey: ATLAS_AI_KEY });
let queryVector: number[] = [];

/**
 * Count Atlas Search indexes across the database, via the raw driver.
 *
 * `vector.listIndexes()` lists Mastra logical indexes, which is a different thing:
 * the BYO registration below adds a logical index without adding an Atlas one. The
 * cluster limit counts Atlas indexes, so that is what gets counted here.
 */
const rawClient = new MongoClient(MONGODB_URI, { appName: APP_NAME });
await rawClient.connect();

async function countSearchIndexes(): Promise<number> {
  const db = rawClient.db(DB_NAME);
  let total = 0;
  for (const collection of await db.listCollections().toArray()) {
    const indexes = await db
      .collection(collection.name)
      .listSearchIndexes()
      .toArray()
      .catch(() => []);
    total += indexes.length;
  }
  return total;
}

// 1. HTTP boundary: the Atlas-hosted Voyage embedding endpoint.
await step('embed a query via ai.mongodb.com', async () => {
  queryVector = await embedder.embedQuery(QUERY);
  return `${queryVector.length}-d vector, first value ${queryVector[0]!.toFixed(4)}`;
});

// 1b. The two Atlas indexes the notebooks query, created if this is a clean cluster.
//     Same create-if-absent path the notebooks take, so a smoke run proves that path
//     too rather than assuming someone else built the indexes first.
await step('ensure the sample_mflix search indexes exist', async () => {
  const movies = rawClient.db(DB_NAME).collection('embedded_movies');
  await ensureVectorSearchIndex(movies, {
    indexName: MFLIX_VECTOR_INDEX,
    path: 'plot_embedding_voyage_3_large',
    dimensions: queryVector.length,
    filterPaths: ['genres', 'year'],
  });
  await ensureFullTextSearchIndex(movies, {
    indexName: MFLIX_FULLTEXT_INDEX,
    fields: ['plot'],
  });
  return `${MFLIX_VECTOR_INDEX} and ${MFLIX_FULLTEXT_INDEX} queryable`;
});

// 2. Driver boundary: $vectorSearch against the sample_mflix index, registered as a
//    bring-your-own collection.
await step('BYO vector search over sample_mflix.embedded_movies', async () => {
  await vector.createIndex({
    indexName: BYO_INDEX,
    dimension: queryVector.length,
    metric: 'cosine',
    collectionName: 'embedded_movies',
    searchIndexName: MFLIX_VECTOR_INDEX,
    filterFields: ['genres', 'year'],
  });
  const results = await vector.query({
    indexName: BYO_INDEX,
    queryVector,
    topK: 3,
    metadataMode: 'document',
  });
  if (results.length === 0) throw new Error('no results -- check the index dimension');
  const titles = results.map((r) => (r.metadata as { title?: string }).title);
  return `top 3: ${titles.join(', ')}`;
});

// 3. Full-text: a different retrieval path over the same documents.
await step('full-text search via textQuery', async () => {
  const results = await vector.textQuery({
    indexName: BYO_INDEX,
    query: QUERY,
    paths: ['plot'],
    topK: 3,
    metadataMode: 'document',
    searchIndexName: MFLIX_FULLTEXT_INDEX,
  });
  if (results.length === 0) throw new Error(`no results -- is ${MFLIX_FULLTEXT_INDEX} READY?`);
  return `top 3: ${results.map((r) => (r.metadata as { title?: string }).title).join(', ')}`;
});

// 4. Server boundary: $rankFusion. Gated at MongoDB >= 8.0 by the store; the server
//    is the final authority on whether the stage is actually enabled.
await step('hybrid search via $rankFusion', async () => {
  const results = await vector.hybridQuery({
    indexName: BYO_INDEX,
    queryVector,
    query: QUERY,
    paths: ['plot'],
    topK: 3,
    metadataMode: 'document',
    textSearchIndexName: MFLIX_FULLTEXT_INDEX,
  });
  if (results.length === 0) throw new Error('no results from $rankFusion');
  return `top 3: ${results.map((r) => (r.metadata as { title?: string }).title).join(', ')}`;
});

// 5. Write path: a managed index the store owns end to end -- the only step that
//    provisions Atlas Search indexes, and it provisions TWO (vectorSearch plus a
//    companion dynamic full-text one). On an M0 already holding the two sample_mflix
//    indexes that exceeds the 3-index limit, so check for room before trying.
const slotsUsed = await countSearchIndexes();
if (slotsUsed + MANAGED_INDEX_SLOT_COST > SEARCH_INDEX_LIMIT) {
  skip(
    'managed index create -> upsert -> query -> delete',
    `${slotsUsed} of ${SEARCH_INDEX_LIMIT} Atlas Search index slots in use; a managed index ` +
      `needs ${MANAGED_INDEX_SLOT_COST} (vectorSearch + companion full-text). ` +
      `Covered instead by the BYO write-path step below, which needs only 1 slot.`,
  );
} else {
  await step('managed index create -> upsert -> query -> delete', async () => {
    await vector.createIndex({ indexName: SMOKE_INDEX, dimension: 4, metric: 'cosine' });
    await vector.waitForIndexReady({ indexName: SMOKE_INDEX, timeoutMs: 180_000 });
    const ids = await vector.upsert({
      indexName: SMOKE_INDEX,
      vectors: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ],
      metadata: [{ label: 'first' }, { label: 'second' }],
      documents: ['first document', 'second document'],
    });
    const results = await vector.query({
      indexName: SMOKE_INDEX,
      queryVector: [1, 0, 0, 0],
      topK: 1,
    });
    // Safe here: SMOKE_INDEX is managed, so deleteIndex drops a collection this store
    // created. Never do this for the BYO registration -- see the header note.
    await vector.deleteIndex({ indexName: SMOKE_INDEX });
    if (results[0]?.metadata?.label !== 'first') {
      throw new Error(
        `expected the nearest neighbour to be "first", got ${JSON.stringify(results[0]?.metadata)}. ` +
          `Index ${SMOKE_INDEX} was deleted; re-run to retry.`,
      );
    }
    return `upserted ${ids.length}, retrieved "${results[0]!.metadata!.label}", index deleted`;
  });
}

// 5b. The write guard, and the write path that fits on an M0.
//
// A BYO collection is read-only by default, and `allowWrites: true` is the opt-in. Both
// halves matter: that a write is refused without the flag, and that it succeeds with it.
// This uses its own throwaway collection, so its 1 vectorSearch index fits M0's cap and
// no caller data is ever at risk.
await step('BYO read-only guard, then allowWrites round trip', async () => {
  const scratch = `mastra_smoke_scratch_${process.pid}`;
  const db = rawClient.db(DB_NAME);
  await db.createCollection(scratch);

  try {
    // Read-only registration: upsert must be refused.
    await vector.createIndex({
      indexName: 'smoke_readonly',
      dimension: 4,
      metric: 'cosine',
      collectionName: scratch,
      searchIndexName: `${scratch}_vector_index`,
    });
    let refused = false;
    try {
      await vector.upsert({ indexName: 'smoke_readonly', vectors: [[1, 0, 0, 0]] });
    } catch {
      refused = true;
    }
    if (!refused) throw new Error('a read-only BYO index accepted a write');

    // Same collection, opted in. Retargeting the same logical index name is a
    // conflict, so this is a second registration.
    await vector.createIndex({
      indexName: 'smoke_writable',
      dimension: 4,
      metric: 'cosine',
      collectionName: scratch,
      searchIndexName: `${scratch}_vector_index`,
      allowWrites: true,
    });
    const ids = await vector.upsert({
      indexName: 'smoke_writable',
      vectors: [[1, 0, 0, 0]],
      metadata: [{ label: 'written' }],
    });
    const stored = await db.collection(scratch).countDocuments();
    if (stored !== 1) throw new Error(`expected 1 document in ${scratch}, found ${stored}`);
    return `write refused without allowWrites, accepted with it (${ids.length} doc, verified in ${scratch})`;
  } finally {
    // Drop the scratch collection directly; deleting the registrations via deleteIndex
    // would take the vectorSearch index with them anyway, but this is unambiguous.
    await db.collection(scratch).drop().catch(() => {});
    await db
      .collection('__mastra_vector_indexes__')
      .deleteMany({ _id: { $in: ['smoke_readonly', 'smoke_writable'] } as never });
  }
});

// 6. Reranking: a second HTTP service, and the step that most often surfaces a
//    key without rerank entitlement.
await step('rerank candidates via ai.mongodb.com', async () => {
  const candidates = [
    'A giant squid attacks a deep sea research station.',
    'A romantic comedy set in a Paris bakery.',
    'Scientists aboard a submarine encounter an unknown creature.',
  ];
  const ranked = await atlasRerank(QUERY, candidates, { apiKey: ATLAS_AI_KEY, topN: 2 });
  if (ranked.length !== 2) throw new Error(`expected 2 results, got ${ranked.length}`);
  if (ranked[0]!.index === 1) throw new Error('the bakery comedy ranked first -- reranker is wrong');
  return `top result index ${ranked[0]!.index} at ${ranked[0]!.score.toFixed(4)}`;
});

// 7. LLM + tool + persistence in one call. The assertion is that the tool actually
//    ran and the thread survived to storage -- an agent that answers from its own
//    knowledge without calling the tool looks like success in the transcript.
await step('agent with a tool, persisting to MongoDBStore', async () => {
  let toolCalls = 0;
  const searchMovies = createTool({
    id: 'search_movies',
    description: 'Search movie plots semantically. Use this for any question about films.',
    inputSchema: z.object({ query: z.string().describe('What the user is looking for') }),
    outputSchema: z.object({ titles: z.array(z.string()) }),
    // Mastra v1 hands the validated input straight to execute -- no `{ context }` wrapper.
    execute: async ({ query }) => {
      toolCalls += 1;
      const vectorForQuery = await embedder.embedQuery(query);
      const results = await vector.query({
        indexName: BYO_INDEX,
        queryVector: vectorForQuery,
        topK: 3,
        metadataMode: 'document',
      });
      return { titles: results.map((r) => String((r.metadata as { title?: string }).title)) };
    },
  });

  const agent = new Agent({
    id: 'smoke-agent',
    name: 'smoke-agent',
    instructions:
      'You recommend movies. Always call search_movies before answering; never answer from memory.',
    model: buildAnthropicModel({
      apiKey: ANTHROPIC_KEY,
      model: ANTHROPIC_MODEL,
      baseUrl: ANTHROPIC_BASE_URL,
    }),
    tools: { searchMovies },
    memory: new Memory({ storage: store }),
  });

  const threadId = `smoke-thread-${process.pid}`;
  const result = await agent.generate('Recommend a movie about a deep sea monster.', {
    memory: { thread: threadId, resource: SMOKE_RESOURCE },
  });

  // store.stores.memory, not store.saveThread -- MongoDBStore is a façade over
  // per-domain sub-stores, and the thread/message API lives on the memory domain.
  const memoryStore = store.stores.memory;
  if (!memoryStore) throw new Error('MongoDBStore exposed no memory sub-store');
  const thread = await memoryStore.getThreadById({ threadId });
  await memoryStore.deleteThread({ threadId });

  if (toolCalls === 0) throw new Error('the agent answered without calling the tool');
  if (!thread) throw new Error(`no thread persisted for ${threadId}`);
  if (!result.text.trim()) throw new Error('the agent returned empty text');
  return `${toolCalls} tool call(s), thread persisted and deleted, ${result.text.trim().length} chars of reply`;
});

// Sweep any memory left by an earlier run that failed before its own teardown.
// Everything the agent step writes is tagged with SMOKE_RESOURCE, so this is scoped
// to this script's data and cannot touch a reader's threads.
// Both collections carry `resourceId`, so one filter covers both. Note that messages
// key their thread as `thread_id` (snake case), not `threadId` -- deleting a thread
// through the store API does not remove them, so they are swept explicitly here.
const sweep = { resourceId: SMOKE_RESOURCE };
const sweptMessages = await rawClient.db(DB_NAME).collection('mastra_messages').deleteMany(sweep);
const sweptThreads = await rawClient.db(DB_NAME).collection('mastra_threads').deleteMany(sweep);
if (sweptMessages.deletedCount + sweptThreads.deletedCount > 0) {
  console.log(
    `  swept ${sweptThreads.deletedCount} thread(s) and ${sweptMessages.deletedCount} message(s) ` +
      `belonging to ${SMOKE_RESOURCE}`,
  );
}

// Tear down the BYO registration by deleting its registry row directly.
//
// NOT vector.deleteIndex({ indexName: BYO_INDEX }) -- that drops the Atlas search index
// the registration points at, which here is the shared `movies_vector_index` the
// LangChain notebooks create. It leaves `embedded_movies` intact but destroys the index,
// and the next run fails with zero results. Only the bookkeeping row belongs to us.
await rawClient.db(DB_NAME).collection('__mastra_vector_indexes__').deleteOne({ _id: BYO_INDEX as never });

await vector.disconnect();
await store.close?.();
await rawClient.close();

console.log(`\n${passed} passed, ${skipped} skipped, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
