import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import Competition from '@/database/models/trading/competition.model';
import Challenge from '@/database/models/trading/challenge.model';
import TradingPosition from '@/database/models/trading/trading-position.model';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/competition-stats
 * Fetch comprehensive competition AND challenge statistics for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');
    const challengeId = searchParams.get('challengeId');
    const contestType = searchParams.get('type') || 'competition'; // 'competition' or 'challenge'

    await connectToDatabase();

    // Get all user's competition participations
    const allCompetitionParticipations = await CompetitionParticipant.find({ userId })
      .populate('competitionId', 'name status prizePool entryFeeCredits startTime endTime')
      .lean();

    // Get all user's challenge participations
    const allChallengeParticipations = await ChallengeParticipant.find({ userId })
      .populate('challengeId', 'name status prizePool stakeAmount startTime endTime')
      .lean();

    // Calculate all-time stats (combining competitions + challenges)
    const allTimeStats = {
      // Competitions
      totalCompetitions: allCompetitionParticipations.length,
      activeCompetitions: 0,
      completedCompetitions: 0,
      // Challenges (1v1)
      totalChallenges: allChallengeParticipations.length,
      activeChallenges: 0,
      completedChallenges: 0,
      challengeWins: 0,
      challengeLosses: 0,
      // Combined Stats
      totalContests: allCompetitionParticipations.length + allChallengeParticipations.length,
      totalPnL: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      bestRank: null as number | null,
      averageRank: 0,
      totalPrizesWon: 0,
      totalEntryFees: 0,
      netProfit: 0,
      winRate: 0,
      averagePnLPerContest: 0,
      biggestWin: 0,
      biggestLoss: 0,
      rankHistory: [] as { date: string; rank: number; name: string; type: string }[],
      pnlHistory: [] as { date: string; pnl: number; name: string; type: string }[],
      monthlyPerformance: {} as Record<string, { pnl: number; contests: number; winRate: number }>,
    };

    let rankSum = 0;
    let rankedContests = 0;

    // Process competition participations
    for (const participation of allCompetitionParticipations) {
      const comp = participation.competitionId as any;
      if (!comp) continue;

      // Count by status
      if (comp.status === 'active') allTimeStats.activeCompetitions++;
      if (comp.status === 'completed') allTimeStats.completedCompetitions++;

      // Accumulate stats
      allTimeStats.totalPnL += participation.pnl || 0;
      allTimeStats.totalTrades += participation.totalTrades || 0;
      allTimeStats.winningTrades += participation.winningTrades || 0;
      allTimeStats.losingTrades += participation.losingTrades || 0;
      allTimeStats.totalEntryFees += comp.entryFeeCredits || 0;

      // Track best/biggest stats
      if (participation.pnl > allTimeStats.biggestWin) {
        allTimeStats.biggestWin = participation.pnl;
      }
      if (participation.pnl < allTimeStats.biggestLoss) {
        allTimeStats.biggestLoss = participation.pnl;
      }

      // Track ranks
      if (participation.currentRank) {
        if (!allTimeStats.bestRank || participation.currentRank < allTimeStats.bestRank) {
          allTimeStats.bestRank = participation.currentRank;
        }
        rankSum += participation.currentRank;
        rankedContests++;

        allTimeStats.rankHistory.push({
          date: comp.endTime ? new Date(comp.endTime).toISOString() : new Date().toISOString(),
          rank: participation.currentRank,
          name: comp.name,
          type: 'competition',
        });
      }

      // Prize won
      if (participation.prizeWon) {
        allTimeStats.totalPrizesWon += participation.prizeWon;
      }

      // PnL history
      allTimeStats.pnlHistory.push({
        date: comp.endTime ? new Date(comp.endTime).toISOString() : new Date().toISOString(),
        pnl: participation.pnl || 0,
        name: comp.name,
        type: 'competition',
      });

      // Monthly performance
      const monthKey = comp.startTime 
        ? new Date(comp.startTime).toISOString().slice(0, 7) 
        : new Date().toISOString().slice(0, 7);
      
      if (!allTimeStats.monthlyPerformance[monthKey]) {
        allTimeStats.monthlyPerformance[monthKey] = { pnl: 0, contests: 0, winRate: 0 };
      }
      allTimeStats.monthlyPerformance[monthKey].pnl += participation.pnl || 0;
      allTimeStats.monthlyPerformance[monthKey].contests++;
    }

    // Process challenge participations
    for (const participation of allChallengeParticipations) {
      const challenge = participation.challengeId as any;
      if (!challenge) continue;

      // Count by status
      if (challenge.status === 'active') allTimeStats.activeChallenges++;
      if (challenge.status === 'completed') {
        allTimeStats.completedChallenges++;
        if (participation.isWinner) {
          allTimeStats.challengeWins++;
        } else {
          allTimeStats.challengeLosses++;
        }
      }

      // Accumulate stats
      allTimeStats.totalPnL += participation.pnl || 0;
      allTimeStats.totalTrades += participation.totalTrades || 0;
      allTimeStats.winningTrades += participation.winningTrades || 0;
      allTimeStats.losingTrades += participation.losingTrades || 0;
      allTimeStats.totalEntryFees += challenge.stakeAmount || 0;

      // Track best/biggest stats
      if (participation.pnl > allTimeStats.biggestWin) {
        allTimeStats.biggestWin = participation.pnl;
      }
      if (participation.pnl < allTimeStats.biggestLoss) {
        allTimeStats.biggestLoss = participation.pnl;
      }

      // Prize received from challenges
      if (participation.prizeReceived) {
        allTimeStats.totalPrizesWon += participation.prizeReceived;
      }

      // PnL history
      allTimeStats.pnlHistory.push({
        date: challenge.endTime ? new Date(challenge.endTime).toISOString() : new Date().toISOString(),
        pnl: participation.pnl || 0,
        name: challenge.name || '1v1 Challenge',
        type: 'challenge',
      });

      // Rank history for challenges (1st or 2nd)
      if (challenge.status === 'completed') {
        allTimeStats.rankHistory.push({
          date: challenge.endTime ? new Date(challenge.endTime).toISOString() : new Date().toISOString(),
          rank: participation.isWinner ? 1 : 2,
          name: challenge.name || '1v1 Challenge',
          type: 'challenge',
        });
      }

      // Monthly performance
      const monthKey = challenge.startTime 
        ? new Date(challenge.startTime).toISOString().slice(0, 7) 
        : new Date().toISOString().slice(0, 7);
      
      if (!allTimeStats.monthlyPerformance[monthKey]) {
        allTimeStats.monthlyPerformance[monthKey] = { pnl: 0, contests: 0, winRate: 0 };
      }
      allTimeStats.monthlyPerformance[monthKey].pnl += participation.pnl || 0;
      allTimeStats.monthlyPerformance[monthKey].contests++;
    }

    // Calculate derived stats
    allTimeStats.averageRank = rankedContests > 0 ? rankSum / rankedContests : 0;
    allTimeStats.netProfit = allTimeStats.totalPrizesWon - allTimeStats.totalEntryFees + allTimeStats.totalPnL;
    allTimeStats.winRate = allTimeStats.totalTrades > 0 
      ? (allTimeStats.winningTrades / allTimeStats.totalTrades) * 100 
      : 0;
    allTimeStats.averagePnLPerContest = allTimeStats.totalContests > 0 
      ? allTimeStats.totalPnL / allTimeStats.totalContests 
      : 0;

    // Sort histories by date
    allTimeStats.rankHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    allTimeStats.pnlHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate monthly win rates
    for (const monthKey of Object.keys(allTimeStats.monthlyPerformance)) {
      const monthCompParticipations = allCompetitionParticipations.filter(p => {
        const comp = p.competitionId as any;
        return comp?.startTime && new Date(comp.startTime).toISOString().slice(0, 7) === monthKey;
      });
      const monthChalParticipations = allChallengeParticipations.filter(p => {
        const chal = p.challengeId as any;
        return chal?.startTime && new Date(chal.startTime).toISOString().slice(0, 7) === monthKey;
      });
      
      const monthWins = monthCompParticipations.reduce((sum, p) => sum + (p.winningTrades || 0), 0) +
                        monthChalParticipations.reduce((sum, p) => sum + (p.winningTrades || 0), 0);
      const monthTotal = monthCompParticipations.reduce((sum, p) => sum + (p.totalTrades || 0), 0) +
                         monthChalParticipations.reduce((sum, p) => sum + (p.totalTrades || 0), 0);
      allTimeStats.monthlyPerformance[monthKey].winRate = monthTotal > 0 ? (monthWins / monthTotal) * 100 : 0;
    }

    // Current competition stats (if competitionId provided)
    let currentCompetitionStats = null;
    let livePositions = null;
    let equityCurve: { time: string; equity: number }[] = [];

    if (competitionId) {
      const participation = await CompetitionParticipant.findOne({
        competitionId,
        userId,
      }).lean();

      if (participation) {
        const competition = await Competition.findById(competitionId).lean();
        
        // Get all positions for this competition
        const positions = await TradingPosition.find({
          competitionId,
          participantId: participation._id,
        }).sort({ openedAt: 1 }).lean();

        // Calculate live stats
        const openPositions = positions.filter(p => p.status === 'open');
        const closedPositions = positions.filter(p => p.status === 'closed');
        
        const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
        const realizedPnL = closedPositions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
        
        // Build equity curve from closed positions
        let runningEquity = competition?.startingCapital || 10000;
        equityCurve.push({ time: new Date(competition?.startTime || Date.now()).toISOString(), equity: runningEquity });
        
        for (const pos of closedPositions) {
          runningEquity += pos.realizedPnL || 0;
          equityCurve.push({
            time: pos.closedAt?.toISOString() || new Date().toISOString(),
            equity: runningEquity,
          });
        }

        // Add current equity if there are open positions
        if (openPositions.length > 0) {
          equityCurve.push({
            time: new Date().toISOString(),
            equity: runningEquity + unrealizedPnL,
          });
        }

        // Calculate session stats (today)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const todayTrades = closedPositions.filter(p => 
          p.closedAt && new Date(p.closedAt) >= today
        );
        const todayPnL = todayTrades.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);
        const todayWins = todayTrades.filter(p => (p.realizedPnL || 0) > 0).length;

        // Calculate winning streak
        let winStreak = 0;
        let loseStreak = 0;
        let currentStreak = 0;
        let isWinStreak = true;

        for (let i = closedPositions.length - 1; i >= 0; i--) {
          const pnl = closedPositions[i].realizedPnL || 0;
          if (i === closedPositions.length - 1) {
            isWinStreak = pnl > 0;
            currentStreak = 1;
          } else {
            if ((pnl > 0) === isWinStreak) {
              currentStreak++;
            } else {
              break;
            }
          }
        }

        if (isWinStreak) winStreak = currentStreak;
        else loseStreak = currentStreak;

        // Calculate average trade stats
        const avgWin = closedPositions.filter(p => (p.realizedPnL || 0) > 0);
        const avgLoss = closedPositions.filter(p => (p.realizedPnL || 0) < 0);
        const avgWinAmount = avgWin.length > 0 
          ? avgWin.reduce((sum, p) => sum + (p.realizedPnL || 0), 0) / avgWin.length 
          : 0;
        const avgLossAmount = avgLoss.length > 0 
          ? Math.abs(avgLoss.reduce((sum, p) => sum + (p.realizedPnL || 0), 0)) / avgLoss.length 
          : 0;
        const profitFactor = avgLossAmount > 0 ? avgWinAmount / avgLossAmount : avgWinAmount > 0 ? Infinity : 0;

        currentCompetitionStats = {
          competitionName: competition?.name || 'Unknown',
          competitionStatus: competition?.status || 'unknown',
          startTime: competition?.startTime,
          endTime: competition?.endTime,
          startingCapital: competition?.startingCapital || 10000,
          currentCapital: participation.currentCapital || 0,
          currentRank: participation.currentRank || null,
          totalParticipants: competition?.currentParticipants || 0,
          pnl: participation.pnl || 0,
          pnlPercentage: participation.pnlPercentage || 0,
          totalTrades: participation.totalTrades || 0,
          winningTrades: participation.winningTrades || 0,
          losingTrades: participation.losingTrades || 0,
          winRate: participation.totalTrades > 0 
            ? ((participation.winningTrades || 0) / participation.totalTrades) * 100 
            : 0,
          openPositionsCount: openPositions.length,
          unrealizedPnL,
          realizedPnL,
          equity: (participation.currentCapital || 0) + unrealizedPnL,
          marginUsed: openPositions.reduce((sum, p) => sum + (p.marginRequired || 0), 0),
          availableMargin: (participation.currentCapital || 0) - openPositions.reduce((sum, p) => sum + (p.marginRequired || 0), 0),
          // Session stats
          todayPnL,
          todayTrades: todayTrades.length,
          todayWinRate: todayTrades.length > 0 ? (todayWins / todayTrades.length) * 100 : 0,
          // Streaks
          winStreak,
          loseStreak,
          currentStreak,
          isOnWinStreak: isWinStreak,
          // Advanced stats
          avgWin: avgWinAmount,
          avgLoss: avgLossAmount,
          profitFactor: profitFactor === Infinity ? 999 : profitFactor,
          largestWin: Math.max(...closedPositions.map(p => p.realizedPnL || 0), 0),
          largestLoss: Math.min(...closedPositions.map(p => p.realizedPnL || 0), 0),
          // Holding times
          avgHoldingTime: closedPositions.length > 0 
            ? closedPositions.reduce((sum, p) => {
                if (p.openedAt && p.closedAt) {
                  return sum + (new Date(p.closedAt).getTime() - new Date(p.openedAt).getTime());
                }
                return sum;
              }, 0) / closedPositions.length / 1000 / 60 // in minutes
            : 0,
        };

        livePositions = openPositions.map(p => ({
          id: p._id?.toString(),
          symbol: p.symbol,
          side: p.side,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          currentPrice: p.currentPrice,
          unrealizedPnL: p.unrealizedPnL,
          marginRequired: p.marginRequired,
          openedAt: p.openedAt,
        }));
      }
    }

    // Current challenge stats (if challengeId provided)
    let currentChallengeStats = null;
    let challengePositions = null;
    let challengeEquityCurve: { time: string; equity: number }[] = [];

    if (challengeId) {
      const participation = await ChallengeParticipant.findOne({
        challengeId,
        userId,
      }).lean();

      if (participation) {
        const challenge = await Challenge.findById(challengeId).lean();
        
        // Get opponent
        const opponent = await ChallengeParticipant.findOne({
          challengeId,
          userId: { $ne: userId },
        }).lean();
        
        // Get all positions for this challenge
        const positions = await TradingPosition.find({
          challengeId,
          participantId: participation._id,
        }).sort({ openedAt: 1 }).lean();

        const openPositions = positions.filter(p => p.status === 'open');
        const closedPositions = positions.filter(p => p.status === 'closed');
        
        const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
        
        // Build equity curve
        let runningEquity = participation.startingCapital || 10000;
        challengeEquityCurve.push({ time: new Date(challenge?.startTime || Date.now()).toISOString(), equity: runningEquity });
        
        for (const pos of closedPositions) {
          runningEquity += pos.realizedPnL || 0;
          challengeEquityCurve.push({
            time: pos.closedAt?.toISOString() || new Date().toISOString(),
            equity: runningEquity,
          });
        }

        if (openPositions.length > 0) {
          challengeEquityCurve.push({
            time: new Date().toISOString(),
            equity: runningEquity + unrealizedPnL,
          });
        }

        currentChallengeStats = {
          challengeName: challenge?.name || '1v1 Challenge',
          challengeStatus: challenge?.status || 'unknown',
          startTime: challenge?.startTime,
          endTime: challenge?.endTime,
          startingCapital: participation.startingCapital || 10000,
          currentCapital: participation.currentCapital || 0,
          pnl: participation.pnl || 0,
          pnlPercentage: participation.pnlPercentage || 0,
          totalTrades: participation.totalTrades || 0,
          winningTrades: participation.winningTrades || 0,
          losingTrades: participation.losingTrades || 0,
          winRate: participation.winRate || 0,
          openPositionsCount: openPositions.length,
          unrealizedPnL,
          realizedPnL: participation.realizedPnl || 0,
          equity: (participation.currentCapital || 0) + unrealizedPnL,
          role: participation.role,
          isWinner: participation.isWinner,
          // Opponent stats
          opponent: opponent ? {
            username: opponent.username,
            currentCapital: opponent.currentCapital,
            pnl: opponent.pnl,
            pnlPercentage: opponent.pnlPercentage,
            totalTrades: opponent.totalTrades,
            isWinner: opponent.isWinner,
          } : null,
          // Your lead/deficit
          leadAmount: opponent ? (participation.pnl || 0) - (opponent.pnl || 0) : 0,
          isLeading: opponent ? (participation.pnl || 0) > (opponent.pnl || 0) : false,
        };

        challengePositions = openPositions.map(p => ({
          id: p._id?.toString(),
          symbol: p.symbol,
          side: p.side,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          currentPrice: p.currentPrice,
          unrealizedPnL: p.unrealizedPnL,
          marginRequired: p.marginRequired,
          openedAt: p.openedAt,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      allTimeStats,
      currentCompetitionStats,
      currentChallengeStats,
      livePositions,
      challengePositions,
      equityCurve,
      challengeEquityCurve,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

