/**
 * Withdrawal Validator Service
 * ---------------------------------------------------------------------------
 * Single source of truth for every admin-controlled gate that must hold before
 * money leaves the platform. Both the manual route
 * (`/api/wallet/withdraw`) and the automatic Nuvei route
 * (`/api/nuvei/withdrawal`) call into this module, so a setting toggled in the
 * admin panel has the same effect no matter which path a user takes.
 *
 * Reason: previously the Nuvei route duplicated only a subset of the rules,
 * which let attackers bypass ~16 withdrawal policies (restrictions, KYC,
 * daily/monthly caps, cooldown, hold period, active competitions, active
 * challenges, allowed methods, sandbox mode, sanitisation, rate limit, etc.)
 * by using the automatic endpoint. This service closes that gap.
 */

import { connectToDatabase } from "@/database/mongoose";
import WithdrawalSettings, {
  type IWithdrawalSettings,
} from "@/database/models/withdrawal-settings.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import CreditWallet, {
  type ICreditWallet,
} from "@/database/models/trading/credit-wallet.model";
import CreditConversionSettings, {
  type ICreditConversionSettings,
} from "@/database/models/credit-conversion-settings.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import AppSettings from "@/database/models/app-settings.model";
import KYCSettings from "@/database/models/kyc-settings.model";
import {
  checkRateLimit,
  getRateLimitHeaders,
  type RateLimitResult,
} from "@/lib/utils/rate-limiter";
import { sanitizeAmount } from "@/lib/utils/sanitize";
import { evaluateTwoFactorGate } from "@/lib/services/two-factor-gate.service";

/**
 * Minimal structural type for app-settings fields consumed by withdrawal
 * routes. The underlying `AppSettings` model is an untyped Mongoose schema,
 * so we capture only the fields we actually read to avoid leaking `{}` into
 * consumer types.
 */
export interface IAppSettingsShape {
  simulatorModeEnabled?: boolean;
  currency?: {
    code?: string;
    symbol?: string;
    name?: string;
    exchangeRateToEUR?: number;
  };
}

/** Logical payout-method categories used by admin toggles. */
export type PayoutCategory =
  | "bank_transfer"
  | "card_payout"
  | "card_refund"
  | "original_method"
  | "stripe_payout"
  | "stripe_refund";

export interface WithdrawalValidationContext {
  userId: string;
  userEmail?: string;
  reqHeaders: Headers;
  /** Raw EUR amount from the user; will be sanitised inside the validator. */
  amountEUR: number | string | null | undefined;
  /** Logical payout category picked by the user. */
  payoutCategory: PayoutCategory;
  /** TOTP / backup code when the user has 2FA enabled. Optional. */
  twoFactorCode?: string;
  /**
   * Whether to run the global per-user rate limiter. Defaults to true.
   * Set false for internal callers that rate-limit separately.
   */
  enforceRateLimit?: boolean;
}

export interface WithdrawalValidationSuccess {
  ok: true;
  /** Sanitised amount clamped to 2dp. */
  amountEUR: number;
  settings: IWithdrawalSettings;
  /** App-wide currency / sandbox settings (may be null if not initialised). */
  appSettings: IAppSettingsShape | null;
  creditSettings: ICreditConversionSettings;
  kycSettings: Awaited<ReturnType<typeof KYCSettings.findOne>>;
  /** Guaranteed non-null on success — the validator rejects missing wallets. */
  wallet: ICreditWallet;
  computed: {
    isSandbox: boolean;
    currencyCode: string;
    currencySymbol: string;
    exchangeRate: number;
    creditsNeeded: number;
    feePercentage: number;
    feeFixed: number;
    platformFee: number;
    platformFeeCredits: number;
    netAmountEUR: number;
  };
  warnings: string[];
  rateLimitHeaders?: Record<string, string>;
}

export interface WithdrawalValidationFailure {
  ok: false;
  status: number;
  code: WithdrawalFailureCode;
  error: string;
  rateLimitHeaders?: Record<string, string>;
}

export type WithdrawalFailureCode =
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "INVALID_AMOUNT"
  | "USER_RESTRICTED"
  | "WALLET_NOT_FOUND"
  | "WALLET_INACTIVE"
  | "SANDBOX_DISABLED"
  | "KYC_REQUIRED"
  | "MIN_DEPOSIT_REQUIRED"
  | "BELOW_MIN"
  | "ABOVE_MAX"
  | "INSUFFICIENT_BALANCE"
  | "AMOUNT_TOO_SMALL_AFTER_FEES"
  | "DAILY_LIMIT_EXCEEDED"
  | "MONTHLY_LIMIT_EXCEEDED"
  | "MAX_REQUESTS_PER_DAY"
  | "MAX_REQUESTS_PER_MONTH"
  | "COOLDOWN_ACTIVE"
  | "HOLD_PERIOD_ACTIVE"
  | "ACTIVE_COMPETITIONS"
  | "ACTIVE_CHALLENGES"
  | "METHOD_DISABLED"
  | "METHOD_NOT_ALLOWED"
  | "TWO_FACTOR_REQUIRED"
  | "TWO_FACTOR_NOT_ENABLED"
  | "TWO_FACTOR_INVALID";

export type WithdrawalValidationResult =
  | WithdrawalValidationSuccess
  | WithdrawalValidationFailure;

const CURRENCY_FALLBACK_SYMBOL = "€";
const CURRENCY_FALLBACK_CODE = "EUR";

/**
 * Run every admin-controlled gate for a withdrawal attempt.
 *
 * Ordering notes (intentional):
 *   1. Rate limit — cheapest and catches spam without DB work.
 *   2. Amount parse — reject malformed bodies before loading models.
 *   3. DB connect + load all settings in parallel.
 *   4. 2FA step-up — refuses high-risk ops before any state change.
 *   5. Restrictions (banned / suspended user).
 *   6. Wallet + sandbox + KYC + deposit history.
 *   7. Amount thresholds + balance.
 *   8. Fee computation.
 *   9. Rolling limits (daily/monthly amount + count).
 *  10. Cooldown + post-deposit hold.
 *  11. Active competitions + challenges.
 *  12. Method toggles (bank/card) + allowed methods list.
 */
export async function validateWithdrawal(
  ctx: WithdrawalValidationContext,
): Promise<WithdrawalValidationResult> {
  const {
    userId,
    reqHeaders,
    payoutCategory,
    twoFactorCode,
    enforceRateLimit = true,
  } = ctx;
  const warnings: string[] = [];

  if (!userId) {
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  }

  // ---------------------------------------------------------------------------
  // 1) Sanitise amount first — cheapest check, no DB work.
  // ---------------------------------------------------------------------------
  const amountEUR = sanitizeAmount(ctx.amountEUR);
  if (!amountEUR || amountEUR <= 0) {
    return fail(400, "INVALID_AMOUNT", "Invalid withdrawal amount");
  }

  await connectToDatabase();

  // ---------------------------------------------------------------------------
  // 2) Load all settings + wallet in parallel. Doing this before rate-limit
  // gives us the admin-configured limits, and it keeps the total round-trip
  // count low.
  // ---------------------------------------------------------------------------
  const [settings, creditSettings, wallet, appSettings, kycSettings] =
    await Promise.all([
      WithdrawalSettings.getSingleton(),
      CreditConversionSettings.getSingleton(),
      CreditWallet.findOne({ userId }),
      AppSettings.findById("global-app-settings"),
      KYCSettings.findOne(),
    ]);

  const currencySymbol =
    appSettings?.currency?.symbol || CURRENCY_FALLBACK_SYMBOL;
  const currencyCode = appSettings?.currency?.code || CURRENCY_FALLBACK_CODE;
  const isSandbox = appSettings?.simulatorModeEnabled ?? true;

  // ---------------------------------------------------------------------------
  // 3) API rate limiting — uses admin-configured per-minute ceiling.
  // ---------------------------------------------------------------------------
  let rateLimitHeaders: Record<string, string> | undefined;
  if (enforceRateLimit && settings.apiRateLimitEnabled !== false) {
    const rl: RateLimitResult = checkRateLimit(userId, {
      maxRequests: settings.apiRateLimitRequestsPerMinute || 5,
      windowMs: 60 * 1000,
      keyPrefix: "withdrawal",
    });
    rateLimitHeaders = getRateLimitHeaders(rl);
    if (!rl.success) {
      return {
        ok: false,
        status: 429,
        code: "RATE_LIMITED",
        error:
          "Too many requests. Please wait a moment before trying again.",
        rateLimitHeaders,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Two-factor step-up gate (before any state-changing work).
  // ---------------------------------------------------------------------------
  const gate = await evaluateTwoFactorGate({
    userId,
    reqHeaders,
    code:
      typeof twoFactorCode === "string" ? twoFactorCode.trim() : undefined,
    policy: {
      required: settings.requireTwoFactorForWithdrawal === true,
      requireAboveAmount:
        typeof settings.requireTwoFactorAboveAmount === "number"
          ? settings.requireTwoFactorAboveAmount
          : 0,
      blockIfNotEnabled: settings.blockWithdrawalsWithoutTwoFactor === true,
      amount: amountEUR,
    },
  });
  if (!gate.ok) {
    return {
      ok: false,
      status: gate.status,
      code: gate.code as WithdrawalFailureCode,
      error: gate.error,
      rateLimitHeaders,
    };
  }

  // ---------------------------------------------------------------------------
  // 5) User restrictions (banned / suspended).
  // ---------------------------------------------------------------------------
  // Dynamic import keeps the service tree-shakable for tests and avoids a
  // circular dep between the restriction service and mongoose models.
  const { canUserPerformAction } = await import(
    "@/lib/services/user-restriction.service"
  );
  const restriction = await canUserPerformAction(userId, "withdraw");
  if (!restriction.allowed) {
    return fail(
      403,
      "USER_RESTRICTED",
      restriction.reason ||
        "Your account is restricted from withdrawals. Please contact support.",
      rateLimitHeaders,
    );
  }

  // ---------------------------------------------------------------------------
  // 6) Wallet + sandbox + KYC + deposit gating.
  // ---------------------------------------------------------------------------
  if (!wallet) {
    return fail(404, "WALLET_NOT_FOUND", "Wallet not found", rateLimitHeaders);
  }
  if (!wallet.isActive) {
    return fail(
      403,
      "WALLET_INACTIVE",
      "Your wallet is inactive. Please contact support.",
      rateLimitHeaders,
    );
  }

  if (isSandbox && settings.sandboxEnabled === false) {
    return fail(
      403,
      "SANDBOX_DISABLED",
      "Withdrawals are disabled in sandbox mode",
      rateLimitHeaders,
    );
  }

  const kycRequired =
    (kycSettings?.enabled && kycSettings?.requiredForWithdrawal) ||
    settings.requireKYC;
  const kycAmountThreshold = kycSettings?.requiredAmount || 0;
  if (kycRequired && !wallet.kycVerified) {
    const thresholdApplies =
      kycAmountThreshold > 0 ? amountEUR >= kycAmountThreshold : true;
    if (thresholdApplies) {
      const kycMessage =
        kycSettings?.kycRequiredMessage ||
        "KYC verification required before withdrawal. Please complete identity verification.";
      return fail(403, "KYC_REQUIRED", kycMessage, rateLimitHeaders);
    }
    warnings.push(
      `KYC verification will be required for withdrawals of ${currencySymbol}${kycAmountThreshold} or more.`,
    );
  }

  if (settings.minimumDepositRequired && wallet.totalDeposited === 0) {
    return fail(
      403,
      "MIN_DEPOSIT_REQUIRED",
      "You must make at least one deposit before withdrawing",
      rateLimitHeaders,
    );
  }

  // ---------------------------------------------------------------------------
  // 7) Amount thresholds + balance.
  // ---------------------------------------------------------------------------
  if (amountEUR < settings.minimumWithdrawal) {
    return fail(
      400,
      "BELOW_MIN",
      `Minimum withdrawal is ${currencySymbol}${settings.minimumWithdrawal}`,
      rateLimitHeaders,
    );
  }
  if (amountEUR > settings.maximumWithdrawal) {
    return fail(
      400,
      "ABOVE_MAX",
      `Maximum withdrawal is ${currencySymbol}${settings.maximumWithdrawal}`,
      rateLimitHeaders,
    );
  }

  // ---------------------------------------------------------------------------
  // 8) Fee computation — done once and reused by callers to persist the
  // withdrawal request without recomputing.
  // ---------------------------------------------------------------------------
  const exchangeRate = creditSettings.eurToCreditsRate || 1;
  const creditsNeeded = Math.round(amountEUR * exchangeRate * 100) / 100;

  const feePercentage = settings.useCustomFees
    ? settings.platformFeePercentage
    : creditSettings.platformWithdrawalFeePercentage;
  const feeFixed = settings.useCustomFees ? settings.platformFeeFixed : 0;
  const platformFee =
    Math.round(((amountEUR * feePercentage) / 100 + feeFixed) * 100) / 100;
  const platformFeeCredits = platformFee * exchangeRate;
  const netAmountEUR = Math.round((amountEUR - platformFee) * 100) / 100;

  if (netAmountEUR <= 0) {
    return fail(
      400,
      "AMOUNT_TOO_SMALL_AFTER_FEES",
      "Withdrawal amount too small after fees",
      rateLimitHeaders,
    );
  }

  if (creditsNeeded > wallet.creditBalance) {
    return fail(
      400,
      "INSUFFICIENT_BALANCE",
      "Insufficient balance",
      rateLimitHeaders,
    );
  }

  // ---------------------------------------------------------------------------
  // 9) Rolling amount + count limits.
  // ---------------------------------------------------------------------------
  if (settings.dailyWithdrawalLimit > 0) {
    const dailyTotal = await WithdrawalRequest.getDailyTotal(userId);
    if (dailyTotal + amountEUR > settings.dailyWithdrawalLimit) {
      return fail(
        400,
        "DAILY_LIMIT_EXCEEDED",
        `Would exceed daily limit of ${currencySymbol}${settings.dailyWithdrawalLimit}`,
        rateLimitHeaders,
      );
    }
  }
  if (settings.monthlyWithdrawalLimit > 0) {
    const monthlyTotal = await WithdrawalRequest.getMonthlyTotal(userId);
    if (monthlyTotal + amountEUR > settings.monthlyWithdrawalLimit) {
      return fail(
        400,
        "MONTHLY_LIMIT_EXCEEDED",
        `Would exceed monthly limit of ${currencySymbol}${settings.monthlyWithdrawalLimit}`,
        rateLimitHeaders,
      );
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const ACTIVE_STATUSES = [
    "pending",
    "approved",
    "processing",
    "completed",
  ] as const;

  const [todayCount, monthCount] = await Promise.all([
    WithdrawalRequest.countDocuments({
      userId,
      status: { $in: ACTIVE_STATUSES },
      requestedAt: { $gte: startOfDay },
    }),
    WithdrawalRequest.countDocuments({
      userId,
      status: { $in: ACTIVE_STATUSES },
      requestedAt: { $gte: startOfMonth },
    }),
  ]);

  if (settings.maxWithdrawalsPerDay > 0 && todayCount >= settings.maxWithdrawalsPerDay) {
    return fail(
      400,
      "MAX_REQUESTS_PER_DAY",
      `Maximum ${settings.maxWithdrawalsPerDay} withdrawal requests per day`,
      rateLimitHeaders,
    );
  }
  if (
    settings.maxWithdrawalsPerMonth > 0 &&
    monthCount >= settings.maxWithdrawalsPerMonth
  ) {
    return fail(
      400,
      "MAX_REQUESTS_PER_MONTH",
      `Maximum ${settings.maxWithdrawalsPerMonth} withdrawal requests per month`,
      rateLimitHeaders,
    );
  }

  // ---------------------------------------------------------------------------
  // 10) Cooldown + hold-period-after-deposit.
  // ---------------------------------------------------------------------------
  if (settings.cooldownHours > 0) {
    const lastWithdrawal = await WithdrawalRequest.findOne({
      userId,
      status: { $in: ACTIVE_STATUSES },
    }).sort({ requestedAt: -1 });
    if (lastWithdrawal) {
      const cooldownEnd = new Date(lastWithdrawal.requestedAt);
      cooldownEnd.setHours(cooldownEnd.getHours() + settings.cooldownHours);
      if (cooldownEnd > new Date()) {
        const hoursLeft = Math.ceil(
          (cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60),
        );
        return fail(
          400,
          "COOLDOWN_ACTIVE",
          `Please wait ${hoursLeft} more hour(s) before your next withdrawal`,
          rateLimitHeaders,
        );
      }
    }
  }

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
        return fail(
          400,
          "HOLD_PERIOD_ACTIVE",
          `Please wait ${hoursLeft} more hour(s) after your last deposit`,
          rateLimitHeaders,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 11) Active competitions + challenges.
  // ---------------------------------------------------------------------------
  if (!settings.allowWithdrawalDuringActiveCompetitions) {
    const Competition = (
      await import("@/database/models/trading/competition.model")
    ).default;
    const participantRecords = await CompetitionParticipant.find({
      userId,
      status: "active",
    })
      .select("competitionId")
      .lean();
    if (participantRecords.length > 0) {
      const competitionIds = participantRecords.map(
        (p: Record<string, unknown>) => p.competitionId,
      );
      const activeCompetitionCount = await Competition.countDocuments({
        _id: { $in: competitionIds },
        status: "active",
      });
      if (activeCompetitionCount > 0) {
        return fail(
          403,
          "ACTIVE_COMPETITIONS",
          `You have ${activeCompetitionCount} active competition(s). Complete them before withdrawing.`,
          rateLimitHeaders,
        );
      }
    }
  }

  if (settings.blockWithdrawalOnActiveChallenges) {
    const now = new Date();
    const activeChallenges = await Challenge.find({
      $or: [{ challengerId: userId }, { challengedId: userId }],
      status: { $in: ["pending", "accepted", "active"] },
    })
      .select("_id status acceptDeadline")
      .lean();
    const stillBlocking = activeChallenges.filter(
      (c: Record<string, unknown>) => {
        // Reason: a pending challenge whose acceptDeadline has passed should
        // not block withdrawal — the caller's route handler will lazily
        // expire it. Here we just decide whether to block now.
        return !(
          c.status === "pending" &&
          c.acceptDeadline &&
          new Date(c.acceptDeadline as string) < now
        );
      },
    );
    if (stillBlocking.length > 0) {
      const pendingCount = stillBlocking.filter(
        (c: Record<string, unknown>) => c.status === "pending",
      ).length;
      const activeCount = stillBlocking.filter(
        (c: Record<string, unknown>) =>
          c.status === "accepted" || c.status === "active",
      ).length;
      const parts: string[] = [];
      if (pendingCount > 0) parts.push(`${pendingCount} pending challenge(s)`);
      if (activeCount > 0) parts.push(`${activeCount} active challenge(s)`);
      const message = `You have ${parts.join(" and ")}. Complete or cancel them before withdrawing.`;
      return fail(403, "ACTIVE_CHALLENGES", message, rateLimitHeaders);
    }
  }

  // ---------------------------------------------------------------------------
  // 12) Payout-method toggles + allow-list.
  // ---------------------------------------------------------------------------
  const isCardCategory =
    payoutCategory === "card_payout" ||
    payoutCategory === "card_refund" ||
    payoutCategory === "original_method" ||
    payoutCategory === "stripe_refund";
  const isBankCategory =
    payoutCategory === "bank_transfer" ||
    payoutCategory === "stripe_payout";

  if (isCardCategory && settings.cardWithdrawalsEnabled === false) {
    return fail(
      403,
      "METHOD_DISABLED",
      "Card withdrawals are currently disabled. Please use bank transfer.",
      rateLimitHeaders,
    );
  }
  if (isBankCategory && settings.bankWithdrawalsEnabled === false) {
    return fail(
      403,
      "METHOD_DISABLED",
      "Bank withdrawals are currently disabled. Please use your card.",
      rateLimitHeaders,
    );
  }

  // Admin-configured allow-list. Empty list = no restriction.
  if (
    Array.isArray(settings.allowedPayoutMethods) &&
    settings.allowedPayoutMethods.length > 0 &&
    !settings.allowedPayoutMethods.includes(payoutCategory)
  ) {
    return fail(
      403,
      "METHOD_NOT_ALLOWED",
      "This payout method is not enabled by the administrator.",
      rateLimitHeaders,
    );
  }

  return {
    ok: true,
    amountEUR,
    settings,
    appSettings,
    creditSettings,
    kycSettings,
    wallet,
    computed: {
      isSandbox,
      currencyCode,
      currencySymbol,
      exchangeRate,
      creditsNeeded,
      feePercentage,
      feeFixed,
      platformFee,
      platformFeeCredits,
      netAmountEUR,
    },
    warnings,
    rateLimitHeaders,
  };
}

function fail(
  status: number,
  code: WithdrawalFailureCode,
  error: string,
  rateLimitHeaders?: Record<string, string>,
): WithdrawalValidationFailure {
  return { ok: false, status, code, error, rateLimitHeaders };
}
