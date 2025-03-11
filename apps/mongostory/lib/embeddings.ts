import { embed, embedMany } from "ai"
import { createVoyage } from "voyage-ai-provider"

const voyage = createVoyage({
  apiKey: process.env.VOYAGE_API_KEY || "",
})

export async function generateEmbedding(text: string) {
  try {
    const { embedding } = await embed({
      model: voyage.embedding("voyage-3"),
      value: text,
    })

    return embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw error
  }
}

export async function generateEmbeddings(texts: string[]) {
  try {
    const { embeddings } = await embedMany({
      model: voyage.embedding("voyage-3"),
      values: texts,
    })

    return embeddings
  } catch (error) {
    console.error("Error generating embeddings:", error)
    throw error
  }
}

