import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import { fetchRealForexPrices } from "@/lib/services/real-forex-prices.service";
import {
  ForexSymbol,
  calculateUnrealizedPnL,
} from "@/lib/services/pnl-calculator.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/challenges/dashboard-live
 * Returns live PnL data for all active challenges the user is involved in.
 * Lightweight endpoint designed for 10-second polling from the dashboard sidebar.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    await connectToDatabase();

    // Reason: Only fetch active challenges the user is part of — keep it lightweight
    // Include "rules" to access rules.rankingMethod for correct metric display
    const activeChallenges = await Challenge.find({
      status: "active",
      $or: [{ challengerId: userId }, { challengedId: userId }],
    })
      .select(
        "_id challengerId challengedId challengerName challengedName entryFee startingCapital startTime endTime status rules",
      )
      .lean();

    if (activeChallenges.length === 0) {
      return NextResponse.json({ challenges: [] });
    }

    const challengeIds = activeChallenges.map((c: any) => c._id.toString());

    // Fetch ALL participants for these challenges (both user and opponents)
    // Reason: Include winRate, winningTrades, losingTrades for non-PnL ranking methods
    const allParticipants = await ChallengeParticipant.find({
      challengeId: { $in: challengeIds },
    })
      .select(
        "challengeId userId username pnl pnlPercentage realizedPnl unrealizedPnl currentCapital startingCapital totalTrades winRate winningTrades losingTrades status",
      )
      .lean();

    // Fetch open positions for live unrealized PnL calculation
    const openPositions = await TradingPosition.find({
      competitionId: { $in: challengeIds },
      status: "open",
    })
      .select("competitionId userId symbol side entryPrice quantity")
      .lean();

    // Fetch live prices for all open position symbols
    const uniqueSymbols = [
      ...new Set(
        (openPositions as any[]).map((p: any) => p.symbol).filter(Boolean),
      ),
    ] as ForexSymbol[];

    const pricesMap =
      uniqueSymbols.length > 0
        ? await fetchRealForexPrices(uniqueSymbols)
        : new Map<ForexSymbol, { bid: number; ask: number }>();

    // Calculate live unrealized PnL per user per challenge
    // Reason: ChallengeParticipant.unrealizedPnl can be stale (updated by margin-check job).
    // Recalculating from open positions + live prices gives real-time accuracy.
    const liveUnrealizedByUserChallenge = new Map<string, number>();
    for (const pos of openPositions as any[]) {
      const key = `${pos.competitionId}:${pos.userId}`;
      const price = pricesMap.get(pos.symbol as ForexSymbol);
      let unrealized = 0;
      if (price) {
        const currentPrice = pos.side === "long" ? price.bid : price.ask;
        unrealized = calculateUnrealizedPnL(
          pos.side,
          pos.entryPrice,
          currentPrice,
          pos.quantity,
          pos.symbol,
        );
      }
      liveUnrealizedByUserChallenge.set(
        key,
        (liveUnrealizedByUserChallenge.get(key) || 0) + unrealized,
      );
    }

    // Build response per challenge
    const challenges = activeChallenges.map((challenge: any) => {
      const cid = challenge._id.toString();
      const isChallenger = challenge.challengerId === userId;
      const opponentName = isChallenger
        ? challenge.challengedName
        : challenge.challengerName;

      const participants = (allParticipants as any[]).filter(
        (p: any) => p.challengeId?.toString() === cid,
      );

      const userPart = participants.find((p: any) => p.userId === userId);
      const opponentPart = participants.find((p: any) => p.userId !== userId);

      // Reason: Use live unrealized PnL from open positions for real-time accuracy
      const userLiveUnrealized =
        liveUnrealizedByUserChallenge.get(`${cid}:${userId}`) ?? (userPart?.unrealizedPnl || 0);
      const userRealizedPnl = userPart?.realizedPnl || 0;
      const userLivePnl = userRealizedPnl + userLiveUnrealized;
      const userStartingCapital =
        userPart?.startingCapital || challenge.startingCapital || 10000;
      const userLivePnlPct =
        userStartingCapital > 0
          ? (userLivePnl / userStartingCapital) * 100
          : 0;

      let opponentLivePnl = 0;
      let opponentLivePnlPct = 0;
      if (opponentPart) {
        const oppId = opponentPart.userId;
        const oppLiveUnrealized =
          liveUnrealizedByUserChallenge.get(`${cid}:${oppId}`) ??
          (opponentPart.unrealizedPnl || 0);
        const oppRealizedPnl = opponentPart.realizedPnl || 0;
        opponentLivePnl = oppRealizedPnl + oppLiveUnrealized;
        const oppStartingCapital =
          opponentPart.startingCapital || challenge.startingCapital || 10000;
        opponentLivePnlPct =
          oppStartingCapital > 0
            ? (opponentLivePnl / oppStartingCapital) * 100
            : 0;
      }

      // Reason: Use the challenge's ranking method to determine isLeading correctly
      const rankingMethod = challenge.rules?.rankingMethod || "pnl";

      // Reason: For PnL/ROI methods, use live-calculated values.
      // For stats-based methods (win_rate, total_wins, profit_factor), use DB values
      // since they only change on trade close, not tick-by-tick.
      const getUserMetric = (): number => {
        switch (rankingMethod) {
          case "pnl": return userLivePnl;
          case "roi": return userLivePnlPct;
          case "total_capital": return (userPart?.currentCapital || 0) + userLiveUnrealized;
          case "win_rate": return userPart?.winRate || 0;
          case "total_wins": return userPart?.winningTrades || 0;
          case "profit_factor": {
            const w = userPart?.winningTrades || 0;
            const l = userPart?.losingTrades || 0;
            return l === 0 ? (w > 0 ? 9999 : 0) : w / l;
          }
          default: return userLivePnl;
        }
      };
      const getOpponentMetric = (): number => {
        if (!opponentPart) return -Infinity;
        switch (rankingMethod) {
          case "pnl": return opponentLivePnl;
          case "roi": return opponentLivePnlPct;
          case "total_capital": {
            const oppId = opponentPart.userId;
            const oppUnrealized = liveUnrealizedByUserChallenge.get(`${cid}:${oppId}`) ?? (opponentPart.unrealizedPnl || 0);
            return (opponentPart.currentCapital || 0) + oppUnrealized;
          }
          case "win_rate": return opponentPart.winRate || 0;
          case "total_wins": return opponentPart.winningTrades || 0;
          case "profit_factor": {
            const w = opponentPart.winningTrades || 0;
            const l = opponentPart.losingTrades || 0;
            return l === 0 ? (w > 0 ? 9999 : 0) : w / l;
          }
          default: return opponentLivePnl;
        }
      };

      return {
        id: cid,
        name: `Challenge vs ${opponentName || "Unknown"}`,
        status: challenge.status,
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        stakeAmount: challenge.entryFee || 0,
        rankingMethod,
        userPnL: +userLivePnl.toFixed(2),
        userPnLPercentage: +userLivePnlPct.toFixed(4),
        userCurrentCapital: userPart?.currentCapital || 0,
        userWinRate: userPart?.winRate || 0,
        userWinningTrades: userPart?.winningTrades || 0,
        userLosingTrades: userPart?.losingTrades || 0,
        userTotalTrades: userPart?.totalTrades || 0,
        userStartingCapital: userStartingCapital,
        opponent: opponentPart
          ? {
              name: opponentPart.username || opponentName || "Unknown",
              pnl: +opponentLivePnl.toFixed(2),
              pnlPercentage: +opponentLivePnlPct.toFixed(4),
              currentCapital: opponentPart.currentCapital || 0,
              winRate: opponentPart.winRate || 0,
              winningTrades: opponentPart.winningTrades || 0,
              losingTrades: opponentPart.losingTrades || 0,
              totalTrades: opponentPart.totalTrades || 0,
            }
          : null,
        // Reason: Compare by the challenge's actual ranking method, not hardcoded PnL
        isLeading: getUserMetric() >= getOpponentMetric(),
      };
    });

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error("❌ [Dashboard Live Challenges] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live challenge data" },
      { status: 500 },
    );
  }
}
