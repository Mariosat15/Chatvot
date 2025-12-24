import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import Competition from '@/database/models/trading/competition.model';
import TradingPosition from '@/database/models/trading/trading-position.model';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/competition-stats
 * Fetch comprehensive competition statistics for the current user
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

    await connectToDatabase();

    // Get all user's competition participations
    const allParticipations = await CompetitionParticipant.find({ userId })
      .populate('competitionId', 'name status prizePool entryFeeCredits startTime endTime')
      .lean();

    // Calculate all-time stats
    const allTimeStats = {
      totalCompetitions: allParticipations.length,
      activeCompetitions: 0,
      completedCompetitions: 0,
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
      averagePnLPerCompetition: 0,
      biggestWin: 0,
      biggestLoss: 0,
      rankHistory: [] as { date: string; rank: number; competition: string }[],
      pnlHistory: [] as { date: string; pnl: number; competition: string }[],
      monthlyPerformance: {} as Record<string, { pnl: number; competitions: number; winRate: number }>,
    };

    let rankSum = 0;
    let rankedCompetitions = 0;

    for (const participation of allParticipations) {
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
        rankedCompetitions++;

        // Add to rank history
        allTimeStats.rankHistory.push({
          date: comp.endTime ? new Date(comp.endTime).toISOString() : new Date().toISOString(),
          rank: participation.currentRank,
          competition: comp.name,
        });
      }

      // Prize won (if applicable)
      if (participation.prizeWon) {
        allTimeStats.totalPrizesWon += participation.prizeWon;
      }

      // PnL history
      allTimeStats.pnlHistory.push({
        date: comp.endTime ? new Date(comp.endTime).toISOString() : new Date().toISOString(),
        pnl: participation.pnl || 0,
        competition: comp.name,
      });

      // Monthly performance
      const monthKey = comp.startTime 
        ? new Date(comp.startTime).toISOString().slice(0, 7) 
        : new Date().toISOString().slice(0, 7);
      
      if (!allTimeStats.monthlyPerformance[monthKey]) {
        allTimeStats.monthlyPerformance[monthKey] = { pnl: 0, competitions: 0, winRate: 0 };
      }
      allTimeStats.monthlyPerformance[monthKey].pnl += participation.pnl || 0;
      allTimeStats.monthlyPerformance[monthKey].competitions++;
    }

    // Calculate derived stats
    allTimeStats.averageRank = rankedCompetitions > 0 ? rankSum / rankedCompetitions : 0;
    allTimeStats.netProfit = allTimeStats.totalPrizesWon - allTimeStats.totalEntryFees + allTimeStats.totalPnL;
    allTimeStats.winRate = allTimeStats.totalTrades > 0 
      ? (allTimeStats.winningTrades / allTimeStats.totalTrades) * 100 
      : 0;
    allTimeStats.averagePnLPerCompetition = allTimeStats.totalCompetitions > 0 
      ? allTimeStats.totalPnL / allTimeStats.totalCompetitions 
      : 0;

    // Sort histories by date
    allTimeStats.rankHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    allTimeStats.pnlHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate monthly win rates
    for (const monthKey of Object.keys(allTimeStats.monthlyPerformance)) {
      const monthParticipations = allParticipations.filter(p => {
        const comp = p.competitionId as any;
        return comp?.startTime && new Date(comp.startTime).toISOString().slice(0, 7) === monthKey;
      });
      
      const monthWins = monthParticipations.reduce((sum, p) => sum + (p.winningTrades || 0), 0);
      const monthTotal = monthParticipations.reduce((sum, p) => sum + (p.totalTrades || 0), 0);
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

    return NextResponse.json({
      success: true,
      allTimeStats,
      currentCompetitionStats,
      livePositions,
      equityCurve,
    });
  } catch (error) {
    console.error('Error fetching competition stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

