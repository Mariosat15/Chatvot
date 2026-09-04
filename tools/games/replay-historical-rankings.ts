/**
 * Replays completed competitions through the ranking code and compares the result
 * against the `finalLeaderboard` that was stored when they actually settled.
 *
 * This is the other half of the X1 acceptance gate in chapter 11 section 4. The golden
 * matrix in `__tests__/services/ranking-regression.test.ts` runs in CI but is synthetic;
 * this runs against real history, which is the only thing that carries the distributions,
 * the tie patterns and the awkward edge cases nobody would think to invent.
 *
 * Run it TWICE and compare the two reports:
 *   1. Before the X1 extraction, to learn which competitions already reproduce.
 *   2. After it. Any competition that reproduced before and does not afterwards is a
 *      regression the extraction introduced.
 *
 *   npx tsx tools/games/replay-historical-rankings.ts [--limit 200] [--json report.json]
 *
 * STRICTLY READ-ONLY. It opens no transaction and calls no save, and the models are read
 * through `.lean()` so nothing is even hydrated into a writable document.
 *
 * A MISMATCH IS NOT AUTOMATICALLY A BUG, and the report separates the reasons:
 *   - Participant rows are read as they are NOW. Anything that edited a participant
 *     after settlement makes the replay diverge for reasons unrelated to ranking.
 *   - Competitions settled before a deliberate ranking change will not reproduce under
 *     today's rules. That is history, not a defect.
 *   - `emergency_ended` competitions were finalized from a price snapshot on a separate
 *     path, so they are counted and skipped rather than reported as failures.
 * The number that matters is the BEFORE/AFTER delta, not the absolute pass rate.
 */

import mongoose from "mongoose";

import {
  calculateRankings,
  distributePrizesWithTies,
  type ParticipantData,
} from "../../lib/services/competition-ranking.service";
import Competition from "../../database/models/trading/competition.model";
import CompetitionParticipant from "../../database/models/trading/competition-participant.model";

interface Mismatch {
  competitionId: string;
  name: string;
  reason: string;
  detail: string;
}

/**
 * Reason: `.lean()` widens the stored subdocuments to `any`, so the two fields this
 * script actually compares are declared here. Without it the Maps below infer
 * `unknown` keys and values and the comparisons silently stop being type-checked.
 */
interface StoredLeaderboardRow {
  userId: unknown;
  rank: number;
  prizeAmount?: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf("--limit");
  const jsonIndex = args.indexOf("--json");
  return {
    limit: limitIndex >= 0 ? Number(args[limitIndex + 1]) : 500,
    jsonPath: jsonIndex >= 0 ? args[jsonIndex + 1] : undefined,
  };
}

async function main() {
  const { limit, jsonPath } = parseArgs();
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Refusing to guess a connection string.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("📡 Connected. Replaying completed competitions (read-only)...\n");

  const competitions = await Competition.find({ status: "completed" })
    .sort({ endTime: -1 })
    .limit(limit)
    .lean();

  const mismatches: Mismatch[] = [];
  let reproduced = 0;
  let skippedNoLeaderboard = 0;
  let skippedNoParticipants = 0;

  for (const competition of competitions) {
    const id = String(competition._id);

    if (!competition.finalLeaderboard?.length) {
      skippedNoLeaderboard++;
      continue;
    }

    const participantRows = await CompetitionParticipant.find({
      competitionId: id,
    }).lean();

    if (!participantRows.length) {
      skippedNoParticipants++;
      continue;
    }

    const participants: ParticipantData[] = participantRows.map((p) => ({
      userId: String(p.userId),
      username: p.username,
      currentCapital: p.currentCapital,
      pnl: p.pnl,
      pnlPercentage: p.pnlPercentage,
      totalTrades: p.totalTrades,
      winningTrades: p.winningTrades,
      losingTrades: p.losingTrades,
      winRate: p.winRate,
      status: p.status,
      enteredAt: p.enteredAt,
      startingCapital: p.startingCapital,
    }));

    const ranked = calculateRankings(participants, competition.rules, {
      competitionStatus: "completed",
    });

    // Reason: the fee is stored as a percentage (0-50) but distributePrizesWithTies takes
    // a fraction, so it must be divided by 100 first. R30.
    const payouts = distributePrizesWithTies(
      ranked,
      competition.prizeDistribution,
      competition.prizePool,
      competition.rules,
      (competition.platformFeePercentage ?? 0) / 100,
    );

    const storedRows = competition.finalLeaderboard as StoredLeaderboardRow[];

    const storedRankByUser = new Map<string, number>(
      storedRows.map((row) => [String(row.userId), row.rank]),
    );
    const replayRankByUser = new Map(ranked.map((p) => [p.userId, p.rank]));

    const rankDiffs = [...storedRankByUser.entries()].filter(
      ([userId, storedRank]) => replayRankByUser.get(userId) !== storedRank,
    );

    if (rankDiffs.length) {
      mismatches.push({
        competitionId: id,
        name: competition.name,
        reason: "RANK",
        detail: rankDiffs
          .slice(0, 5)
          .map(
            ([userId, stored]) =>
              `${userId}: stored #${stored}, replay #${replayRankByUser.get(userId) ?? "absent"}`,
          )
          .join("; "),
      });
      continue;
    }

    const storedPrizeByUser = new Map<string, number>(
      storedRows.map((row) => [String(row.userId), row.prizeAmount ?? 0]),
    );
    const replayPrizeByUser = new Map(payouts.map((d) => [d.userId, d.prizeAmount]));

    const prizeDiffs = [...storedPrizeByUser.entries()].filter(
      ([userId, storedPrize]) =>
        Math.abs((replayPrizeByUser.get(userId) ?? 0) - storedPrize) > 0.01,
    );

    if (prizeDiffs.length) {
      mismatches.push({
        competitionId: id,
        name: competition.name,
        reason: "PRIZE",
        detail: prizeDiffs
          .slice(0, 5)
          .map(
            ([userId, stored]) =>
              `${userId}: stored ${stored}, replay ${replayPrizeByUser.get(userId) ?? 0}`,
          )
          .join("; "),
      });
      continue;
    }

    reproduced++;
  }

  const examined = competitions.length - skippedNoLeaderboard - skippedNoParticipants;

  console.log("Replay report");
  console.log(`  competitions read        ${competitions.length}`);
  console.log(`  skipped, no leaderboard  ${skippedNoLeaderboard}`);
  console.log(`  skipped, no participants ${skippedNoParticipants}`);
  console.log(`  examined                 ${examined}`);
  console.log(`  reproduced exactly       ${reproduced}`);
  console.log(`  mismatched               ${mismatches.length}\n`);

  for (const m of mismatches.slice(0, 20)) {
    console.log(`  [${m.reason}] ${m.name} (${m.competitionId})`);
    console.log(`         ${m.detail}`);
  }
  if (mismatches.length > 20) {
    console.log(`  ... and ${mismatches.length - 20} more`);
  }

  if (jsonPath) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      jsonPath,
      `${JSON.stringify({ examined, reproduced, mismatches }, null, 2)}\n`,
      "utf8",
    );
    console.log(`\n📄 Full report written to ${jsonPath}`);
  }

  console.log(
    "\nCompare this against the run from before the extraction. A competition that reproduced then and does not now is a regression.",
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("❌ Replay failed:", error);
  process.exit(1);
});
