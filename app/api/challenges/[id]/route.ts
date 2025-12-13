import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';

// GET - Get specific challenge details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    let challenge = await Challenge.findById(id);

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Only participants can view
    if (
      challenge.challengerId !== session.user.id &&
      challenge.challengedId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Auto-finalize if challenge is 'active' but has ended and not yet finalized
    if (
      challenge.status === 'active' &&
      challenge.endTime &&
      new Date() >= new Date(challenge.endTime) &&
      !challenge.winnerId // Not yet finalized
    ) {
      console.log(`🏁 Auto-finalizing challenge ${id} on access...`);
      try {
        const { finalizeChallenge } = await import('@/lib/actions/trading/challenge-finalize.actions');
        await finalizeChallenge(id);
        // Refresh challenge data after finalization
        challenge = await Challenge.findById(id);
        console.log(`✅ Challenge ${id} auto-finalized successfully`);
      } catch (error) {
        console.error(`❌ Failed to auto-finalize challenge ${id}:`, error);
      }
    }

    // Get participants if challenge is active or completed
    let participantDocs: any[] = [];
    if (['active', 'completed'].includes(challenge.status)) {
      participantDocs = await ChallengeParticipant.find({
        challengeId: id,
      }).lean();
    }

    // Return raw participant documents with challenge data
    return NextResponse.json({ 
      success: true,
      challenge: challenge.toObject(), 
      participants: participantDocs,
      challengerId: challenge.challengerId,
      challengedId: challenge.challengedId,
    });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenge' },
      { status: 500 }
    );
  }
}
