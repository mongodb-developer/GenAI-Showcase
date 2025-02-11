import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const songId = searchParams.get('songId')

  if (!songId) {
    return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db("mongomp")

    // First, get the music_embeddings for the current song
    const currentSong = await db.collection("songs").findOne(
      { _id: new ObjectId(songId) },
      { projection: { music_embeddings: 1 } }
    )


    if (!currentSong || !currentSong.music_embeddings) {
      return NextResponse.json({ error: 'Song not found or has no embeddings' }, { status: 404 })
    }

    // Then, use $vectorSearch to find similar songs
    const similarSongs = await db.collection("songs").aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "music_embeddings",
          queryVector: currentSong.music_embeddings,
          numCandidates: 50,
          limit: 6
        }
      },
      {
        $match: {
          _id: { $ne: new ObjectId(songId) } // Exclude the current song
        }
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
          url: 1
        }
      }
    ]).toArray()


    const filteredSongs = similarSongs.filter(song => song._id.toString() !== songId)

    return NextResponse.json(filteredSongs)
  } catch (e) {
    console.error('Error fetching similar songs:', e)
    return NextResponse.json({ error: 'Failed to fetch similar songs' }, { status: 500 })
  }
}
