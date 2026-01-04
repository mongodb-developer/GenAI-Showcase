import { MongoClient, Db, Collection, Document } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB || 'voice_memory_demo';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let indexesEnsured = false;

// Vector search index definition
const VECTOR_INDEX_DEFINITION = {
  name: 'memory_vector_index',
  type: 'vectorSearch' as const,
  definition: {
    fields: [
      {
        type: 'vector',
        path: 'embedding',
        numDimensions: 1024,
        similarity: 'cosine',
      },
      {
        type: 'filter',
        path: 'deploymentId',
      },
      {
        type: 'filter',
        path: 'userCookie',
      },
      {
        type: 'filter',
        path: 'isGlobal',
      },
    ],
  },
};

// Atlas Search (text) index definition
const TEXT_INDEX_DEFINITION = {
  name: 'memory_text_index',
  type: 'search' as const,
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        key: {
          type: 'string',
          analyzer: 'lucene.standard',
        },
        value: {
          type: 'string',
          analyzer: 'lucene.standard',
        },
        deploymentId: {
          type: 'string',
        },
        userCookie: {
          type: 'string',
        },
        isGlobal: {
          type: 'boolean',
        },
      },
    },
  },
};

/**
 * Ensures Atlas Search indexes exist on the memories collection.
 * Creates them if they don't exist.
 * Note: Indexes take 1-5 minutes to build after creation.
 */
async function ensureSearchIndexes(collection: Collection<Document>): Promise<void> {
  if (indexesEnsured) return;

  try {
    // Get existing search indexes
    const existingIndexes = await collection.listSearchIndexes().toArray();
    const existingNames = new Set(existingIndexes.map((i) => i.name));

    console.log('[MongoDB] Existing search indexes:', [...existingNames]);

    // Create vector search index if missing
    if (!existingNames.has(VECTOR_INDEX_DEFINITION.name)) {
      console.log('[MongoDB] Creating vector search index:', VECTOR_INDEX_DEFINITION.name);
      try {
        await collection.createSearchIndex(VECTOR_INDEX_DEFINITION);
        console.log('[MongoDB] Vector search index created successfully');
      } catch (err) {
        // Index might already exist or be building
        if (err instanceof Error && !err.message.includes('already exists')) {
          console.warn('[MongoDB] Failed to create vector search index:', err.message);
        }
      }
    }

    // Create text search index if missing
    if (!existingNames.has(TEXT_INDEX_DEFINITION.name)) {
      console.log('[MongoDB] Creating text search index:', TEXT_INDEX_DEFINITION.name);
      try {
        await collection.createSearchIndex(TEXT_INDEX_DEFINITION);
        console.log('[MongoDB] Text search index created successfully');
      } catch (err) {
        // Index might already exist or be building
        if (err instanceof Error && !err.message.includes('already exists')) {
          console.warn('[MongoDB] Failed to create text search index:', err.message);
        }
      }
    }

    indexesEnsured = true;
  } catch (err) {
    // listSearchIndexes might not be available on free tier or older versions
    if (err instanceof Error) {
      if (err.message.includes('not supported') || err.message.includes('CommandNotFound')) {
        console.warn('[MongoDB] Search indexes not supported on this cluster tier. Using fallback search.');
      } else {
        console.warn('[MongoDB] Error checking search indexes:', err.message);
      }
    }
    indexesEnsured = true; // Don't retry on every request
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  console.log('[MongoDB] Connected to database:', MONGODB_DB);

  return { client, db };
}

export async function getMemoriesCollection() {
  const { db } = await connectToDatabase();
  const collection = db.collection('memories');

  // Ensure search indexes exist (runs once per app lifecycle)
  await ensureSearchIndexes(collection);

  return collection;
}
