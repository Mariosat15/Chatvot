import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET  /api/simulator/recompute-finished-stats  → scan (read-only, dry-run)
 * POST /api/simulator/recompute-finished-stats  → apply the corrections
 *
 * Older contests were finalized with code that RE-DERIVED each closed trade's
 * P&L (using the conversion rate at finalization time) and overwrote the
 * participant totals. That left participant.realizedPnl / pnl / winningTrades /
 * losingTrades out of sync with the immutable per-trade record in TradeHistory
 * (which is what the trade-history list and leaderboard show). Finalization is
 * now fixed going forward, but already-finished contests keep the old drifted
 * totals.
 *
 * This tool recomputes each finished participant's stats straight from their
 * TradeHistory rows (matched by participantId) so the stored totals equal the
 * sum of the trades again — exactly what a correct finalization would have
 * produced.
 *
 * Scope guards (so this can never touch live money/rankings):
 *   - Only participants whose parent contest status is "completed".
 *   - Skips "refunded" participants (their entry was voided).
 *   - Never re-ranks and never distributes prizes; only reconciles display/
 *     accounting stats. Idempotent: re-running yields the same result.
 * Admin-authenticated.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
type Doc = any;

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const round2 = (v: number): number => Math.round(v * 100) / 100;

const MAX_FIX_PER_RUN = 5000;
const SAMPLE_LIMIT = 100;

const FINISHED_CONTEST_STATUS = "completed";
// Participants in these states are intentionally left terminal — don't reconcile.
const SKIP_PARTICIPANT_STATUS = new Set(["refunded"]);

interface ExpectedStats {
  realizedPnl: number;
  pnl: number;
  unrealizedPnl: number;
  winningTrades: number;
  losingTrades: number;
  totalTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  pnlPercentage: number;
  currentCapital: number;
  availableCapital: number;
  usedMargin: number;
  currentOpenPositions: number;
}

interface FixCandidate {
  collection: string;
  id: string;
  username: string;
  contestType: "competition" | "challenge";
  contestId: string;
  before: { realizedPnl: number; winningTrades: number; losingTrades: number };
  after: { realizedPnl: number; winningTrades: number; losingTrades: number };
  set: ExpectedStats;
}

type ThAgg = {
  realizedPnl: number;
  winners: number;
  losers: number;
  closed: number;
  winAmount: number;
  lossAmount: number;
  maxPnl: number;
  minPnl: number;
};
const EMPTY_AGG: ThAgg = {
  realizedPnl: 0,
  winners: 0,
  losers: 0,
  closed: 0,
  winAmount: 0,
  lossAmount: 0,
  maxPnl: 0,
  minPnl: 0,
};

function expectedFrom(agg: ThAgg, startingCapital: number): ExpectedStats {
  const realizedPnl = round2(agg.realizedPnl);
  return {
    realizedPnl,
    pnl: realizedPnl,
    unrealizedPnl: 0,
    winningTrades: agg.winners,
    losingTrades: agg.losers,
    totalTrades: agg.closed,
    winRate: agg.closed > 0 ? (agg.winners / agg.closed) * 100 : 0,
    averageWin: agg.winners > 0 ? round2(agg.winAmount / agg.winners) : 0,
    averageLoss: agg.losers > 0 ? round2(agg.lossAmount / agg.losers) : 0,
    largestWin: agg.maxPnl > 0 ? round2(agg.maxPnl) : 0,
    largestLoss: agg.minPnl < 0 ? round2(agg.minPnl) : 0,
    pnlPercentage:
      startingCapital > 0 ? (realizedPnl / startingCapital) * 100 : 0,
    currentCapital: round2(startingCapital + realizedPnl),
    availableCapital: round2(startingCapital + realizedPnl),
    usedMargin: 0,
    currentOpenPositions: 0,
  };
}

/**
 * Build the list of finished participants whose stored stats no longer match
 * the sum of their TradeHistory rows.
 */
async function findFixes(db: mongoose.mongo.Db): Promise<{
  candidates: FixCandidate[];
  scanned: number;
}> {
  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  const pick = (...cands: string[]) => cands.find((c) => cols.includes(c));
  const compPartCol = pick("competitionparticipants");
  const challPartCol = pick("challengeparticipants");
  const compCol = pick("competitions");
  const challCol = pick("challenges");
  const tradeCol = pick("tradehistories", "trade_histories");

  if (!compPartCol || !challPartCol || !tradeCol) {
    throw new Error("Required collections not found");
  }

  const [compParts, challParts, comps, challs, tradeAgg] = await Promise.all([
    db.collection(compPartCol).find({}).toArray(),
    db.collection(challPartCol).find({}).toArray(),
    compCol
      ? db.collection(compCol).find({}, { projection: { status: 1 } }).toArray()
      : Promise.resolve([] as Doc[]),
    challCol
      ? db.collection(challCol).find({}, { projection: { status: 1 } }).toArray()
      : Promise.resolve([] as Doc[]),
    db
      .collection(tradeCol)
      .aggregate([
        {
          $group: {
            _id: "$participantId",
            realizedPnl: { $sum: "$realizedPnl" },
            winners: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
            losers: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
            closed: { $sum: 1 },
            winAmount: {
              $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
            },
            lossAmount: {
              $sum: {
                $cond: [{ $lt: ["$realizedPnl", 0] }, { $abs: "$realizedPnl" }, 0],
              },
            },
            maxPnl: { $max: "$realizedPnl" },
            minPnl: { $min: "$realizedPnl" },
          },
        },
      ])
      .toArray(),
  ]);

  const compFinished = new Set(
    (comps as Doc[])
      .filter((c: Doc) => c.status === FINISHED_CONTEST_STATUS)
      .map((c: Doc) => String(c._id)),
  );
  const challFinished = new Set(
    (challs as Doc[])
      .filter((c: Doc) => c.status === FINISHED_CONTEST_STATUS)
      .map((c: Doc) => String(c._id)),
  );

  const aggByPart = new Map<string, ThAgg>();
  for (const g of tradeAgg as Doc[]) {
    aggByPart.set(String(g._id ?? ""), {
      realizedPnl: num(g.realizedPnl),
      winners: num(g.winners),
      losers: num(g.losers),
      closed: num(g.closed),
      winAmount: num(g.winAmount),
      lossAmount: num(g.lossAmount),
      maxPnl: num(g.maxPnl),
      minPnl: num(g.minPnl),
    });
  }

  const candidates: FixCandidate[] = [];
  let scanned = 0;

  const consider = (
    p: Doc,
    collection: string,
    contestType: "competition" | "challenge",
    contestId: string,
  ) => {
    if (SKIP_PARTICIPANT_STATUS.has(String(p.status))) return;
    scanned += 1;
    const agg = aggByPart.get(String(p._id)) || EMPTY_AGG;
    const set = expectedFrom(agg, num(p.startingCapital));

    const changed =
      Math.abs(num(p.realizedPnl) - set.realizedPnl) > 0.01 ||
      Math.abs(num(p.pnl) - set.pnl) > 0.01 ||
      num(p.winningTrades) !== set.winningTrades ||
      num(p.losingTrades) !== set.losingTrades;
    if (!changed) return;

    candidates.push({
      collection,
      id: String(p._id),
      username: p.username || p.email || String(p.userId),
      contestType,
      contestId,
      before: {
        realizedPnl: round2(num(p.realizedPnl)),
        winningTrades: num(p.winningTrades),
        losingTrades: num(p.losingTrades),
      },
      after: {
        realizedPnl: set.realizedPnl,
        winningTrades: set.winningTrades,
        losingTrades: set.losingTrades,
      },
      set,
    });
  };

  for (const p of compParts as Doc[]) {
    const contestId = String(p.competitionId);
    if (!compFinished.has(contestId)) continue;
    consider(p, compPartCol, "competition", contestId);
  }
  for (const p of challParts as Doc[]) {
    const contestId = String(p.challengeId);
    if (!challFinished.has(contestId)) continue;
    consider(p, challPartCol, "challenge", contestId);
  }

  return { candidates, scanned };
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

    const { candidates, scanned } = await findFixes(db);
    return NextResponse.json({
      success: true,
      mode: "scan",
      scanned,
      fixCount: candidates.length,
      sample: candidates.slice(0, SAMPLE_LIMIT).map((c) => ({
        id: c.id,
        username: c.username,
        contestType: c.contestType,
        contestId: c.contestId,
        before: c.before,
        after: c.after,
      })),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ recompute-finished-stats scan error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Scan failed",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
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

    // Recompute fresh (never trust client input), then apply.
    const { candidates } = await findFixes(db);
    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        mode: "apply",
        fixed: 0,
        message: "All finished-contest stats already match trade history.",
      });
    }

    const batch = candidates.slice(0, MAX_FIX_PER_RUN);
    // Group bulk ops by collection (competition vs challenge participants).
    const opsByCollection = new Map<
      string,
      Array<{
        updateOne: {
          filter: { _id: mongoose.Types.ObjectId };
          update: { $set: ExpectedStats };
        };
      }>
    >();
    for (const c of batch) {
      if (!mongoose.Types.ObjectId.isValid(c.id)) continue;
      const list = opsByCollection.get(c.collection) || [];
      list.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(c.id) },
          update: { $set: c.set },
        },
      });
      opsByCollection.set(c.collection, list);
    }

    let fixed = 0;
    for (const [collection, ops] of opsByCollection.entries()) {
      if (ops.length === 0) continue;
      const result = await db
        .collection(collection)
        .bulkWrite(ops, { ordered: false });
      fixed += result.modifiedCount ?? 0;
    }

    console.log(
      `🧮 [STATS-RECOMPUTE] Admin ${admin.adminId ?? "?"} reconciled ${fixed} finished participant record(s) with TradeHistory.`,
    );

    return NextResponse.json({
      success: true,
      mode: "apply",
      fixed,
      attempted: batch.length,
      remaining: Math.max(0, candidates.length - batch.length),
      message: `Reconciled ${fixed} finished participant record(s) with their trade history.`,
    });
  } catch (error) {
    console.error("❌ recompute-finished-stats apply error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Apply failed",
      },
      { status: 500 },
    );
  }
}
