import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import {
  getStripeClient,
  eurToCents,
  STRIPE_CONFIG,
} from "@/lib/stripe/config";
import { initiateDeposit } from "@/lib/actions/trading/wallet.actions";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import KYCSettings from "@/database/models/kyc-settings.model";
import AppSettings from "@/database/models/app-settings.model";
import { connectToDatabase } from "@/database/mongoose";

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get base currency settings
    const appSettings = await AppSettings.findById("global-app-settings");
    const cs = appSettings?.currency?.symbol || "€";
    const currencyCode = (appSettings?.currency?.code || "EUR").toLowerCase();

    // Check if KYC is required for deposits
    const kycSettings = await KYCSettings.findOne();
    if (kycSettings?.enabled && kycSettings?.requiredForDeposit) {
      const wallet = await CreditWallet.findOne({ userId: session.user.id });
      if (!wallet?.kycVerified) {
        console.log(
          `🛡️ KYC required for deposit - user ${session.user.id} not verified`,
        );
        // Reason: Use custom KYC message from settings if available
        const kycMessage =
          kycSettings?.kycRequiredMessage ||
          "KYC verification required before depositing. Please complete identity verification first.";
        return NextResponse.json(
          { error: kycMessage },
          { status: 403 },
        );
      }
    }

    // ✅ CHECK USER RESTRICTIONS - Blocked users cannot deposit
    const { canUserPerformAction } =
      await import("@/lib/services/user-restriction.service");
    const restrictionCheck = await canUserPerformAction(
      session.user.id,
      "deposit",
    );

    if (!restrictionCheck.allowed) {
      console.log(
        `❌ Deposit blocked for user ${session.user.id}: ${restrictionCheck.reason}`,
      );
      return NextResponse.json(
        {
          error:
            restrictionCheck.reason ||
            "Your account is restricted and cannot make deposits. Please contact support.",
        },
        { status: 403 },
      );
    }

    // Get amount from request (amount = base credits, totalAmount = with VAT + platform fee)
    const {
      amount,
      totalAmount,
      vatAmount,
      vatPercentage,
      platformFeeAmount,
      platformFeePercentage,
    } = await req.json();

    // Validate amount
    if (!amount || typeof amount !== "number") {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (amount < STRIPE_CONFIG.minimumDeposit) {
      return NextResponse.json(
        { error: `Minimum deposit is ${cs}${STRIPE_CONFIG.minimumDeposit}` },
        { status: 400 },
      );
    }

    if (amount > STRIPE_CONFIG.maximumDeposit) {
      return NextResponse.json(
        { error: `Maximum deposit is ${cs}${STRIPE_CONFIG.maximumDeposit}` },
        { status: 400 },
      );
    }

    // Charge amount is totalAmount (including VAT + platform fee) or just amount if no fees
    const chargeAmount =
      totalAmount && typeof totalAmount === "number" ? totalAmount : amount;

    // SECURITY: Validate that client's base amount matches server-side
    // computation to prevent amount tampering (same formula as DepositModal.tsx).
    const CreditConversionSettings = (
      await import("@/database/models/credit-conversion-settings.model")
    ).default;
    const feeSettings = await CreditConversionSettings.getSingleton();
    const serverPlatformFeePercent =
      feeSettings.platformDepositFeePercentage || 0;
    const clampedVatPercent = Math.max(
      0,
      Math.min(30, parseFloat(vatPercentage) || 0),
    );
    const divisor =
      (1 + clampedVatPercent / 100) * (1 + serverPlatformFeePercent / 100);
    const expectedBase =
      Math.round((chargeAmount / divisor) * 100) / 100;

    if (Math.abs(amount - expectedBase) > 0.5) {
      console.error(
        `🚨 SECURITY: Stripe amount mismatch — client base ${amount}, server computed ${expectedBase} from charge ${chargeAmount}`,
      );
      return NextResponse.json(
        { error: "Invalid fee calculation. Please refresh and try again." },
        { status: 400 },
      );
    }

    // Reason: initiateDeposit receives EUR and converts to credits internally
    // using eurToCreditsRate from the DB. We pass the verified EUR base.
    const eurToCreditsRate = feeSettings.eurToCreditsRate || 1;
    const verifiedCredits = Math.round(expectedBase * eurToCreditsRate * 100) / 100;

    const transaction = await initiateDeposit(
      expectedBase,
      currencyCode.toUpperCase(),
    );

    // Get Stripe client with database credentials
    const stripe = await getStripeClient();

    // Build description
    let description = `Purchase of ${cs}${verifiedCredits} credits`;
    const feeDetails = [];
    if (vatAmount && vatAmount > 0)
      feeDetails.push(`VAT ${cs}${vatAmount.toFixed(2)}`);
    if (platformFeeAmount && platformFeeAmount > 0)
      feeDetails.push(`Platform Fee ${cs}${platformFeeAmount.toFixed(2)}`);
    if (feeDetails.length > 0) description += ` + ${feeDetails.join(" + ")}`;

    // Create Stripe Payment Intent - FORCE CARD ONLY (no Link, wallets, or saved methods)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: eurToCents(chargeAmount), // Charge total including VAT + platform fee
      currency: currencyCode, // Reason: Use base currency from admin settings instead of hardcoded "eur"
      // Force manual card input only - required for fraud detection
      payment_method_types: ["card"],
      // Disable automatic payment methods to prevent Link and other saved methods
      automatic_payment_methods: undefined,
      metadata: {
        userId: session.user.id,
        transactionId: transaction._id.toString(),
        type: "deposit",
        baseAmount: verifiedCredits.toString(),
        vatAmount: (vatAmount || 0).toString(),
        vatPercentage: (vatPercentage || 0).toString(),
        platformFeeAmount: (platformFeeAmount || 0).toString(),
        platformFeePercentage: (platformFeePercentage || 0).toString(),
        totalAmount: chargeAmount.toString(),
      },
      description,
    });

    // Update transaction with payment intent ID, fee info, and accurate description
    await connectToDatabase();

    let txDescription = `Purchase of ${verifiedCredits} credits`;
    const feeParts = [];
    if (vatAmount && vatAmount > 0)
      feeParts.push(`VAT ${cs}${vatAmount.toFixed(2)}`);
    if (platformFeeAmount && platformFeeAmount > 0)
      feeParts.push(`Fee ${cs}${platformFeeAmount.toFixed(2)}`);
    if (feeParts.length > 0) {
      txDescription = `${verifiedCredits} credits (Total paid: ${cs}${chargeAmount.toFixed(2)} incl. ${feeParts.join(", ")})`;
    }

    await WalletTransaction.findByIdAndUpdate(transaction._id, {
      paymentIntentId: paymentIntent.id,
      description: txDescription,
      "metadata.vatAmount": vatAmount || 0,
      "metadata.vatPercentage": clampedVatPercent,
      "metadata.platformFeeAmount": platformFeeAmount || 0,
      "metadata.platformFeePercentage": serverPlatformFeePercent,
      "metadata.totalCharged": chargeAmount,
    });

    console.log("✅ Payment Intent created:", paymentIntent.id);
    console.log(
      `   Total charge: ${cs}${chargeAmount} (Credits: ${cs}${verifiedCredits}, VAT: ${cs}${vatAmount || 0}, Platform Fee: ${cs}${platformFeeAmount || 0})`,
    );

    // Send deposit initiated notification
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");
      await notificationService.notifyDepositInitiated(session.user.id, verifiedCredits);
      console.log(
        `🔔 Deposit initiated notification sent to user ${session.user.id}`,
      );
    } catch (notifError) {
      console.error(
        "❌ Error sending deposit initiated notification:",
        notifError,
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create payment intent",
      },
      { status: 500 },
    );
  }
}
