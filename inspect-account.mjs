/**
 * Inspect ONE account's raw records to confirm the win/loss "drift" source.
 *
 * Read-only. Compares, for the matched user(s):
 *   - participant rows (competition + challenge): realizedPnl, winningTrades,
 *     losingTrades, totalTrades(opens), currentOpenPositions, status
 *   - TradeHistory (closed trades): count, winners/losers/breakeven, realizedPnl,
 *     grouped by competitionId and by participantId
 *   - live open positions
 * and pinpoints WHERE the numbers drift (e.g. TradeHistory rows whose
 * participant row no longer exists → reset/re-join/simulator data).
 *
 * Run:  node inspect-account.mjs "Marios Athinos"
 *       node inspect-account.mjs                 (defaults to "Marios Athinos")
 */
import "dotenv/config";
import dns from "node:dns";
// Reason: the local resolver refuses Atlas SRV lookups in this shell; use public DNS.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}
import { MongoClient } from "mongodb";

const query = process.argv[2] || "Marios Athinos";
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const flag = (bad) => (bad ? "❌ MISMATCH" : "✅ match");

const main = async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  const pick = (...c) => c.find((x) => cols.includes(x));

  const compPartCol = pick("competitionparticipants");
  const challPartCol = pick("challengeparticipants");
  const tradeCol = pick("tradehistories", "trade_histories");
  const posCol = pick("tradingpositions", "trading_positions");

  const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [cpMatch, chMatch] = await Promise.all([
    db.collection(compPartCol).find({ $or: [{ username: rx }, { email: rx }] }).toArray(),
    db.collection(challPartCol).find({ $or: [{ username: rx }, { email: rx }] }).toArray(),
  ]);

  const userIds = [
    ...new Set([...cpMatch, ...chMatch].map((p) => String(p.userId))),
  ];
  if (userIds.length === 0) {
    console.log(`No participant matched "${query}".`);
    await client.close();
    return;
  }

  for (const userId of userIds) {
    const compParts = cpMatch.filter((p) => String(p.userId) === userId);
    const challParts = chMatch.filter((p) => String(p.userId) === userId);
    const name =
      (compParts[0] || challParts[0])?.username ||
      (compParts[0] || challParts[0])?.email ||
      userId;

    console.log("=".repeat(100));
    console.log(`ACCOUNT: ${name}    userId=${userId}`);
    console.log("=".repeat(100));

    let pRealized = 0, pWin = 0, pLose = 0, pOpens = 0, pOpenPos = 0;

    console.log("\nCOMPETITION PARTICIPANTS:");
    for (const p of compParts) {
      pRealized += num(p.realizedPnl); pWin += num(p.winningTrades);
      pLose += num(p.losingTrades); pOpens += num(p.totalTrades);
      pOpenPos += num(p.currentOpenPositions);
      console.log(
        `  _id=${p._id} comp=${p.competitionId} status=${p.status} rank=${num(p.currentRank)} ` +
          `opens=${num(p.totalTrades)} win=${num(p.winningTrades)} lose=${num(p.losingTrades)} ` +
          `realizedPnl=${r2(num(p.realizedPnl))} pnl=${r2(num(p.pnl))} openPos=${num(p.currentOpenPositions)}`,
      );
    }

    console.log("\nCHALLENGE PARTICIPANTS:");
    for (const p of challParts) {
      pRealized += num(p.realizedPnl); pWin += num(p.winningTrades);
      pLose += num(p.losingTrades); pOpens += num(p.totalTrades);
      pOpenPos += num(p.currentOpenPositions);
      console.log(
        `  _id=${p._id} chall=${p.challengeId} status=${p.status} isWinner=${!!p.isWinner} ` +
          `opens=${num(p.totalTrades)} win=${num(p.winningTrades)} lose=${num(p.losingTrades)} ` +
          `realizedPnl=${r2(num(p.realizedPnl))} pnl=${r2(num(p.pnl))} openPos=${num(p.currentOpenPositions)}`,
      );
    }

    const th = await db.collection(tradeCol).find({ userId }).toArray();
    const thCount = th.length;
    const thRealized = th.reduce((s, t) => s + num(t.realizedPnl), 0);
    const thWin = th.filter((t) => num(t.realizedPnl) > 0).length;
    const thLose = th.filter((t) => num(t.realizedPnl) < 0).length;
    const thBreakeven = th.filter((t) => num(t.realizedPnl) === 0).length;

    const byComp = new Map();
    for (const t of th) {
      const k = String(t.competitionId);
      const e = byComp.get(k) || { count: 0, pnl: 0 };
      e.count += 1; e.pnl += num(t.realizedPnl); byComp.set(k, e);
    }
    const byReason = new Map();
    for (const t of th) {
      const k = t.closeReason || "unknown";
      byReason.set(k, (byReason.get(k) || 0) + 1);
    }
    const byPart = new Map();
    for (const t of th) {
      const k = String(t.participantId);
      byPart.set(k, (byPart.get(k) || 0) + 1);
    }

    let openPos = pOpenPos;
    if (posCol) openPos = await db.collection(posCol).countDocuments({ userId, status: "open" });

    console.log("\nTRADEHISTORY (closed trades):");
    console.log(
      `  count=${thCount}  winners=${thWin}  losers=${thLose}  breakeven=${thBreakeven}  sumRealizedPnl=${r2(thRealized)}`,
    );
    console.log("  by competitionId:");
    for (const [k, e] of byComp) console.log(`    ${k}: ${e.count} trades, realizedPnl=${r2(e.pnl)}`);
    console.log("  by closeReason:");
    for (const [k, v] of byReason) console.log(`    ${k}: ${v}`);

    console.log("\nLIKE-FOR-LIKE (participant sums vs TradeHistory):");
    console.log(`  realizedPnl:  participants=${r2(pRealized)}   history=${r2(thRealized)}   ${flag(Math.abs(pRealized - thRealized) > 0.01)}`);
    console.log(`  winners:      participants=${pWin}   history=${thWin}   ${flag(pWin !== thWin)}`);
    console.log(`  losers:       participants=${pLose}   history=${thLose}   ${flag(pLose !== thLose)}`);
    console.log(`  (context) opens=${pOpens}   openPositions=${openPos}   closedInHistory=${thCount}`);

    // Drift source #1: history rows whose participant row no longer exists.
    const partIdSet = new Set([...compParts, ...challParts].map((p) => String(p._id)));
    const orphanParts = [...byPart.keys()].filter((k) => !partIdSet.has(k));
    if (orphanParts.length > 0) {
      console.log("\n⚠️  TradeHistory rows whose participantId has NO matching participant doc:");
      for (const k of orphanParts) console.log(`    participantId=${k}: ${byPart.get(k)} trades`);
      console.log("   → DRIFT SOURCE: participant rows were reset/re-created/deleted while their trade history remained.");
    }

    // Drift source #2: history competitions with no participant row for this user.
    const partCtxIds = new Set([
      ...compParts.map((p) => String(p.competitionId)),
      ...challParts.map((p) => String(p.challengeId)),
    ]);
    const orphanComps = [...byComp.keys()].filter((k) => !partCtxIds.has(k));
    if (orphanComps.length > 0) {
      console.log("\n⚠️  TradeHistory references competitions/challenges with NO participant row for this user:");
      for (const k of orphanComps) console.log(`    ${k}: ${byComp.get(k).count} trades, realizedPnl=${r2(byComp.get(k).pnl)}`);
    }

    if (orphanParts.length === 0 && orphanComps.length === 0) {
      const clean =
        Math.abs(pRealized - thRealized) <= 0.01 && pWin === thWin && pLose === thLose;
      console.log(
        clean
          ? "\n✅ No drift: participant realized numbers match trade history exactly."
          : "\nℹ️  Numbers differ but every history row maps to an existing participant — check per-competition rows above for the counter that wasn't updated on close.",
      );
    }
  }

  await client.close();
};

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});
