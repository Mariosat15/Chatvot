/**
 * Payout Provider Registry (single source of truth) — admin mirror.
 *
 * This is the plug-and-play core for withdrawal/payout providers. To add a
 * new payout provider in the future you only need to:
 *   1. Add an entry to PAYOUT_PROVIDERS below (declare its capabilities).
 *   2. Implement a payout adapter (see ./payout-adapter.ts) and register it
 *      in ./payout-adapter-registry.ts.
 *
 * No withdrawal route, settings UI or model has to be rewritten — they all
 * read from this registry. Keep this file in sync with the main app copy at
 * lib/services/payout/payout-providers.ts.
 */

export interface PayoutProviderDefinition {
  /** Stable identifier stored in settings + on withdrawal records. */
  id: string;
  /** Human-friendly label shown in the admin UI. */
  label: string;
  /** Can this provider send money out at all? (Deposit-only providers = false) */
  supportsPayout: boolean;
  /** Supports refunding/paying out to a card. */
  supportsCardPayout: boolean;
  /** Supports SEPA / bank account payouts. */
  supportsBankPayout: boolean;
  /** Short explanation surfaced in the admin UI. */
  description: string;
  /**
   * Name of the WithdrawalSettings boolean flag that turns on this provider's
   * automatic processing. When omitted, selecting the provider is treated as
   * the enable signal.
   */
  enableFlag?: string;
}

/** Default provider used when none is configured (back-compat with Nuvei-only). */
export const DEFAULT_WITHDRAWAL_PROVIDER = "nuvei";

export const PAYOUT_PROVIDERS: PayoutProviderDefinition[] = [
  {
    id: "nuvei",
    label: "Nuvei",
    supportsPayout: true,
    supportsCardPayout: true,
    supportsBankPayout: true,
    description:
      "Automatic card refunds and SEPA bank payouts via the Nuvei payout API.",
    enableFlag: "nuveiWithdrawalEnabled",
  },
  {
    id: "atlas",
    label: "Atlas",
    supportsPayout: false,
    supportsCardPayout: false,
    supportsBankPayout: false,
    description:
      "Deposit provider only — Atlas has no payout API, so it cannot send withdrawals.",
  },
];

export function getPayoutProvider(
  id?: string | null,
): PayoutProviderDefinition | undefined {
  if (!id) return undefined;
  return PAYOUT_PROVIDERS.find((p) => p.id === id);
}

/** Providers that are actually able to execute payouts (for the admin dropdown). */
export function getPayoutCapableProviders(): PayoutProviderDefinition[] {
  return PAYOUT_PROVIDERS.filter((p) => p.supportsPayout);
}

export function providerSupportsPayout(id?: string | null): boolean {
  return !!getPayoutProvider(id)?.supportsPayout;
}
