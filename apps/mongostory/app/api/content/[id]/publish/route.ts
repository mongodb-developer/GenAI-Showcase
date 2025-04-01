import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    // Get current content status
    const content = await db.collection("content").findOne({
      _id: new ObjectId(params.id),
    })

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Toggle publish status
    const newStatus = content.status === "published" ? "draft" : "published"
    const updateData = {
      status: newStatus,
      ...(newStatus === "published" ? { publishedAt: new Date().toISOString() } : {}),
    }

    const result = await db.collection("content").updateOne({ _id: new ObjectId(params.id) }, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: `Content ${newStatus === "published" ? "published" : "unpublished"} successfully`,
      status: newStatus,
    })
  } catch (error) {
    console.error("Error updating content status:", error)
    return NextResponse.json({ error: "Failed to update content status" }, { status: 500 })
  }
}
