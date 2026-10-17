/**
 * The one line a challenge-outcome notification uses to describe what a participant scored.
 *
 * Trading and provider challenges settle onto the same winner/loser value
 * (`SettleChallengeResult.winnerPnL` / `loserPnL`), but the number means something different
 * in each direction — profit-and-loss for trading, a game score for a provider challenge —
 * and the old `challenge_won` / `challenge_lost` templates hard-coded "Final P&L: {{pnl}}",
 * which is wrong for the second half. This is the ONE place that turns that value into words,
 * so the trading finalize path and the provider finalize path word it identically. Both
 * templates now read `{{resultLine}}` instead.
 *
 * Reason: mirrors the "one rule, two copies" precedent from `challengeId` / `referenceId` /
 * the Game Master `||` — a formatting rule duplicated at each finalize call site is exactly
 * the shape that drifts.
 */
export function formatChallengeResultLine(
  gameType: string | null | undefined,
  value: number | null | undefined,
): string {
  const isTrading = (gameType ?? "trading") === "trading";
  if (isTrading) {
    // Reason: matches the pre-existing {{pnl}} substitution exactly (winnerPnL.toFixed(2),
    // no currency symbol, no forced sign) — this generalisation must not change trading's
    // wording, only give the provider branch somewhere correct to go.
    const pnl = Number.isFinite(value) ? (value as number).toFixed(2) : "0";
    return `Final P&L: ${pnl}`;
  }

  // Provider challenges rank on a score, never a currency amount. Printed plain, no sign —
  // same convention as the round-history panel's roundScoreText and the arena activity feed.
  const score = Number.isFinite(value) ? String(value) : "-";
  return `Final score: ${score}`;
}
