/**
 * Atlas Refund Callback (Postback) Webhook
 * Receives refund status-change notifications from Atlas.
 *
 * POST /api/atlas/refund-callback  (register this as RefundCallbackUrl with Atlas)
 *
 * Policy (option A): on a COMPLETED refund we annotate the original deposit
 * transaction with the refund details and raise an admin SecurityAlert for
 * review. We do NOT auto-deduct wallet credits here — refunding money the user
 * may have already traded is a balance/risk decision left to an admin (mirrors
 * how Paddle refunds are handled today).
 *
 * Security: verify X-Signature = SHA-512(ClientId + rawBody + ClientSecret)
 * before trusting any field. Returns 200 on handled events (Atlas only marks a
 * callback delivered on 200) and 401 only on a forged signature.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { reportWebhookSignatureFailure } from "@/lib/services/security/webhook-signature-failure";
import { recordSecurityAlert } from "@/lib/services/security/security-alert.service";
import { isValidObjectId } from "@/lib/utils/url-validator";
import {
  atlasService,
  ATLAS_STATUS,
  type AtlasRefundRecord,
} from "@/lib/services/atlas.service";

interface AtlasRefundCallbackBody {
  data?: AtlasRefundRecord;
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

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const receivedSignature =
      req.headers.get("x-signature") || req.headers.get("X-Signature") || "";

    const credentials = await atlasService.getCredentials();
    if (!credentials) {
      console.error("❌ Atlas refund callback received but Atlas not configured");
      return NextResponse.json({ received: true });
    }

    // STEP 1: signature verification (before trusting any field).
    const valid = atlasService.verifyCallbackSignature(
      credentials.clientId,
      rawBody,
      credentials.clientSecret,
      receivedSignature,
    );
    if (!valid) {
      console.error(
        "🚨 SECURITY: Atlas refund callback signature verification failed",
      );
      return reportWebhookSignatureFailure({
        provider: "atlas",
        request: req,
        reason: "Invalid X-Signature on Atlas refund callback",
        source: "/api/atlas/refund-callback",
      });
    }

    let parsed: AtlasRefundCallbackBody;
    try {
      parsed = JSON.parse(rawBody) as AtlasRefundCallbackBody;
    } catch {
      console.error("❌ Atlas refund callback: invalid JSON body");
      return NextResponse.json({ received: true });
    }

    const record = parsed.data;
    if (!record || record.refund_id === undefined) {
      console.error("❌ Atlas refund callback missing data/refund_id");
      return NextResponse.json({ received: true });
    }

    const statusCode = Number(record.transaction_status_code);
    const refundId = String(record.refund_id);
    const paymentId = record.payment_id ? String(record.payment_id) : undefined;
    const refundAmount = record.amount !== undefined ? Number(record.amount) : undefined;
    const currency = record.currency || record.payment_currency || "EUR";

    console.log("📨 Atlas refund callback:", {
      refundId,
      paymentId,
      statusCode,
      statusText: record.transaction_status_text,
    });

    await connectToDatabase();

    // Locate the original deposit: by additional_data correlation first, then
    // by the Atlas payment id we stored at deposit time.
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
      console.error(
        `❌ Atlas refund callback: no deposit found for refund ${refundId} (payment ${paymentId})`,
      );
      // 200 so Atlas stops retrying — nothing for us to attach the refund to.
      return NextResponse.json({ received: true, message: "Transaction not found" });
    }

    // Idempotency: if we've already recorded this refund as completed, ack and skip.
    const existingRefundId = transaction.metadata?.atlasRefundId as
      | string
      | undefined;
    const existingRefundStatus = transaction.metadata?.refundStatus as
      | string
      | undefined;
    if (existingRefundId === refundId && existingRefundStatus === "completed") {
      console.log(
        `✅ Atlas refund ${refundId} already recorded as completed (duplicate callback)`,
      );
      return NextResponse.json({ received: true, message: "Already processed" });
    }

    if (statusCode === ATLAS_STATUS.COMPLETED) {
      // Annotate the deposit with refund details + flag for admin review.
      // Reason (option A): no automatic wallet deduction — an admin reconciles
      // the credit/balance impact so we never force a negative balance on
      // credits the user may have already traded.
      transaction.metadata = {
        ...transaction.metadata,
        atlasRefundId: refundId,
        refundStatus: "completed",
        refundAmount,
        refundCurrency: currency,
        refundedAt: new Date().toISOString(),
        refundTransactionId: record.transaction_id,
        requiresManualReview: true,
      };
      await transaction.save();

      // Record the bank outflow so the financial dashboard reflects money
      // leaving the platform bank. Reason: a completed refund is real money
      // paid back to the customer — without this the theoretical bank balance
      // overstates funds on hand. The user-credit (liability) side is handled
      // separately by the admin "claw back credits" action.
      const refundEur =
        refundAmount !== undefined && !isNaN(refundAmount)
          ? refundAmount
          : Number(transaction.metadata?.totalCharged) ||
            Math.abs(transaction.amount || 0);
      try {
        const { PlatformFinancialsService } = await import(
          "@/lib/services/platform-financials.service"
        );
        await PlatformFinancialsService.recordRefund({
          userId: transaction.userId,
          amountEUR: refundEur,
          transactionId: transaction._id.toString(),
          refundId,
          provider: "atlas",
        });
      } catch (financialError) {
        console.error(
          "⚠️ Atlas refund: failed to record platform refund outflow:",
          financialError,
        );
      }

      void recordSecurityAlert({
        alertType: "other",
        severity: "medium",
        source: "/api/atlas/refund-callback",
        provider: "atlas",
        userId: transaction.userId,
        reason: `Atlas refund COMPLETED (refund ${refundId}) for deposit ${transaction._id} — admin review required for credit/balance adjustment`,
        metadata: {
          refundId,
          paymentId,
          refundAmount,
          currency,
          depositTransactionId: transaction._id.toString(),
        },
      });

      console.log(
        `💸 Atlas refund ${refundId} recorded on deposit ${transaction._id} — flagged for admin review`,
      );
    } else if (statusCode === ATLAS_STATUS.DECLINED) {
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
      console.log(`Atlas refund ${refundId} declined for deposit ${transaction._id}`);
    } else {
      // NEW / PROCESSING — record latest status.
      transaction.metadata = {
        ...transaction.metadata,
        atlasRefundId: refundId,
        refundStatus: "processing",
      };
      await transaction.save();
      console.log(
        `Atlas refund ${refundId} processing (status ${statusCode}) for deposit ${transaction._id}`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Atlas refund callback error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
