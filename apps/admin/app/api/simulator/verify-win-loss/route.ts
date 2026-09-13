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
 * LIKE-FOR-LIKE comparison (only flags GENUINE problems):
 *   - PnL is compared realized-to-realized: participant.realizedPnl (accumulated
 *     on close) vs Σ TradeHistory.realizedPnl (one row per closed trade).
 *   - Trade counts are compared closed-to-closed: participant.winningTrades /
 *     losingTrades (incremented on close) vs TradeHistory rows split by P&L sign.
 *   - MATCHED-PARTICIPANT only: TradeHistory is compared per surviving participant
 *     row. History whose participantId was reset / re-created / deleted is treated
 *     as "orphan residue", reported separately, and NEVER flagged as a divergence.
 *   - Competition wins/podiums exclude liquidated / disqualified / refunded
 *     participants (finalization leaves those terminal by design; the app does not
 *     count them). An "active" participant in a completed competition is still
 *     flagged (a genuine "not finalized" bug).
 *   Reason: participant.totalTrades counts positions OPENED and participant.pnl
 *   includes UNREALIZED P&L, so comparing those to closed-trade history produces
 *   expected differences (open positions, costs) that are not real bugs. Open
 *   positions are still reported as context.
 *
 * Mirrors verify-win-loss.mjs, but reuses the pooled Mongoose connection, is
 * admin-authenticated, and returns structured JSON instead of console output.
 */

const num = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;
const round2 = (v: number): number => Math.round(v * 100) / 100;

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
  // Like-for-like (realized/closed) accumulators from participant rows.
  partRealizedPnl: number;
  partWinning: number;
  partLosing: number;
  // Context only (not used for flagging).
  partOpens: number;
  partOpenPositions: number;
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
    const posCol = pick("tradingpositions", "trading_positions");

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

     
    const [compParts, challParts, comps, challs, tradeAgg, openPosAgg] =
      (await Promise.all([
        db.collection(compPartCol).find({}).toArray(),
        db.collection(challPartCol).find({}).toArray(),
        db
          .collection(compCol)
          .find({}, { projection: { status: 1 } })
          .toArray(),
        db
          .collection(challCol)
          .find(
            {},
            { projection: { status: 1, winnerId: 1, isTie: 1, noWinner: 1 } },
          )
          .toArray(),
        // Split closed trades by realized P&L sign, grouped by (user, participant)
        // so the comparison is LIKE-FOR-LIKE: only TradeHistory whose participantId
        // still maps to a surviving participant row is compared to the counters.
        // Orphan history (participant reset / re-created / deleted) is reported
        // separately and never counted as a divergence. Breakeven excluded.
        db
          .collection(tradeCol)
          .aggregate([
            {
              $group: {
                _id: { userId: "$userId", participantId: "$participantId" },
                totalPnL: { $sum: "$realizedPnl" },
                winners: {
                  $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] },
                },
                losers: {
                  $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] },
                },
                closedTrades: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        // Open positions per user (source of truth = live positions, not a
        // possibly-drifted counter). Empty result if the collection is absent.
        posCol
          ? db
              .collection(posCol)
              .aggregate([
                { $match: { status: "open" } },
                { $group: { _id: "$userId", openPositions: { $sum: 1 } } },
              ])
              .toArray()
          : Promise.resolve([]),
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
    // Surviving participant _ids — TradeHistory rows pointing at anything else
    // are "orphan" residue (the participant was reset / re-created / deleted while
    // its history remained). Those must NOT count against the live counters.
    const validPartIds = new Set<string>([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      ...compParts.map((p: any) => String(p._id)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      ...challParts.map((p: any) => String(p._id)),
    ]);

    type ThAgg = {
      totalPnL: number;
      winners: number;
      losers: number;
      closedTrades: number;
    };
    const emptyAgg = (): ThAgg => ({
      totalPnL: 0,
      winners: 0,
      losers: 0,
      closedTrades: 0,
    });
    const tradeMatched = new Map<string, ThAgg>();
    const tradeOrphan = new Map<string, ThAgg>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
    for (const g of tradeAgg as any[]) {
      const userId = String(g._id?.userId ?? "");
      const participantId = String(g._id?.participantId ?? "");
      if (!userId) continue;
      const target = validPartIds.has(participantId)
        ? tradeMatched
        : tradeOrphan;
      const cur = target.get(userId) || emptyAgg();
      cur.totalPnL += num(g.totalPnL);
      cur.winners += num(g.winners);
      cur.losers += num(g.losers);
      cur.closedTrades += num(g.closedTrades);
      target.set(userId, cur);
    }
    const openPosMap = new Map<string, number>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      openPosAgg.map((p: any) => [String(p._id), num(p.openPositions)]),
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
          partRealizedPnl: 0,
          partWinning: 0,
          partLosing: 0,
          partOpens: 0,
          partOpenPositions: 0,
        });
      }
      return users.get(userId)!;
    };

    const anomalies = {
      rank1_partNotCompleted: [] as Array<Record<string, unknown>>,
      isWinner_challNotCompleted: [] as Array<Record<string, unknown>>,
      winnerId_vs_isWinner_mismatch: [] as Array<Record<string, unknown>>,
      compCompleted_multipleRank1: [] as Array<{
        competitionId: string;
        rank1Count: number;
      }>,
    };

    const accumulateParticipant = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
      p: any,
      acc: UserAcc,
    ) => {
      acc.partRealizedPnl += num(p.realizedPnl);
      acc.partWinning += num(p.winningTrades);
      acc.partLosing += num(p.losingTrades);
      acc.partOpens += num(p.totalTrades);
      acc.partOpenPositions += num(p.currentOpenPositions);
    };

    const rank1ByComp = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
    for (const p of compParts as any[]) {
      const acc = u(String(p.userId), p.username, p.email);
      acc.compEntered += 1;
      accumulateParticipant(p, acc);

      const compCompleted =
        compStatus.get(String(p.competitionId)) === "completed";
      const partCompleted = p.status === "completed";
      // Reason: finalization marks only active→completed; liquidated / disqualified
      // / refunded stay terminal BY DESIGN and the app does not count them as wins
      // or podiums. Exclude them from the competition-side derivation so a
      // by-design status is not flagged. An "active" participant in a completed
      // competition is NOT excluded — that is a genuine "not finalized" bug.
      const partTerminalNotCompleted =
        p.status === "liquidated" ||
        p.status === "disqualified" ||
        p.status === "refunded";
      const compFinished = compCompleted && !partTerminalNotCompleted;
      const rank = num(p.currentRank);

      if (compFinished && rank === 1) acc.compWon_compStatus += 1;
      if (compFinished && rank >= 1 && rank <= 3) acc.podium_compStatus += 1;
      if (partCompleted && rank === 1) acc.compWon_partStatus += 1;
      if (partCompleted && rank >= 1 && rank <= 3) acc.podium_partStatus += 1;

      if (compCompleted && rank === 1 && !partCompleted && !partTerminalNotCompleted) {
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
      accumulateParticipant(p, acc);

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
    let orphanUsers = 0;
    let orphanTrades = 0;
    let orphanPnl = 0;
    for (const acc of users.values()) {
      const th = tradeMatched.get(acc.userId) || emptyAgg();
      const orphan = tradeOrphan.get(acc.userId);
      if (orphan && orphan.closedTrades > 0) {
        orphanUsers += 1;
        orphanTrades += orphan.closedTrades;
        orphanPnl += orphan.totalPnL;
      }
      const openPositions = openPosMap.get(acc.userId) ?? acc.partOpenPositions;

      const compWinDiff = acc.compWon_compStatus !== acc.compWon_partStatus;
      const podiumDiff = acc.podium_compStatus !== acc.podium_partStatus;
      const challWinDiff =
        acc.challWon_isWinner !== acc.challWon_completedIsWinner ||
        acc.challWon_isWinner !== acc.challWon_winnerId;
      // Like-for-like realized comparisons.
      const realizedPnlDiff = Math.abs(acc.partRealizedPnl - th.totalPnL) > 0.01;
      const winnersDiff = acc.partWinning !== th.winners;
      const losersDiff = acc.partLosing !== th.losers;

      if (
        compWinDiff ||
        podiumDiff ||
        challWinDiff ||
        realizedPnlDiff ||
        winnersDiff ||
        losersDiff
      ) {
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
          partRealizedPnl: round2(acc.partRealizedPnl),
          thRealizedPnl: round2(th.totalPnL),
          partWinning: acc.partWinning,
          thWinners: th.winners,
          partLosing: acc.partLosing,
          thLosers: th.losers,
          opens: acc.partOpens,
          closedTrades: th.closedTrades,
          orphanClosedTrades: orphan ? orphan.closedTrades : 0,
          orphanRealizedPnl: orphan ? round2(orphan.totalPnL) : 0,
          openPositions,
          flags: {
            compWinDiff,
            podiumDiff,
            challWinDiff,
            realizedPnlDiff,
            winnersDiff,
            losersDiff,
          },
        });
      }
    }

    const active = [...users.values()]
      .filter((a) => a.compEntered > 0 || a.challEntered > 0)
      .map((a) => ({
        userId: a.userId,
        username: a.username,
        email: a.email,
        compEntered: a.compEntered,
        challEntered: a.challEntered,
        openPositions: openPosMap.get(a.userId) ?? a.partOpenPositions,
      }))
      .sort(
        (a, b) =>
          b.compEntered + b.challEntered - (a.compEntered + a.challEntered),
      );

    return NextResponse.json({
      success: true,
      clean: divergent.length === 0,
      collections: {
        compPartCol,
        challPartCol,
        compCol,
        challCol,
        tradeCol,
        posCol: posCol ?? null,
      },
      totals: {
        users: users.size,
        active: active.length,
        competitions: comps.length,
        challenges: challs.length,
        divergences: divergent.length,
      },
      // Historical residue from reset / re-created / deleted participants. This is
      // expected on reused test accounts and is EXCLUDED from divergences (it is
      // not a live-data bug). Shown so admins can see it exists.
      orphanResidue: {
        users: orphanUsers,
        trades: orphanTrades,
        pnl: round2(orphanPnl),
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
