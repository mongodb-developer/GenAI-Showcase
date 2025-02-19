import { bedrock } from "./bedrock"
import { generateObject } from "ai"
import { z } from "zod"

const sentimentAnalysisSchema = z.object({
  sentiment:
    z.object({
      name: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      type: z.enum(["agent", "product"]),
    }),
})

type SentimentAnalysis = z.infer<typeof sentimentAnalysisSchema>

export async function analyzeAgentFeedback(content: string): Promise<SentimentAnalysis["sentiments"]> {
  const systemPrompt = `You are an AI assistant that analyzes agent feedback. Your task is to identify agents mentioned in the content and determine the sentiment (positive, negative, or neutral) for each agent. Respond with an object containing a 'sentiments' array of objects, each containing a "name" field for the agent's name, a "sentiment" field, and a "type" field set to "agent".`

  try {
    const result = await generateObject({
      model: bedrock("anthropic.claude-3-5-sonnet-20241022-v2:0"),
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze the sentiment for each agent in the following JSON data. JSON content: ${content}`,
        },
      ],
      schema: sentimentAnalysisSchema,
    })

    return result.object.sentiments
  } catch (error) {
    console.error("Error analyzing agent feedback:", error)
    throw error
  }
}

export async function analyzeProductReview(
  content: string | ArrayBuffer,
  contentType: string,
  fileName: string,
): Promise<SentimentAnalysis["sentiments"]> {
  const systemPrompt = `You are an AI assistant that analyzes product reviews. Your task is to identify products mentioned in the content and determine the sentiment (positive, negative, or neutral) for each product. If no specific product is mentioned, use "General" as the product name. Respond with an object containing a 'sentiments' array of objects, each containing a "name" field for the product name, a "sentiment" field, and a "type" field set to "product".`

  let messages

  if (contentType === "application/json") {
    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analyze the sentiment for each product in the following JSON data. JSON content: ${content}`,
      },
    ]
  } else if (contentType === "text/html") {
    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Extract product information and analyze the sentiment from the following HTML content. HTML content: ${content}`,
      },
    ]
  } else if (contentType.startsWith("image/")) {
    const base64Image =
      content instanceof ArrayBuffer
        ? Buffer.from(content).toString("base64")
        : Buffer.from(content, "binary").toString("base64")

    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze the sentiment for products shown in the image. The image is named: ${fileName}. Describe what you see and infer sentiment.`,
          },
          { type: "image", image: `data:${contentType};base64,${base64Image}` },
        ],
      },
    ]
  } else {
    throw new Error("Unsupported content type")
  }

  try {
    const result = await generateObject({
      model: bedrock("anthropic.claude-3-5-sonnet-20241022-v2:0"),
      messages,
      schema: sentimentAnalysisSchema,
    })

    return result.object.sentiment
  } catch (error) {
    console.error("Error analyzing product review:", error)
    throw error
  }
}
