/**
 * Report-only: compare legacy trading leaderboard top 100 vs UserGameStats Overall.
 * Usage: npx tsx tools/games/diff-leaderboard-top100.ts
 *
 * R14 — run before switching the default tab off "Trading (current)".
 */

import { connectToDatabase } from "@/database/mongoose";
import { diffTop100WithLegacy } from "@/lib/services/games/game-leaderboard.service";

async function main() {
  await connectToDatabase();
  const diff = await diffTop100WithLegacy(100);
  console.log(
    JSON.stringify(
      {
        identical: diff.identical,
        sharedInOrderPrefix: diff.sharedInOrder,
        legacyCount: diff.legacyTop.length,
        statsCount: diff.statsTop.length,
        onlyInLegacyCount: diff.onlyInLegacy.length,
        onlyInStatsCount: diff.onlyInStats.length,
        legacyTop10: diff.legacyTop.slice(0, 10),
        statsTop10: diff.statsTop.slice(0, 10),
      },
      null,
      2,
    ),
  );
  process.exit(diff.identical ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
