import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { cancelCompetitionAndRefund } from '@/lib/actions/trading/competition-cancel.actions';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      );
    }

    // Get competition
    const competition = await Competition.findById(id);

    if (!competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    // Only allow cancelling upcoming competitions
    if (competition.status !== 'upcoming') {
      return NextResponse.json(
        { error: `Cannot cancel a competition that is ${competition.status}. Only upcoming competitions can be cancelled.` },
        { status: 400 }
      );
    }

    // Get participant count before cancellation
    const participantCount = competition.currentParticipants || 0;

    // Cancel and refund
    await cancelCompetitionAndRefund(id, reason.trim());

    return NextResponse.json({
      success: true,
      message: 'Competition cancelled and all participants refunded',
      refundedCount: participantCount,
    });
  } catch (error) {
    console.error('Error cancelling competition:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel competition' },
      { status: 500 }
    );
  }
}

