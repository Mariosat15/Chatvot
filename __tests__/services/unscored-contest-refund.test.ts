import { describe, it, expect } from "vitest";
import { isUnscoredContest } from "@/lib/services/settlement/unscored-refund";

/**
 * The owner's answer to open question 17: a contest that finishes with nobody having scored
 * can return the entry fees less the platform fee, instead of routing the pot to the unclaimed
 * pool.
 *
 * WHAT THESE TESTS ARE ACTUALLY GUARDING, because the refund arithmetic is the easy half. The
 * hard half is *which contests qualify*, and it has to separate two things that R45 had
 * deliberately made look identical: a player with no result, and a player who broke a rule.
 * Both are `qualificationStatus: "disqualified"` with a human sentence in
 * `disqualificationReason`, so anything keying on that field would decide who gets paid back
 * by matching on prose.
 *
 * `isUnscoredContest` asks the game module instead. These tests pin the three consequences
 * that fall out of that choice, and each one is a defect if it inverts.
 */
/**
 * The two engine-required fields neither `hasResult` nor this helper reads.
 *
 * Spelled out once rather than inlined per fixture, and NOT dropped from the parameter type to
 * avoid them: `hasResult` is declared against the ranking engine''s participant, so a narrower
 * local shape would need a cast at the real call site - which is the one place a genuinely
 * missing field must not be hidden.
 */
const base = { status: "active", enteredAt: new Date("2026-09-07T12:00:00Z") };

describe("isUnscoredContest - which contests owe a refund", () => {
  it("says yes when a provider contest completed with no score from anybody", () => {
    expect(
      isUnscoredContest(
        [{ userId: "a", ...base }, { userId: "b", ...base }, { userId: "c", ...base }],
        "provider",
      ),
    ).toBe(true);
  });

  it("says no when even ONE player scored", () => {
    /*
      The all-or-nothing case is the only one the owner asked for, and the reason is money: a
      single real score means the pot was distributed among whoever placed, with the unfilled
      ranks redistributed upward. Refunding on top of that would pay the pool out twice.
    */
    expect(
      isUnscoredContest(
        [{ userId: "a", score: 40, ...base }, { userId: "b", ...base }, { userId: "c", ...base }],
        "provider",
      ),
    ).toBe(false);
  });

  it("counts a genuine ZERO score as a score, so no refund is owed", () => {
    // Reason: `hasResult` is `Number.isFinite(score)`, deliberately not truthiness. A player
    // who scored nothing still played, and refunding them would be refunding a loss.
    expect(
      isUnscoredContest(
        [{ userId: "a", score: 0, ...base }, { userId: "b", score: 0, ...base }],
        "provider",
      ),
    ).toBe(false);
  });

  it("treats null and NaN as no result, matching the ranking engine's own eligibility rule", () => {
    /*
      `null` is cast in deliberately. The type says `number | undefined`, but the value comes
      from a `.lean()` read of a document whose `score` was never set, and Mongoose will hand
      back a stored `null` quite happily - so the type is a description of intent, not a
      guarantee about the bytes. `hasResult` uses `Number.isFinite`, which rejects `null`,
      `undefined` and `NaN` alike; a `!= null` check would have admitted `NaN`, and the
      comparator then places a `NaN` score arbitrarily and pays whoever it lands on.
    */
    expect(
      isUnscoredContest(
        [
          { userId: "a", score: null as unknown as number, ...base },
          { userId: "b", score: NaN, ...base },
        ],
        "provider",
      ),
    ).toBe(true);
  });

  it("NEVER fires for a trading contest, and does so without a game-type branch", () => {
    /*
      THE LOAD-BEARING TEST. Trading's module answers `hasResult` true unconditionally,
      because a flat account is a real result - so a trading contest cannot reach the refund
      however the policy field is set. That is what makes this behaviour provider-only by
      construction rather than by an `if (gameType === "provider")`, which is the trap every
      trading-shaped service in this codebase fell into.

      No score is passed at all here, which is the strongest form of the claim: even with
      nothing to read, trading says its players have results.
    */
    expect(
      isUnscoredContest([{ userId: "a", ...base }, { userId: "b", ...base }], "trading"),
    ).toBe(false);

    // And with an ABSENT label, because invariant 5 resolves that to trading. A contest the
    // game-label backfill never reached must not become refundable by omission.
    expect(isUnscoredContest([{ userId: "a", ...base }], undefined)).toBe(false);
  });

  it("refuses to refund when handed a gameKEY instead of a gameTYPE", () => {
    /*
      A REGRESSION TEST FOR A DEFECT WRITTEN AND CAUGHT DURING THIS SLICE, kept because the
      mistake is the natural one to make: the contest carries both fields, `gameKey` is the
      one nearly every other call site wants, and it is the more specific of the two so it
      looks like the safer argument.

      It is not. One module serves every provider title, so the registry keys on the TYPE.
      Given a key it resolves nothing - and the first version of this code then called
      `hasResult` on `undefined`. Had it instead defaulted to trading, or answered `true`, the
      failure would have been silent in one of the two worst possible ways: either no contest
      is ever refunded, or every one is.

      Now it fails closed and says so, which is the direction that keeps the money recoverable.
    */
    expect(
      isUnscoredContest(
        [{ userId: "a", ...base }, { userId: "b", ...base }],
        "provider:mock:circuit-sprint",
      ),
    ).toBe(false);
  });

  it("says no for a contest with no participants at all", () => {
    /*
      An empty contest has nobody to refund and no fee to return, and `fees.service.ts`
      already reports that case as `no_participants`. Answering true here would make the log
      claim a refund policy was applied to a contest that never had a player - and `every`
      over an empty array is `true`, so this is the guard, not the natural result.
    */
    expect(isUnscoredContest([], "provider")).toBe(false);
  });
});
