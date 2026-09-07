/**
 * How a contest's results READ to an operator, per game.
 *
 * WHY THIS EXISTS, and it is the owner's "the prizes, the distribution is a mess" report.
 * `/competitions/view/[id]` is the screen an operator opens to find out what happened, and it
 * was written for trading. On a provider contest every row showed **"0 trades", "+0.00" and
 * "+0.00%"** - not because anything failed, but because `pnl`, `pnlPercentage` and
 * `totalTrades` all default to `0` on every seat regardless of game, so the trading fields are
 * present, are zero, and render perfectly. Meanwhile `score`, the number the contest actually
 * ranked on, **was on the row and was never displayed.**
 *
 * The result is the worst shape a screen can have: rows in an order the operator cannot
 * explain, every metric identical, winner badges and prize amounts against them. It reads as a
 * broken payout. **The ranking was correct throughout** - R37 fixed the metric it ranks by -
 * so this is a reporting defect sitting directly on top of a money screen, which is why it got
 * reported as a money defect.
 *
 * WHY A MODULE RATHER THAN TERNARIES IN THE JSX. Two reasons, and the second is the load-bearing
 * one. The page is 744 lines and over the 500-line limit already, so growing it is the wrong
 * direction. More importantly a structural test over JSX is weak - it can assert a file mentions
 * `score` and cannot assert which branch renders it - whereas these functions can be called with
 * a provider row and a trading row and compared. Same reasoning as
 * `contest-control-copy.ts` and `round-resolution-actions.ts`.
 *
 * MODEL-FREE BY REQUIREMENT, not preference: the page renders client components beside this and
 * `apps/admin/lib/admin/` is imported from both sides. It takes plain numbers, so it can never
 * pull Mongoose into a browser bundle.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only, so `check:mirrors` says nothing about it.
 */

/** The subset of a leaderboard row this module reads. Deliberately not the model's type. */
export interface ResultRow {
  score?: number | null;
  pnl?: number | null;
  pnlPercentage?: number | null;
  totalTrades?: number | null;
}

export interface MetricDisplay {
  /** The large figure. `-` when there is genuinely nothing to show. */
  value: string;
  /** The small figure under it, or `null` to render nothing rather than a zero. */
  sub: string | null;
  /**
   * `positive` and `negative` exist so trading keeps its red/green P&L. A score is not a
   * profit, so it is `neutral` - colouring a puzzle score green would imply a gain.
   */
  tone: "positive" | "negative" | "neutral";
  /** What the figure IS, so the column is self-describing on a screen serving both games. */
  label: string;
}

/**
 * The metric an operator should be reading for this game.
 *
 * The provider branch returns `-` for an absent score and never `0`. **These are different
 * facts and the distinction is the whole of R45**: a player who never produced a result is not
 * a player who scored nothing, and printing `0` for the first one is what made unscored players
 * look like legitimate last-place finishers holding a prize rank. Same rule as the player-facing
 * board in `13` s4.1b, and it is deliberately the same wording so the two screens agree.
 */
export function resolveResultMetric(
  row: ResultRow,
  isProviderGame: boolean,
): MetricDisplay {
  if (isProviderGame) {
    const hasScore = typeof row.score === "number" && Number.isFinite(row.score);

    return {
      value: hasScore ? (row.score as number).toLocaleString() : "-",
      // Reason no sub-line: the honest alternative is the trade count, which is always 0 for a
      // provider game. A zero that can never be anything else is not information, it is a
      // reader wondering what they did wrong.
      sub: null,
      tone: "neutral",
      label: hasScore ? "Score" : "No score recorded",
    };
  }

  const pnl = typeof row.pnl === "number" ? row.pnl : 0;
  const pnlPercentage =
    typeof row.pnlPercentage === "number" ? row.pnlPercentage : 0;

  return {
    value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
    sub: `${pnlPercentage >= 0 ? "+" : ""}${pnlPercentage.toFixed(2)}%`,
    tone: pnl >= 0 ? "positive" : "negative",
    label: "P&L",
  };
}

/**
 * The line under a player's name.
 *
 * Trading gets its trade count. A provider game gets nothing, for the reason above - and
 * returning `null` rather than an empty string matters, because `"" ` still renders the
 * element and leaves an unexplained gap where a number used to be.
 */
export function resolveParticipantSubline(
  row: ResultRow,
  isProviderGame: boolean,
): string | null {
  if (isProviderGame) return null;
  return `${row.totalTrades ?? 0} trades`;
}

/**
 * Whether the trading-only configuration block should render at all.
 *
 * Starting Capital, Max Leverage and Asset Classes are not "zero" on a provider contest, they
 * are **inapplicable** - and a screen that prints `$0` and `1:1` for them is making a claim
 * about the contest rather than declining to. An operator reasonably reads `$0` as a
 * misconfiguration they need to fix.
 */
export function showsTradingConfiguration(isProviderGame: boolean): boolean {
  return !isProviderGame;
}

/**
 * Where the Edit button goes.
 *
 * **The competitions LIST learned this on 7 September 2026 (`12` s2.2) and this page did not**,
 * which is the "count the writers" rule producing its own next instance: the fix was applied to
 * the call site that had been noticed. It is not a corruption path - `PUT /api/competitions/[id]`
 * refuses a labelled provider contest outright - and that is precisely what makes it worth
 * fixing rather than shrugging at: the operator is walked through the whole trading form and
 * refused **on submit**, which is strictly worse than a button that had never been offered.
 */
export function resolveEditHref(
  competitionId: string,
  isProviderGame: boolean,
): string {
  return isProviderGame
    ? `/competitions/edit-game/${competitionId}`
    : `/competitions/edit/${competitionId}`;
}

/**
 * The caution that belongs beside a configured prize table.
 *
 * The percentages on this screen are what an operator TYPED, not what settlement will pay. Two
 * things move them, and both are invisible here: a rank nobody places in has its share split
 * among the players who did, and a player with no result holds no rank at all (R45). So the
 * figures can only ever be a floor, and an operator comparing them against the wallet credits
 * concludes the payout is wrong - which is what happened.
 *
 * The `PrizeDistributionEditor` already says this at the point of editing. Repeating it at the
 * point of READING is the half that was missing, and it is one exported string rather than two
 * literals so the two screens cannot drift into describing the payout differently.
 */
export const PRIZE_REDISTRIBUTION_NOTE =
  "These are the configured shares. A rank nobody places in is not kept by the platform - its share is split among the players who did place, and a player who recorded no result holds no rank. Actual payouts can therefore be higher than the amounts here.";

/**
 * What to tell an operator when a finished contest paid nobody.
 *
 * `noWinners` is set at settlement by `contest-completion.service.ts` and **was read by no
 * admin screen at all**, so the only signal was an empty winners table - indistinguishable from
 * a page that had failed to load its data. Saying it plainly matters more on a provider contest,
 * where "nobody scored" is a real and expected outcome rather than an anomaly.
 */
export function resolveNoWinnersNotice(input: {
  isCompleted: boolean;
  noWinners?: boolean | null;
  participantCount: number;
}): string | null {
  if (!input.isCompleted || !input.noWinners) return null;

  if (input.participantCount === 0) {
    return "This competition finished with no participants, so no prizes were awarded.";
  }

  return "No prizes were awarded. Nobody finished in a paying position - on a game competition that usually means nobody recorded a score. The prize pool, less the platform fee, was recorded as an unclaimed pool rather than paid out.";
}
