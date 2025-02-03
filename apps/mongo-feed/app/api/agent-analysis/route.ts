import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const agentAnalysis = await db
      .collection("chat_analyses")
      .aggregate([
        { $unwind: "$messages" },
        { $match: { "messages.role": "Agent" } },
        {
          $group: {
            _id: "$messages.agentName",
            positiveSentiment: { $sum: { $cond: [{ $eq: ["$messages.sentiment", "positive"] }, 1, 0] } },
            neutralSentiment: { $sum: { $cond: [{ $eq: ["$messages.sentiment", "neutral"] }, 1, 0] } },
            negativeSentiment: { $sum: { $cond: [{ $eq: ["$messages.sentiment", "negative"] }, 1, 0] } },
            totalInteractions: { $sum: 1 },
          },
        },
        {
          $project: {
            agentName: "$_id",
            positiveSentiment: 1,
            neutralSentiment: 1,
            negativeSentiment: 1,
            totalInteractions: 1,
            _id: 0,
          },
        },
        { $sort: { totalInteractions: -1 } },
      ])
      .toArray()

    return NextResponse.json(agentAnalysis)
  } catch (error) {
    console.error("Error fetching agent analysis:", error)
    return NextResponse.json({ error: "An error occurred while fetching agent analysis." }, { status: 500 })
  }
}

