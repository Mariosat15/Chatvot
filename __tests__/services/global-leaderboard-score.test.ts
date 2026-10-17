/**
 * The Global leaderboard — the seven components, their weights, and the two
 * properties the owner asked for on 16 September 2026:
 *
 *  1. Every published percentage is the percentage the arithmetic uses.
 *  2. A player is never penalised for something they do not do — the share of
 *     a component they take no part in is spread across the ones they do, so a
 *     games-only player can reach #1.
 *
 * Reason for the structural half: the weights travel from the database, through
 * the score module, the board service, the API and into the player's
 * explanation. A hard-coded percentage anywhere on that path is a screen that
 * keeps describing the old split after an operator changes it, with no error
 * and nothing in a log.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildComponentMap,
  computeGlobalScores,
  DEFAULT_GLOBAL_WEIGHTS,
  GLOBAL_SCORE_COMPONENTS,
  GLOBAL_SCORE_COMPONENT_IDS,
  GLOBAL_WEIGHT_TOTAL,
  GlobalScoreComponentId,
  GlobalScoreRow,
  normaliseGlobalWeights,
  positionsByRank,
  weightsForDisplay,
} from "@/lib/services/leaderboard/global-score";

const ROOT = process.cwd();

/** Source with comments removed — these files discuss the anti-patterns. */
function readCode(relative: string): string {
  const raw = fs.readFileSync(path.join(ROOT, relative), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function row(
  userId: string,
  entries: Partial<Record<GlobalScoreComponentId, [number, boolean]>>,
): GlobalScoreRow {
  const pairs = GLOBAL_SCORE_COMPONENTS.map((component) => {
    const found = Object.entries(entries).find(([key]) => key === component.id);
    const [value, participates] = (found?.[1] as [number, boolean]) ?? [0, false];
    return [component.id, { value, participates }] as [
      GlobalScoreComponentId,
      { value: number; participates: boolean },
    ];
  });
  return { userId, components: buildComponentMap(pairs) };
}

describe("global leaderboard — the weights", () => {
  it("ships the owner-approved split and it adds up to 100", () => {
    // Reason: the RAW defaults are asserted as well as the published ones. The
    // display path rescales, so a default moved off its agreed value can come
    // back out at the agreed percentage and the published list still sums to
    // 100 — a probe moving trading from 25 to 40 stayed green on that alone.
    const raw = new Map(
      GLOBAL_SCORE_COMPONENTS.map((c) => [c.id, c.defaultWeight] as const),
    );
    expect(raw.get("trading")).toBe(25);
    expect(raw.get("games")).toBe(25);
    expect([...raw.values()].reduce((sum, w) => sum + w, 0)).toBe(
      GLOBAL_WEIGHT_TOTAL,
    );

    const shown = weightsForDisplay(DEFAULT_GLOBAL_WEIGHTS);
    const asPercent = new Map(shown.map((w) => [w.id, w.percent]));

    expect(asPercent.get("trading")).toBe(25);
    expect(asPercent.get("games")).toBe(25);
    expect(asPercent.get("competitions")).toBe(15);
    expect(asPercent.get("challenges")).toBe(10);
    expect(asPercent.get("level")).toBe(10);
    expect(asPercent.get("badges")).toBe(8);
    expect(asPercent.get("milestones")).toBe(7);

    expect(shown.reduce((sum, w) => sum + w.percent, 0)).toBe(GLOBAL_WEIGHT_TOTAL);
  });

  it("publishes every component, so none can be silently dropped", () => {
    expect(weightsForDisplay(DEFAULT_GLOBAL_WEIGHTS).map((w) => w.id)).toEqual([
      ...GLOBAL_SCORE_COMPONENT_IDS,
    ]);

    // Reason: the interesting case is a component an operator has turned OFF.
    // Filtering a zero row out leaves a list that still adds to 100 and still
    // reads correctly, while the player is never told that part stopped
    // counting. The defaults are all above zero, so they cannot catch it.
    const withZeros = weightsForDisplay(
      normaliseGlobalWeights({ trading: 2, games: 1 }),
    );
    expect(withZeros.map((w) => w.id)).toEqual([...GLOBAL_SCORE_COMPONENT_IDS]);
    expect(withZeros.find((w) => w.id === "badges")?.percent).toBe(0);
  });

  it("rescales an operator's numbers rather than refusing them", () => {
    // 2 and 1 must mean the same as 66 and 33.
    const scaled = normaliseGlobalWeights({ trading: 2, games: 1 });
    const total = GLOBAL_SCORE_COMPONENTS.reduce(
      (sum, c) => sum + (weightsForDisplay(scaled).find((w) => w.id === c.id)?.percent ?? 0),
      0,
    );
    expect(total).toBe(GLOBAL_WEIGHT_TOTAL);

    const shown = new Map(weightsForDisplay(scaled).map((w) => [w.id, w.percent]));
    expect(shown.get("trading")).toBe(67);
    expect(shown.get("games")).toBe(33);
    expect(shown.get("badges")).toBe(0);
  });

  it("rounding drift never leaves the published list short of 100", () => {
    // Three equal shares cannot be written as whole percentages that add to 100.
    const shown = weightsForDisplay(
      normaliseGlobalWeights({ trading: 1, games: 1, badges: 1 }),
    );
    expect(shown.reduce((sum, w) => sum + w.percent, 0)).toBe(GLOBAL_WEIGHT_TOTAL);
  });

  it("falls back to the defaults for a set that says nothing", () => {
    // Reason: `parseFloat` on an empty admin field gives NaN, and a NaN weight
    // makes every derived score NaN while nothing checks (R31).
    expect(normaliseGlobalWeights({})).toEqual(DEFAULT_GLOBAL_WEIGHTS);
    expect(normaliseGlobalWeights(null)).toEqual(DEFAULT_GLOBAL_WEIGHTS);
    expect(normaliseGlobalWeights({ trading: Number.NaN })).toEqual(DEFAULT_GLOBAL_WEIGHTS);
    expect(normaliseGlobalWeights({ trading: 0, games: 0 })).toEqual(DEFAULT_GLOBAL_WEIGHTS);
  });

  it("reads a negative share as zero rather than as a penalty", () => {
    const shown = new Map(
      weightsForDisplay(normaliseGlobalWeights({ trading: -50, games: 10 })).map((w) => [
        w.id,
        w.percent,
      ]),
    );
    expect(shown.get("trading")).toBe(0);
    expect(shown.get("games")).toBe(100);
  });
});

describe("global leaderboard — positions", () => {
  it("ties share the better position", () => {
    expect(positionsByRank([10, 10, 5])).toEqual([100, 100, (1 / 3) * 100]);
  });

  it("the last participant still scores above never taking part", () => {
    // Reason: a floor of zero would make entering and finishing last worse than
    // never entering, which is the incentive redistribution exists to avoid.
    const positions = positionsByRank([9, 8, 7, 6]);
    expect(positions.at(-1)).toBeGreaterThan(0);
    expect(positions.at(0)).toBe(100);
  });

  it("an empty field produces no positions", () => {
    expect(positionsByRank([])).toEqual([]);
  });
});

describe("global leaderboard — scoring", () => {
  it("a games-only player can finish above a trading-only player", () => {
    // The whole point of redistribution. Both are best at what they do; the
    // games-only player must not be capped by the 25% they cannot earn.
    const trader = row("trader", {
      trading: [1000, true],
      competitions: [5, true],
      level: [5, true],
      badges: [5, true],
      milestones: [5, true],
    });
    const gamer = row("gamer", {
      games: [1000, true],
      challenges: [5, true],
      level: [9, true],
      badges: [9, true],
      milestones: [9, true],
    });

    const scored = computeGlobalScores([trader, gamer]);
    const byUser = new Map(scored.map((s) => [s.userId, s]));
    expect(byUser.get("gamer")!.score).toBeGreaterThan(byUser.get("trader")!.score);
  });

  it("the applied weights of a partial player still add up to 100", () => {
    const gamer = row("gamer", {
      games: [10, true],
      level: [1, true],
      badges: [0, true],
      milestones: [0, true],
    });
    const [scored] = computeGlobalScores([gamer]);

    const applied = scored.breakdown
      .filter((b) => b.participates)
      .reduce((sum, b) => sum + b.appliedWeight, 0);
    expect(applied).toBeCloseTo(GLOBAL_WEIGHT_TOTAL, 6);

    // And the components they take no part in contribute exactly nothing —
    // they are not scored zero against the field, they are absent.
    for (const part of scored.breakdown.filter((b) => !b.participates)) {
      expect(part.appliedWeight).toBe(0);
      expect(part.contribution).toBe(0);
    }
  });

  it("taking part with a zero is not the same fact as not taking part", () => {
    // `participates` is deliberately NOT derived from the value: zero wins and
    // never having entered are different, and only the second is redistributed.
    const zeroWins = row("a", { competitions: [0, true], level: [1, true] });
    const neverEntered = row("b", { competitions: [0, false], level: [1, true] });

    const scored = computeGlobalScores([zeroWins, neverEntered]);
    const byUser = new Map(scored.map((s) => [s.userId, s]));

    const aComp = byUser.get("a")!.breakdown.find((b) => b.id === "competitions")!;
    const bComp = byUser.get("b")!.breakdown.find((b) => b.id === "competitions")!;
    expect(aComp.appliedWeight).toBeGreaterThan(0);
    expect(bComp.appliedWeight).toBe(0);
  });

  it("a player who takes part in nothing is unranked rather than last", () => {
    const [scored] = computeGlobalScores([row("ghost", {})]);
    expect(scored.ranked).toBe(false);
    expect(scored.score).toBe(0);
  });

  it("an operator's weights change the order, not just the caption", () => {
    const tradingStrong = row("t", { trading: [100, true], games: [1, true] });
    const gamesStrong = row("g", { trading: [1, true], games: [100, true] });

    const tradingHeavy = normaliseGlobalWeights({ trading: 90, games: 10 });
    const gamesHeavy = normaliseGlobalWeights({ trading: 10, games: 90 });

    const first = new Map(
      computeGlobalScores([tradingStrong, gamesStrong], tradingHeavy).map((s) => [
        s.userId,
        s.score,
      ]),
    );
    const second = new Map(
      computeGlobalScores([tradingStrong, gamesStrong], gamesHeavy).map((s) => [
        s.userId,
        s.score,
      ]),
    );

    expect(first.get("t")!).toBeGreaterThan(first.get("g")!);
    expect(second.get("g")!).toBeGreaterThan(second.get("t")!);
  });
});

describe("global leaderboard — structural guards", () => {
  it("no component is named after one game", () => {
    // R29 / invariant 9: an aggregate that enumerates games is the one way to
    // lose the property that a new game needs no code.
    const text = GLOBAL_SCORE_COMPONENTS.map((c) => `${c.label} ${c.description}`)
      .join(" ")
      .toLowerCase();
    for (const word of ["circuit", "sprint", "puzzle", "forex", "chess"]) {
      expect(text).not.toContain(word);
    }
  });

  it("the board counts stored game keys and never the enabled set", () => {
    // Reason: summing over currently-enabled games retroactively subtracts
    // everything earned in a game an operator switches off (R29).
    const code = readCode("lib/services/leaderboard/global-board.service.ts");
    expect(code).not.toContain("getEnabledGameTypes");
    expect(code).toMatch(/\$nin:\s*\[OVERALL_GAME_KEY,\s*TRADING_GAME_TYPE\]/);
  });

  it("the player's explanation is built from the weights the server used", () => {
    // The negative half is the load-bearing one: importing the weights is
    // trivially satisfied by a component that then prints its own numbers.
    const explainer = readCode("components/leaderboard/RankingsExplainer.tsx");
    expect(explainer).toMatch(/weights\.map/);
    for (const literal of ["25%", "15%", "10%", "8%", "7%"]) {
      expect(explainer).not.toContain(literal);
    }

    const client = readCode("components/leaderboard/LeaderboardClient.tsx");
    expect(client).toMatch(/setGlobalWeights\(\s*data\.weights/);
  });

  it("the API answers one board at a time from a single producer", () => {
    const route = readCode("app/api/leaderboard/route.ts");
    expect(route).toContain("getGlobalBoard");
    // The route must not assemble a second global answer of its own.
    expect(route).not.toContain("computeGlobalScores");
  });

  it("the admin editor stores normalised weights", () => {
    const route = readCode("apps/admin/app/api/badges-xp/manage/route.ts");
    expect(route).toContain("normaliseGlobalWeights");
    expect(route).toMatch(/configType:\s*"leaderboard_weights"/);
  });

  it("both apps carry the same weights module, character for character", () => {
    // Reason: `check:mirrors` compares MODELS, so it has no opinion about these
    // two files. The main copy was edited alone during this build and the admin
    // copy silently kept the old arithmetic - two apps disagreeing about what a
    // share is worth, with the player's board and the operator's editor on
    // opposite sides of the disagreement.
    const main = fs.readFileSync(
      path.join(ROOT, "lib/services/leaderboard/global-score.ts"),
      "utf8",
    );
    const admin = fs.readFileSync(
      path.join(ROOT, "apps/admin/lib/services/leaderboard/global-score.ts"),
      "utf8",
    );
    expect(admin).toBe(main);

    const mainWeights = fs.readFileSync(
      path.join(ROOT, "lib/services/leaderboard/leaderboard-weights.service.ts"),
      "utf8",
    );
    const adminWeights = fs.readFileSync(
      path.join(
        ROOT,
        "apps/admin/lib/services/leaderboard/leaderboard-weights.service.ts",
      ),
      "utf8",
    );
    expect(adminWeights).toBe(mainWeights);
  });

  it("the weights module stays client-safe", () => {
    // R58: the explainer and the table import it, so a Mongoose model here
    // takes the whole player app down at build time.
    const code = readCode("lib/services/leaderboard/global-score.ts");
    expect(code).not.toContain("use server");
    expect(code).not.toContain("mongoose");
    expect(code).not.toContain("@/database/models");
  });
});
