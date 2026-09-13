/**
 * Freezes the CURRENT trading ranking and prize behaviour into a golden file.
 *
 * X1 extracts the ranking switch and the settle block out of the shared engine and into
 * a trading game module. Chapter 11 section 4 is blunt about the acceptance test: trading
 * must behave identically afterwards, and "do not proceed to X2 until this is green".
 *
 * The ordering is the whole point and it is easy to get backwards. This file must be run
 * BEFORE the extraction, while the original code is still in place. A golden file
 * generated afterwards records whatever the new code happens to do, including its bugs,
 * and the regression test then proves nothing while looking thorough.
 *
 * REGENERATING IS ALLOWED AND IS A DECISION, not a repair. The rule that keeps this file
 * honest: before regenerating, DIFF THE OLD AND NEW PAYOUTS AND EXPLAIN EVERY SCENARIO
 * THAT MOVED, then record the explanation in `revisions` below. A red regression test has
 * two causes that look identical from here - a deliberate change to how money is awarded,
 * and a bug - and running this script silences both. The 9 September 2026 regeneration is
 * the worked example: 4 scenarios changed their split, 0 changed the total paid out, and
 * establishing that second number is what made the first one safe to accept.
 *
 * Run:  npx tsx tools/games/generate-ranking-golden.ts
 *
 * It is deliberately a script and not part of the test run. If the tests regenerated the
 * baseline they would agree with themselves for ever. Regenerating is an explicit act
 * that shows up in review as a changed golden file - which is exactly the diff a reviewer
 * needs to see, because it means someone is changing how money is awarded.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  calculateRankings,
  distributePrizesWithTies,
} from "../../lib/services/competition-ranking.service";
import { buildScenarios } from "../../__tests__/fixtures/ranking-scenarios";
import { runScenario, GOLDEN_PATH } from "./ranking-golden-shared";

function main() {
  const scenarios = buildScenarios();
  const results = scenarios.map((scenario) =>
    runScenario(scenario, calculateRankings, distributePrizesWithTies),
  );

  const golden = {
    description:
      "Frozen output of the trading ranking and prize functions. Regenerate only when award behaviour is deliberately changed, and record the change here.",
    capturedAt: "2026-09-09",
    /*
      HISTORY, because a golden file with no history is indistinguishable from one somebody
      regenerated to make a red test go green. Append to this list; never replace it.
    */
    revisions: [
      {
        capturedAt: "2026-09-04",
        reason:
          "Original capture, taken BEFORE the X1 game-module extraction so the extraction could be proven behaviour-free.",
      },
      {
        capturedAt: "2026-09-09",
        reason:
          "Owner's rule (task document 5 and 6): a vacated prize rank is redistributed PROPORTIONALLY rather than as an equal-share bonus, so the configured prize curve survives an unclaimed position. 4 of 18 scenarios changed - all of them ties, because a tie vacates a rank too (two players tied at rank 1 sends the next to rank 3). THE TOTAL PAID OUT IS IDENTICAL IN ALL 18: only the split between winners moved, and each new split restores the ratio the operator configured. Verified before regenerating rather than after.",
      },
    ],
    scenarioCount: results.length,
    results,
  };

  const outPath = resolve(process.cwd(), GOLDEN_PATH);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`, "utf8");

  console.log(`📊 Wrote ${results.length} scenarios to ${GOLDEN_PATH}`);
}

main();
