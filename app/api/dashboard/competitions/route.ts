import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/competitions
 * PUBLIC endpoint for the competition dashboard HTML display.
 * Returns live competitions, challenges, participants, open positions, and winners.
 * No authentication required — display-only data.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // ── 1. Fetch competitions ──────────────────────────────────────────────
    const competitions = await db
      .collection("competitions")
      .find({
        status: { $in: ["active", "upcoming", "completed", "finalizing", "emergency_ended"] },
        startTime: { $gte: windowStart },
      })
      .sort({ startTime: -1 })
      .limit(50)
      .toArray();

    // ── 2. Fetch challenges ────────────────────────────────────────────────
    const challenges = await db
      .collection("challenges")
      .find({
        status: { $in: ["active", "upcoming", "completed", "pending"] },
        startTime: { $gte: windowStart },
      })
      .sort({ startTime: -1 })
      .limit(30)
      .toArray();

    // ── 3. Collect all competitionIds + challengeIds ───────────────────────
    const activeCompIds = competitions
      .filter((c) => c.status === "active")
      .map((c) => c._id.toString());

    const activeChallengeIds = challenges
      .filter((c) => c.status === "active")
      .map((c) => c._id.toString());

    const completedCompIds = competitions
      .filter((c) => ["completed", "finalizing", "emergency_ended"].includes(c.status as string))
      .map((c) => c._id.toString());

    // ── 4. Fetch competition participants (all statuses) ───────────────────
    const allParticipants = activeCompIds.length
      ? await db
          .collection("competitionparticipants")
          .find({ competitionId: { $in: [...activeCompIds, ...completedCompIds] } })
          .project({
            competitionId: 1, userId: 1, username: 1,
            currentCapital: 1, availableCapital: 1, usedMargin: 1,
            unrealizedPnl: 1, realizedPnl: 1, pnl: 1, pnlPercentage: 1,
            totalTrades: 1, winningTrades: 1, losingTrades: 1, winRate: 1,
            averageWin: 1, averageLoss: 1, largestWin: 1, largestLoss: 1,
            currentOpenPositions: 1, maxDrawdown: 1, maxDrawdownPercentage: 1,
            status: 1, currentRank: 1, highestRank: 1, enteredAt: 1, lastTradeAt: 1,
          })
          .toArray()
      : [];

    // ── 5. Fetch challenge participants ────────────────────────────────────
    const challengeParticipants = activeChallengeIds.length
      ? await db
          .collection("challengeparticipants")
          .find({ challengeId: { $in: activeChallengeIds } })
          .project({
            challengeId: 1, userId: 1, username: 1, role: 1,
            currentCapital: 1, availableCapital: 1, usedMargin: 1,
            unrealizedPnl: 1, realizedPnl: 1, pnl: 1, pnlPercentage: 1,
            totalTrades: 1, winningTrades: 1, losingTrades: 1, winRate: 1,
            averageWin: 1, averageLoss: 1, largestWin: 1, largestLoss: 1,
            currentOpenPositions: 1, maxDrawdown: 1, maxDrawdownPercentage: 1,
            status: 1, isWinner: 1, prizeReceived: 1, joinedAt: 1, lastTradeAt: 1,
          })
          .toArray()
      : [];

    // ── 6. Fetch open positions for live competitions ─────────────────────
    const openPositions =
      activeCompIds.length
        ? await db
            .collection("tradingpositions")
            .find({
              competitionId: { $in: activeCompIds },
              status: "open",
            })
            .project({
              competitionId: 1, userId: 1,
              symbol: 1, side: 1, quantity: 1,
              entryPrice: 1, currentPrice: 1,
              unrealizedPnl: 1, unrealizedPnlPercentage: 1,
              leverage: 1, marginUsed: 1,
              stopLoss: 1, takeProfit: 1,
              openedAt: 1,
            })
            .sort({ openedAt: -1 })
            .limit(200)
            .toArray()
        : [];

    // ── 7. Batch-fetch user avatars ────────────────────────────────────────
    const allUserIds = [
      ...new Set([
        ...allParticipants.map((p) => p.userId),
        ...challengeParticipants.map((p) => p.userId),
      ]),
    ];

    const userAvatarMap: Record<string, string | null> = {};
    if (allUserIds.length > 0) {
      const users = await db
        .collection("user")
        .find({ id: { $in: allUserIds } })
        .project({ id: 1, profileImage: 1, image: 1 })
        .toArray();
      for (const u of users) {
        userAvatarMap[u.id] = u.profileImage || u.image || null;
      }
    }

    // ── 8. Helper: build participant enriched object ───────────────────────
    function enrichParticipant(
      p: Record<string, unknown>,
      startingCapital: number,
      rankingMethod: string,
    ) {
      const liveEquity =
        ((p.currentCapital as number) || 0) + ((p.unrealizedPnl as number) || 0);
      const livePnl = liveEquity - startingCapital;
      const liveRoi = startingCapital > 0 ? (livePnl / startingCapital) * 100 : 0;
      const winRate =
        (p.totalTrades as number) > 0
          ? (((p.winningTrades as number) || 0) / (p.totalTrades as number)) * 100
          : (p.winRate as number) || 0;
      const isDisqualified = ["liquidated", "disqualified"].includes(p.status as string);

      let rankValue = livePnl;
      if (rankingMethod === "roi") rankValue = liveRoi;
      else if (rankingMethod === "total_capital") rankValue = liveEquity;
      else if (rankingMethod === "win_rate") rankValue = winRate;

      const profitFactor =
        (p.averageLoss as number) > 0
          ? (p.averageWin as number) / (p.averageLoss as number)
          : (p.averageWin as number) > 0
            ? 99
            : 0;

      return {
        userId: p.userId,
        username: (p.username as string) || "Anonymous",
        profileImage: userAvatarMap[p.userId as string] || null,
        liveEquity: +liveEquity.toFixed(2),
        livePnl: +livePnl.toFixed(2),
        liveRoi: +liveRoi.toFixed(2),
        realizedPnl: +(p.realizedPnl as number || 0).toFixed(2),
        unrealizedPnl: +(p.unrealizedPnl as number || 0).toFixed(2),
        currentCapital: +(p.currentCapital as number || 0).toFixed(2),
        availableCapital: +(p.availableCapital as number || 0).toFixed(2),
        usedMargin: +(p.usedMargin as number || 0).toFixed(2),
        totalTrades: (p.totalTrades as number) || 0,
        winningTrades: (p.winningTrades as number) || 0,
        losingTrades: (p.losingTrades as number) || 0,
        winRate: +winRate.toFixed(1),
        averageWin: +(p.averageWin as number || 0).toFixed(2),
        averageLoss: +(p.averageLoss as number || 0).toFixed(2),
        largestWin: +(p.largestWin as number || 0).toFixed(2),
        largestLoss: +(p.largestLoss as number || 0).toFixed(2),
        maxDrawdownPercentage: +(p.maxDrawdownPercentage as number || 0).toFixed(2),
        currentOpenPositions: (p.currentOpenPositions as number) || 0,
        highestRank: (p.highestRank as number) || 0,
        status: p.status,
        isDisqualified,
        rankValue,
        profitFactor: +profitFactor.toFixed(2),
        lastTradeAt: p.lastTradeAt || null,
        enteredAt: p.enteredAt || p.joinedAt || null,
      };
    }

    // ── 9. Build position map ──────────────────────────────────────────────
    const positionsByComp: Record<string, unknown[]> = {};
    const usernameMap: Record<string, string> = {};
    for (const p of allParticipants) {
      usernameMap[p.userId] = p.username;
    }
    for (const pos of openPositions) {
      const cid = pos.competitionId;
      if (!positionsByComp[cid]) positionsByComp[cid] = [];
      (positionsByComp[cid] as unknown[]).push({
        userId: pos.userId,
        username: usernameMap[pos.userId] || "Trader",
        profileImage: userAvatarMap[pos.userId] || null,
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: +(pos.entryPrice as number).toFixed(5),
        currentPrice: +(pos.currentPrice as number).toFixed(5),
        unrealizedPnl: +(pos.unrealizedPnl as number || 0).toFixed(2),
        unrealizedPnlPercentage: +(pos.unrealizedPnlPercentage as number || 0).toFixed(2),
        leverage: pos.leverage || 1,
        marginUsed: +(pos.marginUsed as number || 0).toFixed(2),
        stopLoss: pos.stopLoss ? +(pos.stopLoss as number).toFixed(5) : null,
        takeProfit: pos.takeProfit ? +(pos.takeProfit as number).toFixed(5) : null,
        openedAt: pos.openedAt,
      });
    }

    // ── 10. Build formatted competitions ──────────────────────────────────
    const formattedCompetitions = competitions.map((c) => {
      const cid = c._id.toString();
      const isActive = c.status === "active";
      const isCompleted = ["completed", "finalizing", "emergency_ended"].includes(c.status as string);
      const fee = (c.platformFeePercentage as number) || 0;
      const netPrizePool = Math.floor(((c.prizePool as number) || 0) * (1 - fee / 100));
      const startingCapital = (c.startingCapital as number) || 10000;
      const rankingMethod = ((c.rules as Record<string, string>)?.rankingMethod) || "pnl";

      let participants: unknown[] = [];
      if (isActive || isCompleted) {
        const raw = allParticipants
          .filter((p) => p.competitionId === cid) as Array<Record<string, unknown>>;
        const enriched = raw.map((p) => enrichParticipant(p, startingCapital, rankingMethod));

        // Sort: disqualified last → by rankValue desc
        enriched.sort((a, b) => {
          if (a.isDisqualified && !b.isDisqualified) return 1;
          if (!a.isDisqualified && b.isDisqualified) return -1;
          return b.rankValue - a.rankValue;
        });

        // Assign ranks
        let rank = 1;
        participants = enriched.map((p, i) => {
          if (i > 0 && Math.abs(p.rankValue - enriched[i - 1].rankValue) > 0.01) rank = i + 1;
          return { ...p, rank: p.isDisqualified ? enriched.length + 1 : rank };
        });
      }

      // Winners for completed events
      const winners = isCompleted
        ? (participants as Array<Record<string, unknown>>)
            .filter((p) => !p.isDisqualified)
            .slice(0, 3)
        : null;

      const prizeDistribution = (c.prizeDistribution as Array<{ rank: number; percentage: number }>) || [];

      return {
        id: cid,
        type: "competition",
        name: c.name,
        description: c.description,
        status: ["finalizing", "emergency_ended"].includes(c.status as string)
          ? "completed"
          : (c.status as string),
        startTime: c.startTime,
        endTime: c.endTime,
        entryFee: c.entryFee || 0,
        prizePool: netPrizePool,
        startingCapital,
        currentParticipants: c.currentParticipants || participants.length || 0,
        maxParticipants: c.maxParticipants || 0,
        rankingMethod,
        assetClasses: c.assetClasses || [],
        isPaused: c.isPaused || false,
        participants: participants.slice(0, 20),
        openPositions: (positionsByComp[cid] || []).slice(0, 50),
        winners,
        prizeDistribution,
      };
    });

    // ── 11. Build formatted challenges ────────────────────────────────────
    const formattedChallenges = challenges.map((c) => {
      const cid = c._id.toString();
      const startingCapital = (c.startingCapital as number) || 10000;
      const isActive = c.status === "active";
      const isCompleted = c.status === "completed";

      let participants: unknown[] = [];
      if (isActive || isCompleted) {
        const raw = challengeParticipants
          .filter((p) => p.challengeId === cid) as Array<Record<string, unknown>>;
        participants = raw.map((p) => {
          const enriched = enrichParticipant(p, startingCapital, "pnl");
          return { ...enriched, role: p.role, isWinner: p.isWinner || false };
        });
        participants.sort(
          (a: unknown, b: unknown) =>
            (b as Record<string, number>).rankValue - (a as Record<string, number>).rankValue,
        );
        participants = participants.map((p, i) => ({ ...(p as object), rank: i + 1 }));
      }

      const winners = isCompleted
        ? (participants as Array<Record<string, unknown>>).filter((p) => p.isWinner).slice(0, 1)
        : null;

      return {
        id: cid,
        type: "challenge",
        name: c.name,
        description: c.description,
        status: c.status as string,
        startTime: c.startTime,
        endTime: c.endTime,
        entryFee: c.entryFee || 0,
        prizePool: c.prizePool || 0,
        startingCapital,
        currentParticipants: participants.length || (c.currentParticipants as number) || 0,
        maxParticipants: 2,
        rankingMethod: "pnl",
        participants: participants.slice(0, 2),
        openPositions: [],
        winners,
        prizeDistribution: [],
      };
    });

    // ── 12. Latest price snapshot ──────────────────────────────────────────
    let latestPrices: Record<string, { bid: number; ask: number; mid: number }> = {};
    try {
      const snapshot = await db
        .collection("pricesnapshots")
        .findOne({}, { sort: { timestamp: -1 } });
      if (snapshot && Array.isArray(snapshot.prices)) {
        for (const entry of snapshot.prices as Array<{
          symbol: string;
          bid: number;
          ask: number;
          mid: number;
          isValid: boolean;
        }>) {
          if (entry.isValid && entry.symbol) {
            latestPrices[entry.symbol] = {
              bid: entry.bid,
              ask: entry.ask,
              mid: entry.mid,
            };
          }
        }
      }
    } catch {
      // prices are optional — don't fail the whole request
    }

    // ── 13. Aggregate stats ────────────────────────────────────────────────
    const allEvents = [...formattedCompetitions, ...formattedChallenges];
    const liveCount = allEvents.filter((e) => e.status === "active").length;
    const upcomingCount = allEvents.filter((e) => e.status === "upcoming").length;
    const totalPrizePool = allEvents.reduce((s, e) => s + (e.prizePool || 0), 0);
    const liveParticipantCount = allEvents
      .filter((e) => e.status === "active")
      .reduce((s, e) => s + (e.currentParticipants || 0), 0);
    const totalOpenPositions = openPositions.length;

    return NextResponse.json(
      {
        competitions: formattedCompetitions,
        challenges: formattedChallenges,
        prices: latestPrices,
        stats: {
          liveNow: liveCount,
          upcoming: upcomingCount,
          totalPrizePool,
          activePlayers: liveParticipantCount,
          openPositions: totalOpenPositions,
          serverTime: now.toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
