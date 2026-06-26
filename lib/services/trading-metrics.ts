/**
 * Trading Metrics — shared math
 *
 * Single source of truth for win rate and profit factor so the dashboard,
 * profile, leaderboard and admin views NEVER disagree. Pure functions, no I/O,
 * so they are trivially unit-testable and safe to import anywhere.
 */

// Display value for profit factor when a trader has ZERO losing trades (a
// division-by-zero case). 999 is the long-standing sentinel already shown on the
// dashboard/profile; centralised here so every surface shows the same thing.
// Reason: previously the leaderboard returned 0 here (penalising a flawless
// record) while the dashboard returned 999 — the same trader looked different.
export const PROFIT_FACTOR_NO_LOSS = 999;

// Upper bound applied to profit factor when it feeds the weighted leaderboard
// score. Reason: an unbounded/sentinel profit factor (e.g. a no-loss trader)
// multiplied into the score would dominate the ranking; capping keeps scoring
// fair while still rewarding a strong win/loss ratio.
export const PROFIT_FACTOR_SCORE_CAP = 5;

/**
 * Profit factor = gross profit / gross loss.
 * When there are no losing trades, returns the PROFIT_FACTOR_NO_LOSS sentinel
 * if the trader has any profit, otherwise 0.
 */
export function computeProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss > 0) return grossProfit / grossLoss;
  return grossProfit > 0 ? PROFIT_FACTOR_NO_LOSS : 0;
}

/**
 * Profit factor clamped into [0, PROFIT_FACTOR_SCORE_CAP] for use in the
 * leaderboard's weighted overall score.
 */
export function clampProfitFactorForScore(profitFactor: number): number {
  if (!Number.isFinite(profitFactor) || profitFactor < 0) return 0;
  return Math.min(profitFactor, PROFIT_FACTOR_SCORE_CAP);
}

/**
 * Win rate as a percentage of DECISIVE trades (wins + losses), excluding
 * breakeven trades (realized PnL exactly 0). This matches the win/loss donut,
 * which shows breakeven as its own separate segment.
 *
 * Note: callers must pass `losingTrades` counted strictly as realized PnL < 0
 * (NOT "every non-winning trade"), otherwise breakevens would be folded back in.
 */
export function computeWinRate(winningTrades: number, losingTrades: number): number {
  const decisive = winningTrades + losingTrades;
  return decisive > 0 ? (winningTrades / decisive) * 100 : 0;
}
