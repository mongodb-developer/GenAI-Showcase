import { xai } from "@ai-sdk/xai"
import { createOpenAI } from "@ai-sdk/openai"

export type LLMProvider = "xai" | "minimax"

const LLM_PROVIDER = (process.env.LLM_PROVIDER as LLMProvider) || "xai"

/**
 * Returns the appropriate LLM model based on the LLM_PROVIDER environment variable.
 *
 * Supported providers:
 * - xai (default): Uses xAI/Grok models (grok-2-1212)
 * - minimax: Uses MiniMax models (MiniMax-M2.7, MiniMax-M2.7-highspeed)
 *   via OpenAI-compatible API at https://api.minimax.io/v1
 */
export function getLLMModel(options?: { modelId?: string }) {
  switch (LLM_PROVIDER) {
    case "minimax": {
      const minimax = createOpenAI({
        baseURL: process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1",
        apiKey: process.env.MINIMAX_API_KEY,
      })
      return minimax(options?.modelId || "MiniMax-M2.7")
    }
    case "xai":
    default:
      return xai(options?.modelId || "grok-2-1212")
  }
}
