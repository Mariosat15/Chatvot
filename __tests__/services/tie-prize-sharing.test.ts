import { describe, it, expect } from "vitest";
import {
  calculateRankings,
  distributePrizesWithTies,
  type CompetitionRules,
  type ParticipantData,
} from "@/lib/services/competition-ranking.service";
import { mergeTiedRankShares } from "@/lib/utils/prize-shares";

/**
 * OWNER'S TIE RULE, 1 OCTOBER 2026: tied players share the prizes of EVERY position they
 * occupy. With 50/30/20 and two players tied for first, each is paid 40 and third keeps 20.
 *
 * Before this the tie skipped rank 2, the normaliser read the skipped rank as vacated and
 * spread its 30 across all winners in proportion - 35.7 / 35.7 / 28.6 - so third place was
 * paid out of a share the tie had already used up. Every expectation below is a number a
 * person chose, for the reason `prize-rule-matrix.test.ts` gives: a regenerated golden file
 * locks a mistake in, an assertion has to be argued with.
 */

const POOL = 1000;
const FIFTY_THIRTY_TWENTY = [
  { rank: 1, percentage: 50 },
  { rank: 2, percentage: 30 },
  { rank: 3, percentage: 20 },
];

const RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "split_prize",
  tieBreaker2: "split_prize",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: false,
};

const ENTERED = new Date("2026-10-01T10:00:00.000Z");

function trader(userId: string, pnl: number): ParticipantData {
  return {
    userId,
    username: userId,
    status: "active",
    enteredAt: ENTERED,
    startingCapital: 10_000,
    currentCapital: 10_000 + pnl,
    pnl,
    pnlPercentage: (pnl / 10_000) * 100,
    totalTrades: 10,
    winningTrades: 5,
    losingTrades: 5,
    winRate: 50,
  };
}

function settle(participants: ParticipantData[], distribution = FIFTY_THIRTY_TWENTY) {
  const ranked = calculateRankings(participants, RULES, {
    competitionStatus: "completed",
  });
  const paid = distributePrizesWithTies(ranked, distribution, POOL, RULES, 0);
  return new Map(paid.map((p) => [p.userId, p.prizeAmount]));
}

describe("a tied group takes the shares of every position it occupies", () => {
  it("two tied for first with 50/30/20 are paid 40 each, third keeps 20", () => {
    const paid = settle([trader("a", 500), trader("b", 500), trader("c", 100)]);
    expect(paid.get("a")).toBe(400);
    expect(paid.get("b")).toBe(400);
    expect(paid.get("c")).toBe(200);
  });

  it("two tied for second share second and third; first is untouched", () => {
    const paid = settle([trader("a", 900), trader("b", 500), trader("c", 500)]);
    expect(paid.get("a")).toBe(500);
    expect(paid.get("b")).toBe(250);
    expect(paid.get("c")).toBe(250);
  });

  it("four tied for first with three prizes share the whole pot equally", () => {
    const paid = settle([
      trader("a", 500),
      trader("b", 500),
      trader("c", 500),
      trader("d", 500),
    ]);
    for (const id of ["a", "b", "c", "d"]) expect(paid.get(id)).toBe(250);
  });

  it("a genuinely vacated rank is still redistributed in proportion", () => {
    // Reason: the merge must only absorb ranks a TIE skipped. Two players, three prizes:
    // rank 3 is empty because nobody is there, so 50/30 normalise to 62.5/37.5.
    const paid = settle([trader("a", 900), trader("b", 500)]);
    expect(paid.get("a")).toBe(625);
    expect(paid.get("b")).toBe(375);
  });
});

describe("mergeTiedRankShares", () => {
  it("sums the absorbed ranks onto the tied rank and drops them", () => {
    const sizes = new Map([[1, 2], [3, 1]]);
    expect(
      mergeTiedRankShares(FIFTY_THIRTY_TWENTY, (r) => sizes.get(r) ?? 0),
    ).toEqual([
      { rank: 1, percentage: 80 },
      { rank: 3, percentage: 20 },
    ]);
  });

  it("never absorbs a rank somebody actually holds", () => {
    const sizes = new Map([[1, 2], [2, 1], [3, 1]]);
    expect(
      mergeTiedRankShares(FIFTY_THIRTY_TWENTY, (r) => sizes.get(r) ?? 0),
    ).toEqual(FIFTY_THIRTY_TWENTY);
  });

  it("returns plain rows, never the input objects", () => {
    const input = [{ rank: 1, percentage: 100 }];
    const [row] = mergeTiedRankShares(input, () => 1);
    expect(row).not.toBe(input[0]);
  });
});
