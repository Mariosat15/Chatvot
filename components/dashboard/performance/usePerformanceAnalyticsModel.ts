"use client";

import { useMemo, useState } from "react";
import {
  ALL_GAMES,
  TRADING_KEY,
  buildChallengeSummary,
  buildCompetitionSummary,
  buildHighlights,
  buildTradingMetrics,
  gameOptions,
  type PerfInput,
  type PerfRange,
} from "./performance-model";
import { buildGameCards } from "./performance-game-cards";
import { buildTrend } from "./performance-trend";

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
    const gameCards = buildGameCards(input, range, activeGame);
    return {
      range,
      setRange,
      gameKey: activeGame,
      setGameKey,
      gameOptions: options,
      highlights: buildHighlights(input, range, activeGame),
      gameCards,
      trend: buildTrend(input, range, activeGame),
      showTradingSection,
      showGamesSection: gameCards.length > 0,
      tradingMetrics: buildTradingMetrics(input.overview),
      challengeSummary: buildChallengeSummary(input, range, activeGame),
      competitionSummary: buildCompetitionSummary(input, range, activeGame),
      challengesFilteredOut: false,
    };
  }, [input, range, activeGame, options]);
}

export type PerformanceAnalyticsModel = ReturnType<typeof usePerformanceAnalyticsModel>;
