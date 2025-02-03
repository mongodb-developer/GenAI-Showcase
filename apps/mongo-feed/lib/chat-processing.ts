import { generateObject } from "ai"
import { bedrock } from "./bedrock"
import { z } from "zod"

const chatAnalysisSchema = z.object({
  overallSentiment: z.enum(["positive", "negative", "neutral"]),
  mainTopics: z.array(z.string()).max(5),
  summary: z.string(),
  agentName: z.string().nullable(),
})

type ChatAnalysis = z.infer<typeof chatAnalysisSchema>

const systemPrompt = `You are an AI assistant that analyzes customer service chat conversations. 
Your task is to analyze the entire chat conversation provided and return a structured analysis including:
- overallSentiment: The overall sentiment of the entire conversation (positive, negative, or neutral)
- mainTopics: An array of main topics discussed throughout the conversation (max 5 topics)
- summary: A brief summary of the entire conversation (2-3 sentences)
- agentName: If the conversation includes an agent and their name is mentioned, extract it. Otherwise, leave it as null.

Provide your analysis in a structured format matching the specified schema.`

export async function analyzeEntireChat(messages: { role: string; content: string }[]): Promise<ChatAnalysis> {
  try {
    const conversationText = messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n\n")

    const result = await generateObject<ChatAnalysis>({
      model: bedrock("anthropic.claude-3-5-sonnet-20241022-v2:0"),
      prompt: conversationText,
      system: systemPrompt,
      schema: chatAnalysisSchema,
    })

    return result.object
  } catch (error) {
    console.error("Error analyzing chat:", error)
    return {
      overallSentiment: "neutral",
      mainTopics: ["error_in_processing"],
      summary: "An error occurred while processing the chat.",
      agentName: null,
    }
  }
}

