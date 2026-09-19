import type {
  ParticipantData,
  CompetitionRules,
  RankingOptions,
} from "@/lib/services/competition-ranking.service";

/**
 * X1 regression baseline: the scenario matrix.
 *
 * Chapter 11 section 4 requires proof that trading ranks and pays out IDENTICALLY after
 * the ranking switch and the settle block are extracted into a game module. The chapter
 * proposes replaying historical competitions from production. That is a good check for
 * the owner to run on a real database, but it cannot run in CI and cannot run here, so
 * this file provides the part that can: a fixed, deterministic matrix that exercises
 * every branch of the ranking and prize code.
 *
 * The rules for this file, because a baseline that drifts is worse than none:
 *
 *   - NOTHING here may be random or time-dependent. No Date.now(), no Math.random().
 *     Every date is a literal. A baseline that changes between runs proves nothing.
 *   - Scenarios are APPEND-ONLY. Editing an existing one silently rewrites the very
 *     history the golden file exists to protect. Add a new scenario instead.
 *   - Every branch that decides money belongs here: each ranking method, each tie-break
 *     path, disqualification, the profit-factor divide-by-zero, and the epsilon
 *     boundaries where two values are close enough to count as equal.
 */

export interface RankingScenario {
  name: string;
  participants: ParticipantData[];
  rules: CompetitionRules;
  options?: RankingOptions;
  prizeDistribution: { rank: number; percentage: number }[];
  grossPrizePool: number;
  /**
   * A FRACTION, not a percentage: 0.1 means 10%.
   *
   * Building this matrix passed a percentage and every fee-bearing scenario produced a
   * negative prize, because `distributePrizesWithTies` computes `grossPrize * (1 - fee)`.
   * The parameter was called `platformFeePercentage` at the time, which is what invited
   * the mistake. It is now `platformFeeFraction` and rejects anything above 1 - risk R30.
   */
  platformFeeFraction: number;
}

/** Fixed instants. Ordering matters - `join_time` and the final tiebreaker both use it. */
const T0 = new Date("2026-01-01T10:00:00.000Z");
const T1 = new Date("2026-01-01T11:00:00.000Z");
const T2 = new Date("2026-01-01T12:00:00.000Z");
const T3 = new Date("2026-01-01T13:00:00.000Z");

function participant(
  overrides: Partial<ParticipantData> & { userId: string },
): ParticipantData {
  return {
    username: `user_${overrides.userId}`,
    startingCapital: 10_000,
    currentCapital: 10_000,
    pnl: 0,
    pnlPercentage: 0,
    totalTrades: 10,
    winningTrades: 5,
    losingTrades: 5,
    winRate: 50,
    status: "active",
    enteredAt: T0,
    ...overrides,
  };
}

const STANDARD_RULES: CompetitionRules = {
  rankingMethod: "pnl",
  tieBreaker1: "trades_count",
  tieBreaker2: "join_time",
  minimumTrades: 0,
  tiePrizeDistribution: "split_equally",
  disqualifyOnLiquidation: true,
};

const PRIZES_60_30_10 = [
  { rank: 1, percentage: 60 },
  { rank: 2, percentage: 30 },
  { rank: 3, percentage: 10 },
];

const RANKING_METHODS: CompetitionRules["rankingMethod"][] = [
  "pnl",
  "roi",
  "total_capital",
  "win_rate",
  "total_wins",
  "profit_factor",
];

/**
 * Four players whose ordering differs depending on which metric is used. Reason: if the
 * same four ranked the same way under every method, the matrix would pass even if the
 * method were ignored entirely.
 */
function metricSensitiveField(): ParticipantData[] {
  return [
    participant({
      userId: "aaaaaaaaaaaaaaaaaaaaaaa1",
      pnl: 5_000,
      pnlPercentage: 50,
      currentCapital: 15_000,
      totalTrades: 100,
      winningTrades: 40,
      losingTrades: 60,
      winRate: 40,
      enteredAt: T0,
    }),
    participant({
      userId: "aaaaaaaaaaaaaaaaaaaaaaa2",
      pnl: 4_000,
      pnlPercentage: 80,
      currentCapital: 9_000,
      totalTrades: 10,
      winningTrades: 9,
      losingTrades: 1,
      winRate: 90,
      startingCapital: 5_000,
      enteredAt: T1,
    }),
    participant({
      userId: "aaaaaaaaaaaaaaaaaaaaaaa3",
      pnl: 4_000,
      pnlPercentage: 20,
      currentCapital: 24_000,
      totalTrades: 50,
      winningTrades: 25,
      losingTrades: 25,
      winRate: 50,
      startingCapital: 20_000,
      enteredAt: T2,
    }),
    participant({
      userId: "aaaaaaaaaaaaaaaaaaaaaaa4",
      pnl: -1_000,
      pnlPercentage: -10,
      currentCapital: 9_000,
      totalTrades: 4,
      winningTrades: 4,
      losingTrades: 0, // profit_factor divide-by-zero branch
      winRate: 100,
      enteredAt: T3,
    }),
  ];
}

export function buildScenarios(): RankingScenario[] {
  const scenarios: RankingScenario[] = [];

  // 1-6. Every ranking method over the same metric-sensitive field.
  for (const method of RANKING_METHODS) {
    scenarios.push({
      name: `ranking method: ${method}`,
      participants: metricSensitiveField(),
      rules: { ...STANDARD_RULES, rankingMethod: method },
      options: { competitionStatus: "completed" },
      prizeDistribution: PRIZES_60_30_10,
      grossPrizePool: 1_000,
      platformFeeFraction: 0.1,
    });
  }

  // 7. Tie on the primary metric, resolved by tiebreaker 1 (fewer trades wins).
  scenarios.push({
    name: "tie on pnl, resolved by trades_count",
    participants: [
      participant({ userId: "bbbbbbbbbbbbbbbbbbbbbbb1", pnl: 1_000, totalTrades: 30 }),
      participant({ userId: "bbbbbbbbbbbbbbbbbbbbbbb2", pnl: 1_000, totalTrades: 10 }),
      participant({ userId: "bbbbbbbbbbbbbbbbbbbbbbb3", pnl: 1_000, totalTrades: 20 }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 900,
    platformFeeFraction: 0,
  });

  // 8. Tied through tiebreaker 1 as well, resolved by tiebreaker 2 (earlier join wins).
  scenarios.push({
    name: "tie through trades_count, resolved by join_time",
    participants: [
      participant({
        userId: "ccccccccccccccccccccccc1",
        pnl: 500,
        totalTrades: 12,
        enteredAt: T2,
      }),
      participant({
        userId: "ccccccccccccccccccccccc2",
        pnl: 500,
        totalTrades: 12,
        enteredAt: T0,
      }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 500,
    platformFeeFraction: 0.05,
  });

  // 9. A TRUE tie - identical on every criterion, so the prize splits.
  scenarios.push({
    name: "true tie across all criteria splits the prize",
    participants: [
      participant({ userId: "ddddddddddddddddddddddd1", pnl: 2_000, enteredAt: T0 }),
      participant({ userId: "ddddddddddddddddddddddd2", pnl: 2_000, enteredAt: T0 }),
      participant({ userId: "ddddddddddddddddddddddd3", pnl: 100, enteredAt: T0 }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 1_000,
    platformFeeFraction: 0,
  });

  // 10. Liquidation disqualifies, and disqualified players rank after everyone else.
  scenarios.push({
    name: "liquidated participant is disqualified",
    participants: [
      participant({ userId: "eeeeeeeeeeeeeeeeeeeeeee1", pnl: 9_000, status: "liquidated" }),
      participant({ userId: "eeeeeeeeeeeeeeeeeeeeeee2", pnl: 100 }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 400,
    platformFeeFraction: 0,
  });

  // 11 and 12. Minimum trades bites only once the contest is completed - the same input
  // ranks differently depending on status, which is exactly the kind of conditional an
  // extraction can drop without any test noticing.
  const thinTrader = () => [
    participant({ userId: "fffffffffffffffffffffff1", pnl: 5_000, totalTrades: 2 }),
    participant({ userId: "fffffffffffffffffffffff2", pnl: 1_000, totalTrades: 50 }),
  ];
  scenarios.push({
    name: "minimum trades enforced when completed",
    participants: thinTrader(),
    rules: { ...STANDARD_RULES, minimumTrades: 10 },
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 600,
    platformFeeFraction: 0,
  });
  scenarios.push({
    name: "minimum trades NOT enforced while active",
    participants: thinTrader(),
    rules: { ...STANDARD_RULES, minimumTrades: 10 },
    options: { competitionStatus: "active" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 600,
    platformFeeFraction: 0,
  });

  // 13. Minimum win rate.
  scenarios.push({
    name: "minimum win rate disqualifies",
    participants: [
      participant({ userId: "ggggggggggggggggggggggg1", pnl: 8_000, winRate: 20 }),
      participant({ userId: "ggggggggggggggggggggggg2", pnl: 200, winRate: 75 }),
    ],
    rules: { ...STANDARD_RULES, minimumWinRate: 50 },
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 300,
    platformFeeFraction: 0,
  });

  // 14. Sub-epsilon differences must be treated as equal. A refactor that swaps the
  // epsilon comparison for a plain `>` reorders these two and changes who gets paid.
  scenarios.push({
    name: "sub-epsilon pnl difference counts as a tie",
    participants: [
      participant({ userId: "hhhhhhhhhhhhhhhhhhhhhhh1", pnl: 1_000.001, enteredAt: T1 }),
      participant({ userId: "hhhhhhhhhhhhhhhhhhhhhhh2", pnl: 1_000.002, enteredAt: T0 }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 700,
    platformFeeFraction: 0,
  });

  // 15. Fewer players than prize positions - the unclaimed-position redistribution path.
  scenarios.push({
    name: "unclaimed prize positions are redistributed",
    participants: [
      participant({ userId: "iiiiiiiiiiiiiiiiiiiiiii1", pnl: 3_000 }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 1_000,
    platformFeeFraction: 0.2,
  });

  // 16. split_prize as the tiebreaker, which short-circuits both tiebreak comparisons.
  scenarios.push({
    name: "split_prize tiebreaker",
    participants: [
      participant({ userId: "jjjjjjjjjjjjjjjjjjjjjjj1", pnl: 1_500, totalTrades: 5 }),
      participant({ userId: "jjjjjjjjjjjjjjjjjjjjjjj2", pnl: 1_500, totalTrades: 40 }),
    ],
    rules: { ...STANDARD_RULES, tieBreaker1: "split_prize", tieBreaker2: undefined },
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 800,
    platformFeeFraction: 0,
  });

  // 17. Everybody disqualified - nobody is paid, and the pool must not be distributed.
  scenarios.push({
    name: "all participants disqualified",
    participants: [
      participant({ userId: "kkkkkkkkkkkkkkkkkkkkkkk1", pnl: 100, status: "liquidated" }),
      participant({ userId: "kkkkkkkkkkkkkkkkkkkkkkk2", pnl: 50, status: "liquidated" }),
    ],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 1_000,
    platformFeeFraction: 0,
  });

  // 18. Empty field. Reason: the finalization sweeps can reach a contest nobody joined.
  scenarios.push({
    name: "no participants",
    participants: [],
    rules: STANDARD_RULES,
    options: { competitionStatus: "completed" },
    prizeDistribution: PRIZES_60_30_10,
    grossPrizePool: 1_000,
    platformFeeFraction: 0,
  });

  return scenarios;
}
