/**
 * Withdrawal Routing Resolver
 *
 * Converts the admin's WithdrawalSettings into a single, easy-to-use decision
 * object that every withdrawal code-path shares:
 *   - sendToProvider : the master switch ("send withdrawals to a PSP" on/off)
 *   - providerId     : which payout provider executes automatic payouts
 *   - canAutoProcess : final yes/no for automatic processing
 *   - isManual       : convenience inverse of canAutoProcess
 *
 * Reason: keeping this logic in one place means the user route, the admin
 * processing route and the worker all make the same decision. Adding a new
 * provider or flipping the master switch never requires touching the routes.
 */

import {
  DEFAULT_WITHDRAWAL_PROVIDER,
  getPayoutProvider,
  type PayoutProviderDefinition,
} from "./payout-providers";

export interface WithdrawalRoutingSettings {
  /** Master switch — when false, NEVER call a PSP (pure manual processing). */
  sendWithdrawalsToProvider?: boolean;
  /** Provider id that handles automatic payouts (e.g. "nuvei"). */
  withdrawalProvider?: string;
  /** Legacy Nuvei enable flag (used as the per-provider enable for Nuvei). */
  nuveiWithdrawalEnabled?: boolean;
  /**
   * "Use <provider> for Manual Withdrawals" — when true, BANK withdrawals in
   * the manual workflow are sent to the provider on admin approval instead of
   * being paid by hand. Does not affect CARD payouts (always via provider).
   */
  usePaymentProcessorForManual?: boolean;
}

export interface WithdrawalRouting {
  /** Master switch: are outgoing provider payouts allowed at all? */
  sendToProvider: boolean;
  /** Resolved provider id. */
  providerId: string;
  /** Resolved provider label (falls back to the id when unknown). */
  providerLabel: string;
  /** Resolved provider definition (undefined when the id is unknown). */
  provider: PayoutProviderDefinition | undefined;
  /** Does the resolved provider support payouts? */
  supportsPayout: boolean;
  /** Is the provider's automatic processing enabled (per-provider flag)? */
  providerEnabled: boolean;
  /** Final decision: automatic payouts can run. */
  canAutoProcess: boolean;
  /** Convenience inverse of canAutoProcess. */
  isManual: boolean;
  /** Human-readable explanation (for logs and admin UI). */
  reason: string;
}

export function resolveWithdrawalRouting(
  // Accept any settings-shaped object (e.g. a Mongoose document) — only the
  // fields below are read.
  settings: Partial<WithdrawalRoutingSettings> | null | undefined,
): WithdrawalRouting {
  const s = (settings || {}) as WithdrawalRoutingSettings;

  // Default TRUE for backward compatibility: existing installs keep their
  // current provider behaviour until an admin explicitly turns this off.
  const sendToProvider = s.sendWithdrawalsToProvider !== false;
  const providerId =
    (typeof s.withdrawalProvider === "string" && s.withdrawalProvider) ||
    DEFAULT_WITHDRAWAL_PROVIDER;

  const provider = getPayoutProvider(providerId);
  const supportsPayout = !!provider?.supportsPayout;

  // Per-provider enable flag (e.g. nuveiWithdrawalEnabled). When a provider
  // declares no flag, selecting it is treated as the enable signal. Read the
  // flag by name via a safe cast so concrete settings objects are accepted.
  const enableFlag = provider?.enableFlag;
  const flags = s as Record<string, unknown>;
  const providerEnabled = enableFlag
    ? // eslint-disable-next-line security/detect-object-injection -- enableFlag comes from our own static registry, not user input
      flags[enableFlag] === true
    : supportsPayout;

  const canAutoProcess = sendToProvider && supportsPayout && providerEnabled;
  const isManual = !canAutoProcess;

  let reason: string;
  if (!sendToProvider) {
    reason =
      "Outgoing provider payouts are disabled — withdrawals are processed manually.";
  } else if (!provider) {
    reason = `Unknown withdrawal provider "${providerId}" — withdrawals are processed manually.`;
  } else if (!supportsPayout) {
    reason = `${provider.label} cannot execute payouts — withdrawals are processed manually.`;
  } else if (!providerEnabled) {
    reason = `${provider.label} automatic payouts are not enabled — withdrawals are processed manually.`;
  } else {
    reason = `Automatic payouts via ${provider.label}.`;
  }

  return {
    sendToProvider,
    providerId,
    providerLabel: provider?.label || providerId,
    provider,
    supportsPayout,
    providerEnabled,
    canAutoProcess,
    isManual,
    reason,
  };
}

/**
 * Logical category of a payout method. The payout *method* fundamentally
 * constrains how money can move:
 *   - "card" → can ONLY be paid by a PSP (card-network refund). Never manual.
 *   - "bank" → can be paid by the PSP OR manually by the admin (bank transfer).
 */
export type PayoutMethodCategory = "card" | "bank";

export function categorizePayoutMethod(
  payoutMethod?: string | null,
): PayoutMethodCategory {
  if (
    payoutMethod === "original_method" ||
    payoutMethod === "card_payout" ||
    payoutMethod === "nuvei_card_payout"
  ) {
    return "card";
  }
  // bank_transfer, nuvei_bank_transfer and anything else default to bank.
  return "bank";
}

export interface PayoutExecutionInput {
  /** The withdrawal's payout method (e.g. "card_payout", "bank_transfer"). */
  payoutMethod?: string | null;
  /**
   * Override for the "Use <provider> for Manual Withdrawals" toggle. When
   * omitted it is read from settings.usePaymentProcessorForManual.
   */
  usePaymentProcessorForManual?: boolean;
}

export interface PayoutExecutionDecision {
  /** Call the PSP for THIS specific withdrawal. */
  useProvider: boolean;
  /** Admin must transfer the money by hand (no PSP call). */
  manual: boolean;
  /** Card vs bank classification used for the decision. */
  category: PayoutMethodCategory;
  providerId: string;
  providerLabel: string;
  /** Human-readable explanation (for logs and admin UI). */
  reason: string;
}

/**
 * Per-withdrawal payout decision. Combines the global routing (master switch +
 * provider + enable flags) with the withdrawal's own method:
 *
 *   • CARD  → always sent via the provider (cards can't be paid by hand),
 *             as long as the master switch is ON and the provider supports
 *             card payouts.
 *   • BANK  → manual UNLESS automatic is enabled OR the admin opted to route
 *             manual bank withdrawals through the provider (and the provider
 *             supports bank payouts).
 *
 * Reason: keeping this single, provider-capability-driven function means new
 * payout providers only declare their capabilities in the registry — no route
 * needs to special-case card vs bank again.
 */
export function resolvePayoutExecution(
  settings: Partial<WithdrawalRoutingSettings> | null | undefined,
  input: PayoutExecutionInput,
): PayoutExecutionDecision {
  const routing = resolveWithdrawalRouting(settings);
  const category = categorizePayoutMethod(input.payoutMethod);
  const usePPForManual =
    input.usePaymentProcessorForManual ??
    (settings || {}).usePaymentProcessorForManual === true;

  const base = {
    category,
    providerId: routing.providerId,
    providerLabel: routing.providerLabel,
  };

  // Master switch OFF → never call a PSP.
  if (!routing.sendToProvider) {
    return {
      ...base,
      useProvider: false,
      manual: true,
      reason:
        category === "card"
          ? "Card payouts require a payment provider, but outgoing provider payouts are disabled — pay the user to a bank account instead."
          : "Outgoing provider payouts are disabled — pay this withdrawal manually.",
    };
  }

  if (category === "card") {
    // Card refunds can only be executed by a PSP — never manual.
    const canCard = routing.supportsPayout && !!routing.provider?.supportsCardPayout;
    return {
      ...base,
      useProvider: canCard,
      manual: !canCard,
      reason: canCard
        ? `Card payout — always sent via ${routing.providerLabel} (cards cannot be paid by hand).`
        : `${routing.providerLabel} cannot pay out to cards — manual follow-up required.`,
    };
  }

  // BANK payout: manual unless automatic is enabled OR the admin routes manual
  // bank withdrawals through the provider — and the provider supports it.
  const wantsProvider = routing.canAutoProcess || usePPForManual;
  const canBank = routing.supportsPayout && !!routing.provider?.supportsBankPayout;
  const useProvider = wantsProvider && canBank;
  return {
    ...base,
    useProvider,
    manual: !useProvider,
    reason: useProvider
      ? `Bank payout via ${routing.providerLabel}.`
      : "Bank payout — paid manually by the admin (no provider call).",
  };
}
