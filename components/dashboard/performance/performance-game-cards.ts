import {
  ALL_GAMES,
  TRADING_KEY,
  currentWindow,
  filteredGames,
  formatDuration,
  formatScore,
  gameKeyOf,
  inWindow,
  pct,
  toMs,
  type PerfInput,
  type PerfRange,
} from "./performance-model";
import { trendBuckets } from "./performance-trend";

export interface GameCardView {
  gameKey: string;
  title: string;
  category?: string;
  artSrc: string | null;
  status: "live" | "retired" | "active";
  scoredRounds: number;
  contests: number;
  bestScore: string;
  avgPlayTime: string;
  lastPlayedAt: string | null;
  spark: number[];
  periodRounds: number;
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
  const tradingArt = input.overviewStanding.playCards.find(
    (c) => c.gameKey === TRADING_KEY || c.isTrading,
  );
  return {
    gameKey: TRADING_KEY,
    title: "Trading",
    category: "Markets",
    artSrc: tradingArt?.artSrc ?? null,
    status: "active",
    scoredRounds: input.overview.totalTrades,
    contests: comps.length + chals.length,
    bestScore: pct(Number.isFinite(input.overview.roi) ? input.overview.roi : null),
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
  const artByKey = new Map(
    input.overviewStanding.playCards.map((c) => [c.gameKey, c.artSrc]),
  );
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
    return {
      gameKey: g.gameKey,
      title: g.title,
      category: g.category?.label,
      artSrc: artByKey.get(g.gameKey) ?? null,
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
  // card the carousel only showed provider games.
  if (input.showTrading && (gameFilter === ALL_GAMES || gameFilter === TRADING_KEY)) {
    cards.unshift(tradingGameCard(input, range, now));
  }
  return cards;
}
