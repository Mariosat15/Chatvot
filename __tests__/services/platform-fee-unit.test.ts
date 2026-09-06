import { describe, it, expect } from "vitest";

import {
  calculateRankings,
  distributePrizesWithTies,
  type CompetitionRules,
  type ParticipantData,
} from "@/lib/services/competition-ranking.service";

/**
 * Risk R30: the platform fee is a FRACTION, and used to be named a percentage.
 *
 * `distributePrizesWithTies` computes `grossPrize * (1 - fee)`. Passing 10 for "10%" made
 * the multiplier -9, so every winner was assigned a NEGATIVE prize - silently, because a
 * negative payout is just a credit adjustment in the platform's favour, not a crash.
 *
 * Live payouts were never wrong: both callers divided by 100 first. This was a naming
 * defect that produced a real bug the moment anyone trusted the name, which is exactly
 * what happened while building the ranking baseline on 4 Sep 2026.
 *
 * Fixed by renaming the parameter to `platformFeeFraction` and rejecting out-of-range
 * values. The guard can never reject valid data: both the competition and challenge
 * schemas cap `platformFeePercentage` at `max: 50`, so a correctly converted fraction is
 * at most 0.5. Anything above 1 is a unit error by construction.
 */

const RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "trades_count",
  tieBreaker2: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: true,
};

const PRIZES = [
  { rank: 1, percentage: 60 },
  { rank: 2, percentage: 40 },
];

function field(): ParticipantData[] {
  return [
    {
      userId: "aaaaaaaaaaaaaaaaaaaaaaa1",
      username: "winner",
      startingCapital: 10_000,
      currentCapital: 15_000,
      pnl: 5_000,
      pnlPercentage: 50,
      totalTrades: 20,
      winningTrades: 15,
      losingTrades: 5,
      winRate: 75,
      status: "active",
      enteredAt: new Date("2026-01-01T10:00:00.000Z"),
    },
    {
      userId: "aaaaaaaaaaaaaaaaaaaaaaa2",
      username: "runner_up",
      startingCapital: 10_000,
      currentCapital: 11_000,
      pnl: 1_000,
      pnlPercentage: 10,
      totalTrades: 30,
      winningTrades: 16,
      losingTrades: 14,
      winRate: 53,
      status: "active",
      enteredAt: new Date("2026-01-01T11:00:00.000Z"),
    },
  ];
}

function payout(fee?: number) {
  const ranked = calculateRankings(field(), RULES, {
    competitionStatus: "completed",
  });
  return distributePrizesWithTies(ranked, PRIZES, 1_000, RULES, fee);
}

describe("the platform fee is interpreted as a fraction", () => {
  it("takes 10% from a 0.1 fee", () => {
    const total = payout(0.1).reduce((sum, d) => sum + d.prizeAmount, 0);
    expect(total).toBeCloseTo(900, 2);
  });

  it("pays the whole pool when the fee is omitted", () => {
    // Reason: the parameter defaults to 0, which is why forgetting it was always safe and
    // only supplying a plausible-looking value was dangerous.
    const total = payout().reduce((sum, d) => sum + d.prizeAmount, 0);
    expect(total).toBeCloseTo(1_000, 2);
  });

  it("accepts the schema maximum of 50%, expressed as 0.5", () => {
    const total = payout(0.5).reduce((sum, d) => sum + d.prizeAmount, 0);
    expect(total).toBeCloseTo(500, 2);
  });

  it("accepts a 100% fee, which pays nobody but is not incoherent", () => {
    const total = payout(1).reduce((sum, d) => sum + d.prizeAmount, 0);
    expect(total).toBe(0);
  });
});

describe("a percentage is refused instead of paying negative prizes", () => {
  it.each([10, 20, 50, 100])("refuses %s, which is a percentage", (fee) => {
    expect(
      () => payout(fee),
      `a fee of ${fee} was accepted - every winner would be paid a negative prize`,
    ).toThrow(/fraction between 0 and 1/);
  });

  it("refuses a negative fee", () => {
    // Reason: a negative fee pays out MORE than the pool holds.
    expect(() => payout(-0.1)).toThrow(/fraction between 0 and 1/);
  });

  it.each([NaN, Infinity])("refuses %s", (fee) => {
    expect(() => payout(fee)).toThrow(/fraction between 0 and 1/);
  });

  it("names the offending value so the unit error is obvious in a log", () => {
    // Reason: "invalid fee" would send someone reading the schema. Echoing the value
    // shows immediately that a percentage arrived where a fraction was expected.
    expect(() => payout(20)).toThrow(/received 20/);
  });
});

describe("no fee can ever produce a negative payout", () => {
  it.each([0, 0.01, 0.1, 0.2, 0.5, 0.99, 1])(
    "pays nothing negative at a fee of %s",
    (fee) => {
      for (const distribution of payout(fee)) {
        expect(distribution.prizeAmount).toBeGreaterThanOrEqual(0);
      }
    },
  );
});
