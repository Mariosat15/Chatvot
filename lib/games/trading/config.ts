import type { GameCapabilities, GameScoring } from "../types";

/**
 * What trading is, expressed as capabilities rather than as special cases in the engine.
 *
 * Every flag here is a statement the engine used to make unconditionally. Writing them
 * down is what allows a second game to answer differently without any `if (trading)`
 * appearing anywhere - invariant 8.
 */
export const tradingCapabilities: GameCapabilities = {
  needsPriceFeed: true,
  // Reason: today the market-hours check is unconditional, so it would block a provider
  // contest at the weekend. Scoping the gate to this flag is a X1 deliverable; trading
  // keeps its current behaviour because it answers true.
  needsMarketHours: true,
  // Liquidation ends a trader's contest early, which is elimination by another name.
  supportsElimination: true,
  // PnL moves on every tick, so the live leaderboard is real.
  scoreUpdates: true,
  supportsChallenges: true,
  // Traders play their own account against the clock, not against each other in real
  // time. Trading is an INDEPENDENT-PLAY game - which describes gameplay, not contest
  // size. Every trader is ranked together in one competition.
  requiresSyncPlay: false,
};

/**
 * Trading ranks on six configurable metrics rather than one score, and for all six a
 * higher value wins - the ranking service sorts descending with no per-metric direction.
 * The general `score` field therefore also sorts higher-is-better.
 */
export const tradingScoring: GameScoring = {
  direction: "higher_is_better",
  scoreType: "currency",
};
