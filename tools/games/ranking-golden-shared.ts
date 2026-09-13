import type {
  ParticipantData,
  CompetitionRules,
  RankingOptions,
  RankedParticipant,
} from "../../lib/services/competition-ranking.service";
import type { RankingScenario } from "../../__tests__/fixtures/ranking-scenarios";

/**
 * Shared between the golden-file generator and the regression test.
 *
 * Reason: both sides must serialise a scenario in EXACTLY the same way. If the generator
 * and the test each had their own copy of this logic, a difference between them would
 * read as a behaviour regression - sending someone hunting through the ranking code for
 * a bug that lives in the test harness.
 */

export const GOLDEN_PATH = "__tests__/fixtures/ranking-golden.json";

type CalculateRankings = (
  participants: ParticipantData[],
  rules: CompetitionRules,
  options?: RankingOptions,
) => RankedParticipant[];

type DistributePrizes = (
  ranked: RankedParticipant[],
  prizeDistribution: { rank: number; percentage: number }[],
  grossPrizePool: number,
  rules: CompetitionRules,
  platformFeeFraction?: number,
) => { userId: string; prizeAmount: number; rank: number; isTied: boolean }[];

export interface ScenarioResult {
  name: string;
  rankings: {
    userId: string;
    rank: number;
    isTied: boolean;
    tiedWith: string[];
    qualificationStatus: string;
    disqualificationReason?: string;
  }[];
  payouts: {
    userId: string;
    prizeAmount: number;
    rank: number;
    isTied: boolean;
  }[];
  totalPaid: number;
}

/**
 * Runs one scenario and reduces it to the values that decide money.
 *
 * Only the deciding fields are captured, not whole participant objects. Reason: the
 * ranking functions copy their input through to the output, so serialising everything
 * would make the golden file fail whenever an unrelated trading field is added - a false
 * alarm on a money test, which is the fastest way to teach a team to ignore it.
 */
export function runScenario(
  scenario: RankingScenario,
  calculateRankings: CalculateRankings,
  distributePrizesWithTies: DistributePrizes,
): ScenarioResult {
  const ranked = calculateRankings(
    scenario.participants,
    scenario.rules,
    scenario.options,
  );

  const payouts = distributePrizesWithTies(
    ranked,
    scenario.prizeDistribution,
    scenario.grossPrizePool,
    scenario.rules,
    scenario.platformFeeFraction,
  );

  return {
    name: scenario.name,
    rankings: ranked.map((p) => ({
      userId: p.userId,
      rank: p.rank,
      isTied: p.isTied,
      // Sorted: the order tiedWith is appended in is an implementation detail, but
      // WHO is tied with whom is not.
      tiedWith: [...(p.tiedWith ?? [])].sort(),
      qualificationStatus: p.qualificationStatus,
      ...(p.disqualificationReason
        ? { disqualificationReason: p.disqualificationReason }
        : {}),
    })),
    payouts: payouts.map((d) => ({
      userId: d.userId,
      prizeAmount: round2(d.prizeAmount),
      rank: d.rank,
      isTied: d.isTied,
    })),
    totalPaid: round2(payouts.reduce((sum, d) => sum + d.prizeAmount, 0)),
  };
}

/**
 * Reason: prize maths produces values like 179.99999999999997. Comparing those raw makes
 * the baseline fail on floating-point noise that no player could ever observe, since
 * credits are only ever shown and paid to two decimal places.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
