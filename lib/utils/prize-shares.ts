/**
 * What share of the pot each prize rank is actually paid once ineligible players have been
 * removed, and how to turn those shares into credits without creating or destroying any.
 *
 * THIS IS ONE RULE WITH TWO CONSUMERS, and it existed as two independent implementations
 * until 9 September 2026. `distributePrizesWithTies` decided what settlement paid;
 * `prize-projection.ts` decided what the lobby's prize table and the admin contest panel
 * promised. Both computed a redistribution and they computed it differently after this
 * change, so leaving them apart would mean a lobby quoting one figure and a payout
 * delivering another - the "one rule, two copies" shape that produced `referenceId`,
 * `failedReason`, `challengeId` and the Game Master `|| 5`, none of which `check:mirrors`
 * can see, because it compares models.
 *
 * MIRRORED into `apps/admin/lib/utils/`, byte-identical, pinned by a test. `check:mirrors`
 * has no opinion about a util, so the text comparison is the only guard.
 */

/** A configured prize row. `rank` is 1-based and matches `CompetitionRules`. */
export interface ConfiguredShare {
  rank: number;
  percentage: number;
}

export interface NormalisedShare {
  rank: number;
  /** What the operator configured. Kept so a screen can show the change. */
  configuredPercentage: number;
  /** What this rank is actually paid, after normalisation. */
  effectivePercentage: number;
  /** `effectivePercentage - configuredPercentage`. Zero when nothing was vacated. */
  bonusPercentage: number;
  filled: boolean;
}

export interface NormalisedShares {
  shares: NormalisedShare[];
  /** Sum of the configured percentages. Usually 100, but an operator may under-allocate. */
  configuredTotal: number;
  /** Percentage sitting on ranks nobody eligible holds. */
  vacatedPercentage: number;
  /** True when no rank has an eligible holder - the caller owes the unclaimed pool. */
  allVacated: boolean;
}

/**
 * Spread a vacated rank's share across the ranks that remain, IN PROPORTION.
 *
 * Owner's rule, 9 September 2026 (task document 5 and 6). With 50/30/20 configured and
 * rank 3 vacated, first place is paid 50/80 of the pot and second 30/80 - 62.5% and 37.5%,
 * not the 60/40 the previous equal-share bonus produced. The distinction is that
 * proportional normalisation preserves the *ratio* the operator configured: an equal
 * share hands the same absolute bonus to first and second, which quietly flattens a
 * deliberately steep prize curve every time a position goes unclaimed.
 *
 * IT NORMALISES TO THE CONFIGURED TOTAL, NEVER TO 100, and that is the load-bearing
 * choice. Normalising to 100 reads as obviously right and pays out more than the operator
 * allocated whenever they under-allocate: a 50/30 table totalling 80% with both ranks
 * filled would pay 62.5/37.5, inflating every prize by a quarter with no error and no log
 * line. Scaling to `configuredTotal` makes "nothing vacated" an exact identity - the
 * factor is 1 - so the arithmetic cannot drift on the ordinary path.
 *
 * @param isRankFilled Asked once per configured rank. The caller decides what eligibility
 *   means; this module deliberately does not know about scores, liquidation or
 *   disqualification. Note that a rank held only by an INELIGIBLE player is vacated:
 *   `calculateRankings` ranks eligible players first and pushes the rest past the end of
 *   the prize table, so both "nobody entered" and "the holder was excluded" arrive here
 *   as the same question.
 */
export function normalisePrizeShares(
  distribution: ConfiguredShare[],
  isRankFilled: (rank: number) => boolean,
): NormalisedShares {
  const configuredTotal = distribution.reduce(
    (sum, d) => sum + (Number.isFinite(d.percentage) ? d.percentage : 0),
    0,
  );

  /*
    EVERY FIELD IS COPIED BY NAME. Do not write this as `{ ...d, filled: ... }`.

    `distribution` is typed `ConfiguredShare[]`, and at runtime it is usually an array of
    MONGOOSE SUBDOCUMENTS off `competition.prizeDistribution`. A spread copies own
    enumerable properties, and a Mongoose document keeps its data in `_doc` behind
    per-path getters - so the spread yields `$__`, `_doc` and `$isNew`, and `rank` is
    simply absent from the result. The type checker cannot see it, because the declared
    type says the field is there and it *is* there through the getter.

    The failure that taught this was silent and total: `rank` came back `undefined`,
    `rankGroups[undefined]` was empty, so every filled rank found no winner and a contest
    calculated ZERO prize distributions while reporting success and booking the whole pot
    as an unclaimed pool. `percentage` and `filled` survived only because they happened to
    be assigned explicitly. Reading one field off `d` directly works, which is exactly why
    the guard callback below looked fine.
  */
  const filled = distribution.map((d) => ({
    rank: d.rank,
    percentage: Number.isFinite(d.percentage) ? d.percentage : 0,
    filled: isRankFilled(d.rank),
  }));

  const filledTotal = filled.reduce(
    (sum, d) => sum + (d.filled ? d.percentage : 0),
    0,
  );
  const vacatedPercentage = configuredTotal - filledTotal;

  // Reason: two different zero cases, and both must refuse to divide. `filledTotal` is 0
  // when no rank has an eligible holder (the unclaimed-pool case) and ALSO when every
  // filled rank is configured at 0% - which is legal, and which an unguarded division
  // turns into Infinity and then into a NaN prize written to a wallet.
  const factor = filledTotal > 0 ? configuredTotal / filledTotal : 1;

  return {
    shares: filled.map((d) => {
      const effectivePercentage = d.filled ? d.percentage * factor : 0;

      return {
        rank: d.rank,
        configuredPercentage: d.percentage,
        effectivePercentage,
        bonusPercentage: d.filled ? effectivePercentage - d.percentage : 0,
        filled: d.filled,
      };
    }),
    configuredTotal,
    vacatedPercentage,
    allVacated: filledTotal <= 0,
  };
}

/**
 * Round a set of exact prize amounts to whole cents so that they still add up.
 *
 * LARGEST REMAINDER, because flooring each winner independently LOSES credits. Three
 * winners owed 333.3333 each were paid 333.33 each and the contest quietly kept a cent -
 * every time, in the platform's favour, which is the direction nobody notices and the one
 * hardest to defend. Task 6 asks in terms for rounding that neither creates nor destroys
 * credits, so the residue is handed to the largest fractional parts until it is gone.
 *
 * Ties in the remainder are broken by the order the amounts arrive, which is prize order,
 * so a spare cent goes to the higher-placed winner. That is arbitrary but it is not
 * random, and a deterministic rule is what makes the total reproducible on a retry.
 *
 * @param exactAmounts Unrounded amounts, already net of any fee.
 * @param targetTotal The total that must be paid, in credits. Floored to cents first: the
 *   pot itself cannot pay a fraction of a cent, so this is the largest honest total.
 */
export function allocateWithoutRoundingLoss(
  exactAmounts: number[],
  targetTotal: number,
): number[] {
  if (exactAmounts.length === 0) return [];

  const safeTarget = Number.isFinite(targetTotal)
    ? Math.max(0, Math.floor(targetTotal * 100))
    : 0;

  const floored = exactAmounts.map((amount) =>
    Number.isFinite(amount) ? Math.max(0, Math.floor(amount * 100)) : 0,
  );
  const flooredTotal = floored.reduce((sum, cents) => sum + cents, 0);

  // Reason: a shortfall is the normal case and is what this function exists for. A
  // NEGATIVE residue - the floors already exceeding the target - can only mean the caller
  // computed the amounts and the total from different inputs, so paying the floors would
  // over-distribute. Trimming from the smallest remainders is the conservative repair and
  // it keeps the invariant this function promises: the returned array sums to the target.
  let residue = safeTarget - flooredTotal;
  if (residue === 0) return floored.map((cents) => cents / 100);

  const remainders = exactAmounts.map((amount, index) => ({
    index,
    fraction: Number.isFinite(amount)
      ? amount * 100 - Math.floor(amount * 100)
      : 0,
  }));

  if (residue > 0) {
    remainders.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    for (let i = 0; residue > 0 && i < remainders.length; i++) {
      floored[remainders[i].index] += 1;
      residue -= 1;
      if (i === remainders.length - 1 && residue > 0) i = -1; // wrap for large residues
    }
  } else {
    remainders.sort((a, b) => a.fraction - b.fraction || a.index - b.index);
    for (let i = 0; residue < 0 && i < remainders.length; i++) {
      if (floored[remainders[i].index] > 0) {
        floored[remainders[i].index] -= 1;
        residue += 1;
      }
      if (i === remainders.length - 1 && residue < 0) {
        if (floored.every((cents) => cents === 0)) break;
        i = -1;
      }
    }
  }

  return floored.map((cents) => cents / 100);
}
