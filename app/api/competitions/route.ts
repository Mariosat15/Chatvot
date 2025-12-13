import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import { auth } from '@/lib/better-auth/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get session for user-specific data
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      userId = session?.user?.id || null;
    } catch {
      // Not logged in, continue without user data
    }

    // Fetch all non-draft competitions
    const competitions = await Competition.find({ 
      status: { $ne: 'draft' } 
    })
      .sort({ startTime: -1 })
      .lean();

    // Get user's participation status if logged in
    let userInCompetitionIds: string[] = [];
    if (userId) {
      const participations = await CompetitionParticipant.find({
        userId,
        status: { $in: ['active', 'completed'] }
      }).select('competitionId').lean();
      
      userInCompetitionIds = participations.map((p: any) => p.competitionId.toString());
    }

    return NextResponse.json({
      competitions: JSON.parse(JSON.stringify(competitions)),
      userInCompetitionIds,
    });
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitions' },
      { status: 500 }
    );
  }
}

