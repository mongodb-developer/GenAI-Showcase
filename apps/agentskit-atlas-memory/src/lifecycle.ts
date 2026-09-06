import type { mongoAtlasVectorStore } from '@agentskit/memory'

type AtlasMemory = ReturnType<typeof mongoAtlasVectorStore>

type LifecycleOptions = {
  maxSearchAttempts?: number
  retryDelayMs?: number
  sleep?: (delayMs: number) => Promise<void>
}

export const sampleDocuments = [
  {
    id: 'deployment-boundary',
    content: 'Keep model providers behind an adapter boundary.',
    embedding: [1, 0, 0],
    metadata: { topic: 'architecture' },
  },
  {
    id: 'retrieval-boundary',
    content: 'Keep retrieval independent from the agent runtime.',
    embedding: [0.8, 0.2, 0],
    metadata: { topic: 'retrieval' },
  },
  {
    id: 'evaluation-boundary',
    content: 'Evaluate behavior before changing model providers.',
    embedding: [0, 0, 1],
    metadata: { topic: 'evaluation' },
  },
]

export async function runMemoryLifecycle(memory: AtlasMemory, options: LifecycleOptions = {}) {
  const ids = sampleDocuments.map((document) => document.id)
  const remove = memory.delete
  if (!remove) throw new Error('This example requires a memory backend with delete support')

  const maxSearchAttempts = options.maxSearchAttempts ?? 5
  const retryDelayMs = options.retryDelayMs ?? 1_000
  const sleep = options.sleep ?? ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)))

  await remove(ids)
  await memory.store(sampleDocuments)

  try {
    for (let attempt = 1; attempt <= maxSearchAttempts; attempt += 1) {
      const matches = await memory.search([1, 0, 0], { topK: 2 })
      if (matches.some((match) => ids.includes(match.id))) return matches
      if (attempt < maxSearchAttempts) await sleep(retryDelayMs)
    }

    throw new Error(`Stored documents were not visible after ${maxSearchAttempts} search attempts`)
  } finally {
    await remove(ids)
  }
}
