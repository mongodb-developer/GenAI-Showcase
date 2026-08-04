import { mongoAtlasVectorStore } from '@agentskit/memory'
import type { MongoCollectionLike } from '@agentskit/memory'
import { MongoClient } from 'mongodb'
import type { Collection, Document, Filter } from 'mongodb'
import { runMemoryLifecycle } from './lifecycle.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function asAgentsKitCollection(collection: Collection<Document>): MongoCollectionLike {
  return {
    insertMany(documents) {
      return collection.insertMany(documents)
    },
    deleteMany(filter) {
      return collection.deleteMany(filter as Filter<Document>)
    },
    aggregate<T>(pipeline: Array<Record<string, unknown>>) {
      const cursor = collection.aggregate(pipeline)
      return {
        toArray: async () => await cursor.toArray() as unknown as T[],
      }
    },
  }
}

const client = new MongoClient(required('MONGODB_URI'))

try {
  await client.connect()

  const database = process.env.MONGODB_DATABASE ?? 'agentskit_demo'
  const collectionName = process.env.MONGODB_COLLECTION ?? 'memory'
  const indexName = process.env.MONGODB_VECTOR_INDEX ?? 'agentskit_vector_index'
  const collection = client.db(database).collection(collectionName)
  const memory = mongoAtlasVectorStore({
    collection: asAgentsKitCollection(collection),
    indexName,
    topK: 2,
  })
  const matches = await runMemoryLifecycle(memory)

  console.log(JSON.stringify(matches, null, 2))
} finally {
  await client.close()
}
