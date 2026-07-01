import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET /api/simulator/verify-win-loss
 *
 * Read-only consistency check: do the "participate / win / lose" numbers shown
 * across the user dashboard, profile, leaderboard and admin surfaces agree with
 * the raw source collections?
 *
 * For every user it recomputes each surface's exact definition from the source
 * data and flags any divergence, plus raw-data anomalies (e.g. rank-1 in a
 * completed competition whose participant row isn't "completed").
 *
 * Mirrors verify-win-loss.mjs, but reuses the pooled Mongoose connection, is
 * admin-authenticated, and returns structured JSON instead of console output.
 */

const num = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

// Caps to keep the response payload sane on large datasets.
const MAX_ACTIVE = 200;
const MAX_ANOMALY = 50;

interface UserAcc {
  userId: string;
  username: string;
  email: string;
  compEntered: number;
  compWon_compStatus: number;
  compWon_partStatus: number;
  podium_compStatus: number;
  podium_partStatus: number;
  challEntered: number;
  challWon_isWinner: number;
  challWon_completedIsWinner: number;
  challWon_winnerId: number;
  partPnlSum: number;
  partTradesSum: number;
}

export async function GET() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not connected" },
        { status: 500 },
      );
    }

    const cols = (await db.listCollections().toArray()).map((c) => c.name);
    const pick = (...cands: string[]) => cands.find((c) => cols.includes(c));

    const compPartCol = pick("competitionparticipants");
    const challPartCol = pick("challengeparticipants");
    const compCol = pick("competitions");
    const challCol = pick("challenges");
    const tradeCol = pick("tradehistories", "trade_histories");

    if (!compPartCol || !challPartCol || !compCol || !challCol || !tradeCol) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more required collections were not found",
          resolved: { compPartCol, challPartCol, compCol, challCol, tradeCol },
        },
        { status: 404 },
      );
    }

     
    const [compParts, challParts, comps, challs, tradeAgg] = (await Promise.all([
      db.collection(compPartCol).find({}).toArray(),
      db.collection(challPartCol).find({}).toArray(),
      db.collection(compCol).find({}, { projection: { status: 1 } }).toArray(),
      db
        .collection(challCol)
        .find(
          {},
          { projection: { status: 1, winnerId: 1, isTie: 1, noWinner: 1 } },
        )
        .toArray(),
      db
        .collection(tradeCol)
        .aggregate([
          {
            $group: {
              _id: "$userId",
              totalTrades: { $sum: 1 },
              totalPnL: { $sum: "$realizedPnl" },
            },
          },
        ])
        .toArray(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
    ])) as any[];

    const compStatus = new Map<string, string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      comps.map((c: any) => [String(c._id), c.status]),
    );
    const challMap = new Map<
      string,
      { status?: string; winnerId?: unknown; isTie?: boolean; noWinner?: boolean }
    >(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      challs.map((c: any) => [
        String(c._id),
        {
          status: c.status,
          winnerId: c.winnerId,
          isTie: c.isTie,
          noWinner: c.noWinner,
        },
      ]),
    );
    const tradeMap = new Map<string, { totalTrades: number; totalPnL: number }>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      tradeAgg.map((t: any) => [
        String(t._id),
        { totalTrades: num(t.totalTrades), totalPnL: num(t.totalPnL) },
      ]),
    );

    const users = new Map<string, UserAcc>();
    const u = (userId: string, username?: string, email?: string): UserAcc => {
      if (!users.has(userId)) {
        users.set(userId, {
          userId,
          username: username || "",
          email: email || "",
          compEntered: 0,
          compWon_compStatus: 0,
          compWon_partStatus: 0,
          podium_compStatus: 0,
          podium_partStatus: 0,
          challEntered: 0,
          challWon_isWinner: 0,
          challWon_completedIsWinner: 0,
          challWon_winnerId: 0,
          partPnlSum: 0,
          partTradesSum: 0,
        });
      }
      return users.get(userId)!;
    };

    const anomalies = {
      rank1_partNotCompleted: [] as Array<Record<string, unknown>>,
      isWinner_challNotCompleted: [] as Array<Record<string, unknown>>,
      winnerId_vs_isWinner_mismatch: [] as Array<Record<string, unknown>>,
      compCompleted_multipleRank1: [] as Array<{ competitionId: string; rank1Count: number }>,
    };

    const rank1ByComp = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
    for (const p of compParts as any[]) {
      const acc = u(String(p.userId), p.username, p.email);
      acc.compEntered += 1;
      acc.partPnlSum += num(p.pnl);
      acc.partTradesSum += num(p.totalTrades);

      const compCompleted =
        compStatus.get(String(p.competitionId)) === "completed";
      const partCompleted = p.status === "completed";
      const rank = num(p.currentRank);

      if (compCompleted && rank === 1) acc.compWon_compStatus += 1;
      if (compCompleted && rank >= 1 && rank <= 3) acc.podium_compStatus += 1;
      if (partCompleted && rank === 1) acc.compWon_partStatus += 1;
      if (partCompleted && rank >= 1 && rank <= 3) acc.podium_partStatus += 1;

      if (compCompleted && rank === 1 && !partCompleted) {
        anomalies.rank1_partNotCompleted.push({
          username: p.username,
          competitionId: String(p.competitionId),
          partStatus: p.status,
        });
      }
      if (compCompleted && rank === 1) {
        rank1ByComp.set(
          String(p.competitionId),
          (rank1ByComp.get(String(p.competitionId)) || 0) + 1,
        );
      }
    }
    for (const [compId, count] of rank1ByComp.entries()) {
      if (count > 1)
        anomalies.compCompleted_multipleRank1.push({
          competitionId: compId,
          rank1Count: count,
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
    for (const p of challParts as any[]) {
      const acc = u(String(p.userId), p.username, p.email);
      acc.challEntered += 1;
      acc.partPnlSum += num(p.pnl);
      acc.partTradesSum += num(p.totalTrades);

      const ch = challMap.get(String(p.challengeId)) || {};
      const challCompleted = ch.status === "completed";
      const isWinner = !!p.isWinner;
      const winnerIdMatch =
        ch.winnerId && String(ch.winnerId) === String(p.userId);

      if (isWinner) acc.challWon_isWinner += 1;
      if (challCompleted && isWinner) acc.challWon_completedIsWinner += 1;
      if (winnerIdMatch) acc.challWon_winnerId += 1;

      if (isWinner && !challCompleted) {
        anomalies.isWinner_challNotCompleted.push({
          username: p.username,
          challengeId: String(p.challengeId),
          challStatus: ch.status,
        });
      }
      if (
        challCompleted &&
        Boolean(winnerIdMatch) !== isWinner &&
        !ch.noWinner &&
        !ch.isTie
      ) {
        anomalies.winnerId_vs_isWinner_mismatch.push({
          username: p.username,
          challengeId: String(p.challengeId),
          isWinner,
          winnerIdMatch: Boolean(winnerIdMatch),
        });
      }
    }

    const divergent: Array<Record<string, unknown>> = [];
    for (const acc of users.values()) {
      const th = tradeMap.get(acc.userId) || { totalTrades: 0, totalPnL: 0 };
      const compWinDiff = acc.compWon_compStatus !== acc.compWon_partStatus;
      const podiumDiff = acc.podium_compStatus !== acc.podium_partStatus;
      const challWinDiff =
        acc.challWon_isWinner !== acc.challWon_completedIsWinner ||
        acc.challWon_isWinner !== acc.challWon_winnerId;
      const pnlDiff = Math.abs(acc.partPnlSum - num(th.totalPnL)) > 0.01;
      const tradesDiff = acc.partTradesSum !== num(th.totalTrades);
      if (compWinDiff || podiumDiff || challWinDiff || pnlDiff || tradesDiff) {
        divergent.push({
          userId: acc.userId,
          username: acc.username,
          email: acc.email,
          compWon_compStatus: acc.compWon_compStatus,
          compWon_partStatus: acc.compWon_partStatus,
          podium_compStatus: acc.podium_compStatus,
          podium_partStatus: acc.podium_partStatus,
          challWon_isWinner: acc.challWon_isWinner,
          challWon_completedIsWinner: acc.challWon_completedIsWinner,
          challWon_winnerId: acc.challWon_winnerId,
          partPnlSum: Math.round(acc.partPnlSum * 100) / 100,
          thPnL: Math.round(num(th.totalPnL) * 100) / 100,
          partTradesSum: acc.partTradesSum,
          thTrades: num(th.totalTrades),
          flags: {
            compWinDiff,
            podiumDiff,
            challWinDiff,
            pnlDiff,
            tradesDiff,
          },
        });
      }
    }

    const active = [...users.values()]
      .filter((a) => a.compEntered > 0 || a.challEntered > 0)
      .sort(
        (a, b) =>
          b.compEntered + b.challEntered - (a.compEntered + a.challEntered),
      );

    return NextResponse.json({
      success: true,
      clean: divergent.length === 0,
      collections: { compPartCol, challPartCol, compCol, challCol, tradeCol },
      totals: {
        users: users.size,
        active: active.length,
        competitions: comps.length,
        challenges: challs.length,
        divergences: divergent.length,
      },
      activeUsers: active.slice(0, MAX_ACTIVE),
      activeTruncated: active.length > MAX_ACTIVE,
      divergences: divergent.slice(0, MAX_ANOMALY),
      divergencesTruncated: divergent.length > MAX_ANOMALY,
      anomalies: {
        rank1_partNotCompleted: {
          count: anomalies.rank1_partNotCompleted.length,
          sample: anomalies.rank1_partNotCompleted.slice(0, MAX_ANOMALY),
        },
        isWinner_challNotCompleted: {
          count: anomalies.isWinner_challNotCompleted.length,
          sample: anomalies.isWinner_challNotCompleted.slice(0, MAX_ANOMALY),
        },
        winnerId_vs_isWinner_mismatch: {
          count: anomalies.winnerId_vs_isWinner_mismatch.length,
          sample: anomalies.winnerId_vs_isWinner_mismatch.slice(0, MAX_ANOMALY),
        },
        compCompleted_multipleRank1: {
          count: anomalies.compCompleted_multipleRank1.length,
          sample: anomalies.compCompleted_multipleRank1.slice(0, MAX_ANOMALY),
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ verify-win-loss error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify win/loss consistency" },
      { status: 500 },
    );
  }
}
