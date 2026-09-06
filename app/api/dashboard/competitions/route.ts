import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import PriceSnapshot from "@/database/models/trading/price-snapshot.model";
import mongoose from "mongoose";
import { computeProfitFactor } from "@/lib/services/trading-metrics";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/competitions
 * PUBLIC endpoint for the competition arena display.
 * Returns live competitions, challenges, participants, open positions, and winners.
 * No authentication required — display-only data.
 */
export async function GET() {
  try {
    await connectToDatabase();

    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // ── 1. Fetch competitions ──────────────────────────────────────────────────
    const competitions = await Competition.find({
      $or: [
        { status: { $in: ["active", "upcoming"] } },
        {
          status: { $in: ["completed", "finalizing", "emergency_ended"] },
          startTime: { $gte: windowStart },
        },
      ],
    })
      .sort({ startTime: -1 })
      .limit(50)
      .lean();

    // ── 2. Fetch challenges ────────────────────────────────────────────────────
    const challenges = await Challenge.find({
      $or: [
        { status: { $in: ["active", "pending", "accepted"] } },
        {
          status: { $in: ["completed", "finalizing"] },
          $or: [
            { startTime: { $gte: windowStart } },
            { startTime: { $exists: false } },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // ── 3. IDs for participant/position queries ────────────────────────────────
    const activeCompIds = competitions
      .filter((c: any) => c.status === "active")
      .map((c: any) => c._id.toString());

    const completedCompIds = competitions
      .filter((c: any) =>
        ["completed", "finalizing", "emergency_ended"].includes(c.status as string),
      )
      .map((c: any) => c._id.toString());

    const activeChallengeIds = challenges
      .filter((c: any) => c.status === "active")
      .map((c: any) => c._id.toString());

    // ── 4. Competition participants ────────────────────────────────────────────
    const allParticipants = [...activeCompIds, ...completedCompIds].length
      ? await CompetitionParticipant.find({
          competitionId: {
            $in: [...activeCompIds, ...completedCompIds],
          },
        })
          .select(
            "competitionId userId username currentCapital availableCapital usedMargin unrealizedPnl realizedPnl pnl pnlPercentage totalTrades winningTrades losingTrades winRate averageWin averageLoss largestWin largestLoss currentOpenPositions maxDrawdown maxDrawdownPercentage status currentRank highestRank enteredAt lastTradeAt",
          )
          .lean()
      : [];

    // ── 5. Challenge participants ──────────────────────────────────────────────
    const challengeParticipants = activeChallengeIds.length
      ? await ChallengeParticipant.find({
          challengeId: { $in: activeChallengeIds },
        })
          .select(
            "challengeId userId username role currentCapital availableCapital usedMargin unrealizedPnl realizedPnl pnl pnlPercentage totalTrades winningTrades losingTrades winRate averageWin averageLoss largestWin largestLoss currentOpenPositions maxDrawdown maxDrawdownPercentage status isWinner prizeReceived joinedAt lastTradeAt",
          )
          .lean()
      : [];

    // ── 6. Open positions ──────────────────────────────────────────────────────
    // TradingPosition.competitionId stores the competition OR challenge _id as a string.
    // Query both string IDs AND ObjectId forms to handle any legacy data written as ObjectId.
    const allEventIds = [...activeCompIds, ...activeChallengeIds];
    let openPositions: any[] = [];
    if (allEventIds.length) {
      // Try both string and ObjectId forms to cover legacy writes
      const objectIdForms = allEventIds.flatMap((id) => {
        try { return [new mongoose.Types.ObjectId(id)]; } catch { return []; }
      });
      openPositions = await TradingPosition.find({
        $or: [
          { competitionId: { $in: allEventIds } },
          { competitionId: { $in: objectIdForms } },
        ],
        status: "open",
      })
        .select(
          "competitionId userId symbol side quantity entryPrice currentPrice unrealizedPnl unrealizedPnlPercentage leverage marginUsed stopLoss takeProfit openedAt",
        )
        .sort({ openedAt: -1 })
        .limit(200)
        .lean() as any[];
    }

    // ── 7. Batch-fetch user avatars ────────────────────────────────────────────
    const allUserIds = [
      ...new Set([
        ...(allParticipants as any[]).map((p) => p.userId),
        ...(challengeParticipants as any[]).map((p) => p.userId),
      ]),
    ];

    const userAvatarMap: Record<string, string | null> = {};
    if (allUserIds.length > 0) {
      const db = mongoose.connection.db;
      if (db) {
        const users = await db
          .collection("user")
          .find({ id: { $in: allUserIds } })
          .project({ id: 1, profileImage: 1, image: 1 })
          .toArray();
        for (const u of users) {
          userAvatarMap[u.id] = u.profileImage || u.image || null;
        }
      }
    }

    // ── 8. Latest price snapshot (fetch BEFORE PnL calc) ──────────────────────
    let latestPrices: Record<string, { bid: number; ask: number; mid: number }> = {};
    let _dbgSnapshotAge = -1;
    let _dbgSnapshotRawKeys: string[] = [];
    try {
      const snapshot = await PriceSnapshot.findOne()
        .sort({ timestamp: -1 })
        .lean();
      if (snapshot) {
        const snap = snapshot as any;
        _dbgSnapshotAge = snap.timestamp
          ? Math.round((Date.now() - new Date(snap.timestamp).getTime()) / 1000)
          : -1;
        const priceList: any[] = Array.isArray(snap.prices) ? snap.prices : [];
        _dbgSnapshotRawKeys = priceList.slice(0, 5).map((e: any) => e?.symbol ?? "?");
        for (const entry of priceList) {
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
      // Prices are optional — don't fail the whole request
    }

    // ── 9. Live unrealized PnL — recalculate from live prices ─────────────────
    // Formula (matches trading engine):
    //   Long:  (livePrice - entryPrice) × lots × contractSize (100 000)
    //   Short: (entryPrice - livePrice) × lots × contractSize (100 000)
    const liveUnrealizedByUser: Record<string, number> = {};
    const _dbgPositionDetails: any[] = [];

    for (const pos of openPositions) {
      const uid = pos.userId as string;

      // Symbol format matches snapshot keys exactly: "EUR/USD" (with slash)
      const sym = (pos.symbol as string) || "";
      const priceData = latestPrices[sym];
      let posLivePnl: number;

      if (priceData && (pos.entryPrice as number) && (pos.quantity as number)) {
        const marketPrice =
          pos.side === "long" ? priceData.bid : priceData.ask;
        const priceChange =
          pos.side === "long"
            ? marketPrice - (pos.entryPrice as number)
            : (pos.entryPrice as number) - marketPrice;
        posLivePnl = Number(
          (priceChange * (pos.quantity as number) * 100000).toFixed(2),
        );
      } else {
        posLivePnl = (pos.unrealizedPnl as number) || 0;
      }

      _dbgPositionDetails.push({
        userId: uid,
        symbol: pos.symbol,
        symUsedForLookup: sym,
        side: pos.side,
        qty: pos.quantity,
        entry: pos.entryPrice,
        storedPnl: pos.unrealizedPnl,
        priceDataFound: !!priceData,
        livePriceUsed: priceData
          ? (pos.side === "long" ? priceData.bid : priceData.ask)
          : null,
        recalcPnl: posLivePnl,
        competitionId: pos.competitionId,
      });

      liveUnrealizedByUser[uid] = (liveUnrealizedByUser[uid] || 0) + posLivePnl;
    }

    // ── Helper: enrich participant ─────────────────────────────────────────────
    const _dbgEnrichSamples: any[] = [];
    function enrichParticipant(
      p: Record<string, unknown>,
      startingCapital: number,
      rankingMethod: string,
    ) {
      const liveUnrFromPos = liveUnrealizedByUser[p.userId as string];
      const realUnrealized =
        liveUnrFromPos !== undefined
          ? liveUnrFromPos
          : ((p.unrealizedPnl as number) || 0);
      const liveEquity = ((p.currentCapital as number) || 0) + realUnrealized;
      const livePnl = liveEquity - startingCapital;

      if (_dbgEnrichSamples.length < 5) {
        _dbgEnrichSamples.push({
          userId: p.userId,
          username: p.username,
          currentCapital: p.currentCapital,
          startingCapital,
          storedUnrealizedPnl: p.unrealizedPnl,
          liveUnrFromPos,
          realUnrealized,
          liveEquity,
          livePnl,
        });
      }

      const liveRoi =
        startingCapital > 0 ? (livePnl / startingCapital) * 100 : 0;
      const winRate =
        (p.totalTrades as number) > 0
          ? (((p.winningTrades as number) || 0) / (p.totalTrades as number)) *
            100
          : ((p.winRate as number) || 0);
      const isDisqualified = ["liquidated", "disqualified"].includes(
        p.status as string,
      );

      let rankValue = livePnl;
      if (rankingMethod === "roi") rankValue = liveRoi;
      else if (rankingMethod === "total_capital") rankValue = liveEquity;
      else if (rankingMethod === "win_rate") rankValue = winRate;

      // Reason: shared total-based profit factor + consistent no-loss sentinel
      // (999) across all surfaces. gross = average × count from stored counters.
      const profitFactor = computeProfitFactor(
        ((p.averageWin as number) || 0) * ((p.winningTrades as number) || 0),
        ((p.averageLoss as number) || 0) * ((p.losingTrades as number) || 0),
      );

      return {
        userId: p.userId,
        username: (p.username as string) || "Anonymous",
        profileImage: userAvatarMap[p.userId as string] || null,
        liveEquity: +liveEquity.toFixed(2),
        livePnl: +livePnl.toFixed(2),
        liveRoi: +liveRoi.toFixed(2),
        realizedPnl: +((p.realizedPnl as number) || 0).toFixed(2),
        unrealizedPnl: +((p.unrealizedPnl as number) || 0).toFixed(2),
        currentCapital: +((p.currentCapital as number) || 0).toFixed(2),
        availableCapital: +((p.availableCapital as number) || 0).toFixed(2),
        usedMargin: +((p.usedMargin as number) || 0).toFixed(2),
        totalTrades: (p.totalTrades as number) || 0,
        winningTrades: (p.winningTrades as number) || 0,
        losingTrades: (p.losingTrades as number) || 0,
        winRate: +winRate.toFixed(1),
        averageWin: +((p.averageWin as number) || 0).toFixed(2),
        averageLoss: +((p.averageLoss as number) || 0).toFixed(2),
        largestWin: +((p.largestWin as number) || 0).toFixed(2),
        largestLoss: +((p.largestLoss as number) || 0).toFixed(2),
        maxDrawdownPercentage: +((p.maxDrawdownPercentage as number) || 0).toFixed(2),
        currentOpenPositions: (p.currentOpenPositions as number) || 0,
        highestRank: (p.highestRank as number) || 0,
        status: p.status,
        isDisqualified,
        rankValue,
        profitFactor: +profitFactor.toFixed(2),
        lastTradeAt: p.lastTradeAt || null,
        enteredAt: p.enteredAt || (p as any).joinedAt || null,
      };
    }

    // ── 10. Build position map per competition ─────────────────────────────────
    const positionsByComp: Record<string, unknown[]> = {};
    const usernameMap: Record<string, string> = {};
    for (const p of allParticipants as any[]) {
      usernameMap[p.userId] = p.username;
    }
    for (const pos of openPositions) {
      const cid = pos.competitionId?.toString?.() || pos.competitionId;
      if (!positionsByComp[cid]) positionsByComp[cid] = [];
      (positionsByComp[cid] as unknown[]).push({
        userId: pos.userId,
        username: usernameMap[pos.userId] || "Trader",
        profileImage: userAvatarMap[pos.userId] || null,
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: +((pos.entryPrice as number) || 0).toFixed(5),
        currentPrice: +((pos.currentPrice as number) || 0).toFixed(5),
        unrealizedPnl: +((pos.unrealizedPnl as number) || 0).toFixed(2),
        unrealizedPnlPercentage: +(
          (pos.unrealizedPnlPercentage as number) || 0
        ).toFixed(2),
        leverage: pos.leverage || 1,
        marginUsed: +((pos.marginUsed as number) || 0).toFixed(2),
        stopLoss: pos.stopLoss
          ? +((pos.stopLoss as number) || 0).toFixed(5)
          : null,
        takeProfit: pos.takeProfit
          ? +((pos.takeProfit as number) || 0).toFixed(5)
          : null,
        openedAt: pos.openedAt,
      });
    }

    // ── 11. Format competitions ────────────────────────────────────────────────
    const formattedCompetitions = (competitions as any[]).map((c) => {
      const cid = c._id.toString();
      const isActive = c.status === "active";
      const isCompleted = ["completed", "finalizing", "emergency_ended"].includes(
        c.status as string,
      );
      const fee = (c.platformFeePercentage as number) || 0;
      const netPrizePool = Math.floor(
        ((c.prizePool as number) || 0) * (1 - fee / 100),
      );
      const startingCapital = (c.startingCapital as number) || 10000;
      const rankingMethod = c.rules?.rankingMethod || "pnl";

      let participants: unknown[] = [];
      if (isActive || isCompleted) {
        const raw = (allParticipants as any[]).filter(
          (p) => p.competitionId?.toString?.() === cid || p.competitionId === cid,
        );
        const enriched = raw.map((p) =>
          enrichParticipant(p as Record<string, unknown>, startingCapital, rankingMethod),
        );

        enriched.sort((a, b) => {
          if (a.isDisqualified && !b.isDisqualified) return 1;
          if (!a.isDisqualified && b.isDisqualified) return -1;
          const aHasTrades = a.totalTrades > 0;
          const bHasTrades = b.totalTrades > 0;
          if (aHasTrades && !bHasTrades) return -1;
          if (!aHasTrades && bHasTrades) return 1;
          return b.rankValue - a.rankValue;
        });

        let rank = 1;
        participants = enriched.map((p, i) => {
          if (i > 0) rank = i + 1;
          return { ...p, rank };
        });
      }

      const winners = isCompleted
        ? (participants as Array<Record<string, unknown>>)
            .filter((p) => !p.isDisqualified)
            .slice(0, 3)
        : null;

      const prizeDistribution = c.prizeDistribution || [];

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
        currentParticipants:
          c.currentParticipants || participants.length || 0,
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

    // ── 12. Format challenges ──────────────────────────────────────────────────
    const formattedChallenges = (challenges as any[]).map((c) => {
      const cid = c._id.toString();
      const startingCapital = (c.startingCapital as number) || 10000;
      const isActive = c.status === "active";
      const isCompleted = c.status === "completed";

      let participants: unknown[] = [];
      if (isActive || isCompleted) {
        const raw = (challengeParticipants as any[]).filter(
          (p) => p.challengeId?.toString?.() === cid || p.challengeId === cid,
        );
        participants = raw.map((p) => {
          const enriched = enrichParticipant(
            p as Record<string, unknown>,
            startingCapital,
            "pnl",
          );
          return { ...enriched, role: p.role, isWinner: p.isWinner || false };
        });
        participants.sort((a: unknown, b: unknown) => {
          const ap = a as Record<string, unknown>;
          const bp = b as Record<string, unknown>;
          if (ap.isDisqualified && !bp.isDisqualified) return 1;
          if (!ap.isDisqualified && bp.isDisqualified) return -1;
          const aHasTrades = ((ap.totalTrades as number) || 0) > 0;
          const bHasTrades = ((bp.totalTrades as number) || 0) > 0;
          if (aHasTrades && !bHasTrades) return -1;
          if (!aHasTrades && bHasTrades) return 1;
          return (
            ((bp.rankValue as number) || 0) - ((ap.rankValue as number) || 0)
          );
        });
        participants = participants.map((p, i) => ({
          ...(p as object),
          rank: i + 1,
        }));
      }

      const winners = isCompleted
        ? (participants as Array<Record<string, unknown>>)
            .filter((p) => p.isWinner)
            .slice(0, 1)
        : null;

      const challengeName =
        c.name ||
        [c.challengerName, c.challengedName].filter(Boolean).join(" vs ") ||
        "1v1 Challenge";

      return {
        id: cid,
        type: "challenge",
        name: challengeName,
        description: c.description || `${c.duration || 60}-minute challenge`,
        status: c.status as string,
        startTime: c.startTime || c.createdAt,
        endTime: c.endTime,
        entryFee: c.entryFee || 0,
        prizePool: c.winnerPrize || c.prizePool || 0,
        startingCapital,
        currentParticipants: participants.length || 2,
        maxParticipants: 2,
        rankingMethod: "pnl",
        participants: participants.slice(0, 2),
        openPositions: [],
        winners,
        prizeDistribution: [],
      };
    });

    // ── 13. Aggregate stats ────────────────────────────────────────────────────
    const allEvents = [...formattedCompetitions, ...formattedChallenges];
    const liveCount = allEvents.filter((e) => e.status === "active").length;
    const upcomingCount = allEvents.filter(
      (e) => e.status === "upcoming" || e.status === "pending",
    ).length;
    const totalPrizePool = allEvents.reduce(
      (s, e) => s + ((e.prizePool as number) || 0),
      0,
    );
    const liveParticipantCount = allEvents
      .filter((e) => e.status === "active")
      .reduce((s, e) => s + ((e.currentParticipants as number) || 0), 0);
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
        // ── DEBUG — remove after diagnosis ────────────────────────────────────
        _debug: {
          activeCompIds,
          activeChallengeIds,
          positionsFound: openPositions.length,
          positionDetails: _dbgPositionDetails,
          priceKeySamples: Object.keys(latestPrices).slice(0, 10),
          priceCount: Object.keys(latestPrices).length,
          snapshotAgeSeconds: _dbgSnapshotAge,
          snapshotRawSymbolSamples: _dbgSnapshotRawKeys,
          liveUnrealizedByUser,
          enrichSamples: _dbgEnrichSamples,
        },
      },
      {
        headers: {
          // 4-second CDN cache: concurrent viewers share one DB query per cycle
          "Cache-Control": "public, s-maxage=4, stale-while-revalidate=1",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data", detail: String(error) },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }
}
