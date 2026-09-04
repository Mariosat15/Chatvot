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
      "Frozen output of the trading ranking and prize functions, captured before the X1 game-module extraction. Regenerate only when award behaviour is deliberately changed.",
    capturedAt: "2026-09-04",
    scenarioCount: results.length,
    results,
  };

  const outPath = resolve(process.cwd(), GOLDEN_PATH);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`, "utf8");

  console.log(`📊 Wrote ${results.length} scenarios to ${GOLDEN_PATH}`);
}

main();
