import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(req: Request) {
  try {
    const { contentId, visitorId, duration } = await req.json()

    if (!contentId || !visitorId || !duration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongostory")

    // Record session
    await db.collection("sessions").insertOne({
      contentId: new ObjectId(contentId),
      visitorId,
      duration,
      timestamp: new Date(),
    })

    // Update average time on page for the content
    await db.collection("content").updateOne(
      { _id: new ObjectId(contentId) },
      {
        $inc: {
          totalTimeSpent: duration,
          sessionCount: 1,
        },
      },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error recording session:", error)
    return NextResponse.json({ error: "Failed to record session" }, { status: 500 })
  }
}
