export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("mongomp");

    // Find user by email
    const user = await db.collection("users").findOne(
      { email },
      { 
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          password: 1,
          likes: 1,
          playlists: 1,
          last_played: 1
        }
      }
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Compare passwords
    const passwordMatch = await compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Generate JWT token
    const token = sign(
      { 
        userId: user._id.toString(),
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create response with user data
    const response = NextResponse.json({ 
      message: 'Login successful', 
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        likes: user.likes || [],
        playlists: user.playlists || [],
        last_played: user.last_played || []
      }
    });

    // Set HTTP-only cookie with token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 });
  }
}

