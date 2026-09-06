/**
 * Chargeback ingestion & enforcement.
 *
 * When a PSP reports a chargeback (dispute won by cardholder = forced refund),
 * the acquired funds have already been clawed back from our merchant account.
 * Our job is to:
 *   1. Record a SecurityAlert (critical severity) for admin review.
 *   2. Create a UserRestriction — ban the user from depositing / withdrawing
 *      / trading / entering competitions and hide them from public lists.
 *   3. Mark the original WalletTransaction as disputed so reconciliation can
 *      reverse the credit grant.
 *
 * This handler is PSP-agnostic: callers (Nuvei / Stripe / Paddle / future
 * providers) resolve the user + transaction from their own DMN formats and
 * pass a normalized input here.
 */

// Reason: relative imports for dual-app (main + admin) resolution.
import { connectToDatabase } from "../../../database/mongoose";
import UserRestriction from "../../../database/models/user-restriction.model";
import WalletTransaction from "../../../database/models/trading/wallet-transaction.model";
import { recordSecurityAlert } from "./security-alert.service";
import { ensureChargebackCase } from "./chargeback-case.service";

export interface HandleChargebackInput {
  /** Provider slug (e.g., "nuvei"). */
  provider: string;
  /** The user whose deposit was charged back. */
  userId: string;
  /** Our internal WalletTransaction _id when known. */
  transactionId?: string;
  /** Amount disputed (in our credit-wallet currency). */
  amount?: number;
  /** Original PSP transaction reference. */
  providerTransactionId?: string;
  /** Case / arbitration ID from the PSP. */
  chargebackCaseId?: string;
  /** Free-form provider reason code (e.g., "10.4 Fraud — Card Absent"). */
  reasonCode?: string;
  /** Requesting client IP (from the webhook). */
  ip?: string;
}

export interface HandleChargebackResult {
  restrictionId?: string;
  securityAlertId?: string;
  transactionUpdated: boolean;
  /** Chargeback case id (admin queue). Optional because case creation is
   *  best-effort — failure must not break the webhook response. */
  chargebackId?: string;
}

export async function handleChargeback(
  input: HandleChargebackInput,
): Promise<HandleChargebackResult> {
  await connectToDatabase();

  const result: HandleChargebackResult = { transactionUpdated: false };

  // 1) SecurityAlert — critical. Always first so we have a paper trail even
  //    if subsequent DB writes fail.
  try {
    const alert = await recordSecurityAlert({
      alertType: "chargeback_received",
      severity: "critical",
      source: `/webhook/${input.provider}`,
      provider: input.provider,
      ip: input.ip,
      userId: input.userId,
      reason: `Chargeback received${input.reasonCode ? ` (${input.reasonCode})` : ""}`,
      metadata: {
        chargebackCaseId: input.chargebackCaseId,
        providerTransactionId: input.providerTransactionId,
        transactionId: input.transactionId,
        amount: input.amount,
        reasonCode: input.reasonCode,
      },
    });
    if (alert && alert._id) {
      result.securityAlertId = String(alert._id);
    }
  } catch (err) {
    console.error("⚠️ [chargeback] failed to record SecurityAlert:", err);
  }

  // 2) UserRestriction — ban all actions. Idempotent: if user already has an
  //    active payment_fraud restriction we bump its customReason rather than
  //    creating duplicates.
  try {
    const existing = await UserRestriction.findOne({
      userId: input.userId,
      isActive: true,
      reason: "payment_fraud",
    }).lean<{ _id: unknown } | null>();

    if (existing && existing._id) {
      await UserRestriction.updateOne(
        { _id: existing._id },
        {
          $set: {
            customReason: buildReason(input),
            restrictionType: "banned",
            canTrade: false,
            canEnterCompetitions: false,
            canDeposit: false,
            canWithdraw: false,
            hideFromPublic: true,
          },
        },
      );
      result.restrictionId = String(existing._id);
    } else {
      const created = await UserRestriction.create({
        userId: input.userId,
        restrictionType: "banned",
        reason: "payment_fraud",
        customReason: buildReason(input),
        canTrade: false,
        canEnterCompetitions: false,
        canDeposit: false,
        canWithdraw: false,
        hideFromPublic: true,
        restrictedBy: "system:chargeback-handler",
        isActive: true,
      });
      result.restrictionId = String(created._id);
    }
  } catch (err) {
    console.error("⚠️ [chargeback] failed to create/update UserRestriction:", err);
  }

  // 3) Mark the original transaction as disputed (best-effort).
  if (input.transactionId) {
    try {
      const res = await WalletTransaction.updateOne(
        { _id: input.transactionId },
        {
          $set: {
            status: "disputed",
            "metadata.chargebackCaseId": input.chargebackCaseId,
            "metadata.chargebackReasonCode": input.reasonCode,
            "metadata.chargebackReceivedAt": new Date(),
          },
        },
      );
      result.transactionUpdated = (res.modifiedCount ?? 0) > 0;
    } catch (err) {
      console.error("⚠️ [chargeback] failed to mark transaction disputed:", err);
    }
  }

  // 4) Ensure a Chargeback case exists for the admin queue. Fully best-effort
  //    and idempotent — if this fails, the existing alert + restriction + tx
  //    update are already in place and the webhook keeps responding 200.
  try {
    const cb = await ensureChargebackCase({
      provider: input.provider,
      userId: input.userId,
      walletTransactionId: input.transactionId,
      providerTransactionId: input.providerTransactionId,
      chargebackCaseId: input.chargebackCaseId,
      reasonCode: input.reasonCode,
      amount: input.amount ?? 0,
      restrictionId: result.restrictionId,
      securityAlertId: result.securityAlertId,
    });
    if (cb && cb._id) result.chargebackId = String(cb._id);
  } catch (err) {
    console.error("⚠️ [chargeback] failed to ensure Chargeback case:", err);
  }

  return result;
}

function buildReason(input: HandleChargebackInput): string {
  const parts = [
    `Automatic restriction after chargeback from ${input.provider}`,
  ];
  if (input.chargebackCaseId) parts.push(`case=${input.chargebackCaseId}`);
  if (input.reasonCode) parts.push(`code=${input.reasonCode}`);
  if (typeof input.amount === "number") parts.push(`amount=${input.amount}`);
  return parts.join(" | ");
}
