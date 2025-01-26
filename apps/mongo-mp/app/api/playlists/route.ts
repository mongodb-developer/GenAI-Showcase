import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verify(token.value, process.env.JWT_SECRET!) as { userId: string };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = await clientPromise
    const db = client.db("mongomp")
    
    // Get all playlists for the user
    const playlists = await db.collection("playlists")
      .find({ user_id: new ObjectId(decoded.userId) })
      .toArray()

    // For each playlist, fetch the full song details
    const playlistsWithSongs = await Promise.all(
      playlists.map(async (playlist) => {
        const songIds = playlist.songs.map((id: string) => new ObjectId(id))
        const songs = await db.collection("songs")
          .find({ _id: { $in: songIds } })
          .toArray()

        return {
          ...playlist,
          _id: playlist._id.toString(),
          songs: songs.map(song => ({
            ...song,
            _id: song._id.toString()
          }))
        }
      })
    )

    return NextResponse.json(playlistsWithSongs)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verify(token.value, process.env.JWT_SECRET!) as { userId: string };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { name } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongomp")
    
    const result = await db.collection("playlists").insertOne({
      name,
      user_id: new ObjectId(decoded.userId),
      songs: [],
      created_at: new Date(),
      updated_at: new Date()
    })

    const newPlaylist = await db.collection("playlists").findOne({ _id: result.insertedId })

    return NextResponse.json({
      ...newPlaylist,
      _id: newPlaylist?._id.toString()
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 })
  }
}

