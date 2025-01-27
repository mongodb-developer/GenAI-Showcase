import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET(
  request: Request,
  { params }: { params: { genre: string } }
) {
  try {
    const client = await clientPromise
    const db = client.db("mongomp")
    
    const songs = await db.collection("songs")
      .find({ genre: params.genre })
      .toArray()

    return NextResponse.json(songs)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 })
  }
}

