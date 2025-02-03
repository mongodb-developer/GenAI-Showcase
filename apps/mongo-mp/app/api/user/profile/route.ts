export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { verify } from "jsonwebtoken"
import { cookies } from "next/headers"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"

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

    // Get user data excluding password
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(decoded.userId) },
      {
        projection: {
          password: 0, // Exclude only the password field
        },
      },
    )

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Fetch liked songs if the user has any
    let likedSongs = []
    if (user.likes && Array.isArray(user.likes) && user.likes.length > 0) {
      likedSongs = await db
        .collection("songs")
        .find({
          _id: { $in: user.likes.map((id) => new ObjectId(id)) },
        })
        .toArray()
    }

    // Fetch last played songs if they exist
    let lastPlayedSongs = []
    if (user.last_played && Array.isArray(user.last_played) && user.last_played.length > 0) {
      const songIds = user.last_played.map((play) => new ObjectId(play.song_id))
      lastPlayedSongs = await db
        .collection("songs")
        .find({
          _id: { $in: songIds },
        })
        .toArray()
    }

    // Transform the response
    const userResponse = {
      ...user,
      _id: user._id.toString(),
      liked_embeddings: user.liked_embeddings || [],
      likes: likedSongs.map((song) => ({
        ...song,
        _id: song._id.toString(),
      })),
      last_played:
        user.last_played?.map((play: any) => ({
          ...play,
          song: lastPlayedSongs.find((s) => s._id.equals(new ObjectId(play.song_id))),
        })) || [],
    }

    return NextResponse.json(userResponse)
  } catch (error) {
    console.error("Error fetching user profile:", error)
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

