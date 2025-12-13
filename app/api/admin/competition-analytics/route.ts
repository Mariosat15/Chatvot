import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import Challenge from '@/database/models/trading/challenge.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import { getUserById } from '@/lib/utils/user-lookup';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production'
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get all competitions (completed AND cancelled)
    const competitions = await Competition.find({ 
      status: { $in: ['completed', 'cancelled'] } 
    })
      .sort({ endTime: -1 })
      .limit(50)
      .lean();

    const competitionIds = competitions.map((c) => c._id);
    
    // Get all wallet transactions for these competitions
    const [
      winTransactions, 
      entryTransactions,
      refundTransactions,
    ] = await Promise.all([
      WalletTransaction.find({
      transactionType: 'competition_win',
      competitionId: { $in: competitionIds },
        status: 'completed',
      }).lean(),
      WalletTransaction.find({
        transactionType: 'competition_entry',
        competitionId: { $in: competitionIds },
        status: 'completed',
      }).lean(),
      WalletTransaction.find({
        transactionType: 'competition_refund',
        competitionId: { $in: competitionIds },
        status: 'completed',
      }).lean(),
    ]);

    // Get platform fees from PlatformTransaction (not WalletTransaction)
    // Platform fees for competitions are stored in PlatformTransaction with sourceType: 'competition'
    const competitionIdStrings = competitionIds.map(id => id.toString());
    
    const [platformFeeTransactions, unclaimedPools] = await Promise.all([
      PlatformTransaction.find({
      transactionType: 'platform_fee',
        sourceType: 'competition',
        sourceId: { $in: competitionIdStrings },
      }).lean(),
      PlatformTransaction.find({
        transactionType: 'unclaimed_pool',
        $or: [
          { sourceId: { $in: competitionIdStrings } },
          { 'metadata.competitionId': { $in: competitionIdStrings } },
        ],
      }).lean(),
    ]);

    // Get participants with status info
    const participants = await CompetitionParticipant.find({
      competitionId: { $in: competitionIds },
    }).lean();

    // Get conversion settings
    const conversionSettings = await CreditConversionSettings.getSingleton();

    // Build detailed competition analytics
    const competitionAnalytics = await Promise.all(competitions.map(async (comp) => {
      const compId = comp._id.toString();
      
      // Get transactions for this competition
      const compWins = winTransactions.filter(
        (t) => t.competitionId?.toString() === compId
      );
      const compEntries = entryTransactions.filter(
        (t) => t.competitionId?.toString() === compId
      );
      const compRefunds = refundTransactions.filter(
        (t) => t.competitionId?.toString() === compId
      );
      // Platform fees are stored in PlatformTransaction with sourceId = competitionId
      const compPlatformFee = platformFeeTransactions.find(
        (t: any) => t.sourceId === compId
      );
      const compUnclaimedPool = unclaimedPools.find(
        (t: any) => t.sourceId === compId || t.metadata?.competitionId === compId
      );
      const compParticipants = participants.filter(
        (p) => p.competitionId?.toString() === compId
      );

      // Calculate totals
      const totalWinnersPaid = compWins.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      const totalEntryFees = compEntries.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      const totalRefunds = compRefunds.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      const platformFeeFromTransactions = (compPlatformFee as any)?.amount || 0;
      const unclaimedPoolAmount = (compUnclaimedPool as any)?.amount || 0;
      
      // Calculate platform fee earned
      const prizePool = comp.prizePool || 0;
      const participantsCount = comp.currentParticipants || 0;
      const entryFee = comp.entryFee || 0;
      const platformFeePercentage = comp.platformFeePercentage || 0;
      
      // Calculate expected platform fee from competition settings
      const totalCollected = participantsCount * entryFee;
      const expectedPlatformFee = totalCollected * (platformFeePercentage / 100);
      
      // Use actual transactions if available
      let platformFeeEarned = platformFeeFromTransactions;
      
      // If no transaction found, calculate the platform fee from settings
      if (platformFeeEarned === 0 && comp.status === 'completed' && totalCollected > 0) {
        // Method 1: Use the expected fee percentage
        platformFeeEarned = expectedPlatformFee;
        
        // Method 2: Calculate from what's left over (totalCollected - prizePool - totalWinnersPaid)
        // If prize pool was never properly distributed, use this
        const actualRemainder = totalCollected - totalWinnersPaid;
        if (actualRemainder > 0 && actualRemainder !== platformFeeEarned) {
          // Use the larger of expected fee or actual remainder
          // This handles cases where some winners didn't get paid (disqualified)
          platformFeeEarned = Math.max(expectedPlatformFee, actualRemainder - unclaimedPoolAmount);
        }
      }
      
      // For cancelled competitions, fee earned is 0 (all refunded)
      if (comp.status === 'cancelled') {
        platformFeeEarned = 0;
      }
      
      // Ensure non-negative
      if (platformFeeEarned < 0) platformFeeEarned = 0;

      // Count disqualified participants
      const disqualifiedParticipants = compParticipants.filter(
        (p: any) => p.status === 'disqualified' || 
               (comp.finalLeaderboard && comp.finalLeaderboard.find(
                 (l: any) => l.userId?.toString() === p.userId?.toString() && l.qualificationStatus === 'disqualified'
               ))
      );
      
      // Get disqualification details from leaderboard or participants
      let disqualifiedDetails: { userId: string; displayName: string; reason: string; finalPnl: number }[] = [];
      
      // Try to get from finalLeaderboard first
      if (comp.finalLeaderboard) {
        disqualifiedDetails = (comp.finalLeaderboard as any[])
          .filter((l: any) => l.qualificationStatus === 'disqualified')
          .map((l: any) => ({
            userId: l.userId || '',
            displayName: l.displayName || l.username || 'Unknown',
            reason: l.disqualificationReason || 'Did not meet minimum requirements',
            finalPnl: l.pnl || 0,
          }));
      }
      
      // If no leaderboard data, get from participants
      if (disqualifiedDetails.length === 0 && disqualifiedParticipants.length > 0) {
        disqualifiedDetails = disqualifiedParticipants.map((p: any) => ({
          userId: p.userId || '',
          displayName: p.username || 'Unknown',
          reason: p.disqualificationReason || 'Did not meet minimum requirements',
          finalPnl: p.pnl || 0,
        }));
      }

      // Build winner details
      const winners = await Promise.all(compWins.map(async (t) => {
        let displayName = 'Unknown';
        try {
          const user = await getUserById(t.userId);
          displayName = user?.name || user?.email?.split('@')[0] || t.userId.substring(0, 8);
        } catch (e) {
          displayName = t.userId.substring(0, 8);
        }
        
        return {
        userId: t.userId,
          displayName,
          amount: Math.abs(t.amount),
        rank: t.metadata?.rank || 0,
        percentage: t.metadata?.percentage || 0,
        finalPnl: t.metadata?.finalPnl || 0,
        };
      }));

      // Get refund details for cancelled competitions
      const refundDetails = await Promise.all(compRefunds.map(async (t) => {
        let displayName = 'Unknown';
        try {
          const user = await getUserById(t.userId);
          displayName = user?.name || user?.email?.split('@')[0] || t.userId.substring(0, 8);
        } catch (e) {
          displayName = t.userId.substring(0, 8);
        }
        
        return {
          userId: t.userId,
          displayName,
          amount: Math.abs(t.amount),
          description: t.description,
          date: t.createdAt,
        };
      }));

      return {
        _id: comp._id,
        name: comp.name,
        status: comp.status,
        cancellationReason: comp.cancellationReason,
        startTime: comp.startTime,
        endTime: comp.endTime,
        entryFee,
        participants: participantsCount,
        prizePool,
        platformFeePercentage,
        // Financial breakdown
        totalCollected, // Total entry fees collected
        platformFeeEarned, // What platform actually kept
        expectedPlatformFee, // What platform was supposed to earn
        totalWinnersPaid, // Total prizes distributed
        totalRefunds, // Total refunds (for cancelled)
        unclaimedPool: unclaimedPoolAmount, // From disqualified users
        // Counts
        winnersCount: compWins.length,
        disqualifiedCount: disqualifiedParticipants.length,
        refundsCount: compRefunds.length,
        // Details
        winners,
        disqualifiedDetails,
        refundDetails,
        leaderboard: comp.finalLeaderboard || [],
      };
    }));

    // Calculate overall statistics
    const completedComps = competitionAnalytics.filter(c => c.status === 'completed');
    const cancelledComps = competitionAnalytics.filter(c => c.status === 'cancelled');
    
    const totalPrizePools = completedComps.reduce((sum, c) => sum + c.prizePool, 0);
    const totalPlatformFees = completedComps.reduce((sum, c) => sum + c.platformFeeEarned, 0);
    const totalWinnersPaid = completedComps.reduce((sum, c) => sum + c.totalWinnersPaid, 0);
    const totalRefunds = cancelledComps.reduce((sum, c) => sum + c.totalRefunds, 0);
    const totalUnclaimedPools = completedComps.reduce((sum, c) => sum + (c.unclaimedPool || 0), 0);
    const totalParticipants = competitionAnalytics.reduce((sum, c) => sum + c.participants, 0);
    const totalDisqualified = competitionAnalytics.reduce((sum, c) => sum + c.disqualifiedCount, 0);
    const totalCompetitions = competitionAnalytics.length;

    // ========== 1v1 CHALLENGE ANALYTICS ==========
    const challenges = await Challenge.find({ 
      status: { $in: ['completed', 'declined', 'expired'] } 
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const challengeIds = challenges.map((c) => c._id.toString());

    // Get challenge-related wallet transactions
    const [
      challengeWinTransactions,
      challengeEntryTransactions,
    ] = await Promise.all([
      WalletTransaction.find({
        transactionType: 'challenge_win',
        challengeId: { $in: challengeIds },
        status: 'completed',
      }).lean(),
      WalletTransaction.find({
        transactionType: 'challenge_entry',
        challengeId: { $in: challengeIds },
        status: 'completed',
      }).lean(),
    ]);

    // Get challenge platform fees from PlatformTransaction
    const challengePlatformFees = await PlatformTransaction.find({
      transactionType: 'challenge_platform_fee',
      sourceId: { $in: challengeIds },
    }).lean();

    // Get unclaimed pools from challenges (both disqualified)
    const challengeUnclaimedPools = await PlatformTransaction.find({
      transactionType: 'unclaimed_pool',
      sourceType: 'challenge',
      sourceId: { $in: challengeIds },
    }).lean();

    // Build challenge analytics
    const challengeAnalytics = challenges.map((challenge) => {
      const chalId = challenge._id.toString();
      const wins = challengeWinTransactions.filter((t) => t.challengeId === chalId);
      const entries = challengeEntryTransactions.filter((t) => t.challengeId === chalId);
      const platformFee = challengePlatformFees.find((t: any) => t.sourceId === chalId);
      const unclaimedPool = challengeUnclaimedPools.find((t: any) => t.sourceId === chalId);

      // Check if both players were disqualified
      const challengerDisqualified = challenge.challengerFinalStats?.isDisqualified;
      const challengedDisqualified = challenge.challengedFinalStats?.isDisqualified;
      const bothDisqualified = challengerDisqualified && challengedDisqualified;

      return {
        _id: challenge._id,
        status: challenge.status,
        challengerName: challenge.challengerName,
        challengedName: challenge.challengedName,
        entryFee: challenge.entryFee,
        prizePool: challenge.prizePool,
        platformFeeAmount: challenge.platformFeeAmount || (platformFee as any)?.amount || 0,
        winnerPrize: challenge.winnerPrize,
        duration: challenge.duration,
        winnerId: challenge.winnerId,
        winnerName: challenge.winnerName,
        winnerPnL: challenge.winnerPnL,
        loserId: challenge.loserId,
        loserName: challenge.loserName,
        loserPnL: challenge.loserPnL,
        isTie: challenge.isTie,
        bothDisqualified,
        unclaimedPool: bothDisqualified ? ((unclaimedPool as any)?.amount || challenge.winnerPrize || 0) : 0,
        createdAt: challenge.createdAt,
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        challengerStats: challenge.challengerFinalStats,
        challengedStats: challenge.challengedFinalStats,
      };
    });

    // Calculate challenge overall statistics
    const completedChallenges = challengeAnalytics.filter(c => c.status === 'completed');
    const declinedChallenges = challengeAnalytics.filter(c => c.status === 'declined');
    const expiredChallenges = challengeAnalytics.filter(c => c.status === 'expired');
    const tieChallenges = completedChallenges.filter(c => c.isTie);
    const bothDisqualifiedChallenges = completedChallenges.filter(c => c.bothDisqualified);

    const totalChallengePrizePools = completedChallenges.reduce((sum, c) => sum + (c.prizePool || 0), 0);
    const totalChallengePlatformFees = completedChallenges.reduce((sum, c) => sum + (c.platformFeeAmount || 0), 0);
    const totalChallengeWinnersPaid = completedChallenges.filter(c => !c.bothDisqualified).reduce((sum, c) => sum + (c.winnerPrize || 0), 0);
    const totalChallengeUnclaimedPools = completedChallenges.reduce((sum, c) => sum + (c.unclaimedPool || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        competitions: competitionAnalytics,
        overallStats: {
          totalCompetitions,
          completedCompetitions: completedComps.length,
          cancelledCompetitions: cancelledComps.length,
          totalParticipants,
          totalPrizePools,
          totalPlatformFees,
          totalWinnersPaid,
          totalRefunds,
          totalUnclaimedPools,
          totalDisqualified,
          averageParticipantsPerComp: totalCompetitions > 0 ? totalParticipants / totalCompetitions : 0,
          averagePrizePool: completedComps.length > 0 ? totalPrizePools / completedComps.length : 0,
        },
        // 1v1 Challenge data
        challenges: challengeAnalytics,
        challengeStats: {
          totalChallenges: challenges.length,
          completedChallenges: completedChallenges.length,
          declinedChallenges: declinedChallenges.length,
          expiredChallenges: expiredChallenges.length,
          tieChallenges: tieChallenges.length,
          bothDisqualifiedChallenges: bothDisqualifiedChallenges.length,
          totalChallengePrizePools,
          totalChallengePlatformFees,
          totalChallengeWinnersPaid,
          totalChallengeUnclaimedPools, // From both-disqualified challenges
          averageChallengeEntryFee: completedChallenges.length > 0 
            ? completedChallenges.reduce((sum, c) => sum + (c.entryFee || 0), 0) / completedChallenges.length 
            : 0,
        },
        conversionRate: conversionSettings.eurToCreditsRate,
      },
    });
  } catch (error) {
    console.error('Error fetching competition analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competition analytics' },
      { status: 500 }
    );
  }
}
