import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradeHistory from "@/database/models/trading/trade-history.model";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/competition-stats
 * Fetch comprehensive competition AND challenge statistics for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");
    const challengeId = searchParams.get("challengeId");
    const contestType = searchParams.get("type") || "competition"; // 'competition' or 'challenge'

    await connectToDatabase();

    // -------------------------------------------------------------------------
    // PERF FIX: replaced .populate() with manual batch-fetch to avoid N+1.
    // .populate("competitionId") fires an individual Competition.findOne per
    // document which, at 40+ participations, amplifies into 40+ round-trips.
    // Instead we: 1) fetch participations, 2) collect unique IDs, 3) one
    // $in query for the referenced docs, 4) join in JS via a Map.
    // -------------------------------------------------------------------------

    // 1. Fetch raw participations (no populate)
    const [rawCompParticipations, rawChalParticipations] = await Promise.all([
      CompetitionParticipant.find({ userId }).lean(),
      ChallengeParticipant.find({ userId }).lean(),
    ]);

    // 2. Collect unique competition / challenge IDs
    const compIds = [
      ...new Set(
        rawCompParticipations
          .map((p) => p.competitionId?.toString())
          .filter(Boolean),
      ),
    ];
    const chalIds = [
      ...new Set(
        rawChalParticipations
          .map((p) => (p as any).challengeId?.toString())
          .filter(Boolean),
      ),
    ];

    // 3. Batch-fetch the referenced documents (1 query each, not N)
    const [competitionDocs, challengeDocs] = await Promise.all([
      compIds.length > 0
        ? Competition.find({ _id: { $in: compIds } })
            .select(
              "name status prizePool entryFee startTime endTime startingCapital",
            )
            .lean()
        : Promise.resolve([]),
      chalIds.length > 0
        ? Challenge.find({ _id: { $in: chalIds } })
            .select(
              "name status prizePool entryFee startTime endTime startingCapital",
            )
            .lean()
        : Promise.resolve([]),
    ]);

    // 4. Build lookup maps (O(1) per join)
    const competitionMap = new Map<string, any>();
    for (const doc of competitionDocs) {
      competitionMap.set((doc as any)._id.toString(), doc);
    }
    const challengeMap = new Map<string, any>();
    for (const doc of challengeDocs) {
      challengeMap.set((doc as any)._id.toString(), doc);
    }

    // 5. Attach the referenced doc to each participation (mirrors .populate())
    // Cast to any — the rest of this handler already treats fields loosely.
    const allCompetitionParticipations: any[] = rawCompParticipations.map(
      (p: any) => ({
        ...p,
        competitionId: competitionMap.get(p.competitionId?.toString()) || null,
      }),
    );
    const allChallengeParticipations: any[] = rawChalParticipations.map(
      (p: any) => ({
        ...p,
        challengeId:
          challengeMap.get(p.challengeId?.toString()) || null,
      }),
    );

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
      totalContests:
        allCompetitionParticipations.length + allChallengeParticipations.length,
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
      rankHistory: [] as {
        date: string;
        rank: number;
        name: string;
        type: string;
      }[],
      pnlHistory: [] as {
        date: string;
        pnl: number;
        name: string;
        type: string;
      }[],
      monthlyPerformance: {} as Record<
        string,
        { pnl: number; contests: number; winRate: number }
      >,
    };

    let rankSum = 0;
    let rankedContests = 0;

    // Process competition participations
    for (const participation of allCompetitionParticipations) {
      const comp = participation.competitionId as any;
      if (!comp) continue;

      // Count by status
      if (comp.status === "active") allTimeStats.activeCompetitions++;
      if (comp.status === "completed") allTimeStats.completedCompetitions++;

      // Accumulate stats
      allTimeStats.totalPnL += participation.pnl || 0;
      allTimeStats.totalTrades += participation.totalTrades || 0;
      allTimeStats.winningTrades += participation.winningTrades || 0;
      allTimeStats.losingTrades += participation.losingTrades || 0;
      allTimeStats.totalEntryFees += comp.entryFee || 0;

      // Track best/biggest stats
      if (participation.pnl > allTimeStats.biggestWin) {
        allTimeStats.biggestWin = participation.pnl;
      }
      if (participation.pnl < allTimeStats.biggestLoss) {
        allTimeStats.biggestLoss = participation.pnl;
      }

      // Track ranks
      if (participation.currentRank) {
        if (
          !allTimeStats.bestRank ||
          participation.currentRank < allTimeStats.bestRank
        ) {
          allTimeStats.bestRank = participation.currentRank;
        }
        rankSum += participation.currentRank;
        rankedContests++;

        allTimeStats.rankHistory.push({
          date: comp.endTime
            ? new Date(comp.endTime).toISOString()
            : new Date().toISOString(),
          rank: participation.currentRank,
          name: comp.name,
          type: "competition",
        });
      }

      // Prize won
      if (participation.prizeWon) {
        allTimeStats.totalPrizesWon += participation.prizeWon;
      }

      // PnL history
      allTimeStats.pnlHistory.push({
        date: comp.endTime
          ? new Date(comp.endTime).toISOString()
          : new Date().toISOString(),
        pnl: participation.pnl || 0,
        name: comp.name,
        type: "competition",
      });

      // Monthly performance
      const monthKey = comp.startTime
        ? new Date(comp.startTime).toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 7);

      if (!allTimeStats.monthlyPerformance[monthKey]) {
        allTimeStats.monthlyPerformance[monthKey] = {
          pnl: 0,
          contests: 0,
          winRate: 0,
        };
      }
      allTimeStats.monthlyPerformance[monthKey].pnl += participation.pnl || 0;
      allTimeStats.monthlyPerformance[monthKey].contests++;
    }

    // Process challenge participations
    for (const participation of allChallengeParticipations) {
      const challenge = participation.challengeId as any;
      if (!challenge) continue;

      // Count by status
      if (challenge.status === "active") allTimeStats.activeChallenges++;
      if (challenge.status === "completed") {
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
      allTimeStats.totalEntryFees += challenge.entryFee || 0;

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
        date: challenge.endTime
          ? new Date(challenge.endTime).toISOString()
          : new Date().toISOString(),
        pnl: participation.pnl || 0,
        name: challenge.name || "1v1 Challenge",
        type: "challenge",
      });

      // Rank history for challenges (1st or 2nd)
      if (challenge.status === "completed") {
        allTimeStats.rankHistory.push({
          date: challenge.endTime
            ? new Date(challenge.endTime).toISOString()
            : new Date().toISOString(),
          rank: participation.isWinner ? 1 : 2,
          name: challenge.name || "1v1 Challenge",
          type: "challenge",
        });
      }

      // Monthly performance
      const monthKey = challenge.startTime
        ? new Date(challenge.startTime).toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 7);

      if (!allTimeStats.monthlyPerformance[monthKey]) {
        allTimeStats.monthlyPerformance[monthKey] = {
          pnl: 0,
          contests: 0,
          winRate: 0,
        };
      }
      allTimeStats.monthlyPerformance[monthKey].pnl += participation.pnl || 0;
      allTimeStats.monthlyPerformance[monthKey].contests++;
    }

    // Calculate derived stats
    allTimeStats.averageRank =
      rankedContests > 0 ? rankSum / rankedContests : 0;
    allTimeStats.netProfit =
      allTimeStats.totalPrizesWon -
      allTimeStats.totalEntryFees +
      allTimeStats.totalPnL;
    allTimeStats.winRate =
      allTimeStats.totalTrades > 0
        ? (allTimeStats.winningTrades / allTimeStats.totalTrades) * 100
        : 0;
    allTimeStats.averagePnLPerContest =
      allTimeStats.totalContests > 0
        ? allTimeStats.totalPnL / allTimeStats.totalContests
        : 0;

    // Sort histories by date
    allTimeStats.rankHistory.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    allTimeStats.pnlHistory.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Calculate monthly win rates
    for (const monthKey of Object.keys(allTimeStats.monthlyPerformance)) {
      const monthCompParticipations = allCompetitionParticipations.filter(
        (p) => {
          const comp = p.competitionId as any;
          return (
            comp?.startTime &&
            new Date(comp.startTime).toISOString().slice(0, 7) === monthKey
          );
        },
      );
      const monthChalParticipations = allChallengeParticipations.filter((p) => {
        const chal = p.challengeId as any;
        return (
          chal?.startTime &&
          new Date(chal.startTime).toISOString().slice(0, 7) === monthKey
        );
      });

      const monthWins =
        monthCompParticipations.reduce(
          (sum, p) => sum + (p.winningTrades || 0),
          0,
        ) +
        monthChalParticipations.reduce(
          (sum, p) => sum + (p.winningTrades || 0),
          0,
        );
      const monthTotal =
        monthCompParticipations.reduce(
          (sum, p) => sum + (p.totalTrades || 0),
          0,
        ) +
        monthChalParticipations.reduce(
          (sum, p) => sum + (p.totalTrades || 0),
          0,
        );
      allTimeStats.monthlyPerformance[monthKey].winRate =
        monthTotal > 0 ? (monthWins / monthTotal) * 100 : 0;
    }

    // Current competition stats (if competitionId provided)
    let currentCompetitionStats = null;
    let livePositions = null;
    let equityCurve: { time: string; equity: number }[] = [];

    if (competitionId) {
      // PERF: .select() to fetch only needed fields
      const participation = (await CompetitionParticipant.findOne({
        competitionId,
        userId,
      }).select("startingCapital currentCapital pnl pnlPercentage totalTrades winningTrades losingTrades winRate realizedPnl role isWinner username currentRank").lean()) as {
        _id: { toString(): string };
        startingCapital?: number;
        currentCapital?: number;
        pnl?: number;
        pnlPercentage?: number;
        totalTrades?: number;
        winningTrades?: number;
        losingTrades?: number;
        winRate?: number;
        realizedPnl?: number;
        role?: string;
        isWinner?: boolean;
        username?: string;
        currentRank?: number;
      } | null;

      if (participation) {
        const competition = (await Competition.findById(
          competitionId,
        ).lean()) as {
          name?: string;
          status?: string;
          startTime?: Date;
          endTime?: Date;
          startingCapital?: number;
          currentParticipants?: number;
        } | null;

        // Get all positions for this competition
        // Note: participantId is stored as string in DB, so convert ObjectId to string
        const participantIdStr = participation._id.toString();

        const positions = await TradingPosition.find({
          competitionId,
          participantId: participantIdStr,
        })
          .sort({ openedAt: 1 })
          .lean();

        // Calculate live stats
        const openPositions = positions.filter((p) => p.status === "open");

        // Get actual P&L from TradeHistory (where realizedPnl is stored for closed trades)
        const tradeHistory = await TradeHistory.find({
          competitionId,
          participantId: participantIdStr,
        })
          .sort({ closedAt: 1 })
          .lean();

        // Unrealized P&L from open positions
        const unrealizedPnL = openPositions.reduce(
          (sum, p) => sum + (p.unrealizedPnl || 0),
          0,
        );
        // Realized P&L from trade history
        const realizedPnL = tradeHistory.reduce(
          (sum, t) => sum + (t.realizedPnl || 0),
          0,
        );

        // Build equity curve from trade history
        let runningEquity = competition?.startingCapital || 10000;
        equityCurve.push({
          time: new Date(competition?.startTime || Date.now()).toISOString(),
          equity: runningEquity,
        });

        for (const trade of tradeHistory) {
          runningEquity += trade.realizedPnl || 0;
          equityCurve.push({
            time: trade.closedAt?.toISOString() || new Date().toISOString(),
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

        const todayTrades = tradeHistory.filter(
          (t) => t.closedAt && new Date(t.closedAt) >= today,
        );
        const todayPnL = todayTrades.reduce(
          (sum, t) => sum + (t.realizedPnl || 0),
          0,
        );
        const todayWins = todayTrades.filter(
          (t) => (t.realizedPnl || 0) > 0,
        ).length;

        // Calculate winning streak from trade history
        let winStreak = 0;
        let loseStreak = 0;
        let currentStreak = 0;
        let isWinStreak = true;

        for (let i = tradeHistory.length - 1; i >= 0; i--) {
          const pnl = tradeHistory[i].realizedPnl || 0;
          if (i === tradeHistory.length - 1) {
            isWinStreak = pnl > 0;
            currentStreak = 1;
          } else {
            if (pnl > 0 === isWinStreak) {
              currentStreak++;
            } else {
              break;
            }
          }
        }

        if (isWinStreak) winStreak = currentStreak;
        else loseStreak = currentStreak;

        // Calculate average trade stats from TradeHistory
        const winningTrades = tradeHistory.filter(
          (t) => (t.realizedPnl || 0) > 0,
        );
        const losingTrades = tradeHistory.filter(
          (t) => (t.realizedPnl || 0) < 0,
        );
        const avgWinAmount =
          winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) /
              winningTrades.length
            : 0;
        const avgLossAmount =
          losingTrades.length > 0
            ? Math.abs(
                losingTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0),
              ) / losingTrades.length
            : 0;
        const profitFactor =
          avgLossAmount > 0
            ? avgWinAmount / avgLossAmount
            : avgWinAmount > 0
              ? Infinity
              : 0;

        currentCompetitionStats = {
          competitionName: competition?.name || "Unknown",
          competitionStatus: competition?.status || "unknown",
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
          winRate:
            (participation.totalTrades || 0) > 0
              ? ((participation.winningTrades || 0) /
                  (participation.totalTrades || 1)) *
                100
              : 0,
          openPositionsCount: openPositions.length,
          unrealizedPnL,
          realizedPnL,
          equity: (participation.currentCapital || 0) + unrealizedPnL,
          marginUsed: openPositions.reduce(
            (sum, p) => sum + (p.marginRequired || 0),
            0,
          ),
          availableMargin:
            (participation.currentCapital || 0) -
            openPositions.reduce((sum, p) => sum + (p.marginRequired || 0), 0),
          // Session stats
          todayPnL,
          todayTrades: todayTrades.length,
          todayWinRate:
            todayTrades.length > 0 ? (todayWins / todayTrades.length) * 100 : 0,
          // Streaks
          winStreak,
          loseStreak,
          currentStreak,
          isOnWinStreak: isWinStreak,
          // Advanced stats from TradeHistory
          avgWin: avgWinAmount,
          avgLoss: avgLossAmount,
          profitFactor: profitFactor === Infinity ? 999 : profitFactor,
          largestWin:
            tradeHistory.length > 0
              ? Math.max(...tradeHistory.map((t) => t.realizedPnl || 0), 0)
              : 0,
          largestLoss:
            tradeHistory.length > 0
              ? Math.min(...tradeHistory.map((t) => t.realizedPnl || 0), 0)
              : 0,
          // Holding times from TradeHistory
          avgHoldingTime:
            tradeHistory.length > 0
              ? tradeHistory.reduce(
                  (sum, t) => sum + (t.holdingTimeSeconds || 0),
                  0,
                ) /
                tradeHistory.length /
                60 // in minutes
              : 0,
        };

        livePositions = openPositions.map((p) => ({
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
      // PERF: .select() to fetch only needed fields
      const participation = (await ChallengeParticipant.findOne({
        challengeId,
        userId,
      }).select("startingCapital currentCapital pnl pnlPercentage totalTrades winningTrades losingTrades winRate realizedPnl").lean()) as {
        _id: { toString(): string };
        startingCapital?: number;
        currentCapital?: number;
        pnl?: number;
        pnlPercentage?: number;
        totalTrades?: number;
        winningTrades?: number;
        losingTrades?: number;
        winRate?: number;
        realizedPnl?: number;
        role?: string;
        isWinner?: boolean;
      } | null;

      if (participation) {
        const challenge = (await Challenge.findById(challengeId).lean()) as {
          name?: string;
          status?: string;
          startTime?: Date;
          endTime?: Date;
        } | null;

        // Get opponent
        const opponent = (await ChallengeParticipant.findOne({
          challengeId,
          userId: { $ne: userId },
        }).lean()) as {
          username?: string;
          currentCapital?: number;
          pnl?: number;
          pnlPercentage?: number;
          totalTrades?: number;
          isWinner?: boolean;
        } | null;

        // Get all positions for this challenge
        // Note: participantId is stored as string in DB, so convert ObjectId to string
        const positions = await TradingPosition.find({
          challengeId,
          participantId: participation._id.toString(),
        })
          .sort({ openedAt: 1 })
          .lean();

        const openPositions = positions.filter((p) => p.status === "open");
        const closedPositions = positions.filter((p) => p.status === "closed");

        const unrealizedPnL = openPositions.reduce(
          (sum, p) => sum + (p.unrealizedPnl || 0),
          0,
        );

        // Build equity curve
        let runningEquity = participation.startingCapital || 10000;
        challengeEquityCurve.push({
          time: new Date(challenge?.startTime || Date.now()).toISOString(),
          equity: runningEquity,
        });

        for (const pos of closedPositions) {
          runningEquity += pos.unrealizedPnl || 0;
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
          challengeName: challenge?.name || "1v1 Challenge",
          challengeStatus: challenge?.status || "unknown",
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
          opponent: opponent
            ? {
                username: opponent.username,
                currentCapital: opponent.currentCapital,
                pnl: opponent.pnl,
                pnlPercentage: opponent.pnlPercentage,
                totalTrades: opponent.totalTrades,
                isWinner: opponent.isWinner,
              }
            : null,
          // Your lead/deficit
          leadAmount: opponent
            ? (participation.pnl || 0) - (opponent.pnl || 0)
            : 0,
          isLeading: opponent
            ? (participation.pnl || 0) > (opponent.pnl || 0)
            : false,
        };

        challengePositions = openPositions.map((p) => ({
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
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
