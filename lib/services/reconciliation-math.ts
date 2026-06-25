/**
 * Reconciliation math — the canonical, dependency-free money rules.
 *
 * This module holds the *pure* calculations that decide:
 *   1. What a user's wallet balance SHOULD be (expected balance).
 *   2. Whether the stored balance is a real mismatch and how severe it is.
 *   3. Whether a refund clawback is safe to apply.
 *
 * It has NO database, network, or framework dependencies on purpose, so the
 * exact financial logic can be unit-tested deterministically. The DB-bound
 * services (reconciliation.service.ts, the admin reconciliation route, and the
 * Atlas clawback route) call into / mirror these functions, so the tests here
 * guard the real behaviour rather than a throwaway copy.
 */

/** Tolerance (in credits) below which two money values are treated as equal. */
export const MONEY_TOLERANCE = 0.01;

/** Round to 2 decimal places (credits are tracked to the cent). */
export function round2(value: number): number {
  return Math.round((value || 0) * 100) / 100;
}

/** Sum an array of signed transaction amounts, rounded to the cent. */
export function sumAmounts(amounts: number[]): number {
  return round2(amounts.reduce((sum, a) => sum + (a || 0), 0));
}

/**
 * The TRUE expected wallet balance.
 *
 * It is the signed sum of every COMPLETED (and disputed) wallet transaction
 * — deposits (+), withdrawals (−), wins (+), entries (−), refunds (+/−),
 * admin adjustments (+/−), clawbacks (−), incident compensation (+), etc. —
 * MINUS credits locked in pending/processing withdrawals, because those
 * credits have already been debited from the live wallet but their
 * withdrawal transaction is not yet "completed".
 *
 * Reason: ignoring pendingWithdrawalCredits produced false "balance_mismatch"
 * criticals for users with an in-flight withdrawal.
 */
export function computeExpectedBalance(
  completedAndDisputedAmounts: number[],
  pendingWithdrawalCredits = 0,
): number {
  return round2(
    completedAndDisputedAmounts.reduce((sum, a) => sum + (a || 0), 0) -
      (pendingWithdrawalCredits || 0),
  );
}

/** Signed difference between the stored balance and the expected balance. */
export function balanceDifference(
  storedBalance: number,
  expectedBalance: number,
): number {
  return round2((storedBalance || 0) - (expectedBalance || 0));
}

/** True when stored vs expected differ by more than the money tolerance. */
export function isBalanceMismatch(
  storedBalance: number,
  expectedBalance: number,
  tolerance = MONEY_TOLERANCE,
): boolean {
  return Math.abs((storedBalance || 0) - (expectedBalance || 0)) > tolerance;
}

/**
 * Severity of a balance mismatch. If the user has pending withdrawals or
 * pending deposits, an in-flight timing difference can legitimately explain
 * the gap, so it is downgraded from "critical" to "info".
 */
export function classifyBalanceMismatchSeverity(params: {
  pendingWithdrawalCredits?: number;
  pendingDepositCredits?: number;
}): "info" | "critical" {
  const pending =
    (params.pendingWithdrawalCredits || 0) > 0 ||
    (params.pendingDepositCredits || 0) > 0;
  return pending ? "info" : "critical";
}

/**
 * Net amount actually spent on an activity (competitions, challenges, GM
 * subscriptions): gross spend minus any refunds returned for it.
 */
export function netSpent(grossSpent: number, refunded: number): number {
  return round2((grossSpent || 0) - (refunded || 0));
}

export interface ClawbackInput {
  /** The wallet's current credit balance. */
  currentBalance: number;
  /** Credits originally granted by the refunded deposit (its positive amount). */
  grantedCredits: number;
  /** Optional partial-refund override; defaults to grantedCredits. */
  requestedAmount?: number;
}

export interface ClawbackResult {
  ok: boolean;
  /** The amount that would be clawed back (absolute value). */
  amount: number;
  /** Resulting wallet balance if applied (unchanged from current when !ok). */
  newBalance: number;
  error?: string;
}

/**
 * Decide whether a refund clawback can be applied, mirroring the safety rules
 * in the Atlas clawback route:
 *   - amount must be a positive number,
 *   - cannot exceed the credits originally granted,
 *   - must never force the balance negative (user already spent the credits).
 */
export function evaluateClawback({
  currentBalance,
  grantedCredits,
  requestedAmount,
}: ClawbackInput): ClawbackResult {
  const granted = Math.abs(grantedCredits || 0);
  const amount =
    requestedAmount !== undefined ? Math.abs(requestedAmount) : granted;

  if (!amount || isNaN(amount) || amount <= 0) {
    return {
      ok: false,
      amount: 0,
      newBalance: round2(currentBalance),
      error: "Invalid clawback amount",
    };
  }

  if (amount > granted + MONEY_TOLERANCE) {
    return {
      ok: false,
      amount,
      newBalance: round2(currentBalance),
      error: `Clawback exceeds the credits originally granted (${granted})`,
    };
  }

  const newBalance = round2((currentBalance || 0) - amount);
  if (newBalance < 0) {
    return {
      ok: false,
      amount,
      newBalance: round2(currentBalance),
      error:
        "Cannot claw back — user already spent the refunded credits; handle as a loss or fraud case.",
    };
  }

  return { ok: true, amount, newBalance };
}
