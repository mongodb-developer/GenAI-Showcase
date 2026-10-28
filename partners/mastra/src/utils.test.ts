/**
 * Unit tests for src/utils.ts.
 *
 * Run from partners/mastra/:  npm run test:unit
 *
 * These mirror the LangChain set's test_utils.py so the two partners can be read
 * side by side. Everything here uses in-memory fakes -- no live Atlas, no keys --
 * except the mock-parity block at the bottom, which is the one test that checks the
 * fake still resembles the service it stands in for. That block skips itself when
 * MDB_ATLAS_API_KEY is unset.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  ATLAS_AI_BASE_URL,
  APP_NAME,
  EmbeddingDimensionMismatch,
  MFLIX_FULLTEXT_INDEX,
  MFLIX_VECTOR_INDEX,
  MissingSecretError,
  REVIEWS_COLLECTION,
  SAMPLE_MFLIX_DIMENSIONS,
  ScratchCollectionExists,
  SearchIndexBudgetExceeded,
  atlasRerank,
  buildAnthropicModel,
  claimScratchCollection,
  createAtlasEmbedder,
  ensureFullTextSearchIndex,
  ensureVectorSearchIndex,
  getSecret,
  listAllSearchIndexes,
  stripMessagesPath,
} from './utils.js';

// --------------------------------------------------------------------------
// A fetch stand-in. Records what was sent, returns canned embeddings.
// --------------------------------------------------------------------------
interface FakeCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

function fakeFetcher(opts: { dims?: number; status?: number } = {}) {
  const dims = opts.dims ?? SAMPLE_MFLIX_DIMENSIONS;
  const status = opts.status ?? 200;
  const calls: FakeCall[] = [];

  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(init.body as string);
    calls.push({ url, headers, body });

    if (status < 200 || status >= 300) {
      return new Response('nope', { status });
    }
    const inputCount = Array.isArray(body.input) ? body.input.length : 1;
    const data = Array.from({ length: inputCount }, (_, i) => ({
      index: i,
      embedding: Array.from({ length: dims }, () => 0.1),
    }));
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetcher, calls };
}

function fakeRerankFetcher(rankedOrder: number[]) {
  const calls: FakeCall[] = [];
  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(init.body as string);
    calls.push({ url, headers: init.headers as Record<string, string>, body });
    const data = rankedOrder.map((originalIndex, rank) => ({
      index: originalIndex,
      document: body.documents[originalIndex],
      relevance_score: 1 - rank * 0.1,
    }));
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetcher, calls };
}

// --------------------------------------------------------------------------
// getSecret: environment-only. There is no getpass in a TypeScript kernel, so
// the Python set's interactive fallback becomes a loud, named failure instead.
// --------------------------------------------------------------------------
describe('getSecret', () => {
  it('reads from the environment', () => {
    expect(getSecret('MY_KEY', { env: { MY_KEY: 'from-env' } })).toBe('from-env');
  });

  it('throws MissingSecretError when unset', () => {
    expect(() => getSecret('MY_KEY', { env: {} })).toThrow(MissingSecretError);
  });

  it('treats a blank value as missing', () => {
    expect(() => getSecret('MY_KEY', { env: { MY_KEY: '   ' } })).toThrow(MissingSecretError);
  });

  it('names the missing variable in the message, so the fix is obvious', () => {
    expect(() => getSecret('MDB_ATLAS_API_KEY', { env: {} })).toThrow(/MDB_ATLAS_API_KEY/);
  });

  it('falls back to process.env when no env is injected', () => {
    process.env.UTILS_TEST_TEMP = 'live-env';
    try {
      expect(getSecret('UTILS_TEST_TEMP')).toBe('live-env');
    } finally {
      delete process.env.UTILS_TEST_TEMP;
    }
  });
});

// --------------------------------------------------------------------------
// stripMessagesPath / buildAnthropicModel: gateway vs direct Anthropic auth.
// --------------------------------------------------------------------------
describe('stripMessagesPath', () => {
  it('drops a trailing /v1/messages', () => {
    expect(stripMessagesPath('https://gw.example.net/foundry/anthropic/v1/messages')).toBe(
      'https://gw.example.net/foundry/anthropic',
    );
  });

  it('drops a trailing /messages', () => {
    expect(stripMessagesPath('https://gw.example.net/anthropic/messages')).toBe(
      'https://gw.example.net/anthropic',
    );
  });

  it('leaves an already-root URL alone', () => {
    expect(stripMessagesPath('https://gw.example.net/anthropic')).toBe(
      'https://gw.example.net/anthropic',
    );
  });

  it('drops a trailing slash', () => {
    // The .env in this repo ends with one; a doubled slash 404s on some gateways.
    expect(stripMessagesPath('https://gw.example.net/anthropic/')).toBe(
      'https://gw.example.net/anthropic',
    );
  });
});

describe('buildAnthropicModel', () => {
  it('returns a model for the direct Anthropic API', () => {
    const model = buildAnthropicModel({ apiKey: 'sk-ant-xxx', model: 'claude-haiku-4-5' });
    expect(model.modelId).toBe('claude-haiku-4-5');
    expect(model.provider).toContain('anthropic');
  });

  it('routes through a gateway when baseUrl is given', () => {
    const model = buildAnthropicModel({
      apiKey: 'gw-key',
      model: 'claude-haiku-4-5',
      baseUrl: 'https://gw.example.net/foundry/anthropic/v1/messages',
    });
    expect(model.modelId).toBe('claude-haiku-4-5');
  });

  it('sends the gateway an api-key header, not x-api-key', async () => {
    // The gateway rejects the SDK's default x-api-key with a 401, so this header
    // swap is the whole reason buildAnthropicModel exists.
    const seen: Record<string, string>[] = [];
    const model = buildAnthropicModel({
      apiKey: 'gw-key',
      model: 'claude-haiku-4-5',
      baseUrl: 'https://gw.example.net/anthropic',
      fetcher: async (_url: any, init: any) => {
        seen.push(Object.fromEntries(new Headers(init.headers).entries()));
        return new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-haiku-4-5',
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    } as any);

    expect(seen).toHaveLength(1);
    expect(seen[0]!['api-key']).toBe('gw-key');
    expect(seen[0]!['anthropic-version']).toBeTruthy();
    expect(seen[0]!['x-api-key']).toBeUndefined();
  });
});

// --------------------------------------------------------------------------
// createAtlasEmbedder: Voyage through ai.mongodb.com, with the dimension guard
// that stops a silent 1024-vs-2048 vector-space mismatch.
// --------------------------------------------------------------------------
describe('createAtlasEmbedder', () => {
  it('embeds a query at the sample_mflix dimension', async () => {
    const { fetcher, calls } = fakeFetcher();
    const embedder = createAtlasEmbedder({ apiKey: 'k', fetcher });
    const vector = await embedder.embedQuery('a deep sea creature');

    expect(vector).toHaveLength(SAMPLE_MFLIX_DIMENSIONS);
    expect(calls[0]!.body.input_type).toBe('query');
    expect(calls[0]!.body.model).toBe('voyage-3-large');
  });

  it('always requests 2048 dimensions, because that is what sample_mflix stores', async () => {
    // voyage-3-large defaults to 1024. Sending a 1024-d query vector against
    // 2048-d stored vectors is not an error -- it just returns nonsense. So the
    // dimension is never left to the default.
    const { fetcher, calls } = fakeFetcher();
    const embedder = createAtlasEmbedder({ apiKey: 'k', fetcher });
    await embedder.embedQuery('q');
    expect(calls[0]!.body.output_dimension).toBe(2048);
  });

  it('embeds documents with the document input type', async () => {
    const { fetcher, calls } = fakeFetcher();
    const embedder = createAtlasEmbedder({ apiKey: 'k', fetcher });
    const vectors = await embedder.embedDocuments(['a', 'b']);

    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(SAMPLE_MFLIX_DIMENSIONS);
    expect(calls[0]!.body.input_type).toBe('document');
  });

  it('authenticates with a bearer token against the Atlas AI endpoint', async () => {
    const { fetcher, calls } = fakeFetcher();
    const embedder = createAtlasEmbedder({ apiKey: 'k', fetcher });
    await embedder.embedQuery('q');

    expect(calls[0]!.url).toBe(`${ATLAS_AI_BASE_URL}/embeddings`);
    expect(calls[0]!.headers['Authorization']).toBe('Bearer k');
  });

  it('throws EmbeddingDimensionMismatch when the service returns the wrong size', async () => {
    const { fetcher } = fakeFetcher({ dims: 1024 });
    const embedder = createAtlasEmbedder({ apiKey: 'k', fetcher });
    await expect(embedder.embedQuery('q')).rejects.toThrow(EmbeddingDimensionMismatch);
  });

  it('reports the expected and actual dimension in the mismatch message', async () => {
    const { fetcher } = fakeFetcher({ dims: 1024 });
    const embedder = createAtlasEmbedder({ apiKey: 'k', fetcher });
    await expect(embedder.embedQuery('q')).rejects.toThrow(/2048.*1024|1024.*2048/);
  });

  it('throws on an HTTP error rather than returning an empty vector', async () => {
    const { fetcher } = fakeFetcher({ status: 401 });
    const embedder = createAtlasEmbedder({ apiKey: 'bad', fetcher });
    await expect(embedder.embedQuery('q')).rejects.toThrow(/401/);
  });

  it('honours an explicit model and dimension for other collections', async () => {
    const { fetcher, calls } = fakeFetcher({ dims: 1024 });
    const embedder = createAtlasEmbedder({
      apiKey: 'k',
      model: 'voyage-3.5',
      dimensions: 1024,
      fetcher,
    });
    await embedder.embedQuery('q');
    expect(calls[0]!.body.model).toBe('voyage-3.5');
    expect(calls[0]!.body.output_dimension).toBe(1024);
  });
});

// --------------------------------------------------------------------------
// atlasRerank: reorders candidates by relevance.
// --------------------------------------------------------------------------
describe('atlasRerank', () => {
  it('reorders documents most-relevant-first', async () => {
    const { fetcher } = fakeRerankFetcher([2, 0, 1]);
    const ranked = await atlasRerank('query', ['doc0', 'doc1', 'doc2'], {
      apiKey: 'k',
      topN: 2,
      fetcher,
    });
    expect(ranked.map((r) => r.document)).toEqual(['doc2', 'doc0']);
  });

  it('returns every document when topN is unset', async () => {
    const { fetcher, calls } = fakeRerankFetcher([2, 0, 1]);
    const ranked = await atlasRerank('query', ['doc0', 'doc1', 'doc2'], { apiKey: 'k', fetcher });
    expect(ranked.map((r) => r.document)).toEqual(['doc2', 'doc0', 'doc1']);
    expect(calls[0]!.body.top_k).toBe(3);
  });

  it('treats an explicit topN of 0 as zero, not as all', async () => {
    // 0 is falsy. A `topN || documents.length` would silently return everything.
    const { fetcher } = fakeRerankFetcher([2, 0, 1]);
    const ranked = await atlasRerank('query', ['doc0', 'doc1', 'doc2'], {
      apiKey: 'k',
      topN: 0,
      fetcher,
    });
    expect(ranked).toEqual([]);
  });

  it('carries the original index so callers can map back to their own objects', async () => {
    const { fetcher } = fakeRerankFetcher([2, 0, 1]);
    const ranked = await atlasRerank('query', ['doc0', 'doc1', 'doc2'], { apiKey: 'k', fetcher });
    expect(ranked.map((r) => r.index)).toEqual([2, 0, 1]);
  });

  it('returns an empty array for no documents without calling the service', async () => {
    const { fetcher, calls } = fakeRerankFetcher([]);
    const ranked = await atlasRerank('query', [], { apiKey: 'k', fetcher });
    expect(ranked).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('throws on an HTTP error', async () => {
    const fetcher = async () => new Response('nope', { status: 500 });
    await expect(atlasRerank('q', ['d'], { apiKey: 'k', fetcher })).rejects.toThrow(/500/);
  });
});

// --------------------------------------------------------------------------
// Telemetry tag, matching the LangChain set's APPNAME convention.
// --------------------------------------------------------------------------
describe('APP_NAME', () => {
  it('follows the devrel.partner.<set>.<language> convention', () => {
    expect(APP_NAME).toBe('devrel.partner.mastra.typescript');
  });
});

// --------------------------------------------------------------------------
// Search index setup. These are what make the set independently runnable: on a
// clean cluster the notebooks create their own indexes instead of assuming the
// LangChain set already did.
// --------------------------------------------------------------------------
/** A collection stand-in. Records created indexes, reports them queryable after N polls. */
function fakeIndexCollection(
  opts: { existing?: string[]; queryableAfter?: number } = {},
) {
  const existing = new Set(opts.existing ?? []);
  const queryableAfter = opts.queryableAfter ?? 1;
  const created: any[] = [];
  const polls: string[] = [];
  return {
    created,
    polls,
    listSearchIndexes(name?: string) {
      return {
        toArray: async () => {
          if (name === undefined) return [...existing].map((n) => ({ name: n }));
          polls.push(name);
          const seen = polls.filter((p) => p === name).length;
          if (!existing.has(name)) return [];
          return [{ name, status: seen >= queryableAfter ? 'READY' : 'BUILDING', queryable: seen >= queryableAfter }];
        },
      };
    },
    async createSearchIndex(description: any) {
      created.push(description);
      existing.add(description.name);
      return description.name;
    },
  };
}

const silent = { log: () => {}, sleep: async () => {}, pollSeconds: 1 };

describe('ensureVectorSearchIndex', () => {
  it('creates the index when the collection has none', async () => {
    const collection = fakeIndexCollection();
    const name = await ensureVectorSearchIndex(
      collection,
      {
        indexName: MFLIX_VECTOR_INDEX,
        path: 'plot_embedding_voyage_3_large',
        dimensions: SAMPLE_MFLIX_DIMENSIONS,
        filterPaths: ['genres', 'year'],
      },
      silent,
    );

    expect(name).toBe(MFLIX_VECTOR_INDEX);
    expect(collection.created).toHaveLength(1);
    expect(collection.created[0].type).toBe('vectorSearch');
    const fields = collection.created[0].definition.fields;
    expect(fields[0]).toMatchObject({
      type: 'vector',
      path: 'plot_embedding_voyage_3_large',
      numDimensions: SAMPLE_MFLIX_DIMENSIONS,
      similarity: 'cosine',
    });
    // The filter fields have to match what Mastra later declares as filterFields,
    // or a pushdown filter silently falls back to the pre-filter path.
    expect(fields.slice(1)).toEqual([
      { type: 'filter', path: 'genres' },
      { type: 'filter', path: 'year' },
    ]);
  });

  it('is a no-op when the index already exists', async () => {
    // The LangChain-ran-first case, and equally the notebook-re-run case.
    const collection = fakeIndexCollection({ existing: [MFLIX_VECTOR_INDEX] });
    const name = await ensureVectorSearchIndex(
      collection,
      { indexName: MFLIX_VECTOR_INDEX, path: 'plot_embedding_voyage_3_large', dimensions: 2048 },
      silent,
    );

    expect(name).toBe(MFLIX_VECTOR_INDEX);
    expect(collection.created).toHaveLength(0);
  });

  it('leaves an existing index alone even when the definition would differ', async () => {
    // Rebuilding an index another notebook created would be a worse surprise
    // than a mismatch, so existing always wins.
    const collection = fakeIndexCollection({ existing: [MFLIX_VECTOR_INDEX] });
    await ensureVectorSearchIndex(
      collection,
      { indexName: MFLIX_VECTOR_INDEX, path: 'some_other_field', dimensions: 1024 },
      silent,
    );

    expect(collection.created).toHaveLength(0);
  });

  it('polls until the new index reports queryable', async () => {
    const collection = fakeIndexCollection({ queryableAfter: 3 });
    await ensureVectorSearchIndex(
      collection,
      { indexName: MFLIX_VECTOR_INDEX, path: 'plot', dimensions: 2048 },
      silent,
    );

    expect(collection.polls.length).toBe(3);
  });

  it('throws a diagnosable error when the index never becomes queryable', async () => {
    const collection = fakeIndexCollection({ queryableAfter: Number.MAX_SAFE_INTEGER });
    await expect(
      ensureVectorSearchIndex(
        collection,
        { indexName: MFLIX_VECTOR_INDEX, path: 'plot', dimensions: 2048 },
        { ...silent, timeoutSeconds: 3 },
      ),
    ).rejects.toThrow(/did not become queryable within 3s/);
  });
});

describe('ensureFullTextSearchIndex', () => {
  it('creates a static string mapping matching the LangChain set', async () => {
    const collection = fakeIndexCollection();
    const name = await ensureFullTextSearchIndex(
      collection,
      { indexName: MFLIX_FULLTEXT_INDEX, fields: ['plot'] },
      silent,
    );

    expect(name).toBe(MFLIX_FULLTEXT_INDEX);
    expect(collection.created[0].type).toBe('search');
    expect(collection.created[0].definition.mappings).toEqual({
      dynamic: false,
      fields: { plot: { type: 'string' } },
    });
  });

  it('is a no-op when the index already exists', async () => {
    const collection = fakeIndexCollection({ existing: [MFLIX_FULLTEXT_INDEX] });
    await ensureFullTextSearchIndex(
      collection,
      { indexName: MFLIX_FULLTEXT_INDEX, fields: ['plot'] },
      silent,
    );

    expect(collection.created).toHaveLength(0);
  });
});

/** A `Db` stand-in built from a `{ collection: [indexNames] }` map. */
function fakeDb(layout: Record<string, string[]>) {
  const collections = new Map(Object.entries(layout));
  return {
    listCollections() {
      return { toArray: async () => [...collections.keys()].map((name) => ({ name })) };
    },
    collection(name: string) {
      return {
        listSearchIndexes(indexName?: string) {
          const names = collections.get(name) ?? [];
          // Report anything present as immediately queryable, so the create path's
          // poll loop resolves on its first attempt.
          const rows = names.map((n) => ({ name: n, status: 'READY', queryable: true }));
          return {
            toArray: async () =>
              indexName === undefined ? rows : rows.filter((row) => row.name === indexName),
          };
        },
        async createSearchIndex(description: any) {
          collections.set(name, [...(collections.get(name) ?? []), description.name]);
          return description.name;
        },
      };
    },
  };
}

describe('search index budget', () => {
  const atLimit = {
    embedded_movies: ['movies_vector_index', 'movies_fulltext_index'],
    other_collection: ['someones_own_index'],
  };

  it('refuses to create a fourth index and names what is already there', async () => {
    const db = fakeDb(atLimit);
    await expect(
      ensureVectorSearchIndex(
        db.collection('embedded_movies'),
        { indexName: 'a_fourth_index', path: 'vec', dimensions: 8 },
        { ...silent, db },
      ),
    ).rejects.toThrow(SearchIndexBudgetExceeded);
  });

  it('tells the reader how to proceed without deleting anything for them', async () => {
    const db = fakeDb(atLimit);
    const error: Error = await ensureVectorSearchIndex(
      db.collection('embedded_movies'),
      { indexName: 'a_fourth_index', path: 'vec', dimensions: 8 },
      { ...silent, db },
    ).then(
      () => {
        throw new Error('expected the budget preflight to reject');
      },
      (e: unknown) => e as Error,
    );

    expect(error.message).toContain('fresh Atlas cluster');
    expect(error.message).toContain('will not delete indexes it did not create');
    // The inventory has to name the offenders, or "at the limit" is unactionable.
    expect(error.message).toContain('someones_own_index');
    expect(error.message).toContain('movies_vector_index');
  });

  it('does not trip when the wanted index is one of the ones already there', async () => {
    // At the limit, but we want an index that exists -- no creation, so no problem.
    const db = fakeDb(atLimit);
    const name = await ensureVectorSearchIndex(
      db.collection('embedded_movies'),
      { indexName: MFLIX_VECTOR_INDEX, path: 'vec', dimensions: 8 },
      { ...silent, db },
    );
    expect(name).toBe(MFLIX_VECTOR_INDEX);
  });

  it('allows creation when there is room', async () => {
    const db = fakeDb({ embedded_movies: ['movies_vector_index'] });
    await ensureFullTextSearchIndex(
      db.collection('embedded_movies'),
      { indexName: MFLIX_FULLTEXT_INDEX, fields: ['plot'] },
      { ...silent, db },
    );
    expect(await listAllSearchIndexes(db)).toHaveLength(2);
  });

  it('honours a raised limit, for readers on a paid tier', async () => {
    const db = fakeDb(atLimit);
    await ensureVectorSearchIndex(
      db.collection('embedded_movies'),
      { indexName: 'a_fourth_index', path: 'vec', dimensions: 8 },
      { ...silent, db, indexLimit: 10 },
    );
    expect(await listAllSearchIndexes(db)).toHaveLength(4);
  });

  it('skips the preflight when no db is passed', async () => {
    // Back-compat: without a db we cannot count, so Atlas reports the problem instead.
    const collection = fakeIndexCollection();
    await ensureVectorSearchIndex(
      collection,
      { indexName: 'unchecked', path: 'vec', dimensions: 8 },
      silent,
    );
    expect(collection.created).toHaveLength(1);
  });
});

describe('claimScratchCollection', () => {
  it('returns the name when the collection does not exist', async () => {
    const db = fakeDb({ embedded_movies: [] });
    expect(await claimScratchCollection(db, REVIEWS_COLLECTION)).toBe(REVIEWS_COLLECTION);
  });

  it('refuses a collection it did not create, rather than dropping it', async () => {
    // The whole point: this used to be an unconditional drop() of `movie_reviews`,
    // which would have destroyed a reader's data if they happened to own that name.
    const db = fakeDb({ [REVIEWS_COLLECTION]: [] });
    await expect(claimScratchCollection(db, REVIEWS_COLLECTION)).rejects.toThrow(
      ScratchCollectionExists,
    );
  });

  it('explains both the leftover case and the your-data case', async () => {
    const db = fakeDb({ [REVIEWS_COLLECTION]: [] });
    const error: Error = await claimScratchCollection(db, REVIEWS_COLLECTION).then(
      () => {
        throw new Error('expected claimScratchCollection to reject');
      },
      (e: unknown) => e as Error,
    );
    expect(error.message).toContain('will not reuse or overwrite one it did not create');
    expect(error.message).toContain('MASTRA_REVIEWS_COLLECTION');
  });

  it('is not named for real-looking data', () => {
    // `movie_reviews` is a name a reader could plausibly already have; a
    // cookbook-prefixed name is not.
    expect(REVIEWS_COLLECTION).toBe('mastra_cookbook_reviews');
    expect(REVIEWS_COLLECTION).not.toBe('movie_reviews');
  });
});

describe('shared index names', () => {
  it('match the names the LangChain notebooks use', () => {
    // Both sets create-if-absent under these names, which is what keeps three
    // indexes enough for eight notebooks on a free M0 cluster. Renaming either
    // here without renaming it there breaks the M0 budget, not correctness.
    expect(MFLIX_VECTOR_INDEX).toBe('movies_vector_index');
    expect(MFLIX_FULLTEXT_INDEX).toBe('movies_fulltext_index');
  });
});

// --------------------------------------------------------------------------
// Dependency guard. Two of these are undeclared peers upstream: importing
// @mastra/voyageai's text path without @huggingface/transformers throws at
// runtime, and @mastra/memory's async-mutex needs tslib. A reader who trims
// package.json would hit both only when a notebook cell fails.
// --------------------------------------------------------------------------
describe('package.json dependencies', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  it.each(['@huggingface/transformers', 'onnxruntime-node', 'tslib'])(
    'declares %s, which no package we depend on declares for us',
    (dep) => {
      expect(pkg.dependencies).toHaveProperty(dep);
    },
  );

  it('pins @mastra/mongodb to a version that has hybrid search and BYO collections', () => {
    // hybridQuery, textQuery, and bring-your-own-collection support landed in
    // 1.15.0. They do not exist in 1.14.0, so this must never float below it.
    const pinned: string = pkg.dependencies['@mastra/mongodb'];
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    const [major, minor] = pinned.split('.').map(Number);
    expect(major === 1 && minor! >= 15).toBe(true);
  });

  it('prefetches the voyage-3-large tokenizer at install time', () => {
    // voyageEmbedding() downloads its tokenizer into node_modules on first use. That
    // write wakes tslab's TypeScript file watcher, and every later cell then fails
    // with "Unexpected pending rebuildTimer" until the kernel restarts. Fetching it
    // during install means a fresh clone never writes there from inside the kernel.
    expect(pkg.scripts.postinstall).toBe('node scripts/prefetch-tokenizer.mjs');
    const script = readFileSync(new URL('../scripts/prefetch-tokenizer.mjs', import.meta.url), 'utf8');
    expect(script).toContain("'voyage-3-large'");
  });

  it('runs typecheck with the pinned TypeScript, not the copy tslab bundles', () => {
    // @tslab/typescript-for-tslab ships its own `tsc` bin and wins the
    // node_modules/.bin link, so a bare `tsc` silently checks with TypeScript 5.0.4.
    expect(pkg.scripts.typecheck).toContain('node_modules/typescript/bin/tsc');
  });

  // Both parents still declare the vulnerable range, so the fix is an override
  // rather than a version bump. Dropping either re-opens high-severity alerts:
  // sharp <0.35.4 bundles a vulnerable libheif, and adm-zip <0.6.1 follows
  // destination symlinks and keeps SUID bits when extracting an untrusted ZIP.
  it.each([
    ['sharp', '0.35.5'],
    ['adm-zip', '0.6.1'],
  ])('keeps the %s override that patches a transitive advisory', (dep, version) => {
    expect(pkg.overrides?.[dep]).toBe(version);
  });
});

// --------------------------------------------------------------------------
// Mock parity. Everything above trusts a fake. This asserts the fake still
// matches the real service: same response shape, same dimension. Without it the
// fake is free to drift until the notebooks break and the tests do not.
// --------------------------------------------------------------------------
describe.skipIf(!process.env.MDB_ATLAS_API_KEY)('mock parity: Atlas AI embeddings', () => {
  it('the fake and the live endpoint agree on shape and dimension', async () => {
    const apiKey = process.env.MDB_ATLAS_API_KEY!;

    const live = await createAtlasEmbedder({ apiKey }).embedQuery('a deep sea creature');
    const { fetcher } = fakeFetcher();
    const faked = await createAtlasEmbedder({ apiKey: 'k', fetcher }).embedQuery(
      'a deep sea creature',
    );

    expect(Array.isArray(live)).toBe(Array.isArray(faked));
    expect(live).toHaveLength(faked.length);
    expect(live).toHaveLength(SAMPLE_MFLIX_DIMENSIONS);
    expect(typeof live[0]).toBe(typeof faked[0]);
    expect(typeof live[0]).toBe('number');
  });

  it('the live endpoint rejects a bad key rather than returning a vector', async () => {
    const embedder = createAtlasEmbedder({ apiKey: 'definitely-not-a-key' });
    await expect(embedder.embedQuery('q')).rejects.toThrow();
  });
});
