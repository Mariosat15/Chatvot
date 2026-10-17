/**
 * Atlas Refund Reconciliation (shared)
 *
 * Single source of truth for applying an Atlas refund record to the original
 * deposit. Used by BOTH:
 *   1. The refund callback webhook (real-time, signature-verified).
 *   2. The scheduled worker reconciler (fallback for refunds Atlas does not
 *      call back on — e.g. provider-side refunds initiated outside ChartVolt).
 *
 * Policy (option A): a COMPLETED refund annotates the deposit, records the bank
 * outflow, emails the customer, and raises an admin SecurityAlert. We do NOT
 * auto-deduct wallet credits — refunding money the user may have already traded
 * is a balance/risk decision left to an admin (mirrors Paddle handling).
 *
 * Idempotency: keyed off the deposit's `metadata.refundStatus === "completed"`
 * plus the matching `atlasRefundId`. Whichever path (callback or reconciler)
 * runs first records the outflow; the other is a no-op. This matters because
 * `PlatformFinancialsService.recordRefund` is not itself idempotent.
 */
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { recordSecurityAlert } from "@/lib/services/security/security-alert.service";
import { isValidObjectId } from "@/lib/utils/url-validator";
import { ATLAS_STATUS, type AtlasRefundRecord } from "@/lib/services/atlas.service";

export type ApplyRefundOutcome =
  | "not_found"
  | "duplicate"
  | "completed"
  | "declined"
  | "processing";

export interface ApplyRefundResult {
  outcome: ApplyRefundOutcome;
  refundId: string;
  transactionId?: string;
}

/** Resolve the original deposit transaction id from the refund's additional_data. */
function resolveTransactionId(record: AtlasRefundRecord): string | null {
  const additional = record.additional_data?.trim();
  if (additional) {
    const id = additional.startsWith("txn_") ? additional.slice(4) : additional;
    if (isValidObjectId(id)) return id;
  }
  return null;
}

/**
 * Apply a single Atlas refund record to its originating deposit.
 *
 * @param record The Atlas refund data block.
 * @param source Audit string identifying the caller (callback vs reconciler).
 */
export async function applyAtlasRefundRecord(
  record: AtlasRefundRecord,
  source = "/api/atlas/refund-callback",
): Promise<ApplyRefundResult> {
  const statusCode = Number(record.transaction_status_code);
  const refundId = String(record.refund_id);
  const paymentId = record.payment_id ? String(record.payment_id) : undefined;
  const refundAmount =
    record.amount !== undefined ? Number(record.amount) : undefined;
  const currency = record.currency || record.payment_currency || "EUR";

  await connectToDatabase();

  // Locate the original deposit: by additional_data correlation first, then by
  // the Atlas payment id we stored at deposit time.
  const transactionId = resolveTransactionId(record);
  let transaction = transactionId
    ? await WalletTransaction.findById(transactionId)
    : null;

  if (!transaction && paymentId) {
    transaction = await WalletTransaction.findOne({
      provider: "atlas",
      providerTransactionId: paymentId,
    });
  }

  if (!transaction) {
    return { outcome: "not_found", refundId };
  }

  const depositId = transaction._id.toString();

  // Idempotency: already fully recorded → no-op.
  const existingRefundId = transaction.metadata?.atlasRefundId as
    | string
    | undefined;
  const existingRefundStatus = transaction.metadata?.refundStatus as
    | string
    | undefined;
  if (existingRefundId === refundId && existingRefundStatus === "completed") {
    return { outcome: "duplicate", refundId, transactionId: depositId };
  }

  if (statusCode === ATLAS_STATUS.COMPLETED) {
    transaction.metadata = {
      ...transaction.metadata,
      atlasRefundId: refundId,
      refundStatus: "completed",
      refundAmount,
      refundCurrency: currency,
      refundedAt: new Date().toISOString(),
      refundTransactionId: record.transaction_id,
      requiresManualReview: true,
      refundReconciledBy: source,
    };
    await transaction.save();

    const refundEur =
      refundAmount !== undefined && !isNaN(refundAmount)
        ? refundAmount
        : Number(transaction.metadata?.totalCharged) ||
          Math.abs(transaction.amount || 0);

    // Record the bank outflow (money leaving the platform bank).
    try {
      const { PlatformFinancialsService } = await import(
        "@/lib/services/platform-financials.service"
      );
      await PlatformFinancialsService.recordRefund({
        userId: transaction.userId,
        amountEUR: refundEur,
        transactionId: depositId,
        refundId,
        provider: "atlas",
      });
    } catch (financialError) {
      console.error(
        "⚠️ Atlas refund: failed to record platform refund outflow:",
        financialError,
      );
    }

    // Notify the customer (best-effort — must never break reconciliation).
    try {
      const mongoose = await import("mongoose");
      const db = mongoose.connection.db;
      if (db) {
        const { ObjectId } = await import("mongodb");
        const or: Record<string, unknown>[] = [{ id: transaction.userId }];
        if (
          ObjectId.isValid(transaction.userId) &&
          String(new ObjectId(transaction.userId)) === transaction.userId
        ) {
          or.push({ _id: new ObjectId(transaction.userId) });
        }
        const userDoc = await db
          .collection("user")
          .findOne({ $or: or }, { projection: { email: 1, name: 1 } });
        if (userDoc?.email) {
          const { sendRefundCompletedEmail } = await import("@/lib/nodemailer");
          await sendRefundCompletedEmail({
            email: userDoc.email as string,
            name: (userDoc.name as string) || "there",
            refundAmount: refundEur,
            currency,
            paymentMethod:
              (transaction.metadata?.atlasPaymentMethod as string) ||
              (record.payment_method_name as string) ||
              "your original payment method",
            transactionId: depositId,
            refundId,
          });
        }
      }
    } catch (emailError) {
      console.error(
        "⚠️ Atlas refund: failed to send refund confirmation email:",
        emailError,
      );
    }

    // Raise an admin alert for the credit/balance reconciliation decision.
    const viaReconciler = source.startsWith("scheduler");
    void recordSecurityAlert({
      alertType: "other",
      severity: "medium",
      source,
      provider: "atlas",
      userId: transaction.userId,
      reason: `Atlas refund COMPLETED (refund ${refundId}) for deposit ${depositId} — admin review required for credit/balance adjustment${
        viaReconciler
          ? " [detected by scheduled reconciler — callback was not received]"
          : ""
      }`,
      metadata: {
        refundId,
        paymentId,
        refundAmount,
        currency,
        depositTransactionId: depositId,
        detectedBy: viaReconciler ? "reconciler" : "callback",
      },
    });

    console.log(
      `💸 Atlas refund ${refundId} recorded on deposit ${depositId} — flagged for admin review (${source})`,
    );
    return { outcome: "completed", refundId, transactionId: depositId };
  }

  if (statusCode === ATLAS_STATUS.DECLINED) {
    transaction.metadata = {
      ...transaction.metadata,
      atlasRefundId: refundId,
      refundStatus: "declined",
      refundDeclineReason:
        record.transaction_status_data ||
        record.transaction_status_text ||
        "Refund declined",
    };
    await transaction.save();
    console.log(`Atlas refund ${refundId} declined for deposit ${depositId}`);
    return { outcome: "declined", refundId, transactionId: depositId };
  }

  // NEW / PROCESSING — record latest status.
  transaction.metadata = {
    ...transaction.metadata,
    atlasRefundId: refundId,
    refundStatus: "processing",
  };
  await transaction.save();
  console.log(
    `Atlas refund ${refundId} processing (status ${statusCode}) for deposit ${depositId}`,
  );
  return { outcome: "processing", refundId, transactionId: depositId };
}
