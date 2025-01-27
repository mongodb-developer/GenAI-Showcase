import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/lib/mongodb'
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    const playlist = await db.collection("playlists").findOne(
      { _id: new ObjectId(params.id), user_id: new ObjectId(decoded.userId) }
    )

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found or unauthorized' }, { status: 404 })
    }

    const songIds = playlist.songs.map((id: string) => new ObjectId(id))
    const songs = await db.collection("songs").find({ _id: { $in: songIds } }).toArray()

    return NextResponse.json(songs.map(song => ({
      ...song,
      _id: song._id.toString()
    })))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch playlist songs' }, { status: 500 })
  }
}

