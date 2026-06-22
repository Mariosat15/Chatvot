/**
 * Atlas Open Order API
 * Creates a pending deposit transaction and an Atlas hosted-form payment,
 * returning the redirect URL the browser should send the user to.
 *
 * POST /api/atlas/open-order
 * Body: { amount: number, currency?: string, baseAmount?, vatPercentage? }
 *
 * Mirrors app/api/nuvei/open-order/route.ts security guards (rate limits,
 * decline-velocity block, KYC, user restrictions, amount validation,
 * server-side fee computation) and funnels into the same provider-agnostic
 * spine. Only the PSP call differs (atlasService.createPayment).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { atlasService } from "@/lib/services/atlas.service";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import KYCSettings from "@/database/models/kyc-settings.model";
import AppSettings from "@/database/models/app-settings.model";
import {
  RateLimiters,
  getRateLimitHeaders,
  isDeclineBlocked,
  getClientIP,
} from "@/lib/utils/rate-limiter";
import { createSecurityLogger } from "@/lib/utils/security-logger";
import { getRequestGeo } from "@/lib/utils/request-geo";

export async function POST(req: NextRequest) {
  const securityLogger = createSecurityLogger(req);

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      await securityLogger.log({
        statusCode: 401,
        success: false,
        errorMessage: "Not authenticated",
      });
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;

    // SECURITY: per-user (5/min) rate limit.
    const rateLimitResult = RateLimiters.deposit(userId);
    if (!rateLimitResult.success) {
      console.log("🛡️ Rate limit exceeded for user - atlas deposit:", userId);
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment before trying again.",
        },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
      );
    }

    const clientIp = getClientIP(req);
    const clientUserAgent = (req.headers.get("user-agent") || "").slice(0, 500);
    if (clientIp !== "unknown") {
      const ipLimitResult = RateLimiters.depositByIp(clientIp);
      if (!ipLimitResult.success) {
        console.log("🛡️ IP rate limit exceeded - atlas deposit:", clientIp);
        await securityLogger.log({
          statusCode: 429,
          success: false,
          errorMessage: "Deposit IP rate limit exceeded",
        });
        return NextResponse.json(
          {
            error:
              "Too many payment attempts from your network. Please wait a moment and try again.",
          },
          { status: 429, headers: getRateLimitHeaders(ipLimitResult) },
        );
      }
    }

    // SECURITY: decline-velocity block (user + IP).
    const userDeclineBlock = await isDeclineBlocked(userId);
    if (userDeclineBlock.blocked) {
      await securityLogger.log({
        statusCode: 429,
        success: false,
        errorMessage: "Decline-velocity block (user)",
      });
      return NextResponse.json(
        {
          error:
            "We've paused deposits from your account due to repeated declined payments. Please try again later or contact support.",
        },
        { status: 429 },
      );
    }
    if (clientIp !== "unknown") {
      const ipDeclineBlock = await isDeclineBlocked(`ip:${clientIp}`);
      if (ipDeclineBlock.blocked) {
        await securityLogger.log({
          statusCode: 429,
          success: false,
          errorMessage: "Decline-velocity block (IP)",
        });
        return NextResponse.json(
          {
            error:
              "We've paused deposits from your network due to repeated declined payments. Please try again later.",
          },
          { status: 429 },
        );
      }
    }

    await connectToDatabase();

    // KYC gate for deposits.
    const kycSettings = await KYCSettings.findOne();
    if (kycSettings?.enabled && kycSettings?.requiredForDeposit) {
      const wallet = await CreditWallet.findOne({ userId });
      if (!wallet?.kycVerified) {
        const kycMessage =
          kycSettings?.kycRequiredMessage ||
          "KYC verification required before depositing. Please complete identity verification first.";
        return NextResponse.json({ error: kycMessage }, { status: 403 });
      }
    }

    // User restriction gate.
    const { canUserPerformAction } = await import(
      "@/lib/services/user-restriction.service"
    );
    const restrictionCheck = await canUserPerformAction(userId, "deposit");
    if (!restrictionCheck.allowed) {
      await securityLogger.log({
        statusCode: 403,
        success: false,
        errorMessage: "User restricted from deposits",
      });
      return NextResponse.json(
        {
          error:
            restrictionCheck.reason ||
            "Your account is restricted and cannot make deposits. Please contact support.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { amount, currency = "EUR", baseAmount, vatPercentage = 0 } = body;

    // Reason: round the charge to 2 decimals. The client total can carry a 3rd
    // decimal (base × (1+vat) × (1+fee)), and payment processors expect a clean
    // minor-unit currency amount — sending e.g. 62.475 can be rejected or
    // silently mishandled. Rounding here keeps the Atlas charge, `totalCharged`
    // metadata, and bank-fee math all consistent.
    const amountNum = Math.round(parseFloat(amount) * 100) / 100;
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Base currency settings.
    const appSettings = await AppSettings.findById("app-settings");
    const cs = appSettings?.currency?.symbol || "€";
    const baseCurrencyCode = appSettings?.currency?.code || "EUR";

    // Reason: honor the admin-configured minimum (transactions.minimumDeposit)
    // instead of a hardcoded 10; fall back to 10 only if unset.
    const minDeposit = appSettings?.transactions?.minimumDeposit ?? 10;
    const maxDeposit = appSettings?.transactions?.maximumDeposit ?? 10000;
    if (amountNum < minDeposit) {
      return NextResponse.json(
        { error: `Minimum deposit is ${cs}${minDeposit}` },
        { status: 400 },
      );
    }
    if (amountNum > maxDeposit) {
      return NextResponse.json(
        { error: `Maximum deposit is ${cs}${maxDeposit.toLocaleString()}` },
        { status: 400 },
      );
    }

    const allowedCurrencies = [baseCurrencyCode, "EUR", "USD", "GBP"];
    if (!allowedCurrencies.includes(currency.toUpperCase())) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }

    // Prevent rapid duplicate orders (5s window).
    const recentPending = await WalletTransaction.findOne({
      userId,
      status: "pending",
      provider: "atlas",
      createdAt: { $gte: new Date(Date.now() - 5000) },
    });
    if (recentPending) {
      return NextResponse.json(
        { error: "Please wait a moment before trying again." },
        { status: 429 },
      );
    }

    // Auto-cancel stale pending Atlas transactions (older than 30 min).
    const oldPending = await WalletTransaction.updateMany(
      {
        userId,
        status: "pending",
        provider: "atlas",
        createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      {
        $set: {
          status: "cancelled",
          failureReason: "Session expired",
          processedAt: new Date(),
        },
      },
    );
    if (oldPending.modifiedCount > 0) {
      console.log(
        `🧹 Auto-cancelled ${oldPending.modifiedCount} old pending Atlas transactions`,
      );
    }

    // Ensure wallet exists.
    let wallet = await CreditWallet.findOne({ userId });
    if (!wallet) {
      wallet = await CreditWallet.create({
        userId,
        creditBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        totalSpentOnChallenges: 0,
        totalWonFromChallenges: 0,
        totalSpentOnMarketplace: 0,
        isActive: true,
      });
    }

    const currentBalance = wallet.creditBalance || 0;

    // Server-side fee + credit computation (source of truth).
    const CreditConversionSettings = (
      await import("@/database/models/credit-conversion-settings.model")
    ).default;
    const feeSettings = await CreditConversionSettings.getSingleton();
    const serverPlatformFeePercent =
      feeSettings.platformDepositFeePercentage || 0;
    const eurToCreditsRate = feeSettings.eurToCreditsRate || 1;

    const clampedVatPercent = Math.max(
      0,
      Math.min(30, parseFloat(vatPercentage) || 0),
    );

    // total = base * (1 + vat%) * (1 + platformFee%)
    const divisor =
      (1 + clampedVatPercent / 100) * (1 + serverPlatformFeePercent / 100);
    const serverBaseAmount = Math.round((amountNum / divisor) * 100) / 100;

    if (
      baseAmount !== undefined &&
      baseAmount !== null &&
      Math.abs(parseFloat(baseAmount) - serverBaseAmount) > 0.5
    ) {
      console.error(
        `🚨 SECURITY: Atlas baseAmount mismatch — client ${baseAmount}, server ${serverBaseAmount}`,
      );
      return NextResponse.json(
        { error: "Invalid fee calculation. Please refresh and try again." },
        { status: 400 },
      );
    }

    const creditsToReceive =
      Math.round(serverBaseAmount * eurToCreditsRate * 100) / 100;
    const serverVatAmount =
      Math.round(serverBaseAmount * clampedVatPercent) / 100;
    const serverPlatformFeeAmount =
      Math.round(
        (serverBaseAmount + serverVatAmount) * serverPlatformFeePercent,
      ) / 100;

    const bankDepositFeePercentage =
      feeSettings.bankDepositFeePercentage || 2.9;
    const bankDepositFeeFixed = feeSettings.bankDepositFeeFixed || 0.3;
    const bankFeePercentage = (amountNum * bankDepositFeePercentage) / 100;
    const bankFeeTotal = bankFeePercentage + bankDepositFeeFixed;
    const netPlatformEarning = serverPlatformFeeAmount - bankFeeTotal;

    let txDescription = `${creditsToReceive} credits`;
    const feeParts = [];
    if (serverVatAmount > 0) feeParts.push(`VAT €${serverVatAmount.toFixed(2)}`);
    if (serverPlatformFeeAmount > 0)
      feeParts.push(`Fee €${serverPlatformFeeAmount.toFixed(2)}`);
    if (feeParts.length > 0) {
      txDescription = `${creditsToReceive} credits (Total paid: €${amountNum.toFixed(2)} incl. ${feeParts.join(", ")})`;
    }

    // STEP 1: create pending transaction with full fee metadata.
    const pendingTransaction = await WalletTransaction.create({
      userId,
      transactionType: "deposit",
      amount: creditsToReceive,
      currency,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + creditsToReceive,
      status: "pending",
      provider: "atlas",
      paymentMethod: "card",
      description: txDescription,
      metadata: {
        walletId: wallet._id.toString(),
        initiatedAt: new Date().toISOString(),
        paymentProvider: "atlas",
        eurAmount: serverBaseAmount,
        creditsReceived: creditsToReceive,
        exchangeRate: eurToCreditsRate,
        totalCharged: amountNum,
        vatAmount: serverVatAmount,
        vatPercentage: clampedVatPercent,
        platformDepositFeePercentage: serverPlatformFeePercent,
        platformFeeAmount: serverPlatformFeeAmount,
        bankDepositFeePercentage,
        bankDepositFeeFixed,
        bankFeeTotal: parseFloat(bankFeeTotal.toFixed(2)),
        netPlatformEarning: parseFloat(netPlatformEarning.toFixed(2)),
        clientIp: clientIp !== "unknown" ? clientIp : undefined,
        userAgent: clientUserAgent || undefined,
        ...(() => {
          const geo = getRequestGeo(req);
          return {
            clientCountry: geo.country,
            clientCity: geo.city,
            clientRegion: geo.region,
          };
        })(),
      },
    });

    // STEP 2: correlation token echoed back on every Atlas callback.
    const additionalData = `txn_${pendingTransaction._id.toString()}`;

    // Build success / fail return URLs (provider config first, then origin).
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;
    const creds = await atlasService.getCredentials();
    const successUrl =
      creds?.successUrl || `${origin}/wallet?status=success&provider=atlas`;
    const failUrl =
      creds?.failUrl || `${origin}/wallet?status=failed&provider=atlas`;

    // STEP 3: create the Atlas hosted-form payment.
    const result = await atlasService.createPayment({
      amount: amountNum,
      currency,
      message: `Deposit of ${creditsToReceive} credits`,
      successUrl,
      failUrl,
      additionalData,
      beneficiaryUrl: origin || undefined,
    });

    if ("error" in result) {
      await WalletTransaction.findByIdAndDelete(pendingTransaction._id);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // STEP 4: persist Atlas payment id (preserve fee metadata via $set).
    await WalletTransaction.findByIdAndUpdate(pendingTransaction._id, {
      $set: {
        providerTransactionId: result.paymentId,
        "metadata.atlasPaymentId": result.paymentId,
        "metadata.atlasUserId": result.userId,
        "metadata.additionalData": additionalData,
      },
    });

    await securityLogger.log({
      userId,
      userEmail: session.user.email,
      body: {
        amount: amountNum,
        currency,
        transactionId: pendingTransaction._id,
      },
      statusCode: 200,
      success: true,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: result.paymentId,
      transactionId: pendingTransaction._id.toString(),
    });
  } catch (error) {
    console.error("Atlas open order error:", error);
    await securityLogger.log({
      statusCode: 500,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 },
    );
  }
}
