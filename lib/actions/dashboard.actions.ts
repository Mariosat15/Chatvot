'use server';

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import Competition from '@/database/models/trading/competition.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import { getRealPrice } from '@/lib/services/real-forex-prices.service';
import { ForexSymbol, calculateUnrealizedPnL } from '@/lib/services/pnl-calculator.service';

// Get user's dashboard data (for API routes - takes userId directly, no redirect)
export const getUserDashboardDataForApi = async (userId: string) => {
  try {
    await connectToDatabase();
    
    console.log('📊 Dashboard API: Fetching data for user:', userId);

    // Get all active competitions the user is participating in (only LIVE competitions)
    const activeParticipations = await CompetitionParticipant.find({
      userId: userId,
      status: 'active',
    }).lean();
    
    console.log('📊 Active participations found:', activeParticipations.length);

    // Filter to only include competitions that are currently active (live now)
    const liveCompetitionIds = await Competition.find({
      status: 'active',
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    }).distinct('_id');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveParticipations = activeParticipations.filter((participation: any) =>
      liveCompetitionIds.some((id) => id.toString() === participation.competitionId.toString())
    );

    // Same logic as getUserDashboardData but with userId parameter
    const competitionsWithStats = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      liveParticipations.map(async (participation: any) => {
        try {
          const competition = await Competition.findById(participation.competitionId).lean();
          if (!competition) return null;

          const openPositions = await TradingPosition.find({
            participantId: participation._id,
            status: 'open',
          }).lean();

          // Calculate unrealized PnL for open positions
          let totalUnrealizedPnL = 0;
          const positionsWithPnL = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            openPositions.map(async (pos: any) => {
              try {
                const priceQuote = await getRealPrice(pos.symbol as ForexSymbol);
                if (priceQuote) {
                  const currentPrice = pos.type === 'long' ? priceQuote.bid : priceQuote.ask;
                  const unrealizedPnL = calculateUnrealizedPnL(
                    pos.type,
                    pos.entryPrice,
                    currentPrice,
                    pos.size,
                    pos.symbol as ForexSymbol
                  );
                  totalUnrealizedPnL += unrealizedPnL;
                  return { ...pos, currentPrice, unrealizedPnL };
                }
                return pos;
              } catch {
                return pos;
              }
            })
          );

          const comp = competition as { startingCapital?: number };
          const currentCapital = (participation.currentCapital || comp.startingCapital || 0) + totalUnrealizedPnL;

          return {
            competition: JSON.parse(JSON.stringify(competition)),
            participation: {
              ...JSON.parse(JSON.stringify(participation)),
              currentCapital,
              unrealizedPnL: totalUnrealizedPnL,
            },
            openPositions: JSON.parse(JSON.stringify(positionsWithPnL)),
            openPositionsCount: openPositions.length,
          };
        } catch (error) {
          console.error(`❌ Error processing competition ${participation.competitionId}:`, error);
          return null;
        }
      })
    );

    const validCompetitions = competitionsWithStats.filter(Boolean);

    const totalCapital = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.currentCapital || 0),
      0
    );
    const totalPnL = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.pnl || 0),
      0
    );
    const totalPositions = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.openPositionsCount || 0),
      0
    );
    const totalTrades = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.totalTrades || 0),
      0
    );
    const totalWinningTrades = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.winningTrades || 0),
      0
    );
    const totalLosingTrades = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.losingTrades || 0),
      0
    );
    const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;

    return {
      activeCompetitions: validCompetitions,
      overallStats: {
        totalCapital,
        totalPnL,
        totalPositions,
        totalTrades,
        totalWinningTrades,
        totalLosingTrades,
        overallWinRate,
        profitFactor: 0,
        activeCompetitionsCount: validCompetitions.length,
      },
      globalCharts: {
        dailyPnL: [],
      },
    };
  } catch (error) {
    console.error('❌ Error getting dashboard data for API:', error);
    return null;
  }
};

// Get user's dashboard data (for client components - uses redirect)
export const getUserDashboardData = async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();
    
    console.log('📊 Dashboard: Fetching data for user:', session.user.id, session.user.name);

    // Get all active competitions the user is participating in (only LIVE competitions)
    const activeParticipations = await CompetitionParticipant.find({
      userId: session.user.id,
      status: 'active',
    }).lean();
    
    console.log('📊 Active participations found:', activeParticipations.length);

    // Filter to only include competitions that are currently active (live now)
    const liveCompetitionIds = await Competition.find({
      status: 'active', // Only competitions that are currently live
      startTime: { $lte: new Date() }, // Started
      endTime: { $gte: new Date() }, // Not ended yet
    }).distinct('_id');

    // Filter participations to only include live competitions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveParticipations = activeParticipations.filter((participation: any) =>
      liveCompetitionIds.some((id) => id.toString() === participation.competitionId.toString())
    );
    
    console.log('📊 Live competitions:', liveCompetitionIds.length);
    console.log('📊 Live participations:', liveParticipations.length);

    // Get competition details for each participation (only live ones)
    const competitionsWithStats = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      liveParticipations.map(async (participation: any) => {
        try {
          console.log(`📊 Processing competition for user ${session.user.id}, participationId: ${participation._id}`);
          
          const competition = await Competition.findById(participation.competitionId).lean();
          
          if (!competition) {
            console.log(`⚠️ Competition not found: ${participation.competitionId}`);
            return null;
          }
          
          const comp = competition as { name?: string };
          console.log(`✅ Competition found: ${comp.name || 'Unknown'}`);

        // Get participant statistics for this competition
        const participantStats = await CompetitionParticipant.aggregate([
          {
            $match: { competitionId: participation.competitionId }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        const stats = {
          active: 0,
          liquidated: 0,
          completed: 0,
          disqualified: 0,
          total: 0
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        participantStats.forEach((stat: { _id: string; count: number }) => {
          stats[stat._id as keyof typeof stats] = stat.count;
          stats.total += stat.count;
        });

        // Get detailed participant lists
        const activeParticipants = await CompetitionParticipant.find({
          competitionId: participation.competitionId,
          status: 'active'
        })
          .sort({ currentRank: 1 })
          .limit(20)
          .lean();

        const liquidatedParticipants = await CompetitionParticipant.find({
          competitionId: participation.competitionId,
          status: 'liquidated'
        })
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean();

        const disqualifiedParticipants = await CompetitionParticipant.find({
          competitionId: participation.competitionId,
          status: 'disqualified'
        })
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean();

        // Get open positions count and value
        const openPositions = await TradingPosition.find({
          competitionId: participation.competitionId,
          userId: session.user.id,
          status: 'open',
        }).lean();

        // Calculate total unrealized P&L from open positions
        let totalUnrealizedPnL = 0;
        for (const position of openPositions) {
          const currentPrice = await getRealPrice(position.symbol as ForexSymbol);
          if (currentPrice) {
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            const pnl = calculateUnrealizedPnL(
              position.side,
              position.entryPrice,
              marketPrice,
              position.quantity,
              position.symbol as ForexSymbol
            );
            totalUnrealizedPnL += pnl;
          }
        }

        // Get recent CLOSED trades (last 10)
        const recentClosedTrades = await TradeHistory.find({
          competitionId: participation.competitionId,
          userId: session.user.id,
        })
          .sort({ closedAt: -1 })
          .limit(10)
          .lean();

        // Get open positions with current prices
        const openPositionsWithPrices = [];
        for (const pos of openPositions) {
          const livePrices = await getRealPrice(pos.symbol as ForexSymbol);
          const currentPrice = livePrices ? 
            (pos.side === 'long' ? livePrices.bid : livePrices.ask) : 
            pos.entryPrice;
          
          const unrealizedPnl = calculateUnrealizedPnL(
            pos.side,
            pos.entryPrice,
            currentPrice,
            pos.quantity,
            pos.symbol as ForexSymbol
          );
          
          const unrealizedPnlPercentage = pos.marginUsed > 0 ? (unrealizedPnl / pos.marginUsed) * 100 : 0;
          
          openPositionsWithPrices.push({
            ...pos,
            currentPrice,
            unrealizedPnl,
            unrealizedPnlPercentage
          });
        }

        console.log(`📊 User ${session.user.id} - Competition ${participation.competitionId}:`);
        console.log(`   - Open positions: ${openPositions.length}`);
        console.log(`   - Open positions with prices: ${openPositionsWithPrices.length}`);
        console.log(`   - Closed trades: ${recentClosedTrades.length}`);
        console.log(`   - Win rate: ${participation.winRate}%`);
        console.log(`   - Total trades: ${participation.totalTrades}`);
        console.log(`   - Unrealized P&L: $${totalUnrealizedPnL.toFixed(2)}`);

        // We've removed the heavy chart data generation for performance

        // Get ALL participants for win probability calculation
        const allCompetitionParticipants = await CompetitionParticipant.find({
          competitionId: participation.competitionId,
        })
          .select('userId currentCapital startingCapital pnl pnlPercentage totalTrades winningTrades losingTrades winRate averageWin averageLoss currentRank status')
          .lean();

        return {
          competition: JSON.parse(JSON.stringify(competition)),
          participation: JSON.parse(JSON.stringify({
            ...participation,
            unrealizedPnl: totalUnrealizedPnL,
          })),
          openPositionsCount: openPositions.length,
          recentClosedTrades: JSON.parse(JSON.stringify(recentClosedTrades)),
          openPositions: JSON.parse(JSON.stringify(openPositionsWithPrices)),
          participantStats: {
            counts: stats,
            active: JSON.parse(JSON.stringify(activeParticipants)),
            liquidated: JSON.parse(JSON.stringify(liquidatedParticipants)),
            disqualified: JSON.parse(JSON.stringify(disqualifiedParticipants)),
          },
          // Add all participants for win probability calculation
          allParticipants: JSON.parse(JSON.stringify(allCompetitionParticipants)),
        };
        } catch (error) {
          console.error(`❌ Error processing competition ${participation.competitionId} for user ${session.user.id}:`, error);
          console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
          console.error('Participation data:', JSON.stringify(participation, null, 2));
          return null;
        }
      })
    );

    // Filter out null values
    const validCompetitions = competitionsWithStats.filter(Boolean);

    // Get overall stats across all competitions
    const totalCapital = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.currentCapital || 0),
      0
    );

    const totalPnL = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.pnl || 0),
      0
    );

    const totalPositions = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.openPositionsCount || 0),
      0
    );

    // Calculate aggregate trading stats (same method as profile)
    const totalTrades = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.totalTrades || 0),
      0
    );

    const totalWinningTrades = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.winningTrades || 0),
      0
    );

    const totalLosingTrades = validCompetitions.reduce(
      (sum, comp) => sum + (comp?.participation.losingTrades || 0),
      0
    );

    // Calculate true overall win rate (not average of win rates)
    const overallWinRate = totalTrades > 0 
      ? (totalWinningTrades / totalTrades) * 100 
      : 0;

    // Calculate profit factor
    let totalGrossProfit = 0;
    let totalGrossLoss = 0;
    validCompetitions.forEach((comp) => {
      const p = comp?.participation;
      if (p?.averageWin && p?.winningTrades) {
        totalGrossProfit += p.averageWin * p.winningTrades;
      }
      if (p?.averageLoss && p?.losingTrades) {
        totalGrossLoss += Math.abs(p.averageLoss) * p.losingTrades;
      }
    });
    const profitFactor = totalGrossLoss > 0 
      ? totalGrossProfit / totalGrossLoss 
      : totalWinningTrades > 0 ? 9999 : 0;

    // Generate global daily P&L across all competitions
    const aggregatedDailyPnL = new Map<string, { pnl: number; trades: number }>();
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      aggregatedDailyPnL.set(dateStr, { pnl: 0, trades: 0 });
    }

    // Fetch all closed trades from all competitions for daily P&L calculation
    const allCompetitionIds = validCompetitions.map(comp => comp?.competition._id);
    const allTrades = await TradeHistory.find({
      competitionId: { $in: allCompetitionIds },
      userId: session.user.id,
    })
      .sort({ closedAt: 1 })
      .lean();

    // Aggregate trades by day
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dayTrades = allTrades.filter((t: any) => {
        const tradeDate = new Date(t.closedAt);
        return tradeDate >= startOfDay && tradeDate <= endOfDay;
      });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dayPnL = dayTrades.reduce((sum: number, t: any) => sum + (t.realizedPnl || 0), 0);
      
      aggregatedDailyPnL.set(dateStr, {
        pnl: dayPnL,
        trades: dayTrades.length
      });
    }

    const globalDailyPnL = Array.from(aggregatedDailyPnL.entries()).map(([date, data]) => ({
      date,
      pnl: data.pnl,
      trades: data.trades
    }));

    console.log('📊 Dashboard Summary:');
    console.log(`   - Total Capital: $${totalCapital.toFixed(2)}`);
    console.log(`   - Total P&L: $${totalPnL.toFixed(2)}`);
    console.log(`   - Total Positions: ${totalPositions}`);
    console.log(`   - Total Trades: ${totalTrades}`);
    console.log(`   - Winning Trades: ${totalWinningTrades}`);
    console.log(`   - Losing Trades: ${totalLosingTrades}`);
    console.log(`   - Overall Win Rate: ${overallWinRate.toFixed(2)}%`);
    console.log(`   - Profit Factor: ${profitFactor === 9999 ? '∞' : profitFactor.toFixed(2)}`);
    
    return {
      activeCompetitions: validCompetitions,
      overallStats: {
        totalCapital,
        totalPnL,
        totalPositions,
        totalTrades,
        totalWinningTrades,
        totalLosingTrades,
        overallWinRate,
        profitFactor,
        activeCompetitionsCount: validCompetitions.length,
      },
      globalCharts: {
        dailyPnL: globalDailyPnL,
      },
    };
  } catch (error) {
    // Don't log NEXT_REDIRECT as an error (it's expected for redirects)
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error; // Re-throw to allow redirect to happen
    }
    
    console.error('❌ Error getting dashboard data:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    return {
      activeCompetitions: [],
      overallStats: {
        totalCapital: 0,
        totalPnL: 0,
        totalPositions: 0,
        totalTrades: 0,
        totalWinningTrades: 0,
        totalLosingTrades: 0,
        overallWinRate: 0,
        profitFactor: 0,
        activeCompetitionsCount: 0,
      },
      globalCharts: {
        dailyPnL: [],
      },
    };
  }
};

