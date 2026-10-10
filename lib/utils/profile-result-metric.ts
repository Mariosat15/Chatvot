/**
 * How a finished contest or challenge row reads on a player's own profile.
 *
 * WHY IT IS A MODULE RATHER THAN TWO EXPRESSIONS. `ProfileOverview.tsx` and
 * `ProfileContent.tsx` both render "how did this player do here", and before R92's read side
 * they each wrote `pnl.toFixed(2)` inline - so a provider row showed +0.00 over 0 trades on
 * both screens, which is the trading shape stated with total confidence about a puzzle. Two
 * copies of one rule is the shape behind `referenceId`, `failedReason`, `challengeId` and the
 * Game Master `||`, none of which the mirror guard can see; here the two screens sit one click
 * apart, so a disagreement is visible to the player and to nobody reviewing the diff.
 *
 * The rule is deliberately NOT "which fields exist" but "which game is this". A provider seat
 * carries `pnl: 0`, `pnlPercentage: 0` and `totalTrades: 0` from `buildParticipantSeat`
 * whatever the game (the R46 mechanism), so testing for presence answers trading for every row
 * ever written. The label decides, and it comes from the CONTEST rather than the seat - see the
 * note in `lib/actions/user/profile.actions.ts`.
 */

/** What a row must carry to be describable. Every figure optional; that is the point. */
export interface ProfileResultRow {
  /** The game label. Absent resolves to trading - invariant 5. */
  gameType?: string | null;
  /** A provider result. Absent means nothing was scored (R50) - never 0. */
  score?: number | null;
  pnl?: number | null;
  pnlPercentage?: number | null;
  totalTrades?: number | null;
  winRate?: number | null;
}

/**
 * What an absent figure reads as. A dash rather than a zero, because a zero is a result and an
 * absence is not - the read-side form of R45 and R50, and the same answer the admin contest
 * view, the provider leaderboard and the player results screen already give.
 */
export const ABSENT_FIGURE = "-";

export type MetricTone = "profit" | "loss" | "neutral";

export interface ProfileResultMetric {
  label: string;
  value: string;
  tone: MetricTone;
}

function isProviderRow(row: ProfileResultRow): boolean {
  return row.gameType === "provider";
}

/**
 * The one performance figure this row is about.
 *
 * A score is printed plain, with no sign and no negation. Which direction a game ranks in is
 * resolved once, server-side, in `calculateRankings`; a `+` here would be this screen forming
 * its own opinion about it, and negating would show a race time as a negative number.
 */
export function profileResultMetric(row: ProfileResultRow): ProfileResultMetric {
  if (isProviderRow(row)) {
    return {
      label: "Score",
      value: Number.isFinite(row.score)
        ? (row.score as number).toLocaleString()
        : ABSENT_FIGURE,
      tone: "neutral",
    };
  }

  if (!Number.isFinite(row.pnl)) {
    return { label: "P&L", value: ABSENT_FIGURE, tone: "neutral" };
  }

  const pnl = row.pnl as number;
  return {
    label: "P&L",
    value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
    tone: pnl >= 0 ? "profit" : "loss",
  };
}

/**
 * The return-on-investment figure, or `null` when the row has none.
 *
 * `null` rather than a dash, because ROI has its own tile on `ProfileContent.tsx` and a tile
 * captioned "ROI" holding a dash asks the player what their return was and declines to answer.
 * A provider score is not a return on anything, so the tile is withheld outright.
 */
export function profileResultRoi(
  row: ProfileResultRow,
): ProfileResultMetric | null {
  if (isProviderRow(row) || !Number.isFinite(row.pnlPercentage)) return null;

  const roi = row.pnlPercentage as number;
  return {
    label: "ROI",
    value: `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`,
    tone: roi >= 0 ? "profit" : "loss",
  };
}

/**
 * The small line of activity under the row's name, or `null` when there is nothing true to say.
 *
 * Withheld entirely on a provider row rather than reworded: a puzzle has no trades and no win
 * rate, and what it does have - boards, attempts, whatever the title reports - is the
 * provider's own free-form breakdown, which the platform may not select among (`01` s3.2). A
 * line here would either be a trading sentence or a guess at a game-specific one.
 */
export function profileResultSubline(
  row: ProfileResultRow,
  options: { includeWinRate?: boolean } = {},
): string | null {
  if (isProviderRow(row)) return null;

  const parts: string[] = [];
  if (Number.isFinite(row.totalTrades)) {
    parts.push(`${row.totalTrades as number} trades`);
  }
  if (options.includeWinRate && Number.isFinite(row.winRate)) {
    parts.push(`${(row.winRate as number).toFixed(1)}% win rate`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
