/**
 * Model-free XP helpers shared by `xp-level.service.ts`.
 *
 * Reason: that service is a `"use server"` file, so Next.js only allows async
 * function exports. A const or sync function exported there empties the whole
 * module's export surface at build time ("module has no exports at all").
 */

/**
 * The sourceId prefix every trade-activity award is written under, and the prefix the daily
 * cap matches on to find today's trade XP.
 *
 * Reason: one definition, because the writer and the reader must agree for the cap to apply
 * at all, and when they disagreed the cap did not fail - it silently admitted everything
 * (risk R95). A second literal would reinstate that, and the symptom is no symptom.
 */
export const TRADE_ACTIVITY_SOURCE_PREFIX = "trade_activity:";

/**
 * Sum xpHistory amounts by gameKey (X7 step 4). Entries without a gameKey are
 * bucketed under `"_unscoped"` — platform awards, never reassigned to trading.
 */
export function sumXpByGameKey(
  xpHistory: Array<{ amount?: number; gameKey?: string }> | null | undefined,
): Record<string, number> {
  // Reason: Map has no prototype chain, so a stored gameKey cannot resolve to
  // Object.prototype the way `out[key]` can (same rule as the round-inspector
  // action map and UNSCORED_CONTEST_POLICY_COPY).
  const totals = new Map<string, number>();
  if (!Array.isArray(xpHistory)) return {};
  for (const row of xpHistory) {
    const key =
      typeof row.gameKey === "string" && row.gameKey.trim()
        ? row.gameKey.trim()
        : "_unscoped";
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    totals.set(key, (totals.get(key) || 0) + amount);
  }
  return Object.fromEntries(totals);
}
