import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';

/**
 * GET /api/competitions/[id]/participant-status
 * Returns the current status of a user's participation in a competition
 * Used for polling to detect when a user gets liquidated or disqualified
 * 
 * Query params:
 * - userId: The user ID to check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: competitionId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    
    // Get participant record
    const participant = await CompetitionParticipant.findOne({
      competitionId,
      userId,
    }).lean() as any;

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    // Build response
    const response: {
      status: string;
      reason?: string;
      liquidatedAt?: Date;
      disqualifiedAt?: Date;
      currentCapital: number;
      pnl: number;
    } = {
      status: participant.status,
      currentCapital: participant.currentCapital,
      pnl: participant.pnl,
    };

    // Add reason based on status
    if (participant.status === 'liquidated') {
      response.reason = 'Your account was liquidated due to margin call.';
      response.liquidatedAt = participant.updatedAt;
    } else if (participant.status === 'disqualified') {
      response.reason = participant.disqualificationReason || 'You did not meet the competition requirements.';
      response.disqualifiedAt = participant.updatedAt;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching participant status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participant status' },
      { status: 500 }
    );
  }
}

