import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '../../../../../utils/db';
import { ObjectId } from 'mongodb';

export async function POST(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const teamId = params.teamId;

    if (!teamId || !ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    const { teams } = await getCollections();

    // Update team status to 'approved'
    const result = await teams.updateOne(
      { _id: new ObjectId(teamId) },
      { $set: { status: 'approved' } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Team status updated to approved'
    });
  } catch (error) {
    console.error('Error approving team:', error);
    return NextResponse.json({ error: 'Failed to approve team' }, { status: 500 });
  }
}
