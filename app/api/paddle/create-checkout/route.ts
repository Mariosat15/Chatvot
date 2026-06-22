import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getPaddleConfig, paddleRequest } from "@/lib/paddle/config";
import { initiateDeposit } from "@/lib/actions/trading/wallet.actions";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import AppSettings from "@/database/models/app-settings.model";
import { connectToDatabase } from "@/database/mongoose";
import {
  RateLimiters,
  getRateLimitHeaders,
  getClientIP,
  isDeclineBlocked,
} from "@/lib/utils/rate-limiter";

// Minimal subset of the Paddle Billing API /transactions response we consume.
// Full schema: https://developer.paddle.com/api-reference/transactions/create-transaction
interface PaddleTransactionResponse {
  data: {
    id: string;
    checkout?: {
      url?: string | null;
    } | null;
  };
}

/**
 * Create Paddle Checkout Session
 *
 * Paddle is simpler than Stripe:
 * - No webhook configuration needed (auto-configured)
 * - Handles taxes automatically
 * - Handles refunds and chargebacks
 */

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Rate limiting + decline-velocity block (parity with Nuvei and
    // Stripe open-order routes). Defends against card-testing campaigns
    // where an attacker rotates stolen cards through a single account/IP.
    const userId = session.user.id;
    const rateLimitResult = RateLimiters.deposit(userId);
    if (!rateLimitResult.success) {
      console.log("🛡️ Rate limit exceeded for user - paddle deposit:", userId);
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment before trying again.",
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        },
      );
    }

    const clientIp = getClientIP(req);
    if (clientIp !== "unknown") {
      const ipLimitResult = RateLimiters.depositByIp(clientIp);
      if (!ipLimitResult.success) {
        console.log("🛡️ IP rate limit exceeded - paddle deposit:", clientIp);
        return NextResponse.json(
          {
            error:
              "Too many payment attempts from your network. Please wait a moment and try again.",
          },
          {
            status: 429,
            headers: getRateLimitHeaders(ipLimitResult),
          },
        );
      }
    }

    if ((await isDeclineBlocked(userId)).blocked) {
      console.log(`🛡️ Decline-velocity block active for user ${userId}`);
      return NextResponse.json(
        {
          error:
            "We've paused deposits from your account due to repeated declined payments. Please try again later or contact support.",
        },
        { status: 429 },
      );
    }
    if (
      clientIp !== "unknown" &&
      (await isDeclineBlocked(`ip:${clientIp}`)).blocked
    ) {
      console.log(`🛡️ Decline-velocity block active for IP ${clientIp}`);
      return NextResponse.json(
        {
          error:
            "We've paused deposits from your network due to repeated declined payments. Please try again later.",
        },
        { status: 429 },
      );
    }

    const { amount, currency = "EUR" } = await req.json();

    // Validate amount
    if (!amount || typeof amount !== "number") {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Reason: honor the admin-configured minimum (transactions.minimumDeposit),
    // falling back to 10 only if unset — keeps every PSP consistent.
    await connectToDatabase();
    const appSettings = await AppSettings.findById("global-app-settings");
    const cs = appSettings?.currency?.symbol || "€";
    const minDeposit = appSettings?.transactions?.minimumDeposit ?? 10;
    if (amount < minDeposit) {
      return NextResponse.json(
        { error: `Minimum deposit is ${cs}${minDeposit}` },
        { status: 400 },
      );
    }

    if (amount > 10000) {
      return NextResponse.json(
        { error: `Maximum deposit is ${cs}10,000` },
        { status: 400 },
      );
    }

    // Check Paddle configuration
    const paddleConfig = await getPaddleConfig();
    if (!paddleConfig) {
      return NextResponse.json(
        { error: "Paddle is not configured. Contact administrator." },
        { status: 400 },
      );
    }

    // Create pending transaction in database
    const transaction = await initiateDeposit(amount, currency);

    // Create Paddle transaction
    // Using Paddle Billing API (v2)
    const paddleTransaction = await paddleRequest<PaddleTransactionResponse>(
      "/transactions",
      {
      method: "POST",
      body: {
        items: [
          {
            price: {
              description: `${amount} Credits for Trading Platform`,
              name: `${amount} Credits`,
              unit_price: {
                amount: Math.round(amount * 100).toString(), // Paddle uses minor units
                currency_code: currency.toUpperCase(),
              },
              product_id: process.env.PADDLE_PRODUCT_ID || undefined, // Optional: use default product
            },
            quantity: 1,
          },
        ],
        customer: {
          email: session.user.email,
        },
        custom_data: {
          user_id: session.user.id,
          transaction_id: transaction._id.toString(),
          type: "deposit",
          amount: amount.toString(),
          // Reason: Stored so the webhook can record decline-velocity against
          // the originating IP (not just the userId).
          ...(clientIp !== "unknown" ? { client_ip: clientIp } : {}),
        },
        currency_code: currency.toUpperCase(),
      },
    });

    // Update transaction with Paddle transaction ID
    await connectToDatabase();
    await WalletTransaction.findByIdAndUpdate(transaction._id, {
      paymentIntentId: paddleTransaction.data.id,
      "metadata.paddleTransactionId": paddleTransaction.data.id,
      "metadata.provider": "paddle",
      ...(clientIp !== "unknown" ? { "metadata.clientIp": clientIp } : {}),
    });

    console.log("✅ Paddle transaction created:", paddleTransaction.data.id);
    console.log("   Amount: €", amount);
    console.log("   User:", session.user.email);

    // Return checkout URL for redirect
    // Paddle provides a hosted checkout page
    const checkoutUrl = paddleTransaction.data.checkout?.url;

    return NextResponse.json({
      success: true,
      transactionId: transaction._id.toString(),
      paddleTransactionId: paddleTransaction.data.id,
      checkoutUrl: checkoutUrl,
      // For inline checkout (Paddle.js)
      clientToken: paddleConfig.publicKey,
      environment: paddleConfig.environment,
    });
  } catch (error) {
    console.error("Error creating Paddle checkout:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create checkout",
      },
      { status: 500 },
    );
  }
}
