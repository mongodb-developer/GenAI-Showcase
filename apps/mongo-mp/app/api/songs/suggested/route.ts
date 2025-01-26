import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { verify } from "jsonwebtoken"
import { cookies } from "next/headers"

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined")
}

export async function GET() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("token")

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const decoded = verify(token.value, process.env.JWT_SECRET) as { userId: string }

    const client = await clientPromise
    const db = client.db("mongomp")

    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(decoded.userId) }, { projection: { liked_embeddings: 1 } })

    if (!user || !user.liked_embeddings || user.liked_embeddings.length === 0) {
      return NextResponse.json([])
    }

    const suggestedSongs = await db
      .collection("songs")
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "music_embeddings",
            queryVector: user.liked_embeddings,
            numCandidates: 100,
            limit: 10,
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            artist: 1,
            duration: 1,
            genre: 1,
            tags: 1,
            play_count: 1,
            last_played: 1,
            coverUrl: 1,
            url: 1,
          },
        },
      ])
      .toArray()

    return NextResponse.json(suggestedSongs)
  } catch (e) {
    console.error("Error fetching suggested songs:", e)
    return NextResponse.json({ error: "Failed to fetch suggested songs" }, { status: 500 })
  }
}

