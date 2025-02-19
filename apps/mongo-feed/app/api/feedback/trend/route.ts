import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const trendData = await db
      .collection("chat_analyses")
      .aggregate([
        {
          $unwind: "$analysis",
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              type: { $ifNull: ["$type", "agent"] },
              sentiment: "$analysis.sentiment",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: {
              date: "$_id.date",
              type: "$_id.type",
            },
            positive: {
              $sum: {
                $cond: [{ $eq: ["$_id.sentiment", "positive"] }, "$count", 0],
              },
            },
            negative: {
              $sum: {
                $cond: [{ $eq: ["$_id.sentiment", "negative"] }, "$count", 0],
              },
            },
            neutral: {
              $sum: {
                $cond: [{ $eq: ["$_id.sentiment", "neutral"] }, "$count", 0],
              },
            },
          },
        },
        {
          $sort: { "_id.date": 1 },
        },
      ])
      .toArray()

    // Transform the data for the chart
    const formattedData = trendData.map((item) => ({
      date: item._id.date,
      type: item._id.type,
      positive: item.positive,
      negative: item.negative,
      neutral: item.neutral,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error("Error fetching feedback trend:", error)
    return NextResponse.json({ error: "An error occurred while fetching feedback trend." }, { status: 500 })
  }
}
