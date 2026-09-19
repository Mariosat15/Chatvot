import { describe, it, expect } from "vitest";
import {
  humanizeMetricKey,
  formatMetricValue,
} from "@/lib/utils/humanize-metric";

/**
 * The provider score breakdown was rendered to players with its raw JSON keys - "penaltyMs
 * 2400" - and the defence in the component was that a label table would break the platform's
 * "no additional coding" property. That defence was right, which is why the fix is a generic
 * transform rather than a dictionary.
 *
 * These tests exist mainly to pin the NEGATIVE property: that nothing here knows any game's
 * field names. A future contributor asked to make one title read better will reach for a
 * lookup table, and the test at the bottom is what should stop them.
 */
describe("humanizeMetricKey", () => {
  it("splits camelCase into a sentence-cased label", () => {
    expect(humanizeMetricKey("boardsCompleted")).toBe("Boards completed");
    expect(humanizeMetricKey("longestStreak")).toBe("Longest streak");
  });

  it("strips a unit suffix from the label, because the value carries the unit", () => {
    // "Penalty ms 2400" reads worse than what it replaced. The suffix moves to the value.
    expect(humanizeMetricKey("penaltyMs")).toBe("Penalty");
    expect(humanizeMetricKey("solveSeconds")).toBe("Solve");
    expect(humanizeMetricKey("accuracyPercent")).toBe("Accuracy");
  });

  it("separates digit runs into their own word", () => {
    expect(humanizeMetricKey("level3Bonus")).toBe("Level 3 bonus");
  });

  it("breaks a run of capitals before the following word", () => {
    // Sentence case flattens the acronym, which is the accepted cost of not knowing which
    // capital runs are acronyms and which are just an enthusiastic provider.
    expect(humanizeMetricKey("HTTPRequests")).toBe("Http requests");
  });

  it("handles snake_case and kebab-case, in case a provider sends either", () => {
    expect(humanizeMetricKey("boards_completed")).toBe("Boards completed");
    expect(humanizeMetricKey("boards-completed")).toBe("Boards completed");
  });

  it("returns the key unchanged rather than an empty label when it cannot split it", () => {
    /*
      The failure mode being avoided: a key of "Ms" is shorter than the suffix rule expects, and
      a naive slice leaves an empty string. An empty label is worse than an ugly one, because
      the player sees a value floating beside nothing while the page looks intentional.
    */
    expect(humanizeMetricKey("Ms")).toBe("Ms");
    expect(humanizeMetricKey("")).toBe("");
  });
});

describe("formatMetricValue", () => {
  it("converts milliseconds to seconds only once there is a second to show", () => {
    expect(formatMetricValue("penaltyMs", 2400)).toBe("2.40s");
    // Reason: rendering 40ms as "0.04s" throws away the precision that made it worth sending.
    expect(formatMetricValue("penaltyMs", 40)).toBe("40ms");
  });

  it("keeps integers integral and fractions to two places", () => {
    expect(formatMetricValue("boardsCompleted", 7)).toBe("7");
    expect(formatMetricValue("averageMoves", 12.3456)).toBe("12.35");
  });

  it("renders a genuine zero as 0, never as a dash", () => {
    // The read-side form of the `Number.isFinite` eligibility rule: a zero is a real result and
    // must not be presented as an absence.
    expect(formatMetricValue("boardsCompleted", 0)).toBe("0");
  });

  it("renders an absent value as a dash, matching every other absent figure on the player surface", () => {
    expect(formatMetricValue("boardsCompleted", null)).toBe("-");
    expect(formatMetricValue("boardsCompleted", undefined)).toBe("-");
  });

  it("renders booleans as Yes/No rather than true/false", () => {
    expect(formatMetricValue("perfectRun", true)).toBe("Yes");
    expect(formatMetricValue("perfectRun", false)).toBe("No");
  });

  it("stringifies a nested object rather than dropping it", () => {
    // Dropping it would make a delivered payload look like an empty one, which is the harder
    // thing to debug of the two.
    expect(formatMetricValue("stages", { a: 1 })).toBe('{"a":1}');
  });

  it("passes a non-finite number through instead of formatting it", () => {
    expect(formatMetricValue("score", NaN)).toBe("NaN");
    expect(formatMetricValue("score", Infinity)).toBe("Infinity");
  });
});

describe("the no-additional-coding property", () => {
  it("contains no game, provider or title identifier anywhere in the module", async () => {
    /*
      THE LOAD-BEARING TEST, and the reason the other two describes are worth having. A lookup
      table keyed on a metric name would satisfy every assertion above while quietly making a
      new title's breakdown render blank labels until somebody adds an entry.

      Structural rather than behavioural because no output can distinguish the two designs: a
      table containing exactly the right entries for today's titles produces identical results.
      Comments are stripped first - this file discusses the anti-pattern in prose, and a test
      that reads prose fails on a correct file for explaining the mistake.
    */
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("../../lib/utils/humanize-metric.ts", import.meta.url),
      "utf8",
    );

    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    for (const forbidden of [
      "gameCode",
      "gameKey",
      "providerKey",
      "circuit",
      "sprint",
      "trading",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
