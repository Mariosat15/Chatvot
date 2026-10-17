/**
 * The equity check is mandatory on every Game Master trading contest (owner, 12 Oct 2026).
 *
 * A Game Master is paid on the entry fees their contests bring in, so the operator least able
 * to be neutral about a coordinated-entry ring is the one creating the contest. The equity
 * check refuses new trades from an account whose equity (balance plus open profit and loss)
 * has fallen a set share below its starting capital - the shape a "sacrifice" account takes
 * when it is deliberately run down to feed a partner. The Game Master chooses how strict, never
 * whether.
 *
 * Model-free on purpose: the create page is a client component and imports it, and the route
 * enforces the same numbers so a hand-written request cannot switch the check off or loosen it.
 */

export const GM_EQUITY_DRAWDOWN_MIN_PERCENT = 1;
export const GM_EQUITY_DRAWDOWN_MAX_PERCENT = 50;
export const GM_EQUITY_DRAWDOWN_DEFAULT_PERCENT = 30;

/** Clamp a requested drawdown into 1-50%. Absent or unusable values take the default. */
export function resolveGmEquityDrawdownPercent(value: unknown): number {
  const n =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    return GM_EQUITY_DRAWDOWN_DEFAULT_PERCENT;
  }
  return Math.min(
    GM_EQUITY_DRAWDOWN_MAX_PERCENT,
    Math.max(GM_EQUITY_DRAWDOWN_MIN_PERCENT, Math.round(n)),
  );
}

/** What the Game Master is told, in a player's words rather than a compliance officer's. */
export function gmEquityCheckExplanation(percent: number): string {
  return (
    `This keeps your contest clean. If a player's account - counting their open trades - drops ` +
    `${percent}% below what they started with, they can't open new trades until they climb ` +
    `back. That stops anyone tanking one account on purpose to boost a friend's, so your ` +
    `leaderboard stays legit and players trust your contests. It's always on - you just pick ` +
    `how strict (up to ${GM_EQUITY_DRAWDOWN_MAX_PERCENT}%).`
  );
}
