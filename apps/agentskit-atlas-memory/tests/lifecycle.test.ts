import { describe, expect, it, vi } from 'vitest'
import { mongoAtlasVectorStore } from '@agentskit/memory'
import type { MongoCollectionLike } from '@agentskit/memory'
import { runMemoryLifecycle, sampleDocuments } from '../src/lifecycle.js'

describe('MongoDB Atlas memory lifecycle', () => {
  function createMemory(searchResults: Array<Array<Record<string, unknown>>>) {
    const insertMany = vi.fn(async () => ({ acknowledged: true }))
    const deleteMany = vi.fn(async () => ({ acknowledged: true }))
    const aggregateCalls: Array<Array<Record<string, unknown>>> = []
    let searchCall = 0
    const collection: MongoCollectionLike = {
      insertMany,
      deleteMany,
      aggregate<T>(pipeline: Array<Record<string, unknown>>) {
        aggregateCalls.push(pipeline)
        return {
          toArray: async () => (searchResults[searchCall++] ?? []) as T[],
        }
      },
    }
    const memory = mongoAtlasVectorStore({
      collection,
      indexName: 'agentskit_vector_index',
      topK: 2,
    })

    return { aggregateCalls, deleteMany, insertMany, memory }
  }

  const match = {
    _id: 'deployment-boundary',
    content: sampleDocuments[0].content,
    metadata: sampleDocuments[0].metadata,
    score: 0.98,
  }

  it('stores, retrieves, and removes immediately visible documents', async () => {
    const { aggregateCalls, deleteMany, insertMany, memory } = createMemory([[match]])

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

  it('retries while stored documents are still being indexed', async () => {
    const { aggregateCalls, deleteMany, memory } = createMemory([[], [match]])
    const sleep = vi.fn(async () => {})

    const matches = await runMemoryLifecycle(memory, {
      maxSearchAttempts: 3,
      retryDelayMs: 25,
      sleep,
    })

    expect(aggregateCalls).toHaveLength(2)
    expect(sleep).toHaveBeenCalledOnce()
    expect(sleep).toHaveBeenCalledWith(25)
    expect(deleteMany).toHaveBeenCalledTimes(2)
    expect(matches[0]?.id).toBe('deployment-boundary')
  })

  it('cleans up and fails after the search retry budget is exhausted', async () => {
    const { aggregateCalls, deleteMany, memory } = createMemory([[], [], []])
    const sleep = vi.fn(async () => {})

    await expect(runMemoryLifecycle(memory, {
      maxSearchAttempts: 3,
      retryDelayMs: 25,
      sleep,
    })).rejects.toThrow('Stored documents were not visible after 3 search attempts')

    expect(aggregateCalls).toHaveLength(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(deleteMany).toHaveBeenCalledTimes(2)
  })
})
