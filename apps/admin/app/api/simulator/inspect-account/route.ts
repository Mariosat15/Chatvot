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
    const compCol = pick("competitions");
    const challCol = pick("challenges");

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

      // Fetch the raw open-position docs (not just a count) so we can resolve
      // each one's parent contest status. An open position is only legitimate
      // while its parent contest is "active"; anything else means the contest
      // ended but the position was left open (e.g. finalization skipped it
      // because no price was available for its symbol).
      const openDocs: Doc[] = posCol
        ? await db
            .collection(posCol)
            .find({ userId, status: "open" })
            .limit(50)
            .toArray()
        : [];
      const openPositions = posCol ? openDocs.length : pOpenPos;

      // Resolve parent contest status for every open position in one batched
      // query per collection. competitionId on a position may be a competition
      // _id OR a challenge _id (challenges reuse the field), so we look in both.
      const ctxIds = [
        ...new Set(openDocs.map((p: Doc) => String(p.competitionId))),
      ];
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

      let orphanOpenPositions = 0;
      const openPositionDetails = openDocs.map((p: Doc) => {
        const ctxId = String(p.competitionId);
        let parentType: "competition" | "challenge" | "unknown" = "unknown";
        let parentStatus = "missing";
        if (compStatus.has(ctxId)) {
          parentType = "competition";
          parentStatus = compStatus.get(ctxId) as string;
        } else if (challStatus.has(ctxId)) {
          parentType = "challenge";
          parentStatus = challStatus.get(ctxId) as string;
        }
        // Reason: "active" is the only state in which an open position is valid.
        const orphaned = parentStatus !== "active";
        if (orphaned) orphanOpenPositions += 1;
        return {
          id: String(p._id),
          symbol: String(p.symbol || "?"),
          side: String(p.side || "?"),
          contextId: ctxId,
          parentType,
          parentStatus,
          openedAt: p.openedAt ? new Date(p.openedAt).toISOString() : null,
          orphaned,
        };
      });

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
        openPositionDetails,
        orphanOpenPositions,
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
