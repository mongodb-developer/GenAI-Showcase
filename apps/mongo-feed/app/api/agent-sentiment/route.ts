import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    // First get all agents with their sentiment data
    const agentData = await db
      .collection("agent_sentiment")
      .aggregate([
        {
          $lookup: {
            from: "chat_analyses",
            let: { agentName: "$agentName" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$analysis.agentName", "$$agentName"] },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              {
                $project: {
                  id: { $toString: "$_id" },
                  date: "$createdAt",
                  summary: "$analysis.summary",
                  sentiment: "$analysis.overallSentiment",
                  issues: "$analysis.mainTopics",
                },
              },
            ],
            as: "recentChats",
          },
        },
        { $sort: { totalInteractions: -1 } },
      ])
      .toArray()

    return NextResponse.json(agentData)
  } catch (error) {
    console.error("Error fetching agent sentiment:", error)
    return NextResponse.json({ error: "An error occurred while fetching agent sentiment." }, { status: 500 })
  }
}
