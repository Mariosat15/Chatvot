import type { ComprehensiveDashboardData } from "@/lib/actions/dashboard/types";

/**
 * Pure derivations for the Performance Analytics tab — no React, so tests can
 * call them directly. The hook in `usePerformanceAnalyticsModel.ts` only holds
 * the two filters and memoises these.
 *
 * Three rules shape every function here:
 * - Real numbers only. Absent is `null` and renders a dash, never `0` (R45/R50).
 * - No game is named in code. Cards and filter options come from the payload (R29).
 * - Never add scores from different games: units and directions differ, so a
 *   sum or a max across titles is a plausible wrong number.
 */

export type PerfRange = "7d" | "30d" | "90d" | "all";
export const PERF_RANGES: PerfRange[] = ["7d", "30d", "90d", "all"];
export const ALL_GAMES = "all";
/** Invariant 5: an absent game label means trading. */
export const TRADING_KEY = "trading";

export const DAY_MS = 86_400_000;

export type PerfInput = Pick<
  ComprehensiveDashboardData,
  | "overview"
  | "charts"
  | "gamePerformance"
  | "gameActivity"
  | "competitions"
  | "challenges"
  | "overviewStanding"
> & { showTrading: boolean; now?: number };

export interface Window {
  start: number | null;
  end: number;
}

export function rangeDays(range: PerfRange): number | null {
  if (range === "all") return null;
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

export function currentWindow(range: PerfRange, now: number): Window {
  const days = rangeDays(range);
  return { start: days === null ? null : now - days * DAY_MS, end: now };
}

export function previousWindow(range: PerfRange, now: number): Window | null {
  const days = rangeDays(range);
  if (days === null) return null;
  return { start: now - 2 * days * DAY_MS, end: now - days * DAY_MS };
}

export function toMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const ms = new Date(value as string | number | Date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function inWindow(ms: number | null, w: Window): boolean {
  if (ms === null) return false;
  if (w.start !== null && ms < w.start) return false;
  return ms <= w.end;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function gameKeyOf(row: { gameKey?: string }): string {
  return row.gameKey && row.gameKey.trim() !== "" ? row.gameKey : TRADING_KEY;
}

export function matchesGame(key: string, filter: string): boolean {
  return filter === ALL_GAMES || key === filter;
}

/* ------------------------------------------------------------------ filters */

export interface GameOption {
  value: string;
  label: string;
}

/** "All games", trading when the player can see it, then every played title. */
export function gameOptions(input: PerfInput): GameOption[] {
  const options: GameOption[] = [{ value: ALL_GAMES, label: "All games" }];
  if (input.showTrading) options.push({ value: TRADING_KEY, label: "Trading" });
  for (const row of input.gamePerformance) {
    options.push({ value: row.gameKey, label: row.title });
  }
  return options;
}

/* ------------------------------------------------------------- window facts */

export interface WindowFacts {
  competitionsPlayed: number;
  competitionsWon: number;
  topThree: number;
  bestRank: number | null;
  averageRank: number | null;
  competitionCredits: number;
  challengesPlayed: number;
  challengeWins: number;
  challengeLosses: number;
  challengeCredits: number;
  activeDays: Set<string>;
}

/**
 * Contest and activity counts inside one window for one game filter.
 *
 * 1v1 rows carry no game label on the dashboard payload, so a single-game filter
 * cannot split them — they count only under "All games" rather than being
 * attributed to whichever game happens to be selected.
 */
export function windowFacts(
  input: PerfInput,
  w: Window,
  gameFilter: string,
): WindowFacts {
  const comps = input.competitions.completed.filter(
    (c) => inWindow(toMs(c.endTime), w) && matchesGame(gameKeyOf(c), gameFilter),
  );
  const ranks = comps
    .map((c) => c.currentRank)
    .filter((r): r is number => typeof r === "number" && r > 0);

  const challenges = input.challenges.completed.filter(
    (c) => inWindow(toMs(c.endTime), w) && matchesGame(gameKeyOf(c), gameFilter),
  );

  const activeDays = new Set<string>();
  const tradingIncluded = gameFilter === ALL_GAMES || gameFilter === TRADING_KEY;
  if (tradingIncluded) {
    for (const d of input.charts.dailyPnL) {
      const ms = toMs(d.date);
      if (d.trades > 0 && inWindow(ms, w) && ms !== null) activeDays.add(dayKey(ms));
    }
  }
  for (const a of input.gameActivity) {
    const ms = toMs(a.date);
    if (a.rounds > 0 && matchesGame(a.gameKey, gameFilter) && inWindow(ms, w) && ms !== null) {
      activeDays.add(dayKey(ms));
    }
  }
  for (const c of comps) {
    const ms = toMs(c.endTime);
    if (ms !== null) activeDays.add(dayKey(ms));
  }
  for (const c of challenges) {
    const ms = toMs(c.endTime);
    if (ms !== null) activeDays.add(dayKey(ms));
  }

  return {
    competitionsPlayed: comps.length,
    competitionsWon: comps.filter((c) => c.currentRank === 1).length,
    topThree: comps.filter((c) => c.currentRank >= 1 && c.currentRank <= 3).length,
    bestRank: ranks.length ? Math.min(...ranks) : null,
    averageRank: ranks.length
      ? ranks.reduce((s, r) => s + r, 0) / ranks.length
      : null,
    competitionCredits: comps.reduce((s, c) => s + (c.prizeWon ?? 0), 0),
    challengesPlayed: challenges.length,
    challengeWins: challenges.filter((c) => c.isWinner === true).length,
    challengeLosses: challenges.filter((c) => c.isWinner === false).length,
    challengeCredits: challenges.reduce((s, c) => s + (c.prizeWon ?? 0), 0),
    activeDays,
  };
}

/** % change, or null when there is nothing honest to compare against. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function rate(wins: number, played: number): number | null {
  return played > 0 ? (wins / played) * 100 : null;
}

/* --------------------------------------------------------------- highlights */

export type HighlightKey =
  | "winRate"
  | "roi"
  | "playTime"
  | "activeDays"
  | "bestScore"
  | "competitionsWon"
  | "challengeWins"
  | "consistency";

export interface Highlight {
  key: HighlightKey;
  label: string;
  value: string;
  hint: string;
  delta: number | null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function formatScore(score: number | null, unit?: string): string {
  if (score === null || !Number.isFinite(score)) return "-";
  const n = Number.isInteger(score)
    ? score.toLocaleString()
    : score.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
}

export function pct(value: number | null, digits = 1): string {
  return value === null ? "-" : `${value.toFixed(digits)}%`;
}

export function filteredGames(input: PerfInput, gameFilter: string) {
  return input.gamePerformance.filter((g) => matchesGame(g.gameKey, gameFilter));
}

export function buildHighlights(
  input: PerfInput,
  range: PerfRange,
  gameFilter: string,
): Highlight[] {
  const now = input.now ?? Date.now();
  const cur = windowFacts(input, currentWindow(range, now), gameFilter);
  const prevW = previousWindow(range, now);
  const prev = prevW ? windowFacts(input, prevW, gameFilter) : null;

  const curWinRate = rate(
    cur.competitionsWon + cur.challengeWins,
    cur.competitionsPlayed + cur.challengesPlayed,
  );
  const prevWinRate = prev
    ? rate(prev.competitionsWon + prev.challengeWins, prev.competitionsPlayed + prev.challengesPlayed)
    : null;

  const games = filteredGames(input, gameFilter);
  const playTimes = games
    .map((g) => g.averagePlaySeconds)
    .filter((s): s is number => typeof s === "number" && s > 0);
  const avgPlay = playTimes.length
    ? playTimes.reduce((s, v) => s + v, 0) / playTimes.length
    : null;

  // Reason: a best score is only meaningful within one title. With several games
  // in scope, show the most-played title's best and name it.
  const scoreGame =
    games
      .filter((g) => g.bestScore !== null)
      .sort((a, b) => b.rounds.scored - a.rounds.scored)[0] ?? null;

  const days = rangeDays(range);
  const span = days ?? spanDaysSinceFirstActivity(input, now);
  const consistency =
    span && span > 0 ? Math.min(100, (cur.activeDays.size / span) * 100) : null;
  const prevConsistency =
    prev && days ? Math.min(100, (prev.activeDays.size / days) * 100) : null;

  const tradingOnly = gameFilter === TRADING_KEY;

  return [
    {
      key: "winRate",
      label: "Win Rate",
      value: pct(curWinRate),
      hint: "Contests and 1v1 won",
      delta: percentChange(curWinRate, prevWinRate),
    },
    {
      key: "roi",
      label: "Avg ROI",
      value:
        gameFilter === ALL_GAMES || tradingOnly
          ? `${input.overview.roi >= 0 ? "+" : ""}${input.overview.roi.toFixed(1)}%`
          : "-",
      hint: "All time",
      delta: null,
    },
    {
      key: "playTime",
      label: "Avg Play Time",
      value: formatDuration(avgPlay),
      hint: "Per ranked round",
      delta: null,
    },
    {
      key: "activeDays",
      label: "Active Days",
      value: String(cur.activeDays.size),
      hint: days ? `In the last ${days} days` : "All time",
      delta: prev ? percentChange(cur.activeDays.size, prev.activeDays.size) : null,
    },
    {
      key: "bestScore",
      label: "Best Score",
      value: scoreGame ? formatScore(scoreGame.bestScore, scoreGame.scoreUnit) : "-",
      hint: scoreGame ? scoreGame.title : "No scored rounds",
      delta: null,
    },
    {
      key: "competitionsWon",
      label: "Competitions Won",
      value: String(cur.competitionsWon),
      hint: `${cur.competitionsPlayed} played`,
      delta: prev ? percentChange(cur.competitionsWon, prev.competitionsWon) : null,
    },
    {
      key: "challengeWins",
      label: "1v1 Wins",
      value: String(cur.challengeWins),
      hint: `${cur.challengesPlayed} played`,
      delta: prev ? percentChange(cur.challengeWins, prev.challengeWins) : null,
    },
    {
      key: "consistency",
      label: "Consistency",
      value: pct(consistency, 0),
      hint: "Share of days you played",
      delta: percentChange(consistency, prevConsistency),
    },
  ];
}

export function spanDaysSinceFirstActivity(input: PerfInput, now: number): number | null {
  const stamps: number[] = [];
  for (const d of input.charts.dailyPnL) {
    const ms = toMs(d.date);
    if (ms !== null && d.trades > 0) stamps.push(ms);
  }
  for (const a of input.gameActivity) {
    const ms = toMs(a.date);
    if (ms !== null) stamps.push(ms);
  }
  for (const c of input.competitions.completed) {
    const ms = toMs(c.endTime);
    if (ms !== null) stamps.push(ms);
  }
  for (const c of input.challenges.completed) {
    const ms = toMs(c.endTime);
    if (ms !== null) stamps.push(ms);
  }
  if (!stamps.length) return null;
  return Math.max(1, Math.ceil((now - Math.min(...stamps)) / DAY_MS));
}

/* ------------------------------------------------------------ trading row */

export interface MetricView {
  key: string;
  label: string;
  value: string;
  tone: "neutral" | "positive" | "negative";
}

function money(value: number): string {
  return `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** The eight trading facts the old rings showed. All time; trading money is simulated. */
export function buildTradingMetrics(overview: PerfInput["overview"]): MetricView[] {
  const signed = (v: number, digits: number) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
  const noTrades = overview.totalTrades === 0;
  const dash = (v: string) => (noTrades ? "-" : v);
  return [
    { key: "tradeWinRate", label: "Win Rate", value: dash(`${overview.winRate.toFixed(1)}%`), tone: "neutral" },
    {
      key: "tradeRoi",
      label: "Trade ROI",
      value: dash(signed(overview.totalPnLPercentage, 2)),
      tone: noTrades ? "neutral" : overview.totalPnLPercentage >= 0 ? "positive" : "negative",
    },
    {
      key: "profitFactor",
      label: "Profit Factor",
      value: dash(Number.isFinite(overview.profitFactor) ? overview.profitFactor.toFixed(2) : "∞"),
      tone: "neutral",
    },
    { key: "totalTrades", label: "Total Trades", value: overview.totalTrades.toLocaleString(), tone: "neutral" },
    { key: "avgWin", label: "Avg Win", value: dash(money(overview.averageWin)), tone: "positive" },
    { key: "avgLoss", label: "Avg Loss", value: dash(money(overview.averageLoss)), tone: "negative" },
    { key: "largestWin", label: "Largest Win", value: dash(money(overview.largestWin)), tone: "positive" },
    { key: "largestLoss", label: "Largest Loss", value: dash(money(overview.largestLoss)), tone: "negative" },
  ];
}

/* --------------------------------------------------------- summary panels */

export interface SummaryPanelView {
  played: number;
  headline: number | null;
  rows: { label: string; value: string }[];
  bars: { label: string; value: number | null; caption: string }[];
  credits: number;
}

export function buildChallengeSummary(
  input: PerfInput,
  range: PerfRange,
  gameFilter: string,
): SummaryPanelView {
  const now = input.now ?? Date.now();
  const f = windowFacts(input, currentWindow(range, now), gameFilter);
  const decided = f.challengeWins + f.challengeLosses;
  const winRate = rate(f.challengeWins, decided);
  // Reason (7 Oct 2026, owner): four tiles so the 1v1 grid matches Competition's
  // 2×2 — three cells left an empty corner that read as unfinished layout.
  return {
    played: f.challengesPlayed,
    headline: winRate,
    rows: [
      { label: "Played", value: String(f.challengesPlayed) },
      { label: "Wins", value: String(f.challengeWins) },
      { label: "Losses", value: String(f.challengeLosses) },
      { label: "Win rate", value: pct(winRate, 0) },
    ],
    bars: [
      {
        label: "Win rate",
        value: winRate,
        caption: pct(winRate, 0),
      },
    ],
    credits: f.challengeCredits,
  };
}

export function buildCompetitionSummary(
  input: PerfInput,
  range: PerfRange,
  gameFilter: string,
): SummaryPanelView {
  const now = input.now ?? Date.now();
  const f = windowFacts(input, currentWindow(range, now), gameFilter);
  const winRate = rate(f.competitionsWon, f.competitionsPlayed);
  const podium = rate(f.topThree, f.competitionsPlayed);
  return {
    played: f.competitionsPlayed,
    headline: winRate,
    rows: [
      { label: "Played", value: String(f.competitionsPlayed) },
      { label: "Won", value: String(f.competitionsWon) },
      { label: "Best rank", value: f.bestRank === null ? "-" : `#${f.bestRank}` },
      {
        label: "Avg rank",
        value: f.averageRank === null ? "-" : `#${f.averageRank.toFixed(1)}`,
      },
    ],
    bars: [
      { label: "Win rate", value: winRate, caption: pct(winRate, 0) },
      { label: "Top 3 finishes", value: podium, caption: `${f.topThree}` },
    ],
    credits: f.competitionCredits,
  };
}
