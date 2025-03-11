import { generateEmbedding } from "@/lib/embeddings"
import type { LanguageModelV1Middleware } from "ai"

export const embeddingMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    // Generate the text as normal
    const result = await doGenerate()

    // If this is a summary generation, create an embedding
    if (params.prompt.includes("summary") || params.prompt.includes("summarize")) {
      try {
        const embedding = await generateEmbedding(result.text)
        return {
          ...result,
          embedding, // Add the embedding to the result
        }
      } catch (error) {
        console.error("Error generating embedding:", error)
        return result // Return original result if embedding fails
      }
    }

    return result
  },
}

