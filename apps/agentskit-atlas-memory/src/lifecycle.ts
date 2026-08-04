import type { mongoAtlasVectorStore } from '@agentskit/memory'

type AtlasMemory = ReturnType<typeof mongoAtlasVectorStore>

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

export async function runMemoryLifecycle(memory: AtlasMemory) {
  const ids = sampleDocuments.map((document) => document.id)
  const remove = memory.delete
  if (!remove) throw new Error('This example requires a memory backend with delete support')

  await remove(ids)
  await memory.store(sampleDocuments)

  try {
    return await memory.search([1, 0, 0], { topK: 2 })
  } finally {
    await remove(ids)
  }
}
