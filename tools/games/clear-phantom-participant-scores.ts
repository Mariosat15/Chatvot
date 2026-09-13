/**
 * R50: remove the phantom `score: 0` from provider participants who never produced a result.
 *
 * WHY A MIGRATION IS NEEDED AT ALL, when the schema default and the seat builder are both
 * fixed. **A schema default fixes FUTURE rows only.** Mongoose has already persisted a real
 * `0` into every seat ever written, and a stored nought is indistinguishable from a player who
 * attempted the game and genuinely scored nothing - which is the distinction
 * `providerHasResult` decides prize eligibility on. So an open provider contest seated before
 * this fix would still settle the old way: every entrant eligible, and a player who never
 * launched a round ranked and paid for the position they landed in.
 *
 * Same shape as `canEnterChallenges`, where flipping the default fixed ten writers with one
 * line and the migration was still not optional.
 *
 * WHAT IT REFUSES TO TOUCH is the more important half, and it is pinned by tests in
 * `__tests__/services/phantom-score-cleanup.test.ts` rather than asserted here: trading
 * participants, anybody holding a contributing round, any score that is not exactly zero,
 * settled contests, and seats mislabelled `trading` on a provider contest. The decision logic
 * lives in `clear-phantom-scores-core.ts` so a test can drive it against a real database.
 *
 * The residual case it accepts deliberately: a player who played, scored a genuine 0, and
 * whose round is in a non-contributing state. Nothing can tell them from a never-played seat,
 * because the default destroyed the evidence - that IS the defect. Every such round is
 * `voided`, `unresolved` or still live, none of which counts towards a score, so both readings
 * produce the same outcome.
 *
 * NOT YET RUN ANYWHERE. Report-only until `--apply`.
 *
 * Usage
 * -----
 *   Report only - changes nothing. ALWAYS run this first:
 *     npx tsx tools/games/clear-phantom-participant-scores.ts
 *
 *   Apply:
 *     npx tsx tools/games/clear-phantom-participant-scores.ts --apply
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { clearPhantomScores } from "./clear-phantom-scores-core";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Nothing was changed.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(
    `\n📊 R50 phantom score cleanup - ${
      apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"
    }\n`,
  );

  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connect.");

  const outcome = await clearPhantomScores(db, { apply });

  if (outcome.contests.length === 0) {
    console.log("No open provider contests. Nothing to examine.\n");
    await mongoose.disconnect();
    return;
  }

  for (const contest of outcome.contests) {
    console.log(
      `  ${contest.name} (${contest.status}): ${contest.clearable} seat(s) hold a phantom zero`,
    );
    if (contest.mislabelled > 0) {
      console.log(
        `  ⚠️  ${contest.name}: ${contest.mislabelled} seat(s) labelled "trading" on a provider contest. Left alone - see R7.`,
      );
    }
  }

  console.log(
    `\n${
      apply
        ? `✅ Cleared ${outcome.totalCleared} of ${outcome.totalClearable}`
        : `📋 ${outcome.totalClearable} seat(s) would be cleared`
    }\n`,
  );

  if (!apply && outcome.totalClearable > 0) {
    console.log("Re-run with --apply to write the change.\n");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("❌ Cleanup failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
