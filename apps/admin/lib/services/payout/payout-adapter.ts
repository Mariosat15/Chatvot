/**
 * Payout Adapter contract.
 *
 * Each payout-capable provider implements this interface so the admin
 * withdrawal-processing route can execute a payout without knowing anything
 * about the specific provider. Adding a new provider = add an adapter file +
 * register it in ./payout-adapter-registry.ts. Nothing else changes.
 */

export interface PayoutExecutionContext {
  /** The WithdrawalRequest mongoose document being processed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withdrawal: any;
}

export type PayoutOutcome = "submitted" | "skipped" | "error";

export interface PayoutExecutionResult {
  /** submitted = money sent, skipped = needs manual handling, error = failed. */
  outcome: PayoutOutcome;
  /** Provider transaction id when submitted. */
  transactionId?: string;
  /** Provider transaction status when submitted. */
  transactionStatus?: string;
  /** Admin-note line describing what happened (always present). */
  note: string;
  /** Error message when outcome === "error". */
  error?: string;
  /** Extra metadata to merge onto the withdrawal record. */
  metadata?: Record<string, unknown>;
}

export interface PayoutAdapter {
  /** Must match the provider id in the payout registry. */
  id: string;
  label: string;
  supportsPayout: boolean;
  executePayout(ctx: PayoutExecutionContext): Promise<PayoutExecutionResult>;
}
