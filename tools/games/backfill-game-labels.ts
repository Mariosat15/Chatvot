/**
 * X1 step 7: stamp the game label on everything written before X1.
 *
 * Covers backfills 1 and 3 from `External game plans/18` section 1:
 *
 *   1. `gameType` / `gameKey` = "trading" on contests and participants
 *   3. `gameTypes` = ["trading"] on badge configs
 *
 * WHY THIS IS NOT URGENT, AND WHY IT STILL MATTERS. Nothing is broken while it is
 * pending: `resolveGameType()` reads a missing label as trading (invariant 5), so every
 * unlabelled contest settles and ranks correctly today. What breaks is later and quieter.
 * The moment an aggregate GROUPS BY `gameKey` - the cross-game leaderboards in X7 - an
 * unlabelled row silently drops out of its own total. No error, no empty state, a page
 * that still renders. And `gameKey` is immutable once written, so the fix is this script
 * or nothing.
 *
 * The second reason is `.lean()`. Mongoose applies schema defaults when it hydrates a
 * document, so an ordinary read of an old contest sees "trading" even with no stored
 * value - but `.lean()` skips hydration entirely and returns the raw document, missing
 * key and all. Much of this codebase reads with `.lean()` for speed. So the default is
 * not a substitute for the stored value; it only looks like one from the wrong read.
 *
 * SAFETY
 * ------
 * Reports by default and writes nothing. Every write is filtered to documents that have
 * no usable label, so it NEVER overwrites one that exists - `gameKey` is immutable and a
 * script that can rewrite it is a script that can destroy the join key for all historical
 * stats. Re-running after a successful pass matches nothing and reports zero.
 *
 * Usage
 * -----
 *   Report only - changes nothing. ALWAYS run this first:
 *     npx tsx tools/games/backfill-game-labels.ts
 *
 *   Apply:
 *     npx tsx tools/games/backfill-game-labels.ts --apply
 *
 * NOT DONE HERE, deliberately: backfill 2, `score` on participants. Chapter 18 says to
 * skip completed contests because their `finalLeaderboard` is stored and authoritative.
 * The same reasoning now extends to active ones: trading ranks on its own metrics and
 * never reads `score`, and seam 2 - the thing that would keep `score` current during play
 * - is not built. Writing it now produces a number nothing maintains and nothing reads,
 * which goes stale immediately while looking authoritative. It belongs with seam 2.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import mongoose from "mongoose";
import { TRADING_GAME_TYPE } from "../../lib/games/types";
import { TARGETS, processTarget, countRemaining } from "./backfill-game-labels-core";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Nothing was changed.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(
    `\n📊 Game label backfill - ${apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"}\n`,
  );

  let totalNeeding = 0;
  let totalUpdated = 0;

  for (const target of TARGETS) {
    const results = await processTarget(target, apply);
    const needing = results.reduce((sum, r) => sum + r.needing, 0);

    if (needing === 0) {
      console.log(`✅ ${target.label}: already labelled`);
      continue;
    }

    console.log(`📌 ${target.label}:`);
    for (const r of results) {
      if (r.needing === 0) continue;
      totalNeeding += r.needing;
      totalUpdated += r.updated;
      console.log(
        apply
          ? `     ${r.field}: ${r.updated} of ${r.needing} updated`
          : `     ${r.field}: ${r.needing} would be set to "${TRADING_GAME_TYPE}"`,
      );
    }
  }

  console.log("");
  if (!apply) {
    console.log(
      totalNeeding === 0
        ? "✅ Nothing to do. Every document already carries a label."
        : `➡️  ${totalNeeding} field value(s) would be written. Re-run with --apply to write them.`,
    );
  } else {
    console.log(`✅ ${totalUpdated} field value(s) written.`);
    // Reason: verify by re-counting rather than trusting modifiedCount. A write that a
    // concurrent process partially undid, or a filter that did not match what it counted,
    // shows up here and nowhere else.
    const remaining = await countRemaining();
    console.log(
      remaining === 0
        ? "✅ Verified: no unlabelled documents remain."
        : `⚠️  ${remaining} field value(s) still unlabelled. Re-run, and investigate if the number does not fall.`,
    );
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  // Reason: a server-selection failure is almost always the Atlas IP allowlist, not a bug,
  // and its raw form is a topology dump that buries that. The replay script hit exactly
  // this and cost a debugging detour. Say it plainly and keep the full error underneath.
  const isConnectionFailure =
    error instanceof Error &&
    /ServerSelection|ReplicaSetNoPrimary|ENOTFOUND|ETIMEDOUT/i.test(
      `${error.name}${error.message}`,
    );

  if (isConnectionFailure) {
    console.error(
      "\n❌ Could not reach MongoDB. Nothing was read and nothing was written.\n" +
        "   The usual cause is this machine's IP not being on the Atlas allowlist.\n" +
        "   Run it from the server, or add your IP in Atlas > Network Access.\n",
    );
  }

  console.error("❌ Backfill failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
