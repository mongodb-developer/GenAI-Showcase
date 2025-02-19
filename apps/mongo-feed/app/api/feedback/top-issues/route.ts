import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const topIssues = await db
      .collection("chat_analyses")
      .aggregate([
        {
          $match: {
            "analysis.overallSentiment": "negative",
          },
        },
        {
          $unwind: "$analysis.mainTopics",
        },
        {
          $group: {
            _id: {
              topic: "$analysis.mainTopics",
              type: { $ifNull: ["$type", "agent"] },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id.topic",
            type: "$_id.type",
            count: 1,
            sentiment: { $literal: "negative" },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
      ])
      .toArray()

    if (!topIssues.length) {
      return NextResponse.json([])
    }

    return NextResponse.json(topIssues)
  } catch (error) {
    console.error("Error fetching top issues:", error)
    return NextResponse.json({ error: "An error occurred while fetching top issues." }, { status: 500 })
  }
}
