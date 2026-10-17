/**
 * Withdrawal Routing Resolver — admin mirror.
 *
 * Converts the admin's WithdrawalSettings into a single decision object that
 * every withdrawal code-path shares. Keep in sync with the main app copy at
 * lib/services/payout/withdrawal-routing.ts.
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
  sendToProvider: boolean;
  providerId: string;
  providerLabel: string;
  provider: PayoutProviderDefinition | undefined;
  supportsPayout: boolean;
  providerEnabled: boolean;
  canAutoProcess: boolean;
  isManual: boolean;
  reason: string;
}

export function resolveWithdrawalRouting(
  settings: WithdrawalRoutingSettings | null | undefined,
): WithdrawalRouting {
  const s = settings || {};

  // Default TRUE for backward compatibility.
  const sendToProvider = s.sendWithdrawalsToProvider !== false;
  const providerId =
    (typeof s.withdrawalProvider === "string" && s.withdrawalProvider) ||
    DEFAULT_WITHDRAWAL_PROVIDER;

  const provider = getPayoutProvider(providerId);
  const supportsPayout = !!provider?.supportsPayout;

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
