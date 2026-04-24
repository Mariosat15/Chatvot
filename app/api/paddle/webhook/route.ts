import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getPaddleConfig } from "@/lib/paddle/config";
import {
  completeDeposit,
  cancelDeposit,
} from "@/lib/actions/trading/wallet.actions";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { isValidObjectId, isSafeMongoString } from "@/lib/utils/url-validator";
import { recordDecline, clearDeclines } from "@/lib/utils/rate-limiter";

/**
 * Paddle Webhook Handler
 *
 * Paddle automatically sends webhooks when transactions complete.
 * The webhook URL is auto-configured in Paddle Dashboard.
 *
 * Paddle webhook events we handle:
 * - transaction.completed → Add credits to user
 * - transaction.payment_failed → Mark as failed
 * - transaction.refunded → Handle refund
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("paddle-signature");

    // Get Paddle config
    const paddleConfig = await getPaddleConfig();

    if (!paddleConfig) {
      console.error("❌ Paddle webhook received but Paddle not configured");
      return NextResponse.json(
        { error: "Paddle not configured" },
        { status: 400 },
      );
    }

    // Verify webhook signature (if secret is configured)
    if (paddleConfig.webhookSecret && signature) {
      const isValid = verifyPaddleWebhook(
        body,
        signature,
        paddleConfig.webhookSecret,
      );
      if (!isValid) {
        console.error("❌ Paddle webhook signature verification failed");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 },
        );
      }
    }

    // Parse the event
    const event = JSON.parse(body);

    console.log("📨 Paddle Webhook:", event.event_type);

    // Handle different event types
    switch (event.event_type) {
      case "transaction.completed":
        await handleTransactionCompleted(event.data);
        break;

      case "transaction.payment_failed":
        await handleTransactionFailed(event.data);
        break;

      case "transaction.refunded":
        await handleTransactionRefunded(event.data);
        break;

      default:
        console.log("ℹ️ Unhandled Paddle event:", event.event_type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Paddle webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

/**
 * Verify Paddle webhook signature
 */
function verifyPaddleWebhook(
  body: string,
  signature: string,
  secret: string,
): boolean {
  try {
    // Paddle uses ts;h1 format for signature
    const parts = signature.split(";");
    const tsValue = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
    const h1Value = parts.find((p) => p.startsWith("h1="))?.split("=")[1];

    if (!tsValue || !h1Value) {
      return false;
    }

    // Create expected signature
    const signedPayload = `${tsValue}:${body}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(h1Value),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

/**
 * Handle completed transaction - ADD CREDITS TO USER
 * Includes idempotency check to prevent duplicate processing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paddle webhook payload type not modelled; pre-existing.
async function handleTransactionCompleted(data: any) {
  try {
    const customData = data.custom_data;

    if (!customData?.transaction_id || !customData?.user_id) {
      console.error("❌ Paddle webhook missing custom_data:", data.id);
      return;
    }

    const transactionId = customData.transaction_id;
    const userId = customData.user_id;
    const paddleTransactionId = data.id;

    // Validate IDs to prevent NoSQL injection
    if (!isValidObjectId(transactionId)) {
      console.error("❌ Invalid transactionId format:", transactionId);
      return;
    }
    if (!isValidObjectId(userId)) {
      console.error("❌ Invalid userId format:", userId);
      return;
    }
    if (!isSafeMongoString(paddleTransactionId)) {
      console.error(`❌ Invalid paddleTransactionId format`);
      return;
    }

    // IDEMPOTENCY CHECK: Verify transaction hasn't already been processed
    // This prevents duplicate credits if Paddle sends the same webhook multiple times
    await connectToDatabase();

    // Check 1: By paymentId (Paddle transaction ID)
    const existingByPaymentId = (await WalletTransaction.findOne({
      paymentId: paddleTransactionId,
      status: "completed",
    }).lean()) as { _id: { toString(): string }; status?: string } | null;

    if (existingByPaymentId) {
      console.log(
        `⚠️ IDEMPOTENCY: Paddle payment ${paddleTransactionId} already processed (found by paymentId)`,
      );
      console.log("   Existing transaction:", existingByPaymentId._id);
      return; // Already processed, skip
    }

    // Check 2: By transactionId and status
    const existingTransaction = (await WalletTransaction.findById(
      transactionId,
    ).lean()) as { _id: { toString(): string }; status?: string } | null;

    if (!existingTransaction) {
      console.error("❌ Transaction not found in database:", transactionId);
      return;
    }

    if (existingTransaction.status === "completed") {
      console.log("⚠️ IDEMPOTENCY: Transaction already completed:", transactionId);
      return; // Already processed, skip
    }

    console.log("✅ Paddle payment completed:", paddleTransactionId);
    console.log("   User:", userId);
    console.log("   Transaction:", transactionId);

    // Complete the deposit - this adds credits to user's wallet
    await completeDeposit(transactionId, paddleTransactionId, "paddle");

    console.log("✅ Credits added for transaction", transactionId);

    // Reason: Clear decline-velocity counters after a successful charge so a
    // single past decline (e.g., wrong CVV) doesn't keep legitimate users
    // locked out. Mirrors Stripe/Nuvei behaviour.
    try {
      await clearDeclines(userId);
      const clientIp = customData.client_ip as string | undefined;
      if (clientIp) await clearDeclines(`ip:${clientIp}`);
    } catch {
      // Non-blocking
    }

    // Send notification to user
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");
      const amount = parseFloat(customData.amount) || 0;
      await notificationService.notifyDepositCompleted(userId, amount, 0);
    } catch (notifyError) {
      console.error("❌ Error sending notification:", notifyError);
    }
  } catch (error) {
    console.error("❌ Error handling Paddle transaction.completed:", error);
  }
}

/**
 * Handle failed payment
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paddle webhook payload type not modelled; pre-existing.
async function handleTransactionFailed(data: any) {
  try {
    const customData = data.custom_data;

    if (!customData?.transaction_id) {
      console.log("⚠️ Paddle payment_failed without transaction_id");
      return;
    }

    const transactionId = customData.transaction_id;

    // Validate transactionId to prevent NoSQL injection
    if (!isValidObjectId(transactionId)) {
      console.error("❌ Invalid transactionId format:", transactionId);
      return;
    }

    const reason = data.details?.reason || "Payment failed";

    console.error("❌ Paddle payment failed:", data.id);
    console.error("   Reason:", reason);

    // Cancel the deposit
    await cancelDeposit(transactionId, "failed", reason);

    // Reason: Record decline-velocity so repeated failures card-test through
    // this account / IP trigger a cooldown (parity with Stripe / Nuvei).
    const userId = customData?.user_id as string | undefined;
    const clientIp = customData?.client_ip as string | undefined;
    if (userId) {
      try {
        const userBlock = await recordDecline(userId);
        if (userBlock.blocked) {
          console.warn(
            `🚨 Decline-velocity threshold tripped for user ${userId} ` +
              `— deposits blocked until ${new Date(userBlock.blockedUntil!).toISOString()}`,
          );
        }
      } catch (err) {
        console.error("⚠️ Decline-velocity (user) failed:", err);
      }
    }
    if (clientIp) {
      try {
        const ipBlock = await recordDecline(`ip:${clientIp}`);
        if (ipBlock.blocked) {
          console.warn(
            `🚨 Decline-velocity threshold tripped for IP ${clientIp} ` +
              `— deposits blocked until ${new Date(ipBlock.blockedUntil!).toISOString()}`,
          );
        }
      } catch (err) {
        console.error("⚠️ Decline-velocity (ip) failed:", err);
      }
    }

    // Notify user
    if (customData?.user_id) {
      try {
        const { notificationService } =
          await import("@/lib/services/notification.service");
        const amount = parseFloat(customData.amount) || 0;
        await notificationService.notifyDepositFailed(
          customData.user_id,
          amount,
          reason,
        );
      } catch (notifyError) {
        console.error("❌ Error sending notification:", notifyError);
      }
    }
  } catch (error) {
    console.error(
      "❌ Error handling Paddle transaction.payment_failed:",
      error,
    );
  }
}

/**
 * Handle refunded transaction
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Paddle webhook payload type not modelled; pre-existing.
async function handleTransactionRefunded(data: any) {
  try {
    const customData = data.custom_data;

    console.log("💸 Paddle refund:", data.id);

    if (customData?.transaction_id) {
      // Validate transactionId to prevent NoSQL injection
      if (!isValidObjectId(customData.transaction_id)) {
        console.error("❌ Invalid transactionId format:", customData.transaction_id);
        return;
      }

      // Update transaction status
      await connectToDatabase();
      await WalletTransaction.findByIdAndUpdate(customData.transaction_id, {
        status: "refunded",
        "metadata.refundedAt": new Date(),
        "metadata.paddleRefundId": data.id,
      });

      console.log("   Transaction marked as refunded:", customData.transaction_id);

      // TODO: Optionally auto-deduct credits when refund is issued
      // For now, admin handles credit adjustment manually
    }
  } catch (error) {
    console.error("❌ Error handling Paddle transaction.refunded:", error);
  }
}
