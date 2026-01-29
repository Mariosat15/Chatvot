import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import mongoose from 'mongoose';

/**
 * GET /api/competitions/[id]/live-ranking
 * Returns live participant rankings with prize info for the trading interface
 * Optimized for frequent polling (every 5-10 seconds)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: competitionId } = await params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get competition with prize info
    const competition = await db.collection('competitions').findOne(
      { _id: new mongoose.Types.ObjectId(competitionId) },
      { 
        projection: { 
          prizePool: 1, 
          prizeDistribution: 1, 
          platformFeePercentage: 1,
          rules: 1,
          status: 1,
          startingCapital: 1,
        } 
      }
    );

    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Only return data for active competitions
    if (competition.status !== 'active') {
      return NextResponse.json({ 
        error: 'Competition not active',
        status: competition.status 
      }, { status: 400 });
    }

    // Get all participants with essential data only
    const participants = await db.collection('competitionparticipants')
      .find({ competitionId: competitionId })
      .project({
        userId: 1,
        username: 1,
        currentCapital: 1,
        unrealizedPnl: 1,
        pnl: 1,
        pnlPercentage: 1,
        status: 1,
        totalTrades: 1,
      })
      .toArray();

    if (participants.length === 0) {
      return NextResponse.json({ 
        rankings: [], 
        userRank: null,
        prizePool: competition.prizePool || 0,
      });
    }

    const disqualifyOnLiquidation = competition.rules?.disqualifyOnLiquidation !== false;
    const startingCapital = competition.startingCapital || 10000;

    // Calculate live equity and sort
    const rankedParticipants = participants
      .map(p => {
        const liveEquity = (p.currentCapital || 0) + (p.unrealizedPnl || 0);
        const profit = liveEquity - startingCapital;
        const profitPercent = ((profit / startingCapital) * 100);
        const isDisqualified = disqualifyOnLiquidation && p.status === 'liquidated';
        
        return {
          oderId: p.userId,
          username: p.username || 'Anonymous',
          liveEquity,
          profit,
          profitPercent,
          status: p.status,
          isDisqualified,
          totalTrades: p.totalTrades || 0,
        };
      })
      .sort((a, b) => {
        // Disqualified go to bottom
        if (a.isDisqualified && !b.isDisqualified) return 1;
        if (!a.isDisqualified && b.isDisqualified) return -1;
        // Sort by live equity (descending)
        return b.liveEquity - a.liveEquity;
      });

    // Assign ranks (handle ties)
    let currentRank = 1;
    const rankings = rankedParticipants.map((p, index) => {
      if (index > 0) {
        const prev = rankedParticipants[index - 1];
        // Same equity = same rank
        if (Math.abs(p.liveEquity - prev.liveEquity) < 0.01) {
          // Keep same rank
        } else {
          currentRank = index + 1;
        }
      }
      return { ...p, rank: p.isDisqualified ? rankedParticipants.length : currentRank };
    });

    // Get first place equity for "distance to 1st" calculation
    const firstPlaceEquity = rankings.find(r => !r.isDisqualified)?.liveEquity || startingCapital;

    // Calculate prize for each rank position
    const prizePool = competition.prizePool || 0;
    const platformFee = (competition.platformFeePercentage || 0) / 100;
    const netPool = prizePool * (1 - platformFee);
    const prizeDistribution = competition.prizeDistribution || [];

    // Add prize and distance info
    const rankingsWithPrizes = rankings.map(r => {
      const prizeInfo = prizeDistribution.find((p: { rank: number; percentage: number }) => p.rank === r.rank);
      const prizePercent = prizeInfo?.percentage || 0;
      const potentialReward = r.isDisqualified ? 0 : Math.floor((netPool * prizePercent / 100) * 100) / 100;
      const distanceToFirst = r.rank === 1 ? 0 : firstPlaceEquity - r.liveEquity;

      return {
        rank: r.rank,
        userId: r.oderId,
        username: r.username,
        profitPercent: Number(r.profitPercent.toFixed(2)),
        liveEquity: Number(r.liveEquity.toFixed(2)),
        potentialReward,
        distanceToFirst: Number(distanceToFirst.toFixed(2)),
        isDisqualified: r.isDisqualified,
        status: r.status,
      };
    });

    // Find current user's rank
    const userRanking = rankingsWithPrizes.find(r => r.userId === session.user.id);

    // Return top 10 + user's position if not in top 10
    let displayRankings = rankingsWithPrizes.slice(0, 10);
    
    if (userRanking && userRanking.rank > 10) {
      // Add separator and user's position
      displayRankings = [
        ...displayRankings,
        { ...userRanking, isSeparator: true } as typeof userRanking & { isSeparator: boolean },
      ];
    }

    return NextResponse.json({
      rankings: displayRankings,
      userRank: userRanking?.rank || null,
      userEquity: userRanking?.liveEquity || null,
      totalParticipants: rankings.length,
      prizePool: netPool,
      firstPlaceEquity,
    });

  } catch (error) {
    console.error('Error fetching live ranking:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch ranking' },
      { status: 500 }
    );
  }
}
