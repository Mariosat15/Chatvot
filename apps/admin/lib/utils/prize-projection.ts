/**
 * What each prize rank is currently projected to pay, including the unclaimed-position
 * redistribution the trading lobby has always done.
 *
 * WHY THIS IS ITS OWN MODULE. Two screens now need this answer: the player-facing
 * `components/competitions/PrizeTable.tsx` and the operator-facing prize sidebar on
 * `/competitions/view/[id]` in the admin app. The admin app cannot import a main-app
 * component, so the alternative was a second copy of a payout calculation - which is the
 * "one rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId` and the
 * Game Master `||`, none of which `check:mirrors` can see, since it compares models. A
 * mirrored pure module is cheap; two screens quoting different amounts for the same rank is
 * the kind of disagreement an operator reports as a payout defect.
 *
 * EXTRACTED, NOT REIMPLEMENTED. The four expressions that decide what a winner is paid were
 * moved character for character out of `PrizeTable.tsx`, and the four text assertions pinning
 * them moved with them unchanged - which is the only thing that makes the move provably
 * behaviour-free. The parameter is named `competition` for exactly that reason: renaming it
 * would have broken the verbatim match and thrown away the proof.
 *
 * MODEL-FREE BY REQUIREMENT, not preference. `PrizeTable` renders inside both lobbies and
 * `apps/admin/lib/utils/` is imported from client components, so a Mongoose import here would
 * surface as a broken client bundle rather than as a type error. It takes a plain object and
 * returns plain numbers. A test asserts no model import in either copy.
 *
 * MIRRORED INTO `apps/admin/lib/utils/prize-projection.ts` AND BYTE-IDENTICAL. `check:mirrors`
 * compares models, so it has no opinion about this file - a test compares the two copies as
 * text instead, because vitest aliases `@` to the repository root and no runtime assertion can
 * see the admin copy.
 *
 * WHAT IT DELIBERATELY DOES NOT KNOW. It redistributes an unfilled *position*, which is a
 * question about how many people entered. It cannot see a player who entered and recorded no
 * result: eligibility is settled at finalization by `hasResult` (R45), so a contest with three
 * entrants and one score pays differently from what this projects. Teaching it otherwise would
 * mean predicting a result before the contest has finished, so both callers say the figures are
 * a floor - and the admin screen stops projecting altogether once the real amounts exist.
 */

import { normalisePrizeShares } from "./prize-shares";

/** The shape both callers already hold. Deliberately not either app's model type. */
export interface PrizeProjectionInput {
  prizeDistribution?: { percentage: number; rank?: number }[] | null;
  currentParticipants?: number | null;
  prizePool?: number | null;
  prizePoolCredits?: number | null;
  platformFeePercentage?: number | null;
}

export interface ProjectedPrizeRow {
  /** The rank as configured, falling back to position so a row always has a number. */
  rank: number;
  /** What the operator typed. */
  configuredPercentage: number;
  /** The redistributed share this row picks up, or 0. */
  bonusPercentage: number;
  /** Net of the platform fee. Meaningless on an unfilled row - check `filled` first. */
  netAmount: number;
  /**
   * Whether anybody is currently in a position to claim this rank.
   *
   * Reason it is by index rather than by anything richer: the redistribution has always been
   * "the top N positions by entrant count", and changing that here would be a payout change
   * smuggled into a refactor.
   */
  filled: boolean;
}

export interface PrizeProjection {
  rows: ProjectedPrizeRow[];
  prizePositions: number;
  filledPositions: number;
  /** Total percentage sitting on positions nobody can currently claim. */
  unclaimedPercentage: number;
  allFilled: boolean;
  /** The pool the amounts were computed from, so a caller can print it in the same unit. */
  prizePool: number;
}

export function projectPrizeDistribution(
  competition: PrizeProjectionInput,
): PrizeProjection {
  const distribution: { percentage: number; rank?: number }[] =
    competition.prizeDistribution ?? [];
  const prizePositions = distribution.length;
  const currentParticipants = competition.currentParticipants || 0;
  const prizePool = competition.prizePool || competition.prizePoolCredits || 0;
  const platformFeePercentage = (competition.platformFeePercentage || 0) / 100;
  const filledPositions = Math.min(currentParticipants, prizePositions);

  /*
    THE REDISTRIBUTION IS NOW `normalisePrizeShares`, SHARED WITH SETTLEMENT.

    Until 9 September 2026 this computed its own `bonusPerWinner` - the unclaimed share
    divided equally by the filled positions - which was a faithful copy of what
    `distributePrizesWithTies` did. When the owner's rule changed settlement to
    proportional normalisation, that copy stopped agreeing with it: a 50/30/20 table with
    two entrants would have been projected here at 60/40 and paid at 62.5/37.5. Nobody
    would have seen an error; the lobby would simply have promised the wrong number to the
    player deciding whether to pay the entry fee.

    So the rule moved out and both callers now ask the same function. This module keeps
    only the part that is genuinely its own: deciding WHICH ranks count as filled, which
    here is by entrant count and not by eligibility - see the caveat in the docblock.
  */
  /*
    Keyed by POSITION, not by the configured rank, and the difference matters. This
    module's whole notion of "filled" is "the first N rows, where N is the entrant count",
    and `distribution` rows are allowed to carry no `rank` at all. Feeding the real ranks
    in would also mean two rows sharing a rank - which is bad data rather than impossible
    - silently answering the filled question for each other. `shares` comes back in input
    order either way, so the row mapping below reads it positionally.
  */
  const normalised = normalisePrizeShares(
    distribution.map((prize, index) => ({
      rank: index + 1,
      percentage: prize.percentage,
    })),
    (position) => position <= currentParticipants,
  );
  const unclaimedPercentage = normalised.vacatedPercentage;

  const rows = distribution.map((prize, index) => {
    const isFilled = index < currentParticipants;
    const share = normalised.shares[index];
    const adjustedPercentage = isFilled
      ? share.effectivePercentage
      : prize.percentage;
    const netAmount =
      ((prizePool * adjustedPercentage) / 100) * (1 - platformFeePercentage);

    return {
      rank: prize.rank ?? index + 1,
      configuredPercentage: prize.percentage,
      bonusPercentage: isFilled ? share.bonusPercentage : 0,
      netAmount,
      filled: isFilled,
    };
  });

  return {
    rows,
    prizePositions,
    filledPositions,
    unclaimedPercentage,
    allFilled: currentParticipants >= prizePositions,
    prizePool,
  };
}
