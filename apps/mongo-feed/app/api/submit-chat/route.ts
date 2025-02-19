import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import type { ObjectId } from "mongodb"
import { analyzeEntireChat } from "@/lib/chat-processing"

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid input. Expected an array of messages." }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongofeed")

    const result = await db.collection("chat_queue").insertOne({
      messages,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const chatId = result.insertedId

    // Create initial processing log
    await db.collection("processing_logs").insertOne({
      chatId: chatId,
      logs: [{ timestamp: new Date(), message: "Chat submitted for processing" }],
      status: "pending",
    })

    // Trigger immediate processing
    await processChatAnalysis(db, chatId, messages)

    return NextResponse.json({ id: chatId.toString() })
  } catch (error) {
    console.error("Error submitting chat:", error)
    return NextResponse.json({ error: "An error occurred while submitting the chat." }, { status: 500 })
  }
}

async function processChatAnalysis(db, chatId: ObjectId, messages) {
  try {
    // Update chat queue status to processing
    await db
      .collection("chat_queue")
      .updateOne({ _id: chatId }, { $set: { status: "processing", updatedAt: new Date() } })

    // Update processing log
    await db.collection("processing_logs").updateOne(
      { chatId },
      {
        $push: {
          logs: { timestamp: new Date(), message: "Analyzing entire chat" },
        },
        $set: { status: "processing" },
      },
    )

    const analysis = await analyzeEntireChat(messages)

    // Create chat analysis document
    await db.collection("chat_analyses").insertOne({
      chatId,
      messages,
      analysis,
      createdAt: new Date(),
    })

    // Update agent sentiment data if an agent was identified
    if (analysis.agentName) {
      await db.collection("agent_sentiment").updateOne(
        { agentName: analysis.agentName },
        {
          $inc: {
            [`sentiment.${analysis.overallSentiment}`]: 1,
            totalInteractions: 1,
          },
        },
        { upsert: true },
      )
    }

    // Update processing status
    await db
      .collection("chat_queue")
      .updateOne({ _id: chatId }, { $set: { status: "completed", updatedAt: new Date() } })

    await db.collection("processing_logs").updateOne(
      { chatId },
      {
        $push: {
          logs: {
            timestamp: new Date(),
            message: `Sentiment analysis completed with overall ${analysis.overallSentiment}`,
          },
        },
        $set: { status: "completed" },
      },
    )
  } catch (error) {
    console.error("Error processing chat analysis:", error)
    await db.collection("processing_logs").updateOne(
      { chatId },
      {
        $push: {
          logs: { timestamp: new Date(), message: `Error during analysis: ${error.message}` },
        },
        $set: { status: "error" },
      },
    )
    await db.collection("chat_queue").updateOne({ _id: chatId }, { $set: { status: "error", updatedAt: new Date() } })
  }
}
