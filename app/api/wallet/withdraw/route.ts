import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import WithdrawalSettings from "@/database/models/withdrawal-settings.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CreditConversionSettings from "@/database/models/credit-conversion-settings.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import AppSettings from "@/database/models/app-settings.model";
import UserBankAccount from "@/database/models/user-bank-account.model";
import KYCSettings from "@/database/models/kyc-settings.model";
import { sanitizeUserNote, sanitizeAmount } from "@/lib/utils/sanitize";
import { createSecurityLogger } from "@/lib/utils/security-logger";
import { evaluateTwoFactorGate } from "@/lib/services/two-factor-gate.service";

/**
 * GET /api/wallet/withdraw
 * Get withdrawal eligibility and settings for current user
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const [
      withdrawalSettings,
      creditSettings,
      wallet,
      appSettings,
      kycSettings,
    ] = await Promise.all([
      WithdrawalSettings.getSingleton(),
      CreditConversionSettings.getSingleton(),
      CreditWallet.findOne({ userId: session.user.id }),
      AppSettings.findById("global-app-settings"),
      KYCSettings.findOne(),
    ]);

    if (!wallet) {
      return NextResponse.json({
        success: true,
        eligible: false,
        reason: "No wallet found",
        settings: null,
      });
    }

    const isSandbox = appSettings?.simulatorModeEnabled ?? true;
    const cs = appSettings?.currency?.symbol || "€";

    // Determine if KYC is required - check KYC settings first, fallback to withdrawal settings
    // Reason: requiredAmount > 0 means KYC is only needed above that threshold
    const kycEnabledForWithdrawal =
      (kycSettings?.enabled && kycSettings?.requiredForWithdrawal) ||
      withdrawalSettings.requireKYC;

    // For the GET (eligibility check), we don't have a specific amount yet,
    // so we pass the threshold info to let the frontend know
    const kycAmountThreshold = kycSettings?.requiredAmount || 0;

    // Check eligibility
    const eligibility = await checkWithdrawalEligibility(
      session.user.id,
      wallet,
      withdrawalSettings,
      creditSettings,
      isSandbox,
      kycEnabledForWithdrawal,
      cs,
      kycAmountThreshold,
      kycSettings,
    );

    // Calculate fees
    const feePercentage = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeePercentage
      : creditSettings.platformWithdrawalFeePercentage;
    const feeFixed = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeeFixed
      : 0;

    // Get user's last deposit for original payment method
    const lastDeposit = await WalletTransaction.findOne({
      userId: session.user.id,
      transactionType: "deposit",
      status: "completed",
    }).sort({ createdAt: -1 });

    // Get user's bank accounts for withdrawals
    const bankAccounts = await UserBankAccount.getUserAccounts(session.user.id);
    const defaultBankAccount =
      bankAccounts.find((a) => a.isDefault) || bankAccounts[0];
    const hasBankAccount = bankAccounts.length > 0;

    // Get conversion rate
    const conversionRate = creditSettings.eurToCreditsRate || 100;
    const balanceEUR = wallet.creditBalance / conversionRate;

    // Build available withdrawal methods
    const availableWithdrawalMethods: Array<{
      id: string;
      type: "original_method" | "bank_account";
      label: string;
      details: string;
      cardBrand?: string;
      cardLast4?: string;
      bankName?: string;
      ibanLast4?: string;
      country?: string;
      isDefault?: boolean;
      userPaymentOptionId?: string; // Nuvei UPO ID for card refunds
    }> = [];

    // Try to get stored UPOs for card refunds (Nuvei)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let storedUPOs: any[] = [];
    try {
      const NuveiUserPaymentOption = (
        await import("@/database/models/nuvei-user-payment-option.model")
      ).default;
      storedUPOs = await NuveiUserPaymentOption.getActiveUPOs(session.user.id);
    } catch {
      // UPO model may not exist yet
    }

    // Add stored UPOs as card options (these have valid UPO IDs for Nuvei refunds)
    for (const upo of storedUPOs) {
      const expiryStr =
        upo.expMonth && upo.expYear ? `${upo.expMonth}/${upo.expYear}` : "";
      availableWithdrawalMethods.push({
        id: `upo_${upo.userPaymentOptionId}`,
        type: "original_method",
        label: `${upo.cardBrand || "Card"} •••• ${upo.cardLast4 || "****"}`,
        details: expiryStr ? `Expires ${expiryStr}` : "From deposit",
        cardBrand: upo.cardBrand,
        cardLast4: upo.cardLast4,
        userPaymentOptionId: upo.userPaymentOptionId, // CRITICAL: Include UPO ID
      });
    }

    // Add original payment method if no UPOs stored but there's a deposit
    // (without UPO, can only be used for manual refunds, not automatic Nuvei)
    if (storedUPOs.length === 0 && lastDeposit?.paymentMethod) {
      const cardLast4 =
        lastDeposit.metadata?.cardLast4 || lastDeposit.metadata?.last4;
      const cardBrand =
        lastDeposit.metadata?.cardBrand ||
        lastDeposit.metadata?.brand ||
        lastDeposit.paymentMethod;
      const upoFromDeposit = lastDeposit.metadata?.userPaymentOptionId;

      availableWithdrawalMethods.push({
        id: "original_method",
        type: "original_method",
        label: `Original Payment Method`,
        details: cardLast4
          ? `${cardBrand} •••• ${cardLast4}${!upoFromDeposit ? " (manual only)" : ""}`
          : cardBrand,
        cardBrand,
        cardLast4,
        userPaymentOptionId: upoFromDeposit, // May be undefined if old deposit
      });
    }

    // Add bank accounts (only if bank withdrawals are enabled)
    const bankWithdrawalsEnabled =
      withdrawalSettings.bankWithdrawalsEnabled ?? true;
    const cardWithdrawalsEnabled =
      withdrawalSettings.cardWithdrawalsEnabled ?? true;

    if (bankWithdrawalsEnabled) {
      for (const bankAccount of bankAccounts) {
        availableWithdrawalMethods.push({
          id: bankAccount._id.toString(),
          type: "bank_account",
          label:
            bankAccount.nickname || `Bank Account ****${bankAccount.ibanLast4}`,
          details: bankAccount.bankName
            ? `${bankAccount.bankName} (****${bankAccount.ibanLast4})`
            : `****${bankAccount.ibanLast4}`,
          bankName: bankAccount.bankName,
          ibanLast4: bankAccount.ibanLast4,
          country: bankAccount.country,
          isDefault: bankAccount.isDefault,
        });
      }
    }

    // Filter out card methods if card withdrawals are disabled
    const filteredWithdrawalMethods = cardWithdrawalsEnabled
      ? availableWithdrawalMethods
      : availableWithdrawalMethods.filter((m) => m.type !== "original_method");

    // Update warning if no methods available
    if (filteredWithdrawalMethods.length === 0 && eligibility.eligible) {
      eligibility.warnings = eligibility.warnings || [];
      if (!bankWithdrawalsEnabled && !cardWithdrawalsEnabled) {
        eligibility.warnings.push(
          "Withdrawals are currently disabled by the administrator.",
        );
      } else if (!bankWithdrawalsEnabled) {
        eligibility.warnings.push(
          "Bank withdrawals are currently disabled. You can only withdraw to your card.",
        );
      } else if (!cardWithdrawalsEnabled) {
        eligibility.warnings.push(
          "Card withdrawals are currently disabled. Please add a bank account.",
        );
      } else {
        eligibility.warnings.push(
          "No withdrawal method available. Please add a bank account or make a deposit first.",
        );
      }
    }

    return NextResponse.json({
      success: true,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      warnings: eligibility.warnings,
      wallet: {
        balance: wallet.creditBalance,
        balanceEUR: balanceEUR,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        kycVerified: wallet.kycVerified,
        withdrawalEnabled: wallet.withdrawalEnabled,
      },
      settings: {
        minimumWithdrawal: withdrawalSettings.minimumWithdrawal,
        maximumWithdrawal: withdrawalSettings.maximumWithdrawal,
        dailyLimit: withdrawalSettings.dailyWithdrawalLimit,
        monthlyLimit: withdrawalSettings.monthlyWithdrawalLimit,
        feePercentage,
        feeFixed,
        processingTimeHours: withdrawalSettings.processingTimeHours,
        allowedMethods: withdrawalSettings.allowedPayoutMethods,
        preferredMethod: withdrawalSettings.preferredPayoutMethod,
        requireKYC: kycEnabledForWithdrawal,
        kycAmountThreshold,
        conversionRate: conversionRate,
      },
      isSandbox,
      originalPaymentMethod: lastDeposit?.paymentMethod || null,
      // Available withdrawal methods for dropdown (filtered by enabled methods)
      availableWithdrawalMethods: filteredWithdrawalMethods,
      hasWithdrawalMethod: filteredWithdrawalMethods.length > 0,
      // Withdrawal method settings
      bankWithdrawalsEnabled,
      cardWithdrawalsEnabled,
      // Nuvei automatic withdrawal enabled
      nuveiEnabled: withdrawalSettings.nuveiWithdrawalEnabled === true,
      // Legacy bank account info (only if bank withdrawals enabled)
      hasBankAccount: bankWithdrawalsEnabled && hasBankAccount,
      bankAccount: defaultBankAccount
        ? {
            id: defaultBankAccount._id,
            nickname: defaultBankAccount.nickname,
            bankName: defaultBankAccount.bankName,
            ibanLast4: defaultBankAccount.ibanLast4,
            country: defaultBankAccount.country,
            isVerified: defaultBankAccount.isVerified,
          }
        : null,
      bankAccountCount: bankAccounts.length,
    });
  } catch (error) {
    console.error("Error getting withdrawal info:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get withdrawal information" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/wallet/withdraw
 * Create a new withdrawal request
 */
export async function POST(request: NextRequest) {
  // SECURITY: Create logger for this request
  const securityLogger = createSecurityLogger(request);

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      await securityLogger.log({
        statusCode: 401,
        success: false,
        errorMessage: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // SECURITY: Get settings from database (also used for rate limiting)
    const withdrawalSettings = await WithdrawalSettings.getSingleton();

    // SECURITY: Rate limiting - uses admin-configured limits (default 5/min if not set)
    if (withdrawalSettings.apiRateLimitEnabled !== false) {
      const { checkRateLimit, getRateLimitHeaders } =
        await import("@/lib/utils/rate-limiter");
      const rateLimitResult = checkRateLimit(session.user.id, {
        maxRequests: withdrawalSettings.apiRateLimitRequestsPerMinute || 5,
        windowMs: 60 * 1000, // 1 minute window
        keyPrefix: "withdrawal",
      });

      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too many requests. Please wait a moment before trying again.",
          },
          {
            status: 429,
            headers: getRateLimitHeaders(rateLimitResult),
          },
        );
      }
    }

    // withdrawalSettings is reused below - no need to fetch again

    const body = await request.json();
    const {
      withdrawalMethodId,
      userNote: rawUserNote,
      twoFactorCode,
    } = body;

    // SECURITY: Sanitize inputs
    const amountEUR = sanitizeAmount(body.amountEUR);
    const userNote = sanitizeUserNote(rawUserNote);

    if (!amountEUR || amountEUR <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid withdrawal amount" },
        { status: 400 },
      );
    }

    if (!withdrawalMethodId) {
      return NextResponse.json(
        { success: false, error: "Please select a withdrawal method" },
        { status: 400 },
      );
    }

    // SECURITY: Two-factor step-up gate. Runs before any state-changing
    // work so failed / missing TOTP returns cheaply.
    // Reason: withdrawal is the highest-value user action — we block
    // session-hijack attacks by requiring a fresh TOTP when the admin
    // has enabled 2FA enforcement (globally or above a threshold).
    const twoFactorGate = await evaluateTwoFactorGate({
      userId: session.user.id,
      reqHeaders: await headers(),
      code:
        typeof twoFactorCode === "string" ? twoFactorCode.trim() : undefined,
      policy: {
        required: withdrawalSettings.requireTwoFactorForWithdrawal === true,
        requireAboveAmount:
          typeof withdrawalSettings.requireTwoFactorAboveAmount === "number"
            ? withdrawalSettings.requireTwoFactorAboveAmount
            : 0,
        blockIfNotEnabled:
          withdrawalSettings.blockWithdrawalsWithoutTwoFactor === true,
        amount: amountEUR,
      },
    });
    if (!twoFactorGate.ok) {
      return NextResponse.json(
        {
          success: false,
          error: twoFactorGate.error,
          code: twoFactorGate.code,
        },
        { status: twoFactorGate.status },
      );
    }

    // Note: connectToDatabase() already called above for rate limiting
    // Fetch remaining settings (withdrawalSettings already fetched for rate limit check)
    const [creditSettings, wallet, appSettings, kycSettings] =
      await Promise.all([
        CreditConversionSettings.getSingleton(),
        CreditWallet.findOne({ userId: session.user.id }).session(mongoSession),
        AppSettings.findById("global-app-settings"),
        KYCSettings.findOne(),
      ]);

    if (!wallet) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Wallet not found" },
        { status: 404 },
      );
    }

    const isSandbox = appSettings?.simulatorModeEnabled ?? true;
    const kycEnabledForWithdrawal =
      (kycSettings?.enabled && kycSettings?.requiredForWithdrawal) ||
      withdrawalSettings.requireKYC;
    const cs = appSettings?.currency?.symbol || "€";
    const kycAmountThreshold = kycSettings?.requiredAmount || 0;

    // Determine withdrawal method (original method, UPO card, or bank account)
    let bankAccount = null;
    let originalPaymentDetails = null;
    let payoutMethodType = "bank_transfer";

    if (withdrawalMethodId === "original_method") {
      // Using original payment method (card)
      const lastDeposit = await WalletTransaction.findOne({
        userId: session.user.id,
        transactionType: "deposit",
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .session(mongoSession);

      if (!lastDeposit) {
        await mongoSession.abortTransaction();
        return NextResponse.json(
          {
            success: false,
            error:
              "No original payment method found. Please make a deposit first or add a bank account.",
          },
          { status: 400 },
        );
      }

      payoutMethodType = "original_method";
      originalPaymentDetails = {
        paymentIntentId: lastDeposit.metadata?.paymentIntentId,
        paymentMethod: lastDeposit.paymentMethod,
        cardBrand:
          lastDeposit.metadata?.cardBrand || lastDeposit.metadata?.brand,
        cardLast4:
          lastDeposit.metadata?.cardLast4 || lastDeposit.metadata?.last4,
        cardExpMonth: lastDeposit.metadata?.cardExpMonth,
        cardExpYear: lastDeposit.metadata?.cardExpYear,
        cardCountry: lastDeposit.metadata?.cardCountry,
      };
    } else if (withdrawalMethodId.startsWith("upo_")) {
      // Using a Nuvei UPO (User Payment Option) - card from previous deposit
      const upoId = withdrawalMethodId.replace("upo_", "");

      // Try to find the UPO in our stored records
      const NuveiUserPaymentOption = (
        await import("@/database/models/nuvei-user-payment-option.model")
      ).default;
      const storedUpo = await NuveiUserPaymentOption.findOne({
        userId: session.user.id,
        userPaymentOptionId: upoId,
      }).session(mongoSession);

      if (!storedUpo) {
        // UPO not found in our records, but might still be valid in Nuvei; proceed with manual withdrawal
      }

      payoutMethodType = "card_payout";
      originalPaymentDetails = {
        userPaymentOptionId: upoId,
        paymentMethod: "nuvei_card",
        cardBrand: storedUpo?.cardBrand || "Card",
        cardLast4: storedUpo?.cardLast4 || "****",
        cardExpMonth: storedUpo?.expMonth,
        cardExpYear: storedUpo?.expYear,
      };
    } else {
      // Using bank account - withdrawalMethodId should be a valid MongoDB ObjectId
      bankAccount = await UserBankAccount.findOne({
        _id: withdrawalMethodId,
        userId: session.user.id,
        isActive: true,
      }).session(mongoSession);

      if (!bankAccount) {
        await mongoSession.abortTransaction();
        return NextResponse.json(
          { success: false, error: "Selected bank account not found" },
          { status: 400 },
        );
      }

      // Check if this bank account has a Nuvei UPO (created when account was added)
      if (!bankAccount.nuveiUpoId) {
        // Try to find a bank UPO for this user in case it was created separately
        const NuveiUserPaymentOption = (
          await import("@/database/models/nuvei-user-payment-option.model")
        ).default;
        const bankUpo = await NuveiUserPaymentOption.findOne({
          userId: session.user.id,
          type: "bank",
          isActive: true,
        }).sort({ lastUsed: -1 });

        if (bankUpo) {
          bankAccount.nuveiUpoId = String(bankUpo.userPaymentOptionId);
        }
      }

      payoutMethodType = "bank_transfer";
    }

    // Check eligibility (pass actual withdrawal amount for KYC threshold check)
    const eligibility = await checkWithdrawalEligibility(
      session.user.id,
      wallet,
      withdrawalSettings,
      creditSettings,
      isSandbox,
      kycEnabledForWithdrawal,
      cs,
      kycAmountThreshold,
      kycSettings,
      amountEUR, // Reason: pass actual amount so we can check against KYC threshold
    );

    if (!eligibility.eligible) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: eligibility.reason },
        { status: 400 },
      );
    }

    // Validate amount
    if (amountEUR < withdrawalSettings.minimumWithdrawal) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: `Minimum withdrawal is ${cs}${withdrawalSettings.minimumWithdrawal}`,
        },
        { status: 400 },
      );
    }

    if (amountEUR > withdrawalSettings.maximumWithdrawal) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: `Maximum withdrawal is ${cs}${withdrawalSettings.maximumWithdrawal}`,
        },
        { status: 400 },
      );
    }

    // Convert EUR to credits
    const exchangeRate = creditSettings.eurToCreditsRate;
    const amountCredits = amountEUR * exchangeRate;

    if (amountCredits > wallet.creditBalance) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Insufficient balance" },
        { status: 400 },
      );
    }

    // Check daily limit
    const dailyTotal = await WithdrawalRequest.getDailyTotal(session.user.id);
    if (
      withdrawalSettings.dailyWithdrawalLimit > 0 &&
      dailyTotal + amountEUR > withdrawalSettings.dailyWithdrawalLimit
    ) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: `Would exceed daily limit of ${cs}${withdrawalSettings.dailyWithdrawalLimit}`,
        },
        { status: 400 },
      );
    }

    // Check monthly limit
    const monthlyTotal = await WithdrawalRequest.getMonthlyTotal(
      session.user.id,
    );
    if (
      withdrawalSettings.monthlyWithdrawalLimit > 0 &&
      monthlyTotal + amountEUR > withdrawalSettings.monthlyWithdrawalLimit
    ) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: `Would exceed monthly limit of ${cs}${withdrawalSettings.monthlyWithdrawalLimit}`,
        },
        { status: 400 },
      );
    }

    // Calculate fees
    const feePercentage = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeePercentage
      : creditSettings.platformWithdrawalFeePercentage;
    const feeFixed = withdrawalSettings.useCustomFees
      ? withdrawalSettings.platformFeeFixed
      : 0;

    const platformFee = (amountEUR * feePercentage) / 100 + feeFixed;
    const platformFeeCredits = platformFee * exchangeRate;
    const netAmountEUR = amountEUR - platformFee;

    // Deduct credits from wallet
    const balanceBefore = wallet.creditBalance;
    wallet.creditBalance -= amountCredits;
    await wallet.save({ session: mongoSession });

    // Build withdrawal request data based on selected method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withdrawalRequestData: Record<string, any> = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      amountCredits,
      amountEUR,
      exchangeRate,
      platformFee,
      platformFeeCredits,
      bankFee: 0, // Will be calculated when processing
      netAmountEUR,
      status: "pending",
      payoutMethod: payoutMethodType,
      walletBalanceBefore: balanceBefore,
      walletBalanceAfter: wallet.creditBalance,
      isSandbox,
      kycVerified: wallet.kycVerified,
      userNote,
      requestedAt: new Date(),
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    };

    // Add method-specific details
    if (payoutMethodType === "original_method" && originalPaymentDetails) {
      // Original payment method (card refund from Stripe/other provider)
      withdrawalRequestData.originalPaymentId =
        originalPaymentDetails.paymentIntentId;
      withdrawalRequestData.originalPaymentMethod =
        originalPaymentDetails.paymentMethod;
      withdrawalRequestData.originalCardDetails = {
        brand: originalPaymentDetails.cardBrand,
        last4: originalPaymentDetails.cardLast4,
        expMonth: originalPaymentDetails.cardExpMonth,
        expYear: originalPaymentDetails.cardExpYear,
        country: originalPaymentDetails.cardCountry,
      };
    } else if (payoutMethodType === "card_payout" && originalPaymentDetails) {
      // Nuvei UPO card refund
      withdrawalRequestData.originalPaymentMethod =
        originalPaymentDetails.paymentMethod || "nuvei_card";
      withdrawalRequestData.originalCardDetails = {
        brand: originalPaymentDetails.cardBrand,
        last4: originalPaymentDetails.cardLast4,
        expMonth: originalPaymentDetails.cardExpMonth,
        expYear: originalPaymentDetails.cardExpYear,
        userPaymentOptionId: originalPaymentDetails.userPaymentOptionId,
      };
    } else if (bankAccount) {
      // Bank transfer
      withdrawalRequestData.bankDetails = {
        accountHolderName: bankAccount.accountHolderName,
        iban: bankAccount.ibanLast4
          ? `****${bankAccount.ibanLast4}`
          : undefined,
        fullIban: bankAccount.iban, // Store full IBAN for processing
        bankName: bankAccount.bankName,
        swiftBic: bankAccount.swiftBic,
        country: bankAccount.country,
        // Include Nuvei UPO if available (required for automatic processing)
        nuveiUpoId: bankAccount.nuveiUpoId,
      };
      withdrawalRequestData.bankAccountId = bankAccount._id;

      // If bank account has Nuvei UPO, also store it for automatic processing
      if (bankAccount.nuveiUpoId) {
        withdrawalRequestData.originalCardDetails = {
          userPaymentOptionId: bankAccount.nuveiUpoId,
          type: "bank_upo",
        };
      }
    }

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create(
      [withdrawalRequestData],
      { session: mongoSession },
    );

    // Record wallet transaction with proper description (same format as deposits)
    const _withdrawalTx = await WalletTransaction.create(
      [
        {
          userId: session.user.id,
          transactionType: "withdrawal",
          amount: -amountCredits,
          balanceBefore,
          balanceAfter: wallet.creditBalance,
          currency: appSettings?.currency?.code || "EUR",
          exchangeRate,
          status: "pending",
          description: `${amountCredits} credits (${cs}${netAmountEUR.toFixed(2)} net after ${cs}${platformFee.toFixed(2)} fee)`,
          metadata: {
            withdrawalRequestId: withdrawalRequest[0]._id,
            amountEUR,
            netAmountEUR,
            platformFee,
            platformFeePercentage: feePercentage,
            platformFeeFixed: feeFixed,
          },
        },
      ],
      { session: mongoSession },
    );

    // NOTE: Don't create withdrawal_fee transaction here!
    // Withdrawal fees should ONLY be recorded when the withdrawal is actually COMPLETED by admin.
    // This prevents charging users fees for failed/rejected withdrawals.
    // The fee will be recorded in:
    // - apps/admin/app/api/withdrawals/[id]/route.ts when admin marks as 'completed'

    await mongoSession.commitTransaction();

    // NOTE: Don't record withdrawal fee to platform financials here either!
    // It will be recorded when the withdrawal is completed.

    // Check for auto-approval
    // Important: Only auto-approve if Nuvei automatic processing is enabled
    // When Nuvei automatic is OFF (manual mode), withdrawals should stay in 'pending' for admin review
    let autoApproved = false;
    const isManualMode = !withdrawalSettings.nuveiWithdrawalEnabled;

    if (isManualMode) {
      // In manual mode, all withdrawals stay in 'pending' status
      // Admin must manually approve/process them

      // Reason: In manual mode, do NOT call Nuvei here. The /payout.do endpoint
      // directly sends money — it must only be called when admin processes the withdrawal.
      // Instead, just save the UPO info so the admin can trigger the payout later.
      if (withdrawalSettings.usePaymentProcessorForManual) {
        try {
          let userPaymentOptionId: string | undefined;

          if (
            payoutMethodType === "card_payout" &&
            originalPaymentDetails?.userPaymentOptionId
          ) {
            userPaymentOptionId = originalPaymentDetails.userPaymentOptionId;
          } else if (payoutMethodType === "bank_transfer" && bankAccount) {
            userPaymentOptionId = bankAccount.nuveiUpoId;
          }

          // Save the UPO info for admin to use when processing
          withdrawalRequest[0].metadata = {
            ...(withdrawalRequest[0].metadata || {}),
            usePaymentProcessor: true,
            savedUpoId: userPaymentOptionId || null,
            noUpoReason: userPaymentOptionId
              ? undefined
              : "No payment option linked",
          };
          await withdrawalRequest[0].save();

          console.log(
            `📋 Manual withdrawal ${withdrawalRequest[0]._id} saved with UPO ${userPaymentOptionId || "N/A"} — awaiting admin processing`,
          );
        } catch (metadataError) {
          console.error(
            "Error saving withdrawal metadata:",
            metadataError,
          );
          // Don't fail - withdrawal is already created
        }
      }
    } else if (isSandbox && withdrawalSettings.sandboxAutoApprove) {
      // Auto-approve sandbox withdrawals ONLY when automatic processing is enabled
      withdrawalRequest[0].status = "approved";
      withdrawalRequest[0].isAutoApproved = true;
      withdrawalRequest[0].autoApprovalReason = "Sandbox mode auto-approval";
      withdrawalRequest[0].processedAt = new Date();
      await withdrawalRequest[0].save();
      autoApproved = true;
    } else if (
      withdrawalSettings.processingMode === "automatic" &&
      withdrawalSettings.autoApproveEnabled &&
      amountEUR <= withdrawalSettings.autoApproveMaxAmount
    ) {
      // Check auto-approval criteria for production
      const accountCreatedAt = new Date(session.user.createdAt || Date.now());
      const accountAge = Math.floor(
        (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      const previousWithdrawals = await WithdrawalRequest.countDocuments({
        userId: session.user.id,
        status: "completed",
      });

      const meetsKYC =
        !withdrawalSettings.autoApproveRequireKYC || wallet.kycVerified;
      const meetsAge =
        accountAge >= withdrawalSettings.autoApproveMinAccountAge;
      const meetsHistory =
        previousWithdrawals >=
        withdrawalSettings.autoApproveMinSuccessfulWithdrawals;

      if (meetsKYC && meetsAge && meetsHistory) {
        withdrawalRequest[0].status = "approved";
        withdrawalRequest[0].isAutoApproved = true;
        withdrawalRequest[0].autoApprovalReason = `Met auto-approval criteria: Amount ≤ ${cs}${withdrawalSettings.autoApproveMaxAmount}, Account age ${accountAge} days, Previous withdrawals: ${previousWithdrawals}`;
        withdrawalRequest[0].processedAt = new Date();
        await withdrawalRequest[0].save();
        autoApproved = true;
      }
    }

    // Note: Auto-approved withdrawals still need admin to complete the bank transfer
    // The auto-approval just skips the initial review step in sandbox mode
    // Admin must still mark as "completed" after actual bank transfer

    const finalStatus = withdrawalRequest[0].status;
    let message =
      "Withdrawal request submitted successfully. It will be reviewed shortly.";

    if (autoApproved && finalStatus === "approved") {
      message =
        "✅ Withdrawal auto-approved! Funds will be transferred to your bank account within 24-48 hours.";
    } else if (autoApproved && finalStatus === "completed") {
      message = "🎉 Withdrawal processed successfully! Funds are on the way.";
    } else if (finalStatus === "processing") {
      message =
        "Withdrawal approved and being processed! You will be notified when complete.";
    } else if (autoApproved) {
      message = "Withdrawal request approved! Processing will begin shortly.";
    }

    // SECURITY: Log successful withdrawal request
    await securityLogger.log({
      userId: session.user.id,
      userEmail: session.user.email,
      body: { amountEUR, netAmountEUR, withdrawalMethodId, autoApproved },
      statusCode: 200,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message,
      withdrawalRequest: {
        id: withdrawalRequest[0]._id,
        status: finalStatus,
        amountEUR,
        netAmountEUR,
        platformFee,
        estimatedProcessingHours: withdrawalSettings.processingTimeHours,
        isAutoApproved: autoApproved,
        payoutId: withdrawalRequest[0].payoutId || null,
      },
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error("Error creating withdrawal:", error);
    // SECURITY: Log failed withdrawal request
    await securityLogger.log({
      statusCode: 500,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { success: false, error: "Failed to create withdrawal request" },
      { status: 500 },
    );
  } finally {
    mongoSession.endSession();
  }
}

/**
 * Check if user is eligible for withdrawal
 */
async function checkWithdrawalEligibility(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creditSettings: any,
  isSandbox: boolean,
  kycRequired: boolean = false,
  currencySymbol: string = "€",
  kycAmountThreshold: number = 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kycSettings: Record<string, any> | null = null,
  withdrawalAmountEUR?: number,
): Promise<{ eligible: boolean; reason: string; warnings: string[] }> {
  const warnings: string[] = [];

  // Get the actual conversion rate from credit settings
  const conversionRate = creditSettings?.eurToCreditsRate || 100;

  // ============================================
  // FIRST: Check user restrictions (banned/suspended)
  // This must be checked before anything else!
  // ============================================
  const { canUserPerformAction } =
    await import("@/lib/services/user-restriction.service");
  const restrictionCheck = await canUserPerformAction(userId, "withdraw");

  if (!restrictionCheck.allowed) {
    return {
      eligible: false,
      reason:
        restrictionCheck.reason ||
        "Your account is restricted from withdrawals. Please contact support.",
      warnings,
    };
  }

  // Check if sandbox withdrawals are enabled
  if (isSandbox && !settings.sandboxEnabled) {
    return {
      eligible: false,
      reason: "Withdrawals are disabled in sandbox mode",
      warnings,
    };
  }

  // Check if wallet is active
  if (!wallet.isActive) {
    return {
      eligible: false,
      reason: "Your wallet is inactive. Please contact support.",
      warnings,
    };
  }

  // Note: wallet.withdrawalEnabled is no longer checked here
  // Admin withdrawal settings now control eligibility globally

  // Check minimum balance using actual conversion rate
  const minCreditsRequired = settings.minimumWithdrawal * conversionRate;
  if (wallet.creditBalance < minCreditsRequired) {
    const userBalanceEUR = (wallet.creditBalance / conversionRate).toFixed(2);
    return {
      eligible: false,
      reason: `Minimum withdrawal amount is ${currencySymbol}${settings.minimumWithdrawal}. Your balance is ${currencySymbol}${userBalanceEUR}`,
      warnings,
    };
  }

  // Check KYC requirement (uses combined KYC settings from both models)
  // Reason: If kycAmountThreshold > 0, KYC is only required for withdrawals >= threshold
  if (kycRequired && !wallet.kycVerified) {
    const amountToCheck = withdrawalAmountEUR ?? 0;
    const thresholdApplies =
      kycAmountThreshold > 0 && amountToCheck > 0
        ? amountToCheck >= kycAmountThreshold
        : true; // threshold = 0 means always required

    if (thresholdApplies) {
      // Use custom KYC message from settings if available
      const kycMessage =
        kycSettings?.kycRequiredMessage ||
        "KYC verification required before withdrawal. Please complete identity verification.";
      return {
        eligible: false,
        reason: kycMessage,
        warnings,
      };
    } else {
      // Amount is below the KYC threshold — allow but warn
      warnings.push(
        `KYC verification will be required for withdrawals of ${currencySymbol}${kycAmountThreshold} or more.`,
      );
    }
  }

  // Check deposit requirement
  if (settings.minimumDepositRequired && wallet.totalDeposited === 0) {
    return {
      eligible: false,
      reason: "You must make at least one deposit before withdrawing",
      warnings,
    };
  }

  // Check withdrawal frequency limits
  const todayCount = await WithdrawalRequest.countDocuments({
    userId,
    status: { $in: ["pending", "approved", "processing", "completed"] },
    requestedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  });

  if (todayCount >= settings.maxWithdrawalsPerDay) {
    return {
      eligible: false,
      reason: `Maximum ${settings.maxWithdrawalsPerDay} withdrawal requests per day`,
      warnings,
    };
  }

  // Check monthly limit
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthCount = await WithdrawalRequest.countDocuments({
    userId,
    status: { $in: ["pending", "approved", "processing", "completed"] },
    requestedAt: { $gte: startOfMonth },
  });

  if (monthCount >= settings.maxWithdrawalsPerMonth) {
    return {
      eligible: false,
      reason: `Maximum ${settings.maxWithdrawalsPerMonth} withdrawal requests per month`,
      warnings,
    };
  }

  // Check cooldown
  if (settings.cooldownHours > 0) {
    const lastWithdrawal = await WithdrawalRequest.findOne({
      userId,
      status: { $in: ["pending", "approved", "processing", "completed"] },
    }).sort({ requestedAt: -1 });

    if (lastWithdrawal) {
      const cooldownEnd = new Date(lastWithdrawal.requestedAt);
      cooldownEnd.setHours(cooldownEnd.getHours() + settings.cooldownHours);

      if (cooldownEnd > new Date()) {
        const hoursLeft = Math.ceil(
          (cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60),
        );
        return {
          eligible: false,
          reason: `Please wait ${hoursLeft} more hour(s) before your next withdrawal`,
          warnings,
        };
      }
    }
  }

  // Check hold period after deposit
  if (settings.holdPeriodAfterDeposit > 0) {
    const lastDeposit = await WalletTransaction.findOne({
      userId,
      transactionType: "deposit",
      status: "completed",
    }).sort({ createdAt: -1 });

    if (lastDeposit) {
      const holdEnd = new Date(lastDeposit.createdAt);
      holdEnd.setHours(holdEnd.getHours() + settings.holdPeriodAfterDeposit);

      if (holdEnd > new Date()) {
        const hoursLeft = Math.ceil(
          (holdEnd.getTime() - Date.now()) / (1000 * 60 * 60),
        );
        return {
          eligible: false,
          reason: `Please wait ${hoursLeft} more hour(s) after your last deposit`,
          warnings,
        };
      }
    }
  }

  // Check active competitions/challenges
  if (!settings.allowWithdrawalDuringActiveCompetitions) {
    // IMPROVED: Check for participants where BOTH the participant AND competition are still active
    // This handles cases where competition ended but participant status wasn't updated
    const Competition = (
      await import("@/database/models/trading/competition.model")
    ).default;

    // Get all participant records for this user
    const participantRecords = await CompetitionParticipant.find({
      userId: userId,
      status: "active",
    })
      .select("competitionId")
      .lean();

    if (participantRecords.length > 0) {
      // Check if any of these competitions are actually still active
      const competitionIds = participantRecords.map(
        (p: Record<string, unknown>) => p.competitionId,
      );
      const activeCompetitionCount = await Competition.countDocuments({
        _id: { $in: competitionIds },
        status: "active", // Only count if competition itself is still active
      });

      if (activeCompetitionCount > 0) {
        return {
          eligible: false,
          reason: `You have ${activeCompetitionCount} active competition(s). Complete them before withdrawing.`,
          warnings,
        };
      }

      // If participant is 'active' but competition is NOT active, auto-fix the participant status
      if (participantRecords.length > activeCompetitionCount) {
        // Get competitions that are NOT active (auto-fix orphaned participant status)
        const nonActiveCompetitions = await Competition.find({
          _id: { $in: competitionIds },
          status: { $ne: "active" },
        })
          .select("_id status")
          .lean();

        for (const comp of nonActiveCompetitions) {
          const newStatus =
            (comp as Record<string, unknown>).status === "cancelled" ? "refunded" : "completed";
          await CompetitionParticipant.updateMany(
            { userId, competitionId: (comp as Record<string, unknown>)._id, status: "active" },
            { $set: { status: newStatus } },
          );
        }
      }
    }
  }

  if (settings.blockWithdrawalOnActiveChallenges) {
    // Find active challenges where user is either challenger or challenged
    // Status values: 'pending' = waiting for accept, 'accepted' = accepted but not started, 'active' = in progress
    const activeChallenges = await Challenge.find({
      $or: [{ challengerId: userId }, { challengedId: userId }],
      status: { $in: ["pending", "accepted", "active"] },
    })
      .select("_id status challengerId challengedId acceptDeadline createdAt")
      .lean();

    if (activeChallenges.length > 0) {
      // Check if any pending challenges have expired accept deadlines
      const now = new Date();
      const expiredPending = activeChallenges.filter(
        (c: Record<string, unknown>) =>
          c.status === "pending" &&
          c.acceptDeadline &&
          new Date(c.acceptDeadline as string) < now,
      );

      if (expiredPending.length > 0) {
        // Auto-expire these stale challenges
        for (const expiredChallenge of expiredPending) {
          try {
            await Challenge.updateOne(
              { _id: expiredChallenge._id, status: "pending" },
              { $set: { status: "expired", expiredAt: now } },
            );
          } catch (err) {
            console.error(
              `Failed to expire challenge ${expiredChallenge._id}:`,
              err,
            );
          }
        }

        // Re-check after cleanup
        const remainingChallenges = activeChallenges.filter(
          (c: Record<string, unknown>) =>
            !(
              c.status === "pending" &&
              c.acceptDeadline &&
              new Date(c.acceptDeadline as string) < now
            ),
        );

        if (remainingChallenges.length === 0) {
          // Continue to next check instead of blocking
        } else {
          const pendingCount = remainingChallenges.filter(
            (c: Record<string, unknown>) => c.status === "pending",
          ).length;
          const activeCount = remainingChallenges.filter(
            (c: Record<string, unknown>) => c.status === "accepted" || c.status === "active",
          ).length;

          let message = "You have ";
          const parts = [];
          if (pendingCount > 0)
            parts.push(`${pendingCount} pending challenge(s)`);
          if (activeCount > 0) parts.push(`${activeCount} active challenge(s)`);
          message +=
            parts.join(" and ") +
            ". Complete or cancel them before withdrawing.";

          return {
            eligible: false,
            reason: message,
            warnings,
          };
        }
      } else {
        const pendingCount = activeChallenges.filter(
          (c: Record<string, unknown>) => c.status === "pending",
        ).length;
        const activeCount = activeChallenges.filter(
          (c: Record<string, unknown>) => c.status === "accepted" || c.status === "active",
        ).length;

        let message = "You have ";
        const parts = [];
        if (pendingCount > 0)
          parts.push(`${pendingCount} pending challenge(s)`);
        if (activeCount > 0) parts.push(`${activeCount} active challenge(s)`);
        message +=
          parts.join(" and ") + ". Complete or cancel them before withdrawing.";

        return {
          eligible: false,
          reason: message,
          warnings,
        };
      }
    }
  }

  // Check pending withdrawals
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({
    userId,
    status: { $in: ["pending", "approved", "processing"] },
  });

  if (pendingWithdrawals > 0) {
    warnings.push(
      `You have ${pendingWithdrawals} pending withdrawal request(s)`,
    );
  }

  return {
    eligible: true,
    reason: "Eligible for withdrawal",
    warnings,
  };
}
