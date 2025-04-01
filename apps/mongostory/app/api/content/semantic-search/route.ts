import { NextResponse } from "next/server"
import { generateEmbedding } from "@/lib/embeddings"
import { performVectorSearch } from "@/lib/vector-search"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(req: Request) {
  try {
    const { query, contentId, limit = 10 } = await req.json()

    // If contentId is provided, find similar content
    if (contentId) {
      const client = await clientPromise
      const db = client.db("mongostory")

      // Get the source content
      const content = await db.collection("content").findOne({
        _id: new ObjectId(contentId),
      })

      if (!content || !content.embedding) {
        return NextResponse.json({ error: "Content not found or has no embedding" }, { status: 404 })
      }

      // Use the content's embedding to find similar content
      const results = await performVectorSearch(content.embedding, {
        limit,
        excludeIds: [contentId],
      })

      return NextResponse.json(results)
    }

    // Otherwise, perform a semantic search with the query
    if (!query) {
      return NextResponse.json({ error: "Query is required when contentId is not provided" }, { status: 400 })
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query)

    // Use the utility function to perform the search
    const results = await performVectorSearch(queryEmbedding, { limit })

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error performing semantic search:", error)
    return NextResponse.json({ error: "Failed to perform semantic search" }, { status: 500 })
  }
}
