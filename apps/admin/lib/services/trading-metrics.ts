/**
 * Trading Metrics — shared math (admin mirror of lib/services/trading-metrics.ts)
 *
 * Single source of truth for win rate and profit factor so the dashboard,
 * profile, leaderboard and admin views NEVER disagree. Pure functions, no I/O.
 *
 * Reason: the admin app resolves "@/" to apps/admin, so it cannot import the
 * root module directly — this is an intentional, identical mirror (kept in sync
 * the same way the other admin/* service mirrors are).
 */

export const PROFIT_FACTOR_NO_LOSS = 999;
export const PROFIT_FACTOR_SCORE_CAP = 5;

export function computeProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss > 0) return grossProfit / grossLoss;
  return grossProfit > 0 ? PROFIT_FACTOR_NO_LOSS : 0;
}

export function clampProfitFactorForScore(profitFactor: number): number {
  if (!Number.isFinite(profitFactor) || profitFactor < 0) return 0;
  return Math.min(profitFactor, PROFIT_FACTOR_SCORE_CAP);
}

export function computeWinRate(winningTrades: number, losingTrades: number): number {
  const decisive = winningTrades + losingTrades;
  return decisive > 0 ? (winningTrades / decisive) * 100 : 0;
}

/**
 * Format a profit factor for DISPLAY — shows ∞ for the no-loss sentinel (999)
 * since the ratio is mathematically infinite, otherwise `decimals` places.
 */
export function formatProfitFactor(
  profitFactor: number | null | undefined,
  decimals = 2,
): string {
  const pf = typeof profitFactor === "number" ? profitFactor : 0;
  if (!Number.isFinite(pf) || pf >= PROFIT_FACTOR_NO_LOSS) return "∞";
  return pf.toFixed(decimals);
}
