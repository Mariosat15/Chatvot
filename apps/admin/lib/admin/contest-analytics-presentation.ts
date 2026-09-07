/**
 * How the competition analytics screen reads, per game.
 *
 * WHY THIS EXISTS. `/api/competition-analytics` and `CompetitionAnalytics.tsx` are the screen an
 * operator opens to answer "what did we earn and who did we pay". Both were written when trading
 * was the only game, and three things follow from that which are not obvious from reading either
 * file:
 *
 * 1. **Every figure on the screen is unscoped.** The route selects all completed and cancelled
 *    competitions with no game filter, so a provider contest appears in the totals and cannot be
 *    told apart from a trading one. `12` s5's binding rule is that no operator-facing aggregate
 *    may silently mean "trading only"; this is the same rule failing in the other direction -
 *    a total that silently means "all games added together" is equally unusable, because the
 *    economics differ (a provider game carries a per-round cost that trading does not).
 * 2. **The winners table renders "Final P&L" unconditionally**, and `prize-payout.service.ts`
 *    deliberately omits `finalPnl` from a provider contest's ledger metadata, writing
 *    `finalScore` instead. So the column read `+0.00` in green for every game winner while the
 *    number the contest ranked on sat in the same document, unread. **This is R46 one screen
 *    along** - the same read-side confusion of an absent fact with a measured zero.
 * 3. **The "Prize %" column has never worked, for any game.** Nothing writes
 *    `metadata.percentage` on a `competition_win` row - checked with `rg` across both apps and
 *    both copies of the payout stage - so `metadata?.percentage || 0` rendered `0%` against
 *    every winner of every competition ever settled. It is replaced by the share of the pool
 *    the payment actually represents, which is derived from two figures that do exist.
 *
 * MODEL-FREE BY REQUIREMENT, not preference: `CompetitionAnalytics.tsx` is `"use client"`, so
 * anything it imports must not pull Mongoose into a browser bundle. Same constraint as
 * `contest-control-copy.ts`, `round-resolution-actions.ts` and `components/games/play-state.ts`,
 * each of which was first written as a second copy for exactly this reason.
 *
 * PURE, so the aggregation can be asserted directly. The by-game summary is arithmetic over the
 * rows the route already returns, which means it can be tested by calling it rather than by
 * grepping JSX - the same reasoning as `contest-result-presentation.ts`.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only, so `check:mirrors` says nothing about it.
 */

import { hasProviderGameLabel } from "./contest-game-label";
import { resolveResultMetric, type MetricDisplay } from "./contest-result-presentation";

/** The game label as it arrives from the analytics route. */
export interface AnalyticsGameLabel {
  gameType?: string | null;
  gameKey?: string | null;
  providerKey?: string | null;
  gameCode?: string | null;
  /** The catalogue's `displayName` for the title, when it is still in the catalogue. */
  gameDisplayName?: string | null;
  /** The provider's `displayName`, when the provider is still registered. */
  providerDisplayName?: string | null;
}

export interface GameBadge {
  /**
   * What the filter and the grouping key on.
   *
   * **It is `gameKey` and never the display name.** `gameKey` is immutable and is the join key
   * for every historical figure; a display name is catalogue content an operator can edit. Group
   * by the name and renaming a title silently splits one game's history into two rows that each
   * look complete.
   */
  key: string;
  /** What to call the game on screen. */
  label: string;
  /** Who supplies it, or `null` for trading, which is ours. */
  provider: string | null;
  isProviderGame: boolean;
}

/** The key every contest created before the game label existed groups under. */
export const TRADING_GAME_KEY = "trading";

/**
 * The game a contest belongs to, for labelling and for grouping.
 *
 * The display-name fallback chain ends at the game code and then at the key, never at
 * "Unknown": a title removed from the catalogue still has a code, and `gameKey` is immutable
 * precisely so that its history stays addressable after the title is retired (R29). A row
 * captioned "Unknown game" holding real revenue is a row an operator cannot investigate.
 */
export function resolveGameBadge(row: AnalyticsGameLabel): GameBadge {
  const isProviderGame = hasProviderGameLabel(row);

  if (!isProviderGame) {
    return {
      key: TRADING_GAME_KEY,
      label: "Trading",
      provider: null,
      isProviderGame: false,
    };
  }

  const key = nonEmpty(row.gameKey) ?? providerCompositeKey(row);

  return {
    key,
    label: nonEmpty(row.gameDisplayName) ?? nonEmpty(row.gameCode) ?? key,
    provider:
      nonEmpty(row.providerDisplayName) ?? nonEmpty(row.providerKey) ?? "Unknown provider",
    isProviderGame: true,
  };
}

/**
 * The fallback key for a provider contest whose `gameKey` never got written.
 *
 * Reason it is composed rather than defaulted to a constant: the X1 backfill has not been
 * applied to production, so unlabelled rows exist. Collapsing them all under one key would
 * merge two different games' money into one line, which is worse than a row keyed on the
 * provider and code the contest does carry.
 */
function providerCompositeKey(row: AnalyticsGameLabel): string {
  const provider = nonEmpty(row.providerKey);
  const code = nonEmpty(row.gameCode);
  if (provider && code) return `provider:${provider}:${code}`;
  return "provider:unlabelled";
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** A winner or disqualified row, as the analytics route returns it. */
export interface AnalyticsPlayerRow {
  /** Trading's final profit and loss. Absent on a provider contest, deliberately. */
  finalPnl?: number | null;
  /** A provider game's raw score. Absent on a trading contest. */
  finalScore?: number | null;
}

/**
 * The performance figure to show beside a player, per game.
 *
 * Delegates to `resolveResultMetric` rather than repeating the rule, because the contest view
 * screen already answers exactly this question and **two screens disagreeing about whether an
 * absent score is `0` or `-` is the defect, not the styling.** That is the "one rule, two
 * copies" shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master rate,
 * none of which `check:mirrors` can see.
 *
 * Note the shapes differ by one field name - the ledger row carries `finalPnl`/`finalScore`
 * where a leaderboard row carries `pnl`/`score` - so this maps rather than passes through.
 *
 * THE SUB-LINE IS DROPPED HERE, AND THAT IS THE ONE DELIBERATE DIFFERENCE FROM THE VIEW SCREEN.
 * A `competition_win` ledger row carries no percentage at all, and the shared resolver's trading
 * branch resolves an absent `pnlPercentage` to `0` - correctly, because on a participant seat
 * `pnlPercentage` is a stored field whose zero is real. Passing an absent one through would
 * print `+0.00%` under a genuine profit, which is precisely the absent-read-as-measured
 * confusion this module exists to remove. The resolver is not changed to suit this caller: its
 * other consumer reads a seat, where the zero means zero.
 */
export function resolvePlayerMetric(
  row: AnalyticsPlayerRow,
  isProviderGame: boolean,
): MetricDisplay {
  const metric = resolveResultMetric(
    { score: row.finalScore, pnl: row.finalPnl, pnlPercentage: null, totalTrades: null },
    isProviderGame,
  );
  return { ...metric, sub: null };
}

/**
 * The share of the prize pool a payment actually represents.
 *
 * THIS REPLACES A COLUMN THAT WAS ALWAYS ZERO. See the file comment: no writer sets
 * `metadata.percentage`. Deriving it from the amount paid and the pool is not merely a
 * substitute - it is the better figure, because after redistribution and ties the share
 * actually paid at a rank is routinely not the share that was configured for it (R45).
 *
 * Returns `null`, never `0`, when the pool is missing or zero. A rank paying nothing out of a
 * pool of nothing is not "0% of the pool"; there is no ratio, and printing one invites an
 * operator to look for the other 100%.
 */
export function resolveShareOfPool(
  amount: number | null | undefined,
  prizePool: number | null | undefined,
): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  if (typeof prizePool !== "number" || !Number.isFinite(prizePool) || prizePool <= 0) {
    return null;
  }
  return (amount / prizePool) * 100;
}

/** One contest, narrowed to the figures the by-game summary adds up. */
export interface AnalyticsContestRow extends AnalyticsGameLabel {
  status: string;
  participants?: number | null;
  totalCollected?: number | null;
  totalWinnersPaid?: number | null;
  platformFeeEarned?: number | null;
  totalRefunds?: number | null;
  unclaimedPool?: number | null;
  /**
   * True when `platformFeeEarned` was inferred from the contest's settings because no ledger
   * row was found. Surfaced rather than hidden: a summary that mixes recorded revenue with
   * estimated revenue and says so is usable, and one that does not is a number nobody can
   * reconcile against the ledger.
   */
  platformFeeEstimated?: boolean | null;
}

export interface GameSummaryRow extends GameBadge {
  contests: number;
  completed: number;
  cancelled: number;
  participants: number;
  collected: number;
  prizesPaid: number;
  platformFees: number;
  refunds: number;
  unclaimed: number;
  /** How many of the fee figures above are estimates rather than ledger rows. */
  estimatedFeeContests: number;
  /** Prizes paid as a share of fees collected. `null` when nothing was collected. */
  payoutRatio: number | null;
  /** Average entry-fee take per completed contest. `null` when none completed. */
  averagePot: number | null;
}

/**
 * Entry-fee volume, prizes, fees and payout ratio **by game**, and the same **by provider**.
 *
 * `12` s5 asks for both and the distinction is not redundancy: **provider cost is per-provider,
 * not per-title**, so the figure a commercial decision is made against is the provider-level
 * one, while the figure an operator schedules against is the title-level one.
 *
 * Sorted by entry-fee volume, descending, because the question this screen answers is which
 * game is carrying the platform. Ties fall back to the label so the order is stable between
 * refreshes rather than following whatever order the rows arrived in.
 */
export function summariseByGame(rows: AnalyticsContestRow[]): GameSummaryRow[] {
  return collapse(rows, (row) => {
    const badge = resolveGameBadge(row);
    return { groupKey: badge.key, badge };
  });
}

/**
 * The same arithmetic grouped by supplier.
 *
 * Trading is included as its own group rather than excluded, because a comparison with one side
 * missing is the thing that made every earlier version of this screen misleading. It is
 * labelled as ours, not as a provider.
 */
export function summariseByProvider(rows: AnalyticsContestRow[]): GameSummaryRow[] {
  return collapse(rows, (row) => {
    const badge = resolveGameBadge(row);
    if (!badge.isProviderGame) {
      return { groupKey: TRADING_GAME_KEY, badge };
    }
    const providerKey = nonEmpty(row.providerKey) ?? "unknown";
    return {
      groupKey: `provider:${providerKey}`,
      badge: {
        key: `provider:${providerKey}`,
        label: badge.provider ?? providerKey,
        provider: badge.provider,
        isProviderGame: true,
      },
    };
  });
}

function collapse(
  rows: AnalyticsContestRow[],
  keyOf: (row: AnalyticsContestRow) => { groupKey: string; badge: GameBadge },
): GameSummaryRow[] {
  // Reason for a Map rather than an object: the keys come from stored data, and an object
  // lookup walks the prototype chain - `__proto__` and `constructor` are truthy and survive a
  // presence check. Third instance of this after the round-inspector action map and the
  // competition update allow-list, so it is the default here rather than a reaction.
  const groups = new Map<string, GameSummaryRow>();

  for (const row of rows) {
    const { groupKey, badge } = keyOf(row);
    const existing = groups.get(groupKey) ?? blankSummary(badge);

    existing.contests += 1;
    if (row.status === "completed") existing.completed += 1;
    if (row.status === "cancelled") existing.cancelled += 1;
    existing.participants += num(row.participants);
    existing.collected += num(row.totalCollected);
    existing.prizesPaid += num(row.totalWinnersPaid);
    existing.platformFees += num(row.platformFeeEarned);
    existing.refunds += num(row.totalRefunds);
    existing.unclaimed += num(row.unclaimedPool);
    if (row.platformFeeEstimated === true) existing.estimatedFeeContests += 1;

    groups.set(groupKey, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      payoutRatio: group.collected > 0 ? (group.prizesPaid / group.collected) * 100 : null,
      averagePot: group.completed > 0 ? group.collected / group.completed : null,
    }))
    .sort((a, b) => b.collected - a.collected || a.label.localeCompare(b.label));
}

function blankSummary(badge: GameBadge): GameSummaryRow {
  return {
    ...badge,
    contests: 0,
    completed: 0,
    cancelled: 0,
    participants: 0,
    collected: 0,
    prizesPaid: 0,
    platformFees: 0,
    refunds: 0,
    unclaimed: 0,
    estimatedFeeContests: 0,
    payoutRatio: null,
    averagePot: null,
  };
}

/**
 * `NaN` and `Infinity` are treated as absent rather than added.
 *
 * Reason: one bad figure in one contest would otherwise turn a whole game's revenue line into
 * `NaN`, and every derived ratio with it - a total that reads as a rendering bug rather than as
 * a data problem in one row, so the actual cause is invisible. Same instinct as
 * `Number.isFinite` replacing `||` in the Game Master rate (R31).
 */
function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The options offered by the game filter, with the count of contests behind each. */
export interface GameFilterOption {
  key: string;
  label: string;
  contests: number;
}

export const ALL_GAMES = "all";

/**
 * The filter's options, derived from the contests present rather than from the catalogue.
 *
 * Reason it is not the catalogue: a retired or deleted title still has settled contests, and a
 * filter built from the catalogue would offer no way to see them - the rows would be in the
 * list, unreachable by any selection, which reads as data loss. Building from the contests
 * guarantees every row is reachable.
 */
export function resolveGameFilterOptions(rows: AnalyticsContestRow[]): GameFilterOption[] {
  const summary = summariseByGame(rows);
  return [
    { key: ALL_GAMES, label: "All games", contests: rows.length },
    ...summary.map((group) => ({
      key: group.key,
      label: group.provider ? `${group.label} (${group.provider})` : group.label,
      contests: group.contests,
    })),
  ];
}

/** Applies the filter. `all` is the identity, deliberately, rather than a special case upstream. */
export function filterByGame<T extends AnalyticsGameLabel>(
  rows: T[],
  selected: string,
): T[] {
  if (selected === ALL_GAMES) return rows;
  return rows.filter((row) => resolveGameBadge(row).key === selected);
}

/**
 * What the screen must say about its own scope, and why it is not optional.
 *
 * The route reads the **50 most recently finished** competitions, and every headline card on the
 * screen is a reduction over that list. So "Platform Fees Earned" has always meant "of the last
 * 50 competitions" while being captioned as a total. That is the binding rule in `12` s5 failing
 * along a different axis than the game one: an aggregate that silently means a window is exactly
 * as unusable as one that silently means one game.
 *
 * The arithmetic is deliberately NOT changed here. Widening the window changes every figure on
 * the screen, and a behaviour change made in the same edit as a labelling fix destroys the only
 * evidence that the labelling fix was safe - the same reasoning that kept the Game Master `||`
 * defect verbatim while settlement was being extracted. Labelling it is the honest half that
 * costs nothing.
 */
export function resolveScopeNote(contestCount: number, limit: number): string {
  if (contestCount < limit) {
    return `Every figure below covers all ${contestCount} finished competitions.`;
  }
  return `Every figure below covers the ${limit} most recently finished competitions, not all time. Older competitions are excluded from the totals as well as from the list.`;
}
