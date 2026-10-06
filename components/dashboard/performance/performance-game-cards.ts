import {
  ALL_GAMES,
  TRADING_KEY,
  currentWindow,
  filteredGames,
  formatDuration,
  formatScore,
  gameKeyOf,
  inWindow,
  toMs,
  type PerfInput,
  type PerfRange,
} from "./performance-model";
import { trendBuckets } from "./performance-trend";

export interface GameCardView {
  gameKey: string;
  title: string;
  /** Catalogue tagline when the overview payload has one — never invented here (R29). */
  tagline: string | null;
  category?: string;
  artSrc: string | null;
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
  const buckets = trendBuckets(range, now, input);
  const comps = input.competitions.completed.filter((c) => gameKeyOf(c) === TRADING_KEY);
  const chals = input.challenges.completed.filter((c) => gameKeyOf(c) === TRADING_KEY);
  const spark = buckets.map(
    (b) =>
      comps.filter((c) => {
        const ms = toMs(c.endTime);
        return ms !== null && ms >= b.start && ms < b.end;
      }).length +
      chals.filter((c) => {
        const ms = toMs(c.endTime);
        return ms !== null && ms >= b.start && ms < b.end;
      }).length,
  );
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
    artSrc: meta.artSrc,
    href: meta.href,
    activityLabel: meta.activityLabel,
    status: "active",
    scoredRounds: input.overview.totalTrades,
    contests: comps.length + chals.length,
    bestScore,
    avgPlayTime: "-",
    lastPlayedAt: stamps.length ? new Date(Math.max(...stamps)).toISOString() : null,
    spark,
    periodRounds:
      comps.filter((c) => inWindow(toMs(c.endTime), w)).length +
      chals.filter((c) => inWindow(toMs(c.endTime), w)).length,
  };
}

export function buildGameCards(
  input: PerfInput,
  range: PerfRange,
  gameFilter: string,
): GameCardView[] {
  const now = input.now ?? Date.now();
  const w = currentWindow(range, now);
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
    const meta = playMeta(input, g.gameKey);
    return {
      gameKey: g.gameKey,
      title: g.title,
      tagline: meta.tagline,
      category: g.category?.label,
      artSrc: meta.artSrc,
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
    };
  });

  // Reason: Game Performance is every playable title. Trading is not a
  // `game_round` row so it never arrived in `gamePerformance`; without this
  // card the strip only showed provider games.
  if (input.showTrading && (gameFilter === ALL_GAMES || gameFilter === TRADING_KEY)) {
    cards.unshift(tradingGameCard(input, range, now));
  }
  return cards;
}
