import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/competitions
 * PUBLIC endpoint for the competition dashboard HTML display.
 * Returns:
 * - All live/upcoming/recently-completed competitions & challenges
 * - Live participant rankings (top 20) per active competition
 * - User profile images
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

    // ── 1. Fetch competitions (non-draft, recent window) ──────────────────
    const competitions = await db
      .collection("competitions")
      .find({
        status: { $in: ["active", "upcoming", "completed", "finalizing", "emergency_ended"] },
        startTime: { $gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // last 48h
      })
      .sort({ startTime: -1 })
      .limit(50)
      .project({
        _id: 1,
        name: 1,
        description: 1,
        status: 1,
        startTime: 1,
        endTime: 1,
        entryFee: 1,
        prizePool: 1,
        platformFeePercentage: 1,
        startingCapital: 1,
        currentParticipants: 1,
        maxParticipants: 1,
        minParticipants: 1,
        rules: 1,
        prizeDistribution: 1,
        assetClasses: 1,
        isPaused: 1,
        competitionType: 1,
        gameMasterUserId: 1,
        // challenges are in a different collection — we pull type from the model
      })
      .toArray();

    // ── 2. Fetch challenges (same time window) ────────────────────────────
    const challenges = await db
      .collection("challenges")
      .find({
        status: { $in: ["active", "upcoming", "completed", "pending"] },
        startTime: { $gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      })
      .sort({ startTime: -1 })
      .limit(30)
      .project({
        _id: 1,
        name: 1,
        description: 1,
        status: 1,
        startTime: 1,
        endTime: 1,
        entryFee: 1,
        prizePool: 1,
        platformFeePercentage: 1,
        startingCapital: 1,
        currentParticipants: 1,
        maxParticipants: 1,
        challengeType: 1,
        winnerId: 1,
        winnerUsername: 1,
      })
      .toArray();

    // ── 3. For each ACTIVE competition, grab top-20 participants ──────────
    const activeCompetitionIds = competitions
      .filter((c) => c.status === "active")
      .map((c) => c._id.toString());

    let participantsByComp: Record<string, unknown[]> = {};
    let userAvatarMap: Record<string, string> = {};

    if (activeCompetitionIds.length > 0) {
      // Get participants for all active competitions in one query
      const allParticipants = await db
        .collection("competitionparticipants")
        .find({ competitionId: { $in: activeCompetitionIds } })
        .project({
          competitionId: 1,
          userId: 1,
          username: 1,
          currentCapital: 1,
          unrealizedPnl: 1,
          pnl: 1,
          pnlPercentage: 1,
          totalTrades: 1,
          winningTrades: 1,
          losingTrades: 1,
          winRate: 1,
          status: 1,
          currentRank: 1,
        })
        .toArray();

      // Group participants by competition
      for (const p of allParticipants) {
        const cid = p.competitionId;
        if (!participantsByComp[cid]) participantsByComp[cid] = [];
        participantsByComp[cid].push(p);
      }

      // Collect unique userIds across all participants to batch-fetch avatars
      const allUserIds = [...new Set(allParticipants.map((p) => p.userId))];

      if (allUserIds.length > 0) {
        const users = await db
          .collection("user")
          .find({ id: { $in: allUserIds } })
          .project({ id: 1, profileImage: 1, image: 1, name: 1 })
          .toArray();

        for (const u of users) {
          const avatar = u.profileImage || u.image || null;
          if (avatar) userAvatarMap[u.id] = avatar;
        }
      }

      // Rank participants per competition
      for (const cid of activeCompetitionIds) {
        const rawParticipants = (participantsByComp[cid] || []) as Array<Record<string, unknown>>;
        const comp = competitions.find((c) => c._id.toString() === cid);
        const startingCapital = (comp?.startingCapital as number) || 10000;
        const rankingMethod = (comp?.rules as Record<string, string>)?.rankingMethod || "pnl";

        // Compute live metrics
        const enriched = rawParticipants.map((p) => {
          const liveEquity = ((p.currentCapital as number) || 0) + ((p.unrealizedPnl as number) || 0);
          const livePnl = liveEquity - startingCapital;
          const liveRoi = (livePnl / startingCapital) * 100;
          const winRate =
            (p.totalTrades as number) > 0
              ? (((p.winningTrades as number) || 0) / (p.totalTrades as number)) * 100
              : 0;
          const isDisqualified = p.status === "liquidated";

          let rankValue = livePnl;
          if (rankingMethod === "roi") rankValue = liveRoi;
          else if (rankingMethod === "total_capital") rankValue = liveEquity;
          else if (rankingMethod === "win_rate") rankValue = winRate;

          return {
            userId: p.userId,
            username: p.username || "Anonymous",
            liveEquity: +liveEquity.toFixed(2),
            livePnl: +livePnl.toFixed(2),
            liveRoi: +liveRoi.toFixed(2),
            winRate: +winRate.toFixed(1),
            totalTrades: (p.totalTrades as number) || 0,
            status: p.status,
            isDisqualified,
            rankValue,
            profileImage: userAvatarMap[p.userId as string] || null,
          };
        });

        // Sort: disqualified last, then by rank value desc
        enriched.sort((a, b) => {
          if (a.isDisqualified && !b.isDisqualified) return 1;
          if (!a.isDisqualified && b.isDisqualified) return -1;
          return b.rankValue - a.rankValue;
        });

        // Assign ranks
        let rank = 1;
        const ranked = enriched.map((p, i) => {
          if (i > 0 && Math.abs(p.rankValue - enriched[i - 1].rankValue) > 0.01) {
            rank = i + 1;
          }
          return { ...p, rank: p.isDisqualified ? enriched.length : rank };
        });

        participantsByComp[cid] = ranked.slice(0, 20); // top 20 only
      }
    }

    // ── 4. Build competition summary objects ──────────────────────────────
    const formattedCompetitions = competitions.map((c) => {
      const cid = c._id.toString();
      const participants = participantsByComp[cid] || null;
      const fee = (c.platformFeePercentage as number) || 0;
      const netPrizePool = Math.floor(((c.prizePool as number) || 0) * (1 - fee / 100));

      return {
        id: cid,
        type: "competition",
        name: c.name,
        description: c.description,
        status: c.status === "finalizing" ? "completed" : (c.status as string),
        startTime: c.startTime,
        endTime: c.endTime,
        entryFee: c.entryFee || 0,
        prizePool: netPrizePool,
        startingCapital: c.startingCapital || 10000,
        currentParticipants: c.currentParticipants || 0,
        maxParticipants: c.maxParticipants || 0,
        rankingMethod: (c.rules as Record<string, string>)?.rankingMethod || "pnl",
        assetClasses: c.assetClasses || [],
        isPaused: c.isPaused || false,
        participants: participants,
      };
    });

    const formattedChallenges = challenges.map((c) => ({
      id: c._id.toString(),
      type: "challenge",
      name: c.name,
      description: c.description,
      status: c.status as string,
      startTime: c.startTime,
      endTime: c.endTime,
      entryFee: c.entryFee || 0,
      prizePool: c.prizePool || 0,
      startingCapital: c.startingCapital || 10000,
      currentParticipants: c.currentParticipants || 2,
      maxParticipants: c.maxParticipants || 2,
      rankingMethod: "pnl",
      participants: null,
    }));

    // ── 5. Aggregate lobby stats ──────────────────────────────────────────
    const allEvents = [...formattedCompetitions, ...formattedChallenges];
    const liveCount = allEvents.filter((e) => e.status === "active").length;
    const upcomingCount = allEvents.filter((e) => e.status === "upcoming").length;
    const totalPrizePool = allEvents.reduce((s, e) => s + (e.prizePool || 0), 0);
    const liveParticipantCount = formattedCompetitions
      .filter((c) => c.status === "active")
      .reduce((s, c) => s + (c.currentParticipants || 0), 0);

    return NextResponse.json(
      {
        competitions: formattedCompetitions,
        challenges: formattedChallenges,
        stats: {
          liveNow: liveCount,
          upcoming: upcomingCount,
          totalPrizePool,
          activePlayers: liveParticipantCount,
          serverTime: now.toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
