import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { bedrock } from "@/lib/bedrock"
import clientPromise from "@/lib/mongodb"
import { z } from "zod"
import type { Db, ObjectId } from "mongodb"

interface Message {
  role: "Customer" | "Agent"
  content: string
}

const chatAnalysisSchema = z.object({
  summary: z.string(),
  overallSentiment: z.enum(["positive", "negative", "neutral"]),
  mainTopics: z.array(z.string()).max(5),
  messages: z.array(
    z.object({
      role: z.enum(["Customer", "Agent"]),
      content: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      agentName: z.string().optional(),
    }),
  ),
})

const systemPrompt = `You are an AI assistant that analyzes customer service chat conversations for MongoFeed, a feedback analysis platform.
Your task is to analyze the provided chat messages and return a structured analysis including:
- summary: A brief summary of the conversation (max 3 sentences)
- overallSentiment: The overall sentiment of the conversation (positive, negative, or neutral)
- mainTopics: An array of main topics discussed (max 5 topics)
- messages: An array of analyzed messages, each containing:
  - role: The role of the speaker (Customer or Agent)
  - content: The content of the message
  - sentiment: The sentiment of the individual message (positive, negative, or neutral)
  - agentName: Try to identify the agent's name from the conversation. If found, include it here.

Focus on identifying key issues, feature requests, or areas of improvement for MongoFeed.`

async function updateProcessingLog(db: Db, chatId: ObjectId, message: string) {
  await db.collection("processing_logs").updateOne(
    { chatId },
    {
      $push: {
        logs: { timestamp: new Date(), message },
      },
    },
  )
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid input. Expected an array of messages." }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongofeed")

    const chatQueue = await db
      .collection("chat_queue")
      .findOneAndUpdate(
        { status: "pending" },
        { $set: { status: "processing" } },
        { sort: { createdAt: 1 }, returnDocument: "after" },
      )

    if (!chatQueue) {
      return NextResponse.json({ error: "No pending chats in the queue." }, { status: 404 })
    }

    const chatId = chatQueue._id

    await updateProcessingLog(db, chatId, "Starting chat analysis")

    await updateProcessingLog(db, chatId, "Chat retrieved from queue and processing started")

    const conversationText = messages.map((msg: Message) => `${msg.role}: ${msg.content}`).join("\n\n")

    await updateProcessingLog(db, chatId, "Generating analysis using Bedrock LLM")

    const result = await generateObject({
      model: bedrock("anthropic.claude-3-5-sonnet-20241022-v2:0"),
      prompt: conversationText,
      system: systemPrompt,
      schema: chatAnalysisSchema,
    })

    console.log('chat analysis result');

    await updateProcessingLog(db, chatId, `Analysis generated: ${result.summary}`)

    await updateProcessingLog(db, chatId, "Analysis generated successfully")

    await db.collection("chat_analyses").insertOne({
      chatId,
      messages: result.messages,
      analysis: {
        summary: result.summary,
        overallSentiment: result.overallSentiment,
        mainTopics: result.mainTopics,
      },
      createdAt: new Date(),
    })

    await updateProcessingLog(db, chatId, "Chat analysis stored in database")

    // Update agent sentiment data
    const agentMessages = result.messages.filter((msg) => msg.role === "Agent" && msg.agentName)
    for (const msg of agentMessages) {
      await db.collection("agent_sentiment").updateOne(
        { agentName: msg.agentName },
        {
          $inc: {
            [`sentiment.${msg.sentiment}`]: 1,
            totalInteractions: 1,
          },
        },
        { upsert: true },
      )
    }

    await updateProcessingLog(db, chatId, "Agent sentiment data updated")

    await updateProcessingLog(
      db,
      chatId,
      `Processing completed. Overall sentiment: ${result.overallSentiment}. Main topics: ${result.mainTopics.join(", ")}`,
    )

    await db.collection("chat_queue").updateOne({ _id: chatId }, { $set: { status: "completed" } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing chat:", error)
    if (chatId) {
      await updateProcessingLog(db, chatId, `Error during processing: ${error.message}`)
    }
    return NextResponse.json({ error: "An error occurred while processing the chat." }, { status: 500 })
  }
}
