"use client";

import { useMemo, useState } from "react";
import {
  ALL_GAMES,
  TRADING_KEY,
  buildChallengeSummary,
  buildCompetitionSummary,
  buildGameCards,
  buildHighlights,
  buildTradingMetrics,
  buildTrend,
  gameOptions,
  type PerfInput,
  type PerfRange,
} from "./performance-model";

/**
 * One model for both the desktop and mobile trees, so the two layouts can never
 * show different numbers for the same filters.
 *
 * The header range and the trend's period control are the SAME state on purpose:
 * two independent ranges on one page let the chart and the cards above it
 * describe different periods while both look authoritative.
 */
export function usePerformanceAnalyticsModel(input: PerfInput) {
  const [range, setRange] = useState<PerfRange>("30d");
  const [gameKey, setGameKey] = useState<string>(ALL_GAMES);

  const options = useMemo(() => gameOptions(input), [input]);
  // Reason: a stale selection (a game no longer in the payload) falls back to All
  // rather than rendering a page of dashes for a filter nobody can see.
  const activeGame = options.some((o) => o.value === gameKey) ? gameKey : ALL_GAMES;

  return useMemo(() => {
    const showTradingSection =
      input.showTrading && (activeGame === ALL_GAMES || activeGame === TRADING_KEY);
    return {
      range,
      setRange,
      gameKey: activeGame,
      setGameKey,
      gameOptions: options,
      highlights: buildHighlights(input, range, activeGame),
      gameCards: buildGameCards(input, range, activeGame),
      trend: buildTrend(input, range, activeGame),
      showTradingSection,
      // Reason: with Trading selected, an empty games carousel would read as
      // "you have never played a game" — a false statement, not a filtered one.
      showGamesSection: activeGame !== TRADING_KEY,
      tradingMetrics: buildTradingMetrics(input.overview),
      challengeSummary: buildChallengeSummary(input, range, activeGame),
      competitionSummary: buildCompetitionSummary(input, range, activeGame),
      challengesFilteredOut: activeGame !== ALL_GAMES,
    };
  }, [input, range, activeGame, options]);
}

export type PerformanceAnalyticsModel = ReturnType<typeof usePerformanceAnalyticsModel>;
