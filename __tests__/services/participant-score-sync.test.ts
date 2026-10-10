import { describe, expect, it } from "vitest";
import { combineRoundScores } from "../../lib/services/games/participant-score.service";

/**
 * The seam that carries a provider round's score up to the contest participant.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS THE TEST THAT WAS MISSING.
 * `provider-settlement.service.ts` asserted in a comment that ingestion writes
 * `participant.score`. Nothing did. Every provider participant would have settled on the seat
 * default of **zero**, tied at rank 1, and split the prize pool equally regardless of how well
 * they played - real money, and in production it reads as a prize-distribution bug rather than
 * as a missing score.
 *
 * The settlement tests could not catch it, and the reason generalises: **they seed the scores
 * they rank** (900 / 500 / 100). That proves ranking works *given* scores. It cannot prove a
 * score ever arrives. The same trap was already recorded for trading finalization, where
 * seeding `pnl` on a participant did nothing because finalization recomputes it - so this is
 * the second instance, and the rule is: **a fixture that supplies the value under test has
 * tested the consumer, not the producer.**
 *
 * These tests cover the ARITHMETIC, which is where the silent mistakes live. The database half
 * - reading the contest's policy, refusing when it is absent, and `$set` on the participant -
 * is exercised by `provider-round-launch.test.ts` and the settlement suites against a real
 * MongoDB.
 */

describe("combining a player's round scores into the number ranking reads", () => {
  it("sums every attempt under sum_of_n", () => {
    expect(combineRoundScores([100, 250, 40], "sum_of_n", "higher_is_better")).toBe(390);
  });

  it("takes the highest attempt under best_of_n when higher is better", () => {
    expect(combineRoundScores([100, 250, 40], "best_of_n", "higher_is_better")).toBe(250);
  });

  it("takes the LOWEST attempt under best_of_n when lower is better", () => {
    // The one that matters most, and the one an unconditional Math.max gets exactly backwards.
    // A race time or a golf score ranks ascending, so "best of three" is the fastest run - and
    // picking the maximum would rank a time trial by who was slowest. Not a crash, not a
    // logged error: a leaderboard that is upside down and pays the worst player first.
    expect(combineRoundScores([12_400, 9_800, 15_000], "best_of_n", "lower_is_better")).toBe(
      9_800,
    );
  });

  it("does not sum in the wrong direction - sum_of_n ignores direction", () => {
    // Deliberate: a total is a total. Direction decides how totals are COMPARED, which is the
    // ranking engine's job, not this function's. Applying direction here would mean the same
    // rounds produced different totals for two games, which no screen could explain.
    expect(combineRoundScores([10, 20], "sum_of_n", "lower_is_better")).toBe(30);
  });

  it("scores zero when no round completed, rather than returning NaN", () => {
    // Math.max() of an empty array is -Infinity and Math.min() is Infinity. Either would be
    // stored on a required Number path and then poison every comparison and every currency
    // format downstream - the same shape as the NaN tie payout found during the extraction.
    expect(combineRoundScores([], "best_of_n", "higher_is_better")).toBe(0);
    expect(combineRoundScores([], "best_of_n", "lower_is_better")).toBe(0);
    expect(combineRoundScores([], "sum_of_n", "higher_is_better")).toBe(0);
    expect(combineRoundScores([], "single", "higher_is_better")).toBe(0);
  });

  it("discards a non-finite score instead of propagating it", () => {
    // A provider reporting a null or a string that parsed to NaN must not silently zero a
    // player who has a real score from another attempt.
    expect(combineRoundScores([NaN, 500], "best_of_n", "higher_is_better")).toBe(500);
    expect(combineRoundScores([Infinity, 500], "sum_of_n", "higher_is_better")).toBe(500);
  });

  it("keeps a legitimate zero, because 0 is a score and not an absence", () => {
    // The R31 lesson in a different file: a truthy filter here would drop a genuine zero and
    // then report the player as having no score at all.
    expect(combineRoundScores([0], "single", "higher_is_better")).toBe(0);
    expect(combineRoundScores([0, 0], "sum_of_n", "higher_is_better")).toBe(0);
    expect(combineRoundScores([0, 30], "best_of_n", "lower_is_better")).toBe(0);
  });

  it("handles a negative score, which a golf-style game reports", () => {
    expect(combineRoundScores([-4, -1], "best_of_n", "lower_is_better")).toBe(-4);
    expect(combineRoundScores([-4, -1], "best_of_n", "higher_is_better")).toBe(-1);
  });

  it("takes the best of several rows under single, rather than the first found", () => {
    // `single` means one attempt, but a voided-and-replayed round or a policy changed after
    // the fact can leave two completed rows. Taking the better one cannot disadvantage a
    // player for our own bookkeeping; taking `[0]` would depend on query order.
    expect(combineRoundScores([300, 700], "single", "higher_is_better")).toBe(700);
    expect(combineRoundScores([300, 700], "single", "lower_is_better")).toBe(300);
  });
});
