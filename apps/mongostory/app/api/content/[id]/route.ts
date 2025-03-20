import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { generateEmbedding } from "@/lib/embeddings"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    const content = await db.collection("content").findOne({
      _id: new ObjectId(params.id),
    })

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    return NextResponse.json(content)
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const client = await clientPromise
    const db = client.db("mongostory")

    // If there's a new summary, generate a new embedding
    let embedding = undefined
    if (body.analysis?.summary) {
      try {
        embedding = await generateEmbedding(body.analysis.summary)
      } catch (error) {
        console.error("Error generating embedding:", error)
        // Continue without embedding if generation fails
      }
    }

    const updateData = {
      ...body,
      // Add embedding if generated
      ...(embedding && {
        embedding,
        embeddingUpdatedAt: new Date().toISOString(),
      }),
      updatedAt: new Date().toISOString(),
    }

    const result = await db.collection("content").updateOne({ _id: new ObjectId(params.id) }, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    return NextResponse.json({ _id: params.id, ...updateData })
  } catch (error) {
    console.error("Error updating content:", error)
    return NextResponse.json({ error: "Failed to update content" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    const result = await db.collection("content").deleteOne({
      _id: new ObjectId(params.id),
    })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Content deleted successfully" })
  } catch (error) {
    console.error("Error deleting content:", error)
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 })
  }
}
