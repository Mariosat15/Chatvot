/**
 * One-off verification: are the "participate / win / lose" numbers shown across
 * the user dashboard, profile, leaderboard and the admin surfaces correct and
 * consistent with the raw data?
 *
 * Recomputes, per user, each surface's exact definition from the source
 * collections and flags any divergence + raw data anomalies.
 *
 * Run: node verify-win-loss.mjs
 */
import "dotenv/config";
import dns from "node:dns";
// Reason: the local resolver refuses Atlas SRV lookups in this shell; use public DNS.
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

const main = async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  const pick = (...cands) => cands.find((c) => cols.includes(c));

  const compPartCol = pick("competitionparticipants");
  const challPartCol = pick("challengeparticipants");
  const compCol = pick("competitions");
  const challCol = pick("challenges");
  const tradeCol = pick("tradehistories", "trade_histories");

  console.log("Using collections:", { compPartCol, challPartCol, compCol, challCol, tradeCol });
  console.log("");

  const [compParts, challParts, comps, challs, tradeAgg] = await Promise.all([
    db.collection(compPartCol).find({}).toArray(),
    db.collection(challPartCol).find({}).toArray(),
    db.collection(compCol).find({}, { projection: { status: 1 } }).toArray(),
    db.collection(challCol).find({}, { projection: { status: 1, winnerId: 1, isTie: 1, noWinner: 1 } }).toArray(),
    db.collection(tradeCol).aggregate([
      {
        $group: {
          _id: "$userId",
          totalTrades: { $sum: 1 },
          totalPnL: { $sum: "$realizedPnl" },
        },
      },
    ]).toArray(),
  ]);

  const compStatus = new Map(comps.map((c) => [String(c._id), c.status]));
  const challMap = new Map(
    challs.map((c) => [String(c._id), { status: c.status, winnerId: c.winnerId, isTie: c.isTie, noWinner: c.noWinner }]),
  );
  const tradeMap = new Map(tradeAgg.map((t) => [t._id, t]));

  const users = new Map();
  const u = (userId, username, email) => {
    if (!users.has(userId)) {
      users.set(userId, {
        userId, username: username || "", email: email || "",
        compEntered: 0, compWon_compStatus: 0, compWon_partStatus: 0,
        podium_compStatus: 0, podium_partStatus: 0,
        challEntered: 0, challWon_isWinner: 0, challWon_completedIsWinner: 0, challWon_winnerId: 0,
        partPnlSum: 0, partTradesSum: 0,
      });
    }
    return users.get(userId);
  };

  const anomalies = {
    rank1_partNotCompleted: [],
    isWinner_challNotCompleted: [],
    winnerId_vs_isWinner_mismatch: [],
    compCompleted_multipleRank1: new Map(),
  };

  const rank1ByComp = new Map();
  for (const p of compParts) {
    const acc = u(p.userId, p.username, p.email);
    acc.compEntered += 1;
    acc.partPnlSum += num(p.pnl);
    acc.partTradesSum += num(p.totalTrades);

    const compCompleted = compStatus.get(String(p.competitionId)) === "completed";
    const partCompleted = p.status === "completed";
    const rank = num(p.currentRank);

    if (compCompleted && rank === 1) acc.compWon_compStatus += 1;
    if (compCompleted && rank >= 1 && rank <= 3) acc.podium_compStatus += 1;
    if (partCompleted && rank === 1) acc.compWon_partStatus += 1;
    if (partCompleted && rank >= 1 && rank <= 3) acc.podium_partStatus += 1;

    if (compCompleted && rank === 1 && !partCompleted) {
      anomalies.rank1_partNotCompleted.push({ username: p.username, competitionId: p.competitionId, partStatus: p.status });
    }
    if (compCompleted && rank === 1) {
      rank1ByComp.set(String(p.competitionId), (rank1ByComp.get(String(p.competitionId)) || 0) + 1);
    }
  }
  for (const [compId, count] of rank1ByComp.entries()) {
    if (count > 1) anomalies.compCompleted_multipleRank1.set(compId, count);
  }

  for (const p of challParts) {
    const acc = u(p.userId, p.username, p.email);
    acc.challEntered += 1;
    acc.partPnlSum += num(p.pnl);
    acc.partTradesSum += num(p.totalTrades);

    const ch = challMap.get(String(p.challengeId)) || {};
    const challCompleted = ch.status === "completed";
    const isWinner = !!p.isWinner;
    const winnerIdMatch = ch.winnerId && String(ch.winnerId) === String(p.userId);

    if (isWinner) acc.challWon_isWinner += 1;
    if (challCompleted && isWinner) acc.challWon_completedIsWinner += 1;
    if (winnerIdMatch) acc.challWon_winnerId += 1;

    if (isWinner && !challCompleted) {
      anomalies.isWinner_challNotCompleted.push({ username: p.username, challengeId: p.challengeId, challStatus: ch.status });
    }
    if (challCompleted && Boolean(winnerIdMatch) !== isWinner && !ch.noWinner && !ch.isTie) {
      anomalies.winnerId_vs_isWinner_mismatch.push({ username: p.username, challengeId: p.challengeId, isWinner, winnerIdMatch: Boolean(winnerIdMatch), challWinnerId: ch.winnerId });
    }
  }

  const divergent = [];
  for (const acc of users.values()) {
    const th = tradeMap.get(acc.userId) || { totalTrades: 0, totalPnL: 0 };
    const compWinDiff = acc.compWon_compStatus !== acc.compWon_partStatus;
    const podiumDiff = acc.podium_compStatus !== acc.podium_partStatus;
    const challWinDiff = acc.challWon_isWinner !== acc.challWon_completedIsWinner || acc.challWon_isWinner !== acc.challWon_winnerId;
    const pnlDiff = Math.abs(acc.partPnlSum - num(th.totalPnL)) > 0.01;
    const tradesDiff = acc.partTradesSum !== num(th.totalTrades);
    if (compWinDiff || podiumDiff || challWinDiff || pnlDiff || tradesDiff) {
      divergent.push({ ...acc, thTrades: num(th.totalTrades), thPnL: num(th.totalPnL), compWinDiff, podiumDiff, challWinDiff, pnlDiff, tradesDiff });
    }
  }

  console.log("=".repeat(110));
  console.log("USERS WITH ANY CONTEST ACTIVITY");
  console.log("=".repeat(110));
  const active = [...users.values()].filter((a) => a.compEntered > 0 || a.challEntered > 0);
  active.sort((a, b) => (b.compEntered + b.challEntered) - (a.compEntered + a.challEntered));
  console.log(
    pad("user", 24), pad("compEnt", 8), pad("cWon(comp)", 11), pad("cWon(part)", 11),
    pad("pod(comp)", 10), pad("pod(part)", 10), pad("chEnt", 6), pad("chW(isW)", 9), pad("chW(comp)", 10), pad("chW(wid)", 9),
  );
  for (const a of active) {
    console.log(
      pad(a.username || a.email || a.userId, 24), pad(a.compEntered, 8), pad(a.compWon_compStatus, 11), pad(a.compWon_partStatus, 11),
      pad(a.podium_compStatus, 10), pad(a.podium_partStatus, 10), pad(a.challEntered, 6), pad(a.challWon_isWinner, 9), pad(a.challWon_completedIsWinner, 10), pad(a.challWon_winnerId, 9),
    );
  }

  console.log("");
  console.log("=".repeat(110));
  console.log("DIVERGENCES (numbers that would differ between surfaces)");
  console.log("=".repeat(110));
  if (divergent.length === 0) {
    console.log("None - every surface's definition produces identical win/loss/participation numbers per user.");
  } else {
    for (const d of divergent) {
      const flags = [
        d.compWinDiff ? "COMP_WIN" : null, d.podiumDiff ? "PODIUM" : null, d.challWinDiff ? "CHALL_WIN" : null,
        d.pnlDiff ? "PNL(part!=trades)" : null, d.tradesDiff ? "TRADES(part!=trades)" : null,
      ].filter(Boolean).join(", ");
      console.log(`- ${d.username || d.email || d.userId}: ${flags}`);
      if (d.compWinDiff) console.log(`    compWon: byCompetitionStatus=${d.compWon_compStatus}  byParticipantStatus=${d.compWon_partStatus}`);
      if (d.podiumDiff) console.log(`    podium:  byCompetitionStatus=${d.podium_compStatus}  byParticipantStatus=${d.podium_partStatus}`);
      if (d.challWinDiff) console.log(`    challWon: isWinner=${d.challWon_isWinner}  completed&isWinner=${d.challWon_completedIsWinner}  winnerId=${d.challWon_winnerId}`);
      if (d.pnlDiff) console.log(`    PnL: sum(participant.pnl)=${d.partPnlSum.toFixed(2)}  sum(trade.realizedPnl)=${d.thPnL.toFixed(2)}  (delta=${(d.partPnlSum - d.thPnL).toFixed(2)})`);
      if (d.tradesDiff) console.log(`    Trades: sum(participant.totalTrades)=${d.partTradesSum}  TradeHistory count=${d.thTrades}`);
    }
  }

  console.log("");
  console.log("=".repeat(110));
  console.log("RAW DATA ANOMALIES");
  console.log("=".repeat(110));
  console.log(`rank-1 in a COMPLETED competition but participant.status != completed: ${anomalies.rank1_partNotCompleted.length}`);
  for (const a of anomalies.rank1_partNotCompleted.slice(0, 20)) console.log(`    ${a.username} comp=${a.competitionId} partStatus=${a.partStatus}`);
  console.log(`isWinner=true but challenge.status != completed: ${anomalies.isWinner_challNotCompleted.length}`);
  for (const a of anomalies.isWinner_challNotCompleted.slice(0, 20)) console.log(`    ${a.username} chall=${a.challengeId} status=${a.challStatus}`);
  console.log(`completed challenge winnerId vs participant.isWinner mismatch (excl ties/noWinner): ${anomalies.winnerId_vs_isWinner_mismatch.length}`);
  for (const a of anomalies.winnerId_vs_isWinner_mismatch.slice(0, 20)) console.log(`    ${a.username} chall=${a.challengeId} isWinner=${a.isWinner} winnerIdMatch=${a.winnerIdMatch}`);
  console.log(`completed competitions with MULTIPLE rank-1 participants (ties): ${anomalies.compCompleted_multipleRank1.size}`);
  for (const [compId, count] of anomalies.compCompleted_multipleRank1) console.log(`    comp=${compId} rank1Count=${count}`);

  console.log("");
  console.log("Totals: users=", users.size, " active=", active.length, " competitions=", comps.length, " challenges=", challs.length);

  await client.close();
};

main().catch((e) => { console.error("Script error:", e); process.exit(1); });
