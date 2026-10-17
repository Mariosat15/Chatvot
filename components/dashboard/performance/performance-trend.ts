import {
  ALL_GAMES,
  DAY_MS,
  TRADING_KEY,
  gameKeyOf,
  matchesGame,
  rangeDays,
  spanDaysSinceFirstActivity,
  toMs,
  type PerfInput,
  type PerfRange,
} from "./performance-model";

export type TrendSeriesKey = "overall" | "trading" | "games" | "competitions" | "challenges";

export const TREND_SERIES: { key: TrendSeriesKey; label: string; color: string }[] = [
  { key: "overall", label: "Overall", color: "#00d9ff" },
  { key: "trading", label: "Trading", color: "#00e6a3" },
  { key: "games", label: "Games", color: "#ff7b17" },
  { key: "competitions", label: "Competitions", color: "#9d39ff" },
  { key: "challenges", label: "1v1", color: "#ff36ca" },
];

export interface TrendBucket {
  start: number;
  end: number;
  label: string;
}

/**
 * Daily buckets for 7D/30D, weekly for 90D, weekly or monthly for All.
 * All starts at the first recorded activity so the chart is not mostly empty.
 */
export function trendBuckets(range: PerfRange, now: number, input?: PerfInput): TrendBucket[] {
  const days = rangeDays(range);
  const totalDays = days ?? (input ? spanDaysSinceFirstActivity(input, now) ?? 30 : 30);
  const step = totalDays <= 31 ? 1 : totalDays <= 200 ? 7 : 30;
  const count = Math.max(1, Math.ceil(totalDays / step));
  const endDay = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
  const out: TrendBucket[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const end = endDay - i * step * DAY_MS;
    const start = end - step * DAY_MS;
    const d = new Date(start);
    const label =
      step === 30
        ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    out.push({ start, end, label });
  }
  return out;
}

export type TrendPoint = { label: string } & Record<TrendSeriesKey, number>;

/**
 * Activity per period across every way the player plays.
 *
 * Reason: the series share ONE unit — things completed (trades closed, scored
 * rounds, competitions finished, 1v1s finished) — because trading P&L, game
 * scores and prizes have no common scale. Overall is their sum, not an index.
 */
export function buildTrend(
  input: PerfInput,
  range: PerfRange,
  gameFilter: string,
): { points: TrendPoint[]; totals: Record<TrendSeriesKey, number> } {
  const now = input.now ?? Date.now();
  const buckets = trendBuckets(range, now, input);
  const tradingIncluded =
    input.showTrading && (gameFilter === ALL_GAMES || gameFilter === TRADING_KEY);

  const sumIn = <T>(rows: T[], when: (r: T) => number | null, weight: (r: T) => number, b: TrendBucket) =>
    rows.reduce((s, r) => {
      const ms = when(r);
      return ms !== null && ms >= b.start && ms < b.end ? s + weight(r) : s;
    }, 0);

  const comps = input.competitions.completed.filter((c) =>
    matchesGame(gameKeyOf(c), gameFilter),
  );
  const challenges = input.challenges.completed.filter((c) =>
    matchesGame(gameKeyOf(c), gameFilter),
  );
  const activity = input.gameActivity.filter((a) => matchesGame(a.gameKey, gameFilter));

  const points = buckets.map((b) => {
    const trading = tradingIncluded
      ? sumIn(input.charts.dailyPnL, (d) => toMs(d.date), (d) => d.trades, b)
      : 0;
    const games = sumIn(activity, (a) => toMs(a.date), (a) => a.rounds, b);
    const competitions = sumIn(comps, (c) => toMs(c.endTime), () => 1, b);
    const challengeCount = sumIn(challenges, (c) => toMs(c.endTime), () => 1, b);
    return {
      label: b.label,
      trading,
      games,
      competitions,
      challenges: challengeCount,
      overall: trading + games + competitions + challengeCount,
    };
  });

  const totals = TREND_SERIES.reduce(
    (acc, s) => ({ ...acc, [s.key]: points.reduce((sum, p) => sum + p[s.key], 0) }),
    {} as Record<TrendSeriesKey, number>,
  );
  return { points, totals };
}
