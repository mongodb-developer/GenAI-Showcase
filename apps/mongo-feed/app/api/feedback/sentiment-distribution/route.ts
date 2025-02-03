import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const distribution = await db
      .collection("chat_analyses")
      .aggregate([
        {
          $group: {
            _id: {
              type: { $ifNull: ["$type", "agent"] },
              sentiment: "$analysis.overallSentiment",
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id.sentiment",
            type: "$_id.type",
            value: "$count",
          },
        },
      ])
      .toArray()

    return NextResponse.json(distribution)
  } catch (error) {
    console.error("Error fetching sentiment distribution:", error)
    return NextResponse.json({ error: "An error occurred while fetching sentiment distribution." }, { status: 500 })
  }
}

