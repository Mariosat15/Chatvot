import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET /api/simulator/inspect-account?q=<name-or-email>
 *
 * Read-only deep dive on ONE account to confirm the source of any win/loss
 * "drift". For each matched user it returns the raw participant rows, the
 * TradeHistory breakdown (by competition + close reason), live open positions,
 * a like-for-like realized comparison, and the concrete drift sources:
 *   - TradeHistory rows whose participantId no longer maps to a participant doc
 *     (participant was reset/re-created/deleted → history outlives the counter),
 *   - TradeHistory contexts with no participant row for the user.
 *
 * Server-side sibling of inspect-account.mjs (uses the pooled connection so it
 * works even where a local shell cannot reach the DB). Admin-authenticated.
 */

const num = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;
const r2 = (v: number): number => Math.round(v * 100) / 100;

const MAX_MATCHES = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw driver docs
type Doc = any;

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = (new URL(request.url).searchParams.get("q") || "")
      .trim()
      .slice(0, 100);
    if (q.length < 2) {
      return NextResponse.json(
        { success: false, error: "Provide a name or email (min 2 chars)" },
        { status: 400 },
      );
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
    const tradeCol = pick("tradehistories", "trade_histories");
    const posCol = pick("tradingpositions", "trading_positions");

    if (!compPartCol || !challPartCol || !tradeCol) {
      return NextResponse.json(
        { success: false, error: "Required collections not found" },
        { status: 404 },
      );
    }

    // Escape the query so it is treated as a literal (no ReDoS / injection) and
    // pass it as a STRING $regex — Mongo compiles it, so we avoid constructing a
    // RegExp from non-literal input in Node.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameFilter = {
      $or: [
        { username: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
      ],
    };

    const [cpMatch, chMatch] = await Promise.all([
      db.collection(compPartCol).find(nameFilter).toArray(),
      db.collection(challPartCol).find(nameFilter).toArray(),
    ]);

    const userIds = [
      ...new Set([...cpMatch, ...chMatch].map((p: Doc) => String(p.userId))),
    ].slice(0, MAX_MATCHES);

    const matches = [];
    for (const userId of userIds) {
      const compParts = cpMatch.filter((p: Doc) => String(p.userId) === userId);
      const challParts = chMatch.filter((p: Doc) => String(p.userId) === userId);
      const name =
        (compParts[0] || challParts[0])?.username ||
        (compParts[0] || challParts[0])?.email ||
        userId;

      let pRealized = 0;
      let pWin = 0;
      let pLose = 0;
      let pOpens = 0;
      let pOpenPos = 0;
      const mapPart = (p: Doc) => {
        pRealized += num(p.realizedPnl);
        pWin += num(p.winningTrades);
        pLose += num(p.losingTrades);
        pOpens += num(p.totalTrades);
        pOpenPos += num(p.currentOpenPositions);
        return {
          id: String(p._id),
          status: p.status,
          rank: num(p.currentRank),
          isWinner: !!p.isWinner,
          opens: num(p.totalTrades),
          winningTrades: num(p.winningTrades),
          losingTrades: num(p.losingTrades),
          realizedPnl: r2(num(p.realizedPnl)),
          pnl: r2(num(p.pnl)),
          openPositions: num(p.currentOpenPositions),
        };
      };
      const competitionParticipants = compParts.map((p: Doc) => ({
        contextId: String(p.competitionId),
        ...mapPart(p),
      }));
      const challengeParticipants = challParts.map((p: Doc) => ({
        contextId: String(p.challengeId),
        ...mapPart(p),
      }));

      const th = await db.collection(tradeCol).find({ userId }).toArray();
      const thRealized = th.reduce((s: number, t: Doc) => s + num(t.realizedPnl), 0);
      const thWin = th.filter((t: Doc) => num(t.realizedPnl) > 0).length;
      const thLose = th.filter((t: Doc) => num(t.realizedPnl) < 0).length;
      const thBreakeven = th.filter((t: Doc) => num(t.realizedPnl) === 0).length;

      const byComp = new Map<string, { count: number; pnl: number }>();
      const byReason = new Map<string, number>();
      const byPart = new Map<string, number>();
      for (const t of th as Doc[]) {
        const ck = String(t.competitionId);
        const ce = byComp.get(ck) || { count: 0, pnl: 0 };
        ce.count += 1;
        ce.pnl += num(t.realizedPnl);
        byComp.set(ck, ce);
        byReason.set(t.closeReason || "unknown", (byReason.get(t.closeReason || "unknown") || 0) + 1);
        byPart.set(String(t.participantId), (byPart.get(String(t.participantId)) || 0) + 1);
      }

      const openPositions = posCol
        ? await db.collection(posCol).countDocuments({ userId, status: "open" })
        : pOpenPos;

      const partIdSet = new Set([...compParts, ...challParts].map((p: Doc) => String(p._id)));
      const partCtxIds = new Set([
        ...compParts.map((p: Doc) => String(p.competitionId)),
        ...challParts.map((p: Doc) => String(p.challengeId)),
      ]);
      const orphanParticipants = [...byPart.entries()]
        .filter(([k]) => !partIdSet.has(k))
        .map(([participantId, trades]) => ({ participantId, trades }));
      const orphanContexts = [...byComp.entries()]
        .filter(([k]) => !partCtxIds.has(k))
        .map(([id, e]) => ({ id, count: e.count, pnl: r2(e.pnl) }));

      matches.push({
        userId,
        name,
        competitionParticipants,
        challengeParticipants,
        tradeHistory: {
          count: th.length,
          winners: thWin,
          losers: thLose,
          breakeven: thBreakeven,
          realizedPnl: r2(thRealized),
          byCompetition: [...byComp.entries()].map(([id, e]) => ({
            id,
            count: e.count,
            pnl: r2(e.pnl),
          })),
          byCloseReason: [...byReason.entries()].map(([reason, count]) => ({
            reason,
            count,
          })),
        },
        openPositions,
        comparison: {
          realizedPnl: {
            participants: r2(pRealized),
            history: r2(thRealized),
            match: Math.abs(pRealized - thRealized) <= 0.01,
          },
          winners: { participants: pWin, history: thWin, match: pWin === thWin },
          losers: { participants: pLose, history: thLose, match: pLose === thLose },
          opens: pOpens,
          closedInHistory: th.length,
        },
        driftSources: { orphanParticipants, orphanContexts },
      });
    }

    return NextResponse.json({
      success: true,
      query: q,
      matchCount: matches.length,
      matches,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ inspect-account error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to inspect account" },
      { status: 500 },
    );
  }
}
