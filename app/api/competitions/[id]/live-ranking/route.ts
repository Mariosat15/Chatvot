import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import mongoose from "mongoose";

/**
 * GET /api/competitions/[id]/live-ranking
 * Returns live participant rankings with prize info for the trading interface
 * Optimized for frequent polling (every 5-10 seconds)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: competitionId } = await params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Get competition with prize info
    const competition = await db.collection("competitions").findOne(
      { _id: new mongoose.Types.ObjectId(competitionId) },
      {
        projection: {
          prizePool: 1,
          prizeDistribution: 1,
          platformFeePercentage: 1,
          rules: 1,
          status: 1,
          startingCapital: 1,
        },
      },
    );

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Only return data for active competitions
    if (competition.status !== "active") {
      return NextResponse.json(
        {
          error: "Competition not active",
          status: competition.status,
        },
        { status: 400 },
      );
    }

    // Get all participants with essential data only
    const participants = await db
      .collection("competitionparticipants")
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
        winningTrades: 1,
        losingTrades: 1,
      })
      .toArray();

    if (participants.length === 0) {
      return NextResponse.json({
        rankings: [],
        userRank: null,
        prizePool: competition.prizePool || 0,
      });
    }

    const disqualifyOnLiquidation =
      competition.rules?.disqualifyOnLiquidation !== false;
    const startingCapital = competition.startingCapital || 10000;
    const rankingMethod = competition.rules?.rankingMethod || "pnl";

    // Calculate all metrics for each participant
    const rankedParticipants = participants.map((p) => {
      const liveEquity = (p.currentCapital || 0) + (p.unrealizedPnl || 0);
      const livePnl = liveEquity - startingCapital; // Live P&L = current equity - starting
      const liveRoi = (livePnl / startingCapital) * 100;
      const winRate =
        p.totalTrades > 0 ? ((p.winningTrades || 0) / p.totalTrades) * 100 : 0;
      const isDisqualified =
        disqualifyOnLiquidation && p.status === "liquidated";

      return {
        userId: p.userId,
        username: p.username || "Anonymous",
        liveEquity,
        livePnl,
        liveRoi,
        winRate,
        totalTrades: p.totalTrades || 0,
        winningTrades: p.winningTrades || 0,
        losingTrades: p.losingTrades || 0,
        status: p.status,
        isDisqualified,
      };
    });

    // Get ranking value based on competition's ranking method
    const getRankingValue = (p: (typeof rankedParticipants)[0]) => {
      switch (rankingMethod) {
        case "pnl":
          return p.livePnl;
        case "roi":
          return p.liveRoi;
        case "total_capital":
          return p.liveEquity;
        case "win_rate":
          return p.winRate;
        case "total_wins":
          return p.winningTrades;
        case "profit_factor":
          if (p.losingTrades === 0) return p.winningTrades > 0 ? 9999 : 0;
          return p.winningTrades / p.losingTrades;
        default:
          return p.livePnl;
      }
    };

    // Sort by the correct ranking method
    rankedParticipants.sort((a, b) => {
      // Disqualified go to bottom
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      // Sort by ranking value (descending - higher is better)
      return getRankingValue(b) - getRankingValue(a);
    });

    // Assign ranks (handle ties)
    let currentRank = 1;
    const rankings = rankedParticipants.map((p, index) => {
      if (index > 0) {
        const prev = rankedParticipants[index - 1];
        // Same ranking value = same rank
        if (Math.abs(getRankingValue(p) - getRankingValue(prev)) < 0.01) {
          // Keep same rank
        } else {
          currentRank = index + 1;
        }
      }
      return {
        ...p,
        rank: p.isDisqualified ? rankedParticipants.length : currentRank,
      };
    });

    // Get first place value for "distance to 1st" calculation
    const firstPlace = rankings.find((r) => !r.isDisqualified);
    const firstPlaceValue = firstPlace ? getRankingValue(firstPlace) : 0;

    // Calculate prize for each rank position
    const prizePool = competition.prizePool || 0;
    const platformFee = (competition.platformFeePercentage || 0) / 100;
    const netPool = prizePool * (1 - platformFee);
    const prizeDistribution = competition.prizeDistribution || [];

    // Add prize and distance info
    const rankingsWithPrizes = rankings.map((r) => {
      const prizeInfo = prizeDistribution.find(
        (p: { rank: number; percentage: number }) => p.rank === r.rank,
      );
      const prizePercent = prizeInfo?.percentage || 0;
      const potentialReward = r.isDisqualified
        ? 0
        : Math.floor(((netPool * prizePercent) / 100) * 100) / 100;

      // Distance to first based on ranking method
      const myValue = getRankingValue(r);
      const distanceToFirst = r.rank === 1 ? 0 : firstPlaceValue - myValue;

      // Display value based on ranking method (what user sees as "profit")
      const displayValue =
        rankingMethod === "roi" || rankingMethod === "win_rate"
          ? r.liveRoi
          : r.livePnl;

      return {
        rank: r.rank,
        userId: r.userId,
        username: r.username,
        profitPercent: Number(r.liveRoi.toFixed(2)),
        displayValue: Number(displayValue.toFixed(2)),
        liveEquity: Number(r.liveEquity.toFixed(2)),
        potentialReward,
        distanceToFirst: Number(distanceToFirst.toFixed(2)),
        isDisqualified: r.isDisqualified,
        status: r.status,
        rankingMethod, // Include so frontend knows how to display
      };
    });

    // Find current user's rank
    const userRanking = rankingsWithPrizes.find(
      (r) => r.userId === session.user.id,
    );

    // Return top 10 + user's position if not in top 10
    let displayRankings = rankingsWithPrizes.slice(0, 10);

    if (userRanking && userRanking.rank > 10) {
      // Add separator and user's position
      displayRankings = [
        ...displayRankings,
        { ...userRanking, isSeparator: true } as typeof userRanking & {
          isSeparator: boolean;
        },
      ];
    }

    return NextResponse.json({
      rankings: displayRankings,
      userRank: userRanking?.rank || null,
      userEquity: userRanking?.liveEquity || null,
      totalParticipants: rankings.length,
      prizePool: netPool,
      firstPlaceValue,
      rankingMethod,
    });
  } catch (error) {
    console.error("Error fetching live ranking:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch ranking",
      },
      { status: 500 },
    );
  }
}
