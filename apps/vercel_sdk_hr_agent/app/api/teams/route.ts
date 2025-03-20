import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '../../../utils/db';

export async function GET(req: NextRequest) {
  try {
    const { teams } = await getCollections();

    // Get all teams, sorted by creation date (newest first)
    const teamsList = await teams.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({ teams: teamsList });
  } catch (error) {
    console.error('Error retrieving teams:', error);
    return NextResponse.json({ error: 'Failed to retrieve teams' }, { status: 500 });
  }
}
