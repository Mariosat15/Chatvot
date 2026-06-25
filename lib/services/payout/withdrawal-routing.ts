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
