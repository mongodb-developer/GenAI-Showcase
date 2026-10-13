/**
 * Shared setup helpers for the Mastra notebooks.
 *
 * Teaching code -- retrievers, comparisons, agents -- stays inline in the notebooks.
 * This module holds only the boilerplate every notebook repeats: reading secrets,
 * connecting to Atlas, calling the Atlas-hosted embedding and rerank endpoints, and
 * configuring a Claude model against either the Anthropic API or a compatible gateway.
 *
 * It mirrors the LangChain set's `utils.py` function for function, so the two partners
 * can be read side by side. Nothing here touches the network at import time, so it is
 * safe to import in any cell. The one HTTP dependency is injected as a `fetcher` seam
 * so the unit tests run without a network or API keys.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { MongoClient } from 'mongodb';
import type { Db } from 'mongodb';

/** MongoDB's Atlas-hosted AI services: Voyage embeddings and reranking. */
export const ATLAS_AI_BASE_URL = 'https://ai.mongodb.com/v1';
export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * The dimension `sample_mflix.embedded_movies` stores its plot vectors at.
 *
 * `voyage-3-large` supports 256/512/1024/2048 and **defaults to 1024**. The sample
 * data is 2048. Querying 2048-d stored vectors with a 1024-d query vector is not an
 * error -- Atlas returns results, they are just meaningless. So every embed call here
 * sends the dimension explicitly and checks what came back.
 */
export const SAMPLE_MFLIX_DIMENSIONS = 2048;

/** Telemetry tag so MongoDB can attribute this workload (GenAI-Showcase convention). */
export const APP_NAME = 'devrel.partner.mastra.typescript';

/** Raised when the embedding service returns a vector of unexpected length. */
export class EmbeddingDimensionMismatch extends Error {
  constructor(expected: number, actual: number) {
    super(
      `Expected ${expected}-d vectors, got ${actual}. ` +
        `A dimension mismatch against sample_mflix returns plausible-looking but ` +
        `meaningless neighbours, so this fails loudly instead.`,
    );
    this.name = 'EmbeddingDimensionMismatch';
  }
}

/** Raised when a required environment variable is unset or blank. */
export class MissingSecretError extends Error {
  constructor(name: string) {
    super(
      `${name} is not set. Add it to partners/mastra/.env (see .env.example) ` +
        `and restart the kernel, or export it before launching Jupyter.`,
    );
    this.name = 'MissingSecretError';
  }
}

/** The injectable HTTP seam. Matches the shape of global `fetch`. */
export type Fetcher = (url: any, init: any) => Promise<Response>;

// --------------------------------------------------------------------------
// Secrets: environment only.
// --------------------------------------------------------------------------
/**
 * Return a secret from the environment, or throw naming the variable.
 *
 * The Python set falls back to `getpass` so its notebooks work in Colab. A TypeScript
 * kernel has no equivalent -- and this set does not run in Colab anyway -- so the
 * fallback becomes an error that says which variable to set and where.
 */
export function getSecret(
  name: string,
  opts: { env?: Record<string, string | undefined> } = {},
): string {
  const env = opts.env ?? process.env;
  const value = env[name];
  if (value && value.trim()) return value;
  throw new MissingSecretError(name);
}

// --------------------------------------------------------------------------
// LLM configuration: direct Anthropic API vs. an Anthropic-compatible gateway.
// --------------------------------------------------------------------------
/**
 * Drop a trailing `/v1/messages` and any trailing slash from a gateway URL.
 *
 * The Anthropic SDK appends `/v1/messages` itself, so `baseUrl` must be the API root.
 * People paste the full endpoint out of a curl example, so normalise it.
 */
export function stripMessagesPath(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  for (const suffix of ['/v1/messages', '/messages']) {
    if (url.endsWith(suffix)) {
      url = url.slice(0, -suffix.length);
      break;
    }
  }
  return url;
}

/**
 * Build a Claude model an `Agent` can use, for either a direct or gateway connection.
 *
 * Direct Anthropic API: the key goes through as usual.
 * Gateway (e.g. Azure API Management fronting a foundry): the SDK's default
 * `x-api-key` header is rejected with a 401, so the key rides in an `api-key`
 * header instead and the base URL is normalised to the API root.
 */
export function buildAnthropicModel(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string | undefined;
  fetcher?: Fetcher;
}) {
  const { apiKey, model, baseUrl, fetcher } = opts;

  const provider = baseUrl
    ? createAnthropic({
        // The SDK insists on an apiKey and turns it into an `x-api-key` header, which
        // the gateway rejects with a 401. `headers` is merged last and undefined
        // entries are dropped, so this deletes x-api-key and sends `api-key` instead.
        apiKey: 'unused-see-api-key-header',
        baseURL: `${stripMessagesPath(baseUrl)}/v1`,
        headers: {
          'x-api-key': undefined,
          'api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        } as unknown as Record<string, string>,
        ...(fetcher ? { fetch: fetcher as typeof fetch } : {}),
      })
    : createAnthropic({
        apiKey,
        ...(fetcher ? { fetch: fetcher as typeof fetch } : {}),
      });

  return provider(model);
}

// --------------------------------------------------------------------------
// Embeddings: Voyage via MongoDB's Atlas-hosted endpoint.
// --------------------------------------------------------------------------
export interface AtlasEmbedder {
  readonly model: string;
  readonly dimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

/**
 * An embedder backed by the Atlas-hosted Voyage endpoint, with a dimension guard.
 *
 * One model embeds both documents and queries by default. That is required when
 * querying a collection whose stored vectors come from a single model -- as
 * `sample_mflix`'s `voyage-3-large` plot vectors do -- since query and document
 * vectors have to share a space.
 *
 * The notebooks also use `@mastra/voyageai`'s `voyageEmbedding()` directly, which is
 * the idiomatic Mastra path and what a reader should copy. This helper exists for the
 * repeated case: one call, 2048 dimensions, checked.
 */
export function createAtlasEmbedder(opts: {
  apiKey: string;
  model?: string;
  dimensions?: number;
  baseUrl?: string;
  fetcher?: Fetcher;
}): AtlasEmbedder {
  const model = opts.model ?? 'voyage-3-large';
  const dimensions = opts.dimensions ?? SAMPLE_MFLIX_DIMENSIONS;
  const baseUrl = opts.baseUrl ?? ATLAS_AI_BASE_URL;
  const fetcher: Fetcher = opts.fetcher ?? ((url, init) => fetch(url, init));

  async function embed(texts: string[], inputType: 'query' | 'document'): Promise<number[][]> {
    const response = await fetcher(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: texts,
        input_type: inputType,
        output_dimension: dimensions,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Atlas embeddings request failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as { data: Array<{ embedding: number[] }> };
    const vectors = payload.data.map((item) => item.embedding);
    for (const vector of vectors) {
      if (vector.length !== dimensions) {
        throw new EmbeddingDimensionMismatch(dimensions, vector.length);
      }
    }
    return vectors;
  }

  return {
    model,
    dimensions,
    async embedQuery(text) {
      const [vector] = await embed([text], 'query');
      return vector!;
    },
    embedDocuments(texts) {
      return embed([...texts], 'document');
    },
  };
}

// --------------------------------------------------------------------------
// Reranking: reorder candidates via the Atlas-hosted rerank endpoint.
// --------------------------------------------------------------------------
export interface RerankedDocument {
  /** Position in the array that was passed in, so callers can map back to their objects. */
  index: number;
  document: string;
  score: number;
}

/** Return `documents` reordered most-relevant-first, truncated to `topN`. */
export async function atlasRerank(
  query: string,
  documents: string[],
  opts: {
    apiKey: string;
    topN?: number;
    model?: string;
    baseUrl?: string;
    fetcher?: Fetcher;
  },
): Promise<RerankedDocument[]> {
  if (documents.length === 0) return [];

  const model = opts.model ?? 'rerank-2.5';
  const baseUrl = opts.baseUrl ?? ATLAS_AI_BASE_URL;
  const fetcher: Fetcher = opts.fetcher ?? ((url, init) => fetch(url, init));
  // `?? documents.length` rather than `|| documents.length`: an explicit topN of 0
  // means zero, not "all of them".
  const topK = opts.topN ?? documents.length;

  const response = await fetcher(`${baseUrl}/rerank`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, query, documents, top_k: topK }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Atlas rerank request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as {
    data: Array<{ index: number; document?: string; relevance_score: number }>;
  };

  return payload.data
    .slice()
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, topK)
    .map((result) => ({
      index: result.index,
      document: result.document ?? documents[result.index]!,
      score: result.relevance_score,
    }));
}

// --------------------------------------------------------------------------
// Atlas connection.
// --------------------------------------------------------------------------
/** Connect to Atlas and verify it with a ping. */
export async function connect(
  uri: string,
  opts: { appName?: string } = {},
): Promise<{ client: MongoClient; db(name: string): Db }> {
  const client = new MongoClient(uri, {
    appName: opts.appName ?? APP_NAME,
    serverSelectionTimeoutMS: 20_000,
  });
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  return { client, db: (name: string) => client.db(name) };
}

// --------------------------------------------------------------------------
// Atlas Search indexes: create if absent, then wait until queryable.
// --------------------------------------------------------------------------
/**
 * The Atlas Search indexes this set queries on `sample_mflix.embedded_movies`.
 *
 * These names are shared with the LangChain notebooks in this repository *by
 * convention, not by dependency*. Either set can run first on a clean cluster: whoever
 * gets there creates the index, and the other finds it and moves on. That is the whole
 * point of the `ensure*` helpers below -- a notebook set that assumed another partner's
 * notebooks had already run was an ordering bug, not a feature.
 *
 * Reusing the names is still what keeps a free M0 cluster viable. M0 allows three search
 * indexes; these two plus notebook 02's scratch-collection index is exactly three.
 * Give each set its own names and the pair no longer fits.
 */
export const MFLIX_VECTOR_INDEX = 'movies_vector_index';
export const MFLIX_FULLTEXT_INDEX = 'movies_fulltext_index';

/** A search index as `listSearchIndexes` actually returns it. */
interface SearchIndexInfo {
  name: string;
  status?: string;
  queryable?: boolean;
}

/** Minimal surface of a driver collection, so the unit tests can pass a fake. */
export interface SearchIndexCollection {
  listSearchIndexes(name?: string): { toArray(): Promise<unknown[]> };
  createSearchIndex(description: unknown): Promise<unknown>;
}

/** Atlas Search index limit on the free M0 tier. Paid tiers allow more. */
export const M0_SEARCH_INDEX_LIMIT = 3;

/**
 * Raised when creating an index would exceed the cluster's search index limit.
 *
 * The message names what is already there and what the reader can do about it. It
 * deliberately stops rather than freeing a slot: an index this code did not create
 * belongs to the reader, and deleting one to make room could destroy the index behind
 * somebody's application. Asking for a fresh cluster is the safe failure.
 */
export class SearchIndexBudgetExceeded extends Error {
  constructor(
    wanted: string,
    existing: Array<{ collection: string; index: string }>,
    limit: number,
  ) {
    const inventory = existing
      .map(({ collection, index }) => `  ${collection}: ${index}`)
      .join('\n');
    super(
      `Cannot create "${wanted}": this cluster already has ${existing.length} Atlas Search ` +
        `index(es), which is the limit${limit === M0_SEARCH_INDEX_LIMIT ? ' on a free M0 tier' : ''}:\n` +
        `${inventory}\n\n` +
        `Use a fresh Atlas cluster, upgrade the tier, or drop an index you no longer need ` +
        `from the Atlas UI. This notebook will not delete indexes it did not create.\n` +
        `If a previous run of this cookbook was interrupted, the leftover is most likely an ` +
        `index on a scratch collection (a "*_reviews" or "auto_embed_demo" collection) -- ` +
        `those are safe for you to remove.`,
    );
    this.name = 'SearchIndexBudgetExceeded';
  }
}

export interface EnsureIndexOptions {
  /** Seconds to wait for a newly created index to become queryable. */
  timeoutSeconds?: number;
  /** Poll interval in seconds. */
  pollSeconds?: number;
  /** Injectable sleep, so tests do not wait in real time. */
  sleep?: (ms: number) => Promise<void>;
  /** Where progress goes. Defaults to `console.log`. */
  log?: (message: string) => void;
  /**
   * The whole database, used to count existing search indexes before creating one.
   *
   * Optional: without it the budget preflight is skipped and Atlas's own (less
   * specific) error surfaces instead. The notebooks always pass it.
   */
  db?: SearchIndexDatabase;
  /** Search index ceiling to enforce. Defaults to the M0 limit of three. */
  indexLimit?: number;
}

/** Minimal surface of a driver `Db`, so the unit tests can pass a fake. */
export interface SearchIndexDatabase {
  listCollections(): { toArray(): Promise<Array<{ name: string }>> };
  collection(name: string): SearchIndexCollection;
}

/**
 * Every Atlas Search index in the database, as `{ collection, index }` pairs.
 *
 * Counts *Atlas* indexes, not Mastra logical ones: a bring-your-own registration adds a
 * logical index without adding an Atlas index, and it is the Atlas count the cluster
 * limit applies to.
 */
export async function listAllSearchIndexes(
  db: SearchIndexDatabase,
): Promise<Array<{ collection: string; index: string }>> {
  const found: Array<{ collection: string; index: string }> = [];
  for (const { name } of await db.listCollections().toArray()) {
    const indexes = (await db
      .collection(name)
      .listSearchIndexes()
      .toArray()
      .catch(() => [])) as SearchIndexInfo[];
    for (const index of indexes) found.push({ collection: name, index: index.name });
  }
  return found;
}

/**
 * Throw `SearchIndexBudgetExceeded` if creating `wanted` would exceed the limit.
 *
 * Called only when `wanted` does not already exist, so an index that is already there
 * never trips this.
 */
async function assertRoomForIndex(
  wanted: string,
  opts: EnsureIndexOptions,
): Promise<void> {
  if (!opts.db) return;
  const limit = opts.indexLimit ?? M0_SEARCH_INDEX_LIMIT;
  const existing = await listAllSearchIndexes(opts.db);
  if (existing.length >= limit) throw new SearchIndexBudgetExceeded(wanted, existing, limit);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Block until `indexName` reports `queryable`, or throw once the timeout elapses.
 *
 * Atlas builds search indexes asynchronously (PENDING -> BUILDING -> READY) and querying
 * one that is not yet queryable is an error, so creation is only half the job.
 */
async function waitUntilQueryable(
  collection: SearchIndexCollection,
  indexName: string,
  opts: EnsureIndexOptions,
): Promise<void> {
  const timeoutSeconds = opts.timeoutSeconds ?? 420;
  const pollSeconds = opts.pollSeconds ?? 5;
  const sleep = opts.sleep ?? defaultSleep;
  const log = opts.log ?? console.log;
  const attempts = Math.max(1, Math.ceil(timeoutSeconds / pollSeconds));

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const found = (await collection.listSearchIndexes(indexName).toArray()) as SearchIndexInfo[];
    const status = found[0];
    if (status?.queryable) {
      log(`  ${indexName} is queryable after ~${attempt * pollSeconds}s.`);
      return;
    }
    await sleep(pollSeconds * 1000);
  }
  throw new Error(
    `${indexName} did not become queryable within ${timeoutSeconds}s. ` +
      `Check the index status in the Atlas UI -- on a free M0 cluster a build can be slow, ` +
      `and hitting the three-index limit surfaces here rather than at creation.`,
  );
}

/**
 * The scratch collection notebook 02 creates for its bring-your-own walkthrough.
 *
 * Named for the cookbook rather than for the data, because this collection is created and
 * dropped by a notebook. An earlier version used `movie_reviews`, which is a plausible
 * name for a collection a reader already has -- and dropping it would have destroyed real
 * data. Nothing here touches a collection whose name it did not choose.
 */
export const REVIEWS_COLLECTION = 'mastra_cookbook_reviews';

/** Raised when a scratch collection already exists and is therefore not ours to reuse. */
export class ScratchCollectionExists extends Error {
  constructor(name: string) {
    super(
      `"${name}" already exists on this cluster. This notebook creates that collection ` +
        `and drops it during cleanup, so it will not reuse or overwrite one it did not ` +
        `create -- the contents might be yours.\n\n` +
        `If it is a leftover from an interrupted run of this notebook, drop it (and any ` +
        `search index on it) and re-run. If it is your data, set MASTRA_REVIEWS_COLLECTION ` +
        `in your .env to a name this notebook can own.`,
    );
    this.name = 'ScratchCollectionExists';
  }
}

/**
 * Claim `name` as a scratch collection this run owns, or throw if it already exists.
 *
 * The return value is the name, so callers can use it inline. Pairing this with a drop at
 * the end of the notebook is what makes a run idempotent *without* an unconditional drop
 * at the start -- the destructive step only ever runs against a collection we just made.
 */
export async function claimScratchCollection(
  db: SearchIndexDatabase,
  name: string = REVIEWS_COLLECTION,
): Promise<string> {
  const existing = await db.listCollections().toArray();
  if (existing.some((collection) => collection.name === name)) {
    throw new ScratchCollectionExists(name);
  }
  return name;
}

/**
 * Ensure a vector search index exists on `collection`, creating it if it does not.
 *
 * Returns the index name either way, so callers can pass it straight to
 * `searchIndexName`. Existing indexes are left exactly as they are: we do not compare
 * definitions and do not attempt to update, because the common case is an index some
 * other notebook (or the Atlas UI) created with a compatible definition, and silently
 * rebuilding someone else's index would be a worse surprise than a mismatch.
 */
export async function ensureVectorSearchIndex(
  collection: SearchIndexCollection,
  params: {
    indexName: string;
    path: string;
    dimensions: number;
    similarity?: 'cosine' | 'euclidean' | 'dotProduct';
    filterPaths?: string[];
  },
  opts: EnsureIndexOptions = {},
): Promise<string> {
  const log = opts.log ?? console.log;
  const existing = (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
  if (existing.some((index) => index.name === params.indexName)) {
    log(`  ${params.indexName} already exists.`);
    return params.indexName;
  }

  await assertRoomForIndex(params.indexName, opts);
  log(`  Creating ${params.indexName} (vectorSearch, ${params.dimensions}-d)...`);
  await collection.createSearchIndex({
    name: params.indexName,
    type: 'vectorSearch',
    definition: {
      fields: [
        {
          type: 'vector',
          path: params.path,
          numDimensions: params.dimensions,
          similarity: params.similarity ?? 'cosine',
        },
        ...(params.filterPaths ?? []).map((path) => ({ type: 'filter', path })),
      ],
    },
  });
  await waitUntilQueryable(collection, params.indexName, opts);
  return params.indexName;
}

/**
 * Ensure a full-text (`search`) index exists on `collection`, creating it if it does not.
 *
 * The definition mirrors what the LangChain set's `create_fulltext_search_index` produces
 * for the same name: a static mapping over the given fields as `string`. Matching it
 * matters -- both sets query the same index by name, so a divergent mapping would make
 * results depend on which notebook happened to create it.
 */
export async function ensureFullTextSearchIndex(
  collection: SearchIndexCollection,
  params: { indexName: string; fields: string[] },
  opts: EnsureIndexOptions = {},
): Promise<string> {
  const log = opts.log ?? console.log;
  const existing = (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
  if (existing.some((index) => index.name === params.indexName)) {
    log(`  ${params.indexName} already exists.`);
    return params.indexName;
  }

  await assertRoomForIndex(params.indexName, opts);
  log(`  Creating ${params.indexName} (search, fields: ${params.fields.join(', ')})...`);
  await collection.createSearchIndex({
    name: params.indexName,
    type: 'search',
    definition: {
      mappings: {
        dynamic: false,
        fields: Object.fromEntries(params.fields.map((field) => [field, { type: 'string' }])),
      },
    },
  });
  await waitUntilQueryable(collection, params.indexName, opts);
  return params.indexName;
}
