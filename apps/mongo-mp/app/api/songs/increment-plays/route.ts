export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const { songId } = await request.json();

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("mongomp");

    // Update play count and last_played timestamp
    const result = await db.collection("songs").updateOne(
      { _id: new ObjectId(songId) },
      {
        $inc: { play_count: 1 },
        $set: { last_played: new Date().toISOString() }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    // Get updated song data
    const updatedSong = await db.collection("songs").findOne(
      { _id: new ObjectId(songId) }
    );

    return NextResponse.json({
      message: 'Play count incremented successfully',
      song: {
        ...updatedSong,
        _id: updatedSong?._id.toString()
      }
    });
  } catch (e) {
    console.error('Error incrementing play count:', e);
    return NextResponse.json({ error: 'Failed to increment play count' }, { status: 500 });
  }
}
