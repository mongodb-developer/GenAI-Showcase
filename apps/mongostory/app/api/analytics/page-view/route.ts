import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(req: Request) {
  try {
    const { contentId, visitorId } = await req.json()

    if (!contentId || !visitorId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongostory")

    // Check if this visitor has already viewed this content in the last hour
    const recentView = await db.collection("pageViews").findOne({
      contentId: new ObjectId(contentId),
      visitorId,
      timestamp: {
        $gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    })

    if (!recentView) {
      // Record new page view
      await db.collection("pageViews").insertOne({
        contentId: new ObjectId(contentId),
        visitorId,
        timestamp: new Date(),
      })

      // Update or create unique visitor record
      await db.collection("uniqueVisitors").updateOne(
        { visitorId },
        {
          $setOnInsert: { firstVisit: new Date() },
          $set: { lastVisit: new Date() },
          $inc: { totalVisits: 1 },
        },
        { upsert: true },
      )

      // Increment content view count
      await db.collection("content").updateOne({ _id: new ObjectId(contentId) }, { $inc: { views: 1 } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error recording page view:", error)
    return NextResponse.json({ error: "Failed to record page view" }, { status: 500 })
  }
}

