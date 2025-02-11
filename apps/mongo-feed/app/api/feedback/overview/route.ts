import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    // Get total feedback count
    const totalFeedback = await db.collection("chat_analyses").countDocuments()

    // Calculate sentiment score
    const sentimentAggregation = await db
      .collection("chat_analyses")
      .aggregate([
        {
          $unwind: "$analysis",
        },
        {
          $group: {
            _id: null,
            positive: {
              $sum: { $cond: [{ $eq: ["$analysis.sentiment", "positive"] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const sentimentScore =
      sentimentAggregation.length > 0
        ? Math.round((sentimentAggregation[0].positive / sentimentAggregation[0].total) * 100)
        : 0

    // Get trend data
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
              sentiment: "$analysis.sentiment",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            positive: {
              $sum: { $cond: [{ $eq: ["$_id.sentiment", "positive"] }, "$count", 0] },
            },
            negative: {
              $sum: { $cond: [{ $eq: ["$_id.sentiment", "negative"] }, "$count", 0] },
            },
            neutral: {
              $sum: { $cond: [{ $eq: ["$_id.sentiment", "neutral"] }, "$count", 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ])
      .toArray()

    const formattedTrendData = trendData.map((item) => ({
      date: item._id,
      positive: item.positive,
      negative: item.negative,
      neutral: item.neutral,
    }))

    return NextResponse.json({
      totalFeedback,
      sentimentScore,
      trendData: formattedTrendData,
    })
  } catch (error) {
    console.error("Error fetching feedback overview:", error)
    return NextResponse.json({ error: "Failed to fetch feedback overview" }, { status: 500 })
  }
}
