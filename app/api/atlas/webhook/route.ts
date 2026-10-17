/**
 * Atlas Payment Callback (Postback) Webhook
 * Authoritative event that credits a wallet after an Atlas hosted-form payment.
 *
 * POST /api/atlas/webhook  (register this as PaymentCallbackUrl with Atlas)
 *
 * Security posture mirrors the Nuvei DMN handler:
 *   1. Verify X-Signature = SHA-512(ClientId + rawBody + ClientSecret) FIRST,
 *      before trusting any field. On failure → reportWebhookSignatureFailure.
 *   2. Atomic idempotent claim (pending → processing) so concurrent/duplicate
 *      callbacks cannot double-credit.
 *   3. Funnel into the agnostic spine completeDeposit() — never fork it.
 *   4. On decline, record decline-velocity for user + IP.
 *
 * Atlas considers a callback delivered only on HTTP 200, so every *handled*
 * event returns 200. Only a forged signature returns 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { recordDecline, clearDeclines } from "@/lib/utils/rate-limiter";
import { reportWebhookSignatureFailure } from "@/lib/services/security/webhook-signature-failure";
import { PaymentFraudService } from "@/lib/services/fraud/payment-fraud.service";
import { isValidObjectId } from "@/lib/utils/url-validator";
import {
  atlasService,
  ATLAS_STATUS,
  type AtlasPaymentRecord,
} from "@/lib/services/atlas.service";

interface AtlasCallbackBody {
  data?: AtlasPaymentRecord;
}

/** Extract the internal WalletTransaction id from Atlas correlation fields. */
function resolveTransactionId(record: AtlasPaymentRecord): string | null {
  // Primary: additional_data we set at creation ("txn_<id>").
  const additional = record.additional_data?.trim();
  if (additional) {
    const id = additional.startsWith("txn_")
      ? additional.slice(4)
      : additional;
    if (isValidObjectId(id)) return id;
  }
  return null;
}

/** Best-effort last-4 extraction from an Atlas masked PAN / method data. */
function extractLast4(methodData: string | undefined): string | undefined {
  if (!methodData) return undefined;
  const digits = methodData.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    // Raw body is required to recompute the SHA-512 signature byte-for-byte.
    const rawBody = await req.text();
    const receivedSignature =
      req.headers.get("x-signature") || req.headers.get("X-Signature") || "";

    const credentials = await atlasService.getCredentials();
    if (!credentials) {
      console.error("❌ Atlas callback received but Atlas not configured");
      // Not configured → cannot verify. Return 200 so Atlas does not hammer us;
      // nothing is credited because we never reach completeDeposit.
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
      console.error("🚨 SECURITY: Atlas callback signature verification failed");
      return reportWebhookSignatureFailure({
        provider: "atlas",
        request: req,
        reason: "Invalid X-Signature on Atlas callback",
        source: "/api/atlas/webhook",
      });
    }

    let parsed: AtlasCallbackBody;
    try {
      parsed = JSON.parse(rawBody) as AtlasCallbackBody;
    } catch {
      console.error("❌ Atlas callback: invalid JSON body");
      return NextResponse.json({ received: true });
    }

    const record = parsed.data;
    if (!record || record.payment_id === undefined) {
      console.error("❌ Atlas callback missing data/payment_id");
      return NextResponse.json({ received: true });
    }

    const statusCode = Number(record.transaction_status_code);
    const paymentId = String(record.payment_id);
    const amount = record.amount !== undefined ? Number(record.amount) : undefined;
    const currency = record.currency || "EUR";

    console.log("📨 Atlas callback:", {
      paymentId,
      statusCode,
      statusText: record.transaction_status_text,
    });

    await connectToDatabase();

    // STEP 2: correlate to our pending transaction.
    const transactionId = resolveTransactionId(record);
    let transaction = transactionId
      ? await WalletTransaction.findById(transactionId)
      : null;

    // Fallback: locate by the Atlas payment id we stored at creation.
    if (!transaction) {
      transaction = await WalletTransaction.findOne({
        provider: "atlas",
        providerTransactionId: paymentId,
      });
    }

    if (!transaction) {
      console.error(
        `❌ Atlas callback: no transaction for payment ${paymentId} (additional_data: ${record.additional_data})`,
      );
      // 200 so Atlas stops retrying — there is nothing for us to do.
      return NextResponse.json({ received: true, message: "Transaction not found" });
    }

    console.log(
      `📦 Processing Atlas callback for transaction ${transaction._id}, user: ${transaction.userId}`,
    );

    // SECURITY: amount reconciliation (non-blocking warning for Atlas — the
    // reported amount can differ from the requested gross depending on the
    // commission_included setting, so we record a flag instead of auto-failing
    // a real charge). Reason: avoid wrongly failing settled money.
    const storedTotalCharged = transaction.metadata?.totalCharged;
    if (
      amount !== undefined &&
      storedTotalCharged &&
      Math.abs(amount - storedTotalCharged) > 0.01
    ) {
      console.warn(
        `⚠️ Atlas amount note: reported ${amount} ${currency}, expected ${storedTotalCharged} (tx ${transaction._id})`,
      );
    }

    // STEP 3: status handling.
    if (statusCode === ATLAS_STATUS.COMPLETED) {
      // Atomic claim: pending/awaiting_payment → processing.
      const claimed = await WalletTransaction.findOneAndUpdate(
        {
          _id: transaction._id,
          status: { $in: ["pending", "awaiting_payment"] },
        },
        { $set: { status: "processing" } },
        { new: false },
      );

      if (!claimed) {
        const currentTxn = await WalletTransaction.findById(transaction._id);
        if (currentTxn?.status === "completed") {
          console.log(
            `✅ Atlas tx ${transaction._id} already completed (duplicate callback)`,
          );
          return NextResponse.json({ received: true, message: "Already processed" });
        }
        if (currentTxn?.status === "processing") {
          return NextResponse.json({ received: true, message: "Already processing" });
        }
        return NextResponse.json({
          received: true,
          message: "Transaction not in pending state",
        });
      }

      console.log(
        `🔒 Claimed Atlas tx ${transaction._id} for processing (user: ${transaction.userId})`,
      );

      const last4 = extractLast4(record.payment_method_data);
      transaction.paymentId = paymentId;
      transaction.providerTransactionId = paymentId;
      transaction.metadata = {
        ...transaction.metadata,
        atlasStatusCode: statusCode,
        atlasStatusText: record.transaction_status_text,
        atlasTransactionId: record.transaction_id,
        atlasPaymentMethod: record.payment_method_name,
        payerCountry: record.payer_country,
        payerEmail: record.payer_email,
      };
      await transaction.save();

      try {
        const { completeDeposit } = await import(
          "@/lib/actions/trading/wallet.actions"
        );

        const cardDetails = last4
          ? {
              brand: record.payment_method_name || undefined,
              last4,
              country: record.payer_country || undefined,
            }
          : undefined;

        await completeDeposit(transaction._id.toString(), paymentId, "card", cardDetails);

        console.log(
          `✅ Atlas deposit completed via completeDeposit: ${transaction._id}`,
        );

        // Clear decline-velocity counters after a successful charge.
        try {
          await clearDeclines(transaction.userId);
          const txIp = transaction.metadata?.clientIp as string | undefined;
          if (txIp) await clearDeclines(`ip:${txIp}`);
        } catch {
          // Non-blocking.
        }

        // Journey milestones.
        try {
          const { checkAndCompleteMilestones } = await import(
            "@/lib/services/journey-progress.service"
          );
          await checkAndCompleteMilestones(transaction.userId);
        } catch (journeyError) {
          console.error("🗺️ Atlas journey milestone check failed:", journeyError);
        }

        // Fraud fingerprint — only when a card-specific identifier exists.
        // Reason: Atlas provides no card hash; feeding a non-unique value
        // (e.g. "VISA") would create false cross-account fraud links, so we
        // only track when the masked PAN yields BIN+last4-level specificity.
        const methodData = record.payment_method_data;
        const fpDigits = methodData ? methodData.replace(/\D/g, "") : "";
        if (fpDigits.length >= 8 && transaction.userId) {
          try {
            await PaymentFraudService.trackPaymentFingerprint({
              userId: transaction.userId,
              paymentProvider: "atlas",
              paymentFingerprint: `atlas:${fpDigits}`,
              cardLast4: last4,
              cardBrand: record.payment_method_name || undefined,
              cardCountry: record.payer_country || undefined,
              transactionId: paymentId,
              amount: transaction.amount,
              currency,
              providerMetadata: {
                paymentMethodId: record.payment_method_id,
                atlasTransactionId: record.transaction_id,
              },
            });
          } catch (fraudError) {
            console.error("❌ Atlas fraud fingerprint failed:", fraudError);
          }
        }
      } catch (completeError) {
        // CRITICAL: do NOT credit on completeDeposit failure — flag for review.
        console.error("❌ CRITICAL: completeDeposit failed for Atlas:", completeError);
        transaction.status = "failed";
        transaction.failureReason = `completeDeposit error: ${completeError instanceof Error ? completeError.message : "Unknown error"}`;
        transaction.metadata = {
          ...transaction.metadata,
          processingError:
            completeError instanceof Error
              ? completeError.message
              : "Unknown error",
          requiresManualReview: true,
          atlasPaymentApproved: true,
        };
        await transaction.save();
        console.error(
          `🚨 ALERT: Atlas deposit ${transaction._id} approved but failed to process. Manual review required!`,
        );
      }
    } else if (statusCode === ATLAS_STATUS.DECLINED) {
      transaction.status = "failed";
      transaction.providerTransactionId = paymentId;
      transaction.metadata = {
        ...transaction.metadata,
        atlasStatusCode: statusCode,
        atlasStatusText: record.transaction_status_text,
        errorReason:
          record.transaction_status_data ||
          record.transaction_status_text ||
          "Payment declined",
      };
      await transaction.save();
      console.log(`Atlas tx ${transaction._id} marked as failed (declined)`);

      // Decline-velocity (user + IP).
      try {
        const userBlock = await recordDecline(transaction.userId);
        if (userBlock.blocked) {
          console.warn(
            `🚨 Decline-velocity tripped for user ${transaction.userId} (Atlas)`,
          );
        }
        const txIp = transaction.metadata?.clientIp as string | undefined;
        if (txIp) {
          const ipBlock = await recordDecline(`ip:${txIp}`);
          if (ipBlock.blocked) {
            console.warn(`🚨 Decline-velocity tripped for IP ${txIp} (Atlas)`);
          }
        }
      } catch (declineErr) {
        console.error("⚠️ Atlas decline-velocity record failed:", declineErr);
      }
    } else {
      // NEW / PROCESSING — keep pending, just record latest status.
      transaction.metadata = {
        ...transaction.metadata,
        atlasStatusCode: statusCode,
        atlasStatusText: record.transaction_status_text,
      };
      await transaction.save();
      console.log(`Atlas tx ${transaction._id} still pending (status ${statusCode})`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Atlas webhook error:", error);
    // 500 lets Atlas retry on transient server errors.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
