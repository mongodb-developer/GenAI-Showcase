import { NextResponse } from 'next/server';
import { getCollections } from '../../../../../utils/db';
import { ObjectId } from 'mongodb';

interface Params {
  id: string;
}

export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  try {
    const id = params.id;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid team ID" },
        { status: 400 }
      );
    }

    // In a real implementation, we would update the team in MongoDB
    // For this demo, we'll just return a success response

    return NextResponse.json({
      success: true,
      message: `Team ${id} has been approved`,
      status: 'approved'
    });
  } catch (error) {
    console.error('Error approving team:', error);
    return NextResponse.json(
      { error: "Failed to approve team" },
      { status: 500 }
    );
  }
}
