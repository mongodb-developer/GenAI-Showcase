export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verify(token.value, process.env.JWT_SECRET) as { userId: string };
    const { songId } = await request.json();

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("mongomp");

    // First check if the song exists
    const song = await db.collection("songs").findOne({ 
      _id: new ObjectId(songId) 
    });

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    // Get user's current likes
    const user = await db.collection("users").findOne({ 
      _id: new ObjectId(decoded.userId) 
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const likes = user.likes || [];
    const songObjectId = new ObjectId(songId);
    let operation;
    let message;

    if (likes.some((id: ObjectId) => id.equals(songObjectId))) {
      // Unlike - remove from likes array
      operation = {
        $pull: { likes: songObjectId }
      };
      message = 'Song removed from likes';
    } else {
      // Like - add to likes array
      operation = {
        $addToSet: { likes: songObjectId }
      };
      message = 'Song added to likes';
    }

    // Update user's likes
    await db.collection("users").updateOne(
      { _id: new ObjectId(decoded.userId) },
      operation
    );

    // Get updated user data with populated likes
    const updatedUser = await db.collection("users").findOne(
      { _id: new ObjectId(decoded.userId) }
    );

    // Fetch all liked songs
    const likedSongs = await db.collection("songs").find({
      _id: { $in: updatedUser?.likes || [] }
    }).toArray();

    return NextResponse.json({ 
      message,
      likes: likedSongs.map(song => ({
        ...song,
        _id: song._id.toString()
      }))
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

