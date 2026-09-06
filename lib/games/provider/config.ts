import type { GameCapabilities, GameScoring } from "../types";

/**
 * What a provider contest can and cannot do.
 *
 * THESE ARE THE CONSERVATIVE INTERSECTION, not any one title's abilities. The engine reads
 * this to decide what to offer before a specific title has been chosen - the market-hours
 * gate, for instance, consults it from `gameNeedsMarketHours()` with nothing but the game
 * type in hand. A per-title ability that some titles lack must be read from that title's
 * `provider_game` row, never from here, or the first title without it silently gets an
 * option it cannot honour.
 *
 * Concretely: `supportsChallenges` is true because the provider contract has a
 * `supportsOneVsOne` flag and some titles will set it - but the contest pre-flight still
 * refuses a challenge on a title whose own flag is false. This says "the category permits
 * it", the catalogue row says "this game does".
 */
export const providerCapabilities: GameCapabilities = {
  // No price feed. This is the flag that keeps a provider contest out of the trading
  // engine's price plumbing entirely.
  needsPriceFeed: false,

  // The reason the capability exists at all. Before X1 the market-hours check was
  // unconditional, so a chess contest was unplayable at the weekend for no reason.
  needsMarketHours: false,

  // A provider reports a result at the end of a round; it does not knock players out
  // mid-contest. A title that eliminates would express that within its own gameplay.
  supportsElimination: false,

  // FALSE, and this is the one worth explaining. Scores arrive per finished ROUND, not
  // continuously during play, so a live leaderboard would move in jumps and would show a
  // player on zero purely because their round is still running. Claiming otherwise would
  // put a leaderboard on screen that reads as a ranking and is actually a race to finish.
  scoreUpdates: false,

  supportsChallenges: true,

  // The engine never requires both players present. A 1v1 provider challenge is two
  // independently played rounds compared afterwards, which is what lets a challenge work
  // across time zones. A title genuinely needing simultaneous play is out of scope.
  requiresSyncPlay: false,
};

/**
 * The module-level default direction.
 *
 * `higher_is_better` here is a fallback for a participant carrying no direction, NOT a
 * statement about provider games in general - direction is per title and is threaded onto
 * the participant at finalization. Anything reading this constant to decide a real ranking
 * is reading the wrong thing.
 */
export const providerScoring: GameScoring = {
  direction: "higher_is_better",
  scoreType: "points",
};
