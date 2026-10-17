/**
 * Who may take a Game Master-funded (free) seat (owner, 2 Oct 2026).
 *
 * A funded seat costs the player nothing, so without a rule anyone with an empty wallet can
 * join. The admin picks one of two policies:
 * - `open`: anyone may join, whatever their balance;
 * - `min_balance`: the player's spendable credit balance must be at least `minBalance`.
 *
 * The balance is only checked. It is never debited - the Game Master still pays the seat.
 *
 * Model-free and mirrored byte-identical into `apps/admin/lib/utils/`, so the admin screen
 * and the entry guard read one definition (R58: the admin panel imports it client-side).
 */

export type FreePrivateEntryPolicy = "open" | "min_balance";

export interface FreePrivateEntryRule {
  policy: FreePrivateEntryPolicy;
  minBalance: number;
}

/** The rule a deployment that has never saved the setting gets: credits are required. */
export const DEFAULT_FREE_PRIVATE_ENTRY_RULE: FreePrivateEntryRule = {
  policy: "min_balance",
  minBalance: 1,
};

/**
 * Read the stored settings into a rule.
 *
 * Reason: fails towards the STRICT rule. Only a stored `"open"` opens entry; an absent,
 * misspelt or legacy value keeps the minimum. A non-finite or negative minimum (these arrive
 * from `parseFloat` on an admin form) falls back to the default rather than becoming `NaN`,
 * which would make every comparison false and silently admit everyone.
 */
export function resolveFreePrivateEntryRule(stored: {
  freePrivateEntryPolicy?: unknown;
  freePrivateMinEntryBalance?: unknown;
} | null | undefined): FreePrivateEntryRule {
  const policy: FreePrivateEntryPolicy =
    stored?.freePrivateEntryPolicy === "open" ? "open" : "min_balance";
  const raw = stored?.freePrivateMinEntryBalance;
  const minBalance =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0
      ? raw
      : DEFAULT_FREE_PRIVATE_ENTRY_RULE.minBalance;
  return { policy, minBalance };
}

/** The refusal shown to the player, or `null` when they may take the seat. */
export function freePrivateEntryRefusal(
  rule: FreePrivateEntryRule,
  creditBalance: number,
): string | null {
  if (rule.policy === "open") return null;
  const balance = Number.isFinite(creditBalance) ? creditBalance : 0;
  if (balance >= rule.minBalance) return null;
  return `This free competition is open to players with at least ${rule.minBalance} credits in their wallet. Entry stays free - your credits are not used. Please deposit to join.`;
}

/** One line for the admin screen describing what the current rule does. */
export function describeFreePrivateEntryRule(rule: FreePrivateEntryRule): string {
  if (rule.policy === "open") {
    return "Anyone may join a free competition, even with an empty wallet.";
  }
  return `Players need at least ${rule.minBalance} credits in their wallet to join a free competition. The credits are only checked, never taken.`;
}
