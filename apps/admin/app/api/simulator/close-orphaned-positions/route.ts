import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET  /api/simulator/close-orphaned-positions  → scan (read-only, dry-run)
 * POST /api/simulator/close-orphaned-positions  → close the orphans found
 *
 * An "orphaned open position" is a TradingPosition that is still status:"open"
 * even though its parent contest is already over (completed / cancelled /
 * expired / declined) or the contest no longer exists. This happens when contest
 * finalization could not fetch a price for the position's symbol and skipped it
 * (now fixed in competition-end / challenge-finalize, but existing leftovers
 * remain). Such a position never gets closed by anything else, so it lingers
 * open forever on a finished contest.
 *
 * We ONLY act on definitively-ended contests. Positions on active / finalizing /
 * upcoming contests are left untouched so this can never race live finalization.
 *
 * Read-only scan is safe to run any time. The POST close uses each position's
 * last known price (currentPrice → entryPrice) and the contest-appropriate
 * closeReason, mirroring the finalization fallback. Admin-authenticated.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
type Doc = any;

// Contest states that mean "definitively over" → an open position is an orphan.
const ENDED_STATES = new Set([
  "completed",
  "cancelled",
  "canceled",
  "expired",
  "declined",
]);
// States where finalization may still run or trading is valid → never touch.
const PROTECTED_STATES = new Set([
  "active",
  "finalizing",
  "upcoming",
  "pending",
  "accepted",
  "draft",
  "scheduled",
]);

const MAX_CLOSE_PER_RUN = 5000;
const SAMPLE_LIMIT = 100;

interface Orphan {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  contextId: string;
  parentType: "competition" | "challenge" | "unknown";
  parentStatus: string;
  exitPrice: number;
  closeReason: "competition_end" | "challenge_end";
}

/**
 * Find every open position whose parent contest is definitively ended or missing.
 * Positions on protected (active/finalizing/…) contests are excluded entirely.
 */
async function findOrphans(
  db: mongoose.mongo.Db,
): Promise<{ orphans: Orphan[]; totalOpen: number; byStatus: Record<string, number> }> {
  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  const pick = (...cands: string[]) => cands.find((c) => cols.includes(c));
  const posCol = pick("tradingpositions", "trading_positions");
  const compCol = pick("competitions");
  const challCol = pick("challenges");

  if (!posCol) return { orphans: [], totalOpen: 0, byStatus: {} };

  const openDocs: Doc[] = await db
    .collection(posCol)
    .find(
      { status: "open" },
      {
        projection: {
          competitionId: 1,
          userId: 1,
          symbol: 1,
          side: 1,
          currentPrice: 1,
          entryPrice: 1,
        },
      },
    )
    .toArray();

  const ctxIds = [...new Set(openDocs.map((p: Doc) => String(p.competitionId)))];
  const idCandidates: (string | mongoose.Types.ObjectId)[] = [];
  for (const id of ctxIds) {
    idCandidates.push(id);
    if (mongoose.Types.ObjectId.isValid(id)) {
      idCandidates.push(new mongoose.Types.ObjectId(id));
    }
  }

  const [comps, challs] = await Promise.all([
    compCol && idCandidates.length
      ? db.collection(compCol).find({ _id: { $in: idCandidates } }).toArray()
      : Promise.resolve([] as Doc[]),
    challCol && idCandidates.length
      ? db.collection(challCol).find({ _id: { $in: idCandidates } }).toArray()
      : Promise.resolve([] as Doc[]),
  ]);
  const compStatus = new Map(
    (comps as Doc[]).map((c: Doc) => [String(c._id), String(c.status)]),
  );
  const challStatus = new Map(
    (challs as Doc[]).map((c: Doc) => [String(c._id), String(c.status)]),
  );

  const orphans: Orphan[] = [];
  const byStatusMap = new Map<string, number>();

  for (const p of openDocs) {
    const ctxId = String(p.competitionId);
    let parentType: Orphan["parentType"] = "unknown";
    let parentStatus = "missing";
    if (compStatus.has(ctxId)) {
      parentType = "competition";
      parentStatus = compStatus.get(ctxId) as string;
    } else if (challStatus.has(ctxId)) {
      parentType = "challenge";
      parentStatus = challStatus.get(ctxId) as string;
    }

    // Only ended-or-missing contests are orphans; never touch protected states.
    const isOrphan =
      parentStatus === "missing" ||
      (ENDED_STATES.has(parentStatus) && !PROTECTED_STATES.has(parentStatus));
    if (!isOrphan) continue;

    byStatusMap.set(parentStatus, (byStatusMap.get(parentStatus) || 0) + 1);
    orphans.push({
      id: String(p._id),
      userId: String(p.userId),
      symbol: String(p.symbol || "?"),
      side: String(p.side || "?"),
      contextId: ctxId,
      parentType,
      parentStatus,
      exitPrice:
        typeof p.currentPrice === "number" && isFinite(p.currentPrice)
          ? p.currentPrice
          : typeof p.entryPrice === "number" && isFinite(p.entryPrice)
            ? p.entryPrice
            : 0,
      closeReason: parentType === "challenge" ? "challenge_end" : "competition_end",
    });
  }

  return {
    orphans,
    totalOpen: openDocs.length,
    byStatus: Object.fromEntries(byStatusMap),
  };
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

    const { orphans, totalOpen, byStatus } = await findOrphans(db);
    return NextResponse.json({
      success: true,
      mode: "scan",
      totalOpen,
      orphanCount: orphans.length,
      byStatus,
      sample: orphans.slice(0, SAMPLE_LIMIT),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ close-orphaned-positions scan error:", error);
    return NextResponse.json(
      { success: false, error: "Scan failed" },
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

    const { orphans } = await findOrphans(db);
    if (orphans.length === 0) {
      return NextResponse.json({
        success: true,
        mode: "close",
        closed: 0,
        message: "No orphaned open positions to close.",
      });
    }

    const cols = (await db.listCollections().toArray()).map((c) => c.name);
    const posCol = cols.includes("tradingpositions")
      ? "tradingpositions"
      : "trading_positions";

    const now = new Date();
    const batch = orphans.slice(0, MAX_CLOSE_PER_RUN);
    // Re-guard on status:"open" in the filter so a position closed by finalization
    // in the meantime is never double-written (idempotent).
    const ops = batch.map((o) => ({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(o.id),
          status: "open",
        },
        update: {
          $set: {
            status: "closed",
            exitPrice: o.exitPrice,
            closedAt: now,
            closeReason: o.closeReason,
          },
        },
      },
    }));

    const result = await db.collection(posCol).bulkWrite(ops, { ordered: false });
    const closed = result.modifiedCount ?? 0;

    console.log(
      `🧹 [ORPHAN-CLEANUP] Admin ${admin.adminId ?? "?"} closed ${closed} orphaned open position(s).`,
    );

    return NextResponse.json({
      success: true,
      mode: "close",
      closed,
      attempted: batch.length,
      remaining: Math.max(0, orphans.length - batch.length),
      message: `Closed ${closed} orphaned open position(s).`,
    });
  } catch (error) {
    console.error("❌ close-orphaned-positions close error:", error);
    return NextResponse.json(
      { success: false, error: "Close failed" },
      { status: 500 },
    );
  }
}
