/**
 * Scoring tests for the two Circuit titles. Run with `npx tsx tools/test-scoring.ts`.
 *
 * THE TESTS THAT MATTER MOST ARE THE TWO STRATEGY INVARIANTS
 * ---------------------------------------------------------
 * A scoring rule can be arithmetically correct and still reward the wrong behaviour, and that
 * failure produces no error at all - just a contest whose winner did the thing the game was
 * meant to discourage. Two of them apply here and each is pinned:
 *
 *   Sprint  - completing boards must always beat rushing, or the game becomes a gamble about
 *             which board to abandon.
 *   Perfect - finishing everything slowly must beat solving a few quickly and quitting, or
 *             GIVING UP IS THE WINNING STRATEGY in a paid contest.
 *
 * And the one that is easiest to get backwards: for a lower-is-better title, "produced no
 * result" must be the WORST score, not zero. A literal zero would make a player who never
 * loaded the game the winner of every Circuit Perfect contest ever run.
 */

import assert from "node:assert/strict";

import { BoardOutcome, scoreRound, zeroScore } from "../src/games/scoring";
import {
  PERFECT,
  PerfectConfig,
  SPRINT,
  SprintConfig,
  resolveConfig,
} from "../src/games/titles";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n")[0]}`);
  }
}

const SPRINT_CONFIG: SprintConfig = {
  kind: "sprint",
  durationSeconds: 120,
  gridSize: "medium",
};
const PERFECT_CONFIG: PerfectConfig = {
  kind: "perfect",
  boardCount: 5,
  gridSize: "medium",
  unfinishedPenaltyMs: 120_000,
};

const T0 = new Date("2026-09-06T12:00:00.000Z");

/** A board issued `offsetMs` into the round and solved `takenMs` later. Absent = never solved. */
function board(index: number, offsetMs: number, takenMs?: number): BoardOutcome {
  const issuedAt = new Date(T0.getTime() + offsetMs);
  return takenMs === undefined
    ? { index, issuedAt }
    : { index, issuedAt, solvedAt: new Date(issuedAt.getTime() + takenMs) };
}

console.log("\nCircuit Sprint - higher is better");

test("no boards completed scores zero", () => {
  const result = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0)]);
  assert.equal(result.score, 0);
  assert.equal(result.breakdown.boardsCompleted, 0);
});

test("a board solved instantly earns the full speed bonus", () => {
  const result = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0, 0)]);
  assert.equal(result.score, 1200);
  assert.equal(result.breakdown.speedBonus, 200);
});

test("a board solved slowly earns the base points only", () => {
  const result = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0, 45_000)]);
  assert.equal(result.score, 1000);
  assert.equal(result.breakdown.speedBonus, 0);
});

test("the speed bonus scales linearly to zero at thirty seconds", () => {
  const half = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0, 15_000)]);
  assert.equal(half.score, 1100);
});

test("completing boards always beats rushing", () => {
  // THE SPRINT STRATEGY INVARIANT. Two boards solved as slowly as possible must beat one solved
  // instantly, or the optimal play is to abandon boards to chase bonuses.
  const twoSlow = scoreRound(SPRINT, SPRINT_CONFIG, [
    board(0, 0, 60_000),
    board(1, 60_000, 60_000),
  ]);
  const oneInstant = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0, 0)]);
  assert.ok(
    twoSlow.score > oneInstant.score,
    `two slow boards (${twoSlow.score}) must beat one instant board (${oneInstant.score})`,
  );
});

test("duration is the time to the last completed board, not the session length", () => {
  // Reason: every Sprint session lasts the full configured clock, so reporting session length
  // would give the entire field an identical tie-break and make it useless.
  const result = scoreRound(SPRINT, SPRINT_CONFIG, [
    board(0, 0, 10_000),
    board(1, 10_000, 5_000),
    board(2, 15_000), // still open when the clock ran out
  ]);
  assert.equal(result.durationMs, 15_000);
});

test("two equal scores are separated by duration", () => {
  const quick = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0, 30_000)]);
  const slow = scoreRound(SPRINT, SPRINT_CONFIG, [board(0, 0, 90_000)]);
  assert.equal(quick.score, slow.score, "both earn base points only");
  assert.ok(quick.durationMs < slow.durationMs, "but the faster player has a lower duration");
});

test("a produced score never leaves the declared range", () => {
  const many = Array.from({ length: 200 }, (_, i) => board(i, i * 100, 0));
  const result = scoreRound(SPRINT, SPRINT_CONFIG, many);
  assert.ok(result.score <= SPRINT.scoreRange.max, `${result.score}`);
  assert.ok(result.score >= SPRINT.scoreRange.min);
});

test("no result scores zero, which is the worst score for this title", () => {
  const nothing = zeroScore(SPRINT, SPRINT_CONFIG);
  assert.equal(nothing.score, SPRINT.scoreRange.min);
});

console.log("\nCircuit Perfect - lower is better");

test("all boards solved scores the total time", () => {
  const result = scoreRound(PERFECT, PERFECT_CONFIG, [
    board(0, 0, 20_000),
    board(1, 20_000, 25_000),
    board(2, 45_000, 30_000),
    board(3, 75_000, 15_000),
    board(4, 90_000, 10_000),
  ]);
  assert.equal(result.score, 100_000);
  assert.equal(result.breakdown.boardsUnfinished, 0);
});

test("an unfinished board adds the penalty", () => {
  const result = scoreRound(PERFECT, PERFECT_CONFIG, [
    board(0, 0, 20_000),
    board(1, 20_000),
  ]);
  assert.equal(result.score, 20_000 + 120_000);
  assert.equal(result.breakdown.penaltyMs, 120_000);
});

test("finishing everything slowly beats quitting early", () => {
  // THE PERFECT STRATEGY INVARIANT, and the reason the penalty exists at all. Without it a
  // player who solved two boards fast and walked away would have the lowest total time in the
  // contest - so the game would pay people for abandoning it.
  const finishedAllSlowly = scoreRound(PERFECT, PERFECT_CONFIG, [
    board(0, 0, 60_000),
    board(1, 60_000, 60_000),
    board(2, 120_000, 60_000),
    board(3, 180_000, 60_000),
    board(4, 240_000, 60_000),
  ]);
  const quitAfterTwoFast = scoreRound(PERFECT, PERFECT_CONFIG, [
    board(0, 0, 5_000),
    board(1, 5_000, 5_000),
    board(2, 10_000),
    board(3, 10_000),
    board(4, 10_000),
  ]);
  assert.ok(
    finishedAllSlowly.score < quitAfterTwoFast.score,
    `finishing all (${finishedAllSlowly.score}) must beat quitting (${quitAfterTwoFast.score})`,
  );
});

test("no result is the WORST score, not zero", () => {
  // The single easiest thing to get backwards in a lower-is-better game. A literal zero would
  // make a player who never opened the game the winner of every contest, and nothing would
  // throw, log or look wrong.
  const nothing = zeroScore(PERFECT, PERFECT_CONFIG);
  assert.equal(nothing.score, 5 * 120_000);
  assert.ok(nothing.score > 0, "must not be zero");

  const playedBadly = scoreRound(PERFECT, PERFECT_CONFIG, [
    board(0, 0, 90_000),
    board(1, 90_000, 90_000),
    board(2, 180_000),
    board(3, 180_000),
    board(4, 180_000),
  ]);
  assert.ok(
    playedBadly.score < nothing.score,
    `playing badly (${playedBadly.score}) must still beat not playing (${nothing.score})`,
  );
});

test("a score can never be reported below the declared minimum", () => {
  // Reason: a reported zero on a duration would win every contest, so the floor is a safety net
  // against our own arithmetic as much as against a cheat.
  const impossiblyFast = scoreRound(PERFECT, PERFECT_CONFIG, [
    board(0, 0, 0),
    board(1, 0, 0),
    board(2, 0, 0),
    board(3, 0, 0),
    board(4, 0, 0),
  ]);
  assert.equal(impossiblyFast.score, PERFECT.scoreRange.min);
  assert.ok(impossiblyFast.breakdown.clamped !== null, "the clamp must be visible, not silent");
});

test("a score can never be reported above the declared maximum", () => {
  const glacial = Array.from({ length: 10 }, (_, i) => board(i, 0));
  const config: PerfectConfig = { ...PERFECT_CONFIG, boardCount: 10, unfinishedPenaltyMs: 300_000 };
  const result = scoreRound(PERFECT, config, glacial);
  assert.ok(result.score <= PERFECT.scoreRange.max, `${result.score}`);
});

test("the two titles disagree about which end is good", () => {
  // A guard against the two scoring functions being quietly unified later: their "nothing
  // happened" results must sit at OPPOSITE ends, and any refactor that makes them agree has
  // broken one of them.
  assert.equal(SPRINT.scoreDirection, "higher_is_better");
  assert.equal(PERFECT.scoreDirection, "lower_is_better");
  const sprintNothing = zeroScore(SPRINT, SPRINT_CONFIG);
  const perfectNothing = zeroScore(PERFECT, PERFECT_CONFIG);
  assert.equal(sprintNothing.score, SPRINT.scoreRange.min, "worst for higher-is-better is the min");
  assert.ok(perfectNothing.score > PERFECT.scoreRange.min, "worst for lower-is-better is not the min");
});

console.log("\nConfiguration");

test("defaults apply when the platform sends nothing", () => {
  const sprint = resolveConfig(SPRINT, undefined);
  assert.deepEqual(sprint.config, { kind: "sprint", durationSeconds: 120, gridSize: "medium" });
  assert.deepEqual(sprint.corrected, []);
});

test("an out-of-range setting is clamped and reported, not silently accepted", () => {
  // The platform validates against our configSchema before sending, so a value arriving out of
  // range means the two sides disagree about the schema. Playing on is right; hiding it is not.
  const { config, corrected } = resolveConfig(SPRINT, { durationSeconds: 9999 });
  assert.equal((config as SprintConfig).durationSeconds, 300);
  assert.deepEqual(corrected, ["durationSeconds"]);
});

test("an unknown enum value falls back and is reported", () => {
  const { config, corrected } = resolveConfig(SPRINT, { gridSize: "enormous" });
  assert.equal((config as SprintConfig).gridSize, "medium");
  assert.deepEqual(corrected, ["gridSize"]);
});

test("a non-numeric setting does not become NaN", () => {
  // Reason: these values cross a network as JSON. `NaN` propagates silently through every
  // multiplication downstream and nothing checks - the same trap that made a configured 0%
  // referral rate pay 5%.
  const { config } = resolveConfig(PERFECT, {
    boardCount: "five",
    unfinishedPenaltyMs: null,
  });
  const perfect = config as PerfectConfig;
  assert.ok(Number.isFinite(perfect.boardCount), `${perfect.boardCount}`);
  assert.ok(Number.isFinite(perfect.unfinishedPenaltyMs));
  assert.equal(perfect.boardCount, 5);
});

test("scoring refuses a title and config that disagree", () => {
  // Fail closed. Reaching here is our own bug, and a guessed score is a wrong payout nobody can
  // trace, whereas a throw becomes a voided round that returns the player's attempt.
  assert.throws(() => scoreRound(SPRINT, PERFECT_CONFIG, []), /cannot score/);
  assert.throws(() => scoreRound(PERFECT, SPRINT_CONFIG, []), /cannot score/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
