import { overviewPlayCardArt } from "@/lib/services/games/overview-assets";
import {
  ALL_GAMES,
  TRADING_KEY,
  currentWindow,
  filteredGames,
  formatDuration,
  formatScore,
  gameKeyOf,
  inWindow,
  percentChange,
  previousWindow,
  toMs,
  type PerfInput,
  type PerfRange,
} from "./performance-model";
import { type PerfAccent } from "./performance-assets";
import { trendBuckets } from "./performance-trend";

export interface GameCardView {
  gameKey: string;
  title: string;
  /** Catalogue tagline when the overview payload has one — never invented here (R29). */
  tagline: string | null;
  category?: string;
  /** Always a real play/banner image when the card is shown — never a neon icon. */
  artSrc: string;
  href: string;
  /** Free-text unit for the activity count ("Trades" / "Rounds" / catalogue label). */
  activityLabel: string;
  status: "live" | "retired" | "active";
  scoredRounds: number;
  contests: number;
  bestScore: string;
  avgPlayTime: string;
  lastPlayedAt: string | null;
  spark: number[];
  periodRounds: number;
  /** Period-over-period on activity in the selected window. Null when all-time. */
  roundsTrend: number | null;
  contestsTrend: number | null;
  bestScoreTrend: number | null;
  avgPlayTrend: number | null;
  /** Trading cyan; other titles cycle without naming a game (R29). */
  accent: PerfAccent;
}

/** A card with nothing played is noise — hide it (owner, 9 Oct 2026). */
export function hasPlayedGameCard(card: Pick<GameCardView, "scoredRounds" | "contests">): boolean {
  return card.scoredRounds > 0 || card.contests > 0;
}

const PROVIDER_ACCENTS = new Map<number, PerfAccent>([
  [0, "orange"],
  [1, "magenta"],
  [2, "purple"],
  [3, "gold"],
]);

/** Trading is cyan. Every other title hashes its key so no game is named (R29). */
export function accentForGame(gameKey: string): PerfAccent {
  if (gameKey === TRADING_KEY) return "cyan";
  let n = 0;
  for (let i = 0; i < gameKey.length; i += 1) {
    n = (n + gameKey.charCodeAt(i) * (i + 1)) % PROVIDER_ACCENTS.size;
  }
  return PROVIDER_ACCENTS.get(n) ?? "orange";
}

function playMeta(
  input: PerfInput,
  gameKey: string,
): { tagline: string | null; artSrc: string | null; href: string; activityLabel: string } {
  const card =
    input.overviewStanding.playCards.find((c) => c.gameKey === gameKey) ??
    (gameKey === TRADING_KEY
      ? input.overviewStanding.playCards.find((c) => c.isTrading)
      : undefined);
  return {
    tagline: card?.tagline?.trim() ? card.tagline.trim() : null,
    artSrc: card?.artSrc ?? null,
    href: card?.href ?? "/games",
    activityLabel:
      card?.activityLabel?.trim() || (gameKey === TRADING_KEY ? "Trades" : "Rounds"),
  };
}

function tradingGameCard(
  input: PerfInput,
  range: PerfRange,
  now: number,
): GameCardView {
  const w = currentWindow(range, now);
  const prev = previousWindow(range, now);
  const buckets = trendBuckets(range, now, input);
  const comps = input.competitions.completed.filter((c) => gameKeyOf(c) === TRADING_KEY);
  const chals = input.challenges.completed.filter((c) => gameKeyOf(c) === TRADING_KEY);
  const endedIn = (ms: number | null, start: number, end: number) =>
    ms !== null && ms >= start && ms < end;
  const spark = buckets.map((b) =>
    input.charts.dailyPnL
      .filter((d) => endedIn(toMs(d.date), b.start, b.end))
      .reduce((s, d) => s + d.trades, 0),
  );
  const periodContests =
    comps.filter((c) => inWindow(toMs(c.endTime), w)).length +
    chals.filter((c) => inWindow(toMs(c.endTime), w)).length;
  const prevContests = prev
    ? comps.filter((c) => inWindow(toMs(c.endTime), prev)).length +
      chals.filter((c) => inWindow(toMs(c.endTime), prev)).length
    : null;
  const periodTrades = input.charts.dailyPnL
    .filter((d) => inWindow(toMs(d.date), w))
    .reduce((s, d) => s + d.trades, 0);
  const prevTrades = prev
    ? input.charts.dailyPnL
        .filter((d) => inWindow(toMs(d.date), prev))
        .reduce((s, d) => s + d.trades, 0)
    : null;
  const stamps = [...comps, ...chals]
    .map((c) => toMs(c.endTime))
    .filter((ms): ms is number => ms !== null);
  const meta = playMeta(input, TRADING_KEY);
  // Reason: "Best score" on a game card is that title's performance figure.
  // Wallet credit ROI is a different question (Avg ROI highlight); trading's
  // answer is Trade ROI — realized PnL ÷ trading starting capital. No trades
  // → dash, never a nought (R45).
  const tradeRoi = input.overview.totalPnLPercentage;
  const bestScore =
    input.overview.totalTrades > 0 && Number.isFinite(tradeRoi)
      ? `${tradeRoi >= 0 ? "+" : ""}${tradeRoi.toFixed(2)}%`
      : "-";

  return {
    gameKey: TRADING_KEY,
    title: "Trading",
    tagline: meta.tagline,
    category: "Markets",
    // Reason: never use a neon icon as the hero strip — same art as Overview when
    // the standing payload has no play card yet.
    artSrc: meta.artSrc ?? overviewPlayCardArt(null, true),
    href: meta.href,
    activityLabel: meta.activityLabel,
    status: "active",
    scoredRounds: input.overview.totalTrades,
    contests: comps.length + chals.length,
    bestScore,
    avgPlayTime: "-",
    lastPlayedAt: stamps.length ? new Date(Math.max(...stamps)).toISOString() : null,
    spark,
    periodRounds: periodTrades,
    roundsTrend: percentChange(periodTrades, prevTrades),
    contestsTrend: percentChange(periodContests, prevContests),
    bestScoreTrend: null,
    avgPlayTrend: null,
    accent: accentForGame(TRADING_KEY),
  };
}

export function buildGameCards(
  input: PerfInput,
  range: PerfRange,
  gameFilter: string,
): GameCardView[] {
  const now = input.now ?? Date.now();
  const w = currentWindow(range, now);
  const prev = previousWindow(range, now);
  const buckets = trendBuckets(range, now, input);

  const cards = filteredGames(input, gameFilter).map((g) => {
    const activity = input.gameActivity.filter((a) => a.gameKey === g.gameKey);
    const spark = buckets.map((b) =>
      activity
        .filter((a) => {
          const ms = toMs(a.date);
          return ms !== null && ms >= b.start && ms < b.end;
        })
        .reduce((s, a) => s + a.rounds, 0),
    );
    const periodRounds = activity
      .filter((a) => inWindow(toMs(a.date), w))
      .reduce((s, a) => s + a.rounds, 0);
    const prevRounds = prev
      ? activity
          .filter((a) => inWindow(toMs(a.date), prev))
          .reduce((s, a) => s + a.rounds, 0)
      : null;
    const endedIn = (ms: number | null, window: { start: number | null; end: number }) =>
      inWindow(ms, window);
    const periodContests =
      input.competitions.completed.filter(
        (c) => gameKeyOf(c) === g.gameKey && endedIn(toMs(c.endTime), w),
      ).length +
      input.challenges.completed.filter(
        (c) => gameKeyOf(c) === g.gameKey && endedIn(toMs(c.endTime), w),
      ).length;
    const prevContests = prev
      ? input.competitions.completed.filter(
          (c) => gameKeyOf(c) === g.gameKey && endedIn(toMs(c.endTime), prev),
        ).length +
        input.challenges.completed.filter(
          (c) => gameKeyOf(c) === g.gameKey && endedIn(toMs(c.endTime), prev),
        ).length
      : null;
    const meta = playMeta(input, g.gameKey);
    return {
      gameKey: g.gameKey,
      title: g.title,
      tagline: meta.tagline,
      category: g.category?.label,
      artSrc: meta.artSrc ?? overviewPlayCardArt(null, false),
      href: meta.href,
      activityLabel: meta.activityLabel,
      status: g.rounds.live > 0 ? "live" : g.inCatalogue ? "active" : "retired",
      scoredRounds: g.rounds.scored,
      contests: g.competitions + g.challenges,
      bestScore: formatScore(g.bestScore, g.scoreUnit),
      avgPlayTime: formatDuration(g.averagePlaySeconds),
      lastPlayedAt: g.lastPlayedAt,
      spark,
      periodRounds,
      roundsTrend: percentChange(periodRounds, prevRounds),
      contestsTrend: percentChange(periodContests, prevContests),
      bestScoreTrend: null,
      avgPlayTrend: null,
      accent: accentForGame(g.gameKey),
    };
  });

  // Reason: Game Performance is every playable title. Trading is not a
  // `game_round` row so it never arrived in `gamePerformance`; without this
  // card the strip only showed provider games. Omit when the player has never
  // traded or entered a trading contest — an empty card with a neon-icon hero
  // was worse than the empty state (owner, 9 Oct 2026).
  if (input.showTrading && (gameFilter === ALL_GAMES || gameFilter === TRADING_KEY)) {
    const trading = tradingGameCard(input, range, now);
    if (hasPlayedGameCard(trading)) cards.unshift(trading);
  }
  return cards.filter(hasPlayedGameCard);
}
