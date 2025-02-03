export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')

  try {
    const client = await clientPromise
    const db = client.db("mongomp")
    
    let songs
    if (query) {
      // Using the actual schema fields for text search
      songs = await db.collection("songs").aggregate([
        {
          '$search': {
            'index': 'default', 
            'text': {
              'query': query, 
              'path': ['title', 'artist', 'genre', 'tags']
            }
          }
        },
        {
          '$project': {
            '_id': 1,
            'title': 1,
            'artist': 1,
            'genre': 1,
            'duration': 1,
            'coverUrl': 1,
            'play_count': 1,
            'tags': 1,
            'url': 1,
            'last_played': 1
          }
        }
      ]).toArray()
    } else {
      // Get all songs with their complete structure, excluding music_embeddings
      songs = await db.collection("songs").find({}, {
        projection: {
          music_embeddings: 0
        }
      }).toArray()
    }

    // Group songs by genre as per our UI structure
    const songsByGenre = songs.reduce((acc, song) => {
      if (!acc[song.genre]) {
        acc[song.genre] = []
      }
      acc[song.genre].push({
        ...song,
        _id: song._id.toString()
      })
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json(songsByGenre)
  } catch (e) {
    console.error('Error fetching songs:', e)
    return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 })
  }
}

