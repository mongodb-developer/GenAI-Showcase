import { describe, expect, it, vi } from 'vitest'
import { mongoAtlasVectorStore } from '@agentskit/memory'
import type { MongoCollectionLike } from '@agentskit/memory'
import { runMemoryLifecycle, sampleDocuments } from '../src/lifecycle.js'

describe('MongoDB Atlas memory lifecycle', () => {
  it('stores, retrieves, and removes the example documents', async () => {
    const insertMany = vi.fn(async () => ({ acknowledged: true }))
    const deleteMany = vi.fn(async () => ({ acknowledged: true }))
    const aggregateCalls: Array<Array<Record<string, unknown>>> = []
    const collection: MongoCollectionLike = {
      insertMany,
      deleteMany,
      aggregate<T>(pipeline: Array<Record<string, unknown>>) {
        aggregateCalls.push(pipeline)
        return {
          toArray: async () => [
            {
              _id: 'deployment-boundary',
              content: sampleDocuments[0].content,
              metadata: sampleDocuments[0].metadata,
              score: 0.98,
            },
          ] as T[],
        }
      },
    }
    const memory = mongoAtlasVectorStore({
      collection,
      indexName: 'agentskit_vector_index',
      topK: 2,
    })

    const matches = await runMemoryLifecycle(memory)

    expect(insertMany).toHaveBeenCalledOnce()
    expect(aggregateCalls).toEqual([[
      {
        $vectorSearch: {
          index: 'agentskit_vector_index',
          path: 'embedding',
          queryVector: [1, 0, 0],
          numCandidates: 20,
          limit: 2,
        },
      },
      { $project: { content: 1, metadata: 1, score: { $meta: 'vectorSearchScore' } } },
    ]])
    expect(deleteMany).toHaveBeenCalledTimes(2)
    expect(matches).toEqual([
      {
        id: 'deployment-boundary',
        content: sampleDocuments[0].content,
        metadata: sampleDocuments[0].metadata,
        score: 0.98,
      },
    ])
  })
})
