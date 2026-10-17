/**
 * Score vs P&L display for public broadcast surfaces (`/arena`, championship).
 *
 * Reason: the arena API already ranks provider contests on `score` (13 s5.1c). Painting
 * `livePnl` for every row is the R37 shape one layer out — a puzzle player reads as flat
 * or "down money" while the board order is correct. ContestsSidebar already solved this
 * for the signed-in dashboard; this module is the broadcast twin so the two cannot drift.
 *
 * Model-free and client-reachable (R58).
 */

export type BroadcastMetricTone = "positive" | "negative" | "neutral";

export function isProviderBroadcast(gameType?: string | null): boolean {
  return gameType === "provider";
}

export function describeBroadcastMetric(input: {
  gameType?: string | null;
  score?: number | null;
  livePnl: number;
}): {
  value: string;
  label: string;
  tone: BroadcastMetricTone;
  color: string;
} {
  if (isProviderBroadcast(input.gameType)) {
    // Reason: undefined and 0 are different facts (R50 read-side). Absent → dash.
    const has =
      typeof input.score === "number" && Number.isFinite(input.score);
    return {
      value: has ? input.score!.toLocaleString() : "–",
      label: "Score",
      tone: "neutral",
      // Reason: a score is neither profit nor loss — never inherit green/red.
      color: "#22d3ee",
    };
  }

  const pnl = input.livePnl || 0;
  const pos = pnl >= 0;
  return {
    value: `${pos ? "+" : "-"}$${Math.abs(pnl).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`,
    label: "P&L",
    tone: pos ? "positive" : "negative",
    color: pos ? "#10b981" : "#ef4444",
  };
}
