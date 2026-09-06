import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  calculateRankings,
  distributePrizesWithTies,
} from "@/lib/services/competition-ranking.service";
import { buildScenarios } from "../fixtures/ranking-scenarios";
import {
  runScenario,
  GOLDEN_PATH,
  type ScenarioResult,
} from "../../tools/games/ranking-golden-shared";

/**
 * X1 acceptance gate: trading must rank and pay out IDENTICALLY after the extraction.
 *
 * Chapter 11 section 4: "Recompute a sample of historical completed competitions through
 * the new module path and compare against the stored finalLeaderboard. Identical order,
 * identical values. Do not proceed to X2 until this is green."
 *
 * This is the CI half of that gate. Production data cannot be replayed here, so instead
 * the golden file freezes what the ranking and prize functions do today, across a matrix
 * that exercises every branch which decides money: all six ranking methods, both
 * tiebreak paths, true ties, every disqualification reason, the profit-factor
 * divide-by-zero, the sub-epsilon boundary, unclaimed-position redistribution, and the
 * empty field.
 *
 * WHAT THIS TEST IS FOR. Today it compares the current code against a baseline captured
 * from the current code, so of course it passes - that is not the point and it is worth
 * being explicit, because a reviewer could reasonably call it circular. Its value is
 * entirely in the future: the moment `getRankingValue` moves into `lib/games/trading/`,
 * this is the thing that proves the move changed no outcome. Written after the
 * extraction it would only ever have recorded the new behaviour, bugs included.
 *
 * IF THIS FAILS, the extraction changed who wins or how much they are paid. Do not
 * regenerate the golden file to make it pass. Regenerating is only correct when award
 * behaviour is being changed deliberately, and then the changed golden file is the
 * reviewable evidence of exactly what moved.
 */

interface GoldenFile {
  description: string;
  capturedAt: string;
  scenarioCount: number;
  results: ScenarioResult[];
}

const golden: GoldenFile = JSON.parse(
  readFileSync(resolve(process.cwd(), GOLDEN_PATH), "utf8"),
);

const scenarios = buildScenarios();

describe("trading ranking and payout are unchanged", () => {
  it("the golden file covers every scenario in the matrix", () => {
    // Reason: without this, deleting a scenario would silently shrink the safety net
    // while every remaining test stayed green.
    expect(
      golden.results.length,
      "the golden file and the scenario matrix disagree on how many scenarios exist - regenerate deliberately, or restore the scenario that was removed",
    ).toBe(scenarios.length);
    expect(golden.scenarioCount).toBe(scenarios.length);
  });

  for (const [index, scenario] of scenarios.entries()) {
    it(`produces the recorded outcome for: ${scenario.name}`, () => {
      // Reason: .at() rather than [index] - the security/detect-object-injection rule
      // flags bracket access on a variable, and the pre-commit hook allows no warnings.
      const expected = golden.results.at(index);

      // Reason: a throw rather than expect(...).toBeDefined(), which asserts at runtime
      // but does not narrow the type for the accesses below.
      if (!expected) {
        throw new Error(
          `No baseline recorded for scenario "${scenario.name}" at index ${index}. Regenerate the golden file deliberately if a scenario was appended.`,
        );
      }

      expect(
        expected.name,
        "the scenario matrix has been reordered, so the golden file no longer lines up with it. Scenarios are append-only for this reason",
      ).toBe(scenario.name);

      const actual = runScenario(
        scenario,
        calculateRankings,
        distributePrizesWithTies,
      );

      // Ranks first: a different order means different winners, which is the more
      // serious failure and the one worth reading before any money difference.
      expect(
        actual.rankings,
        `RANKING CHANGED for "${scenario.name}" - the extraction altered who wins`,
      ).toEqual(expected.rankings);

      expect(
        actual.payouts,
        `PAYOUT CHANGED for "${scenario.name}" - the extraction altered how much winners are paid`,
      ).toEqual(expected.payouts);

      expect(actual.totalPaid).toBe(expected.totalPaid);
    });
  }
});

describe("the matrix is actually sensitive to what it claims to test", () => {
  it("the six ranking methods do not all produce the same order", () => {
    // Reason: if every method ranked the field identically, the six method scenarios
    // would still pass with the ranking metric ignored entirely - a matrix that looks
    // thorough and tests nothing.
    const methodOrders = golden.results
      .filter((r) => r.name.startsWith("ranking method:"))
      .map((r) => r.rankings.map((p) => `${p.userId}#${p.rank}`).join(","));

    expect(methodOrders.length).toBe(6);
    expect(
      new Set(methodOrders).size,
      "two or more ranking methods produce an identical order, so those scenarios cannot detect the ranking metric being ignored",
    ).toBeGreaterThan(4);
  });

  it("no scenario pays out more than its prize pool", () => {
    // Reason: an over-distribution is the failure that costs real money, and it would
    // otherwise be frozen into the baseline as though it were correct.
    for (const [index, result] of golden.results.entries()) {
      const pool = scenarios.at(index)?.grossPrizePool ?? 0;
      expect(
        result.totalPaid,
        `"${result.name}" pays ${result.totalPaid} from a pool of ${pool}`,
      ).toBeLessThanOrEqual(pool + 0.01);
    }
  });

  it("no scenario pays a negative prize", () => {
    // Reason: this is not hypothetical. Building the matrix passed the platform fee as
    // a percentage rather than a fraction and every fee-bearing scenario went negative,
    // because distributePrizesWithTies computes `1 - platformFeePercentage`.
    for (const result of golden.results) {
      for (const payout of result.payouts) {
        expect(
          payout.prizeAmount,
          `"${result.name}" pays ${payout.userId} a negative prize - the platform fee was almost certainly passed as a percentage instead of a fraction`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
