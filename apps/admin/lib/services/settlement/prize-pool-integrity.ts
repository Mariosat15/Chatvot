/**
 * Finalize-time prize-pool integrity (R1 residual).
 *
 * The stored `prizePool` must equal fees actually collected
 * (`participantCount × entryFee`) after any exclusion refunds have already
 * adjusted both figures. Two failure modes, both silent without this helper:
 *
 * - Over-count: pool higher than collected → phantom credits paid out.
 * - Under-count: pool lower than collected (a writer forgot `$inc prizePool`)
 *   → winners underpaid with no log line. The Stage 0 safeguard only capped
 *   the high side until this module landed.
 *
 * Free contests (`collectedFees <= 0`) are left alone — there is no fee
 * arithmetic to trust. Equality is an exact match; credits are whole numbers.
 */

export type PrizePoolCorrection = "over" | "under" | null;

export interface PrizePoolIntegrityResult {
  /** Value settlement must distribute (and persist when corrected). */
  prizePool: number;
  collectedFees: number;
  correction: PrizePoolCorrection;
}

export function reconcilePrizePoolAgainstCollectedFees(
  storedPrizePool: number,
  participantCount: number,
  entryFee: number,
): PrizePoolIntegrityResult {
  const collectedFees = Math.max(0, (participantCount || 0) * (entryFee || 0));
  const prizePool = storedPrizePool || 0;

  if (collectedFees <= 0 || prizePool === collectedFees) {
    return { prizePool, collectedFees, correction: null };
  }

  if (prizePool > collectedFees) {
    return { prizePool: collectedFees, collectedFees, correction: "over" };
  }

  // Reason: under-count — raise to collected so entrants are not underpaid
  // because an upstream writer incremented seats but not the pool.
  return { prizePool: collectedFees, collectedFees, correction: "under" };
}

export function logPrizePoolIntegrityViolation(options: {
  label: string;
  contestId: string;
  stored: number;
  collected: number;
  participantCount: number;
  entryFee: number;
  correction: "over" | "under";
}): void {
  const {
    label,
    contestId,
    stored,
    collected,
    participantCount,
    entryFee,
    correction,
  } = options;
  const action =
    correction === "over"
      ? "Capping prizePool to actual collected fees to prevent phantom credit distribution."
      : "Raising prizePool to actual collected fees so entrants are not underpaid.";

  console.error(
    `🚨 [${label}] PRIZE POOL INTEGRITY VIOLATION for ${contestId}!`,
  );
  console.error(
    `   Stored prizePool: ${stored}, actual collected (${participantCount} × ${entryFee}): ${collected}`,
  );
  console.error(`   ${action}`);
}
