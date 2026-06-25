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
