/**
 * The game module contract (X1, chapter 11 section 3).
 *
 * A game module is what lets the shared contest engine run a contest without knowing what
 * the game is. The engine owns entry fees, the prize pool, ranking, payouts, refunds and
 * progression; a module owns only the game-specific parts of scoring and settlement.
 *
 * Two axes must not be conflated, because collapsing them is how a 1v1 provider contest
 * ends up impossible to express:
 *
 *   Contest kind   competition | challenge      - how many players and how they are paid
 *   Game type      trading | provider           - which module scores and settles
 *
 * A challenge is not a game, and trading is not a contest kind.
 */

/** Values are open-ended by design: adding a game must not require editing a union. */
export type GameType = string;

export const TRADING_GAME_TYPE = "trading";
export const PROVIDER_GAME_TYPE = "provider";

/**
 * What a module can do, so the admin panel cannot offer an impossible contest format.
 *
 * For provider games these are derived from the catalogue response described in chapter
 * 01 section 3 (`family`, `supportsCompetition`, `supportsOneVsOne`, `supportsContentSeed`)
 * rather than hard-coded.
 */
export interface GameCapabilities {
  /** Needs live prices. Trading does; a puzzle game does not. */
  needsPriceFeed: boolean;
  /**
   * Gated by market hours.
   *
   * Reason: this must be a capability rather than a global check. The market-hours gate
   * is currently unconditional, so without this flag a provider contest would be blocked
   * at the weekend for no reason - see chapter 11 section 7.
   */
  needsMarketHours: boolean;
  /** Players can be knocked out mid-contest. */
  supportsElimination: boolean;
  /** Scores arrive during play rather than only at the end, so a live leaderboard works. */
  scoreUpdates: boolean;
  /** Can be played as a 1v1 challenge, not only a competition. */
  supportsChallenges: boolean;
  /** Both players must be present at the same time. */
  requiresSyncPlay: boolean;
}

/** Which way is better. Some games rank on lowest score - a race time, a stroke count. */
export type ScoreDirection = "higher_is_better" | "lower_is_better";

export interface GameScoring {
  direction: ScoreDirection;
  /** Display only. Never used for ranking. */
  scoreType?: "points" | "time_ms" | "currency" | "percentage";
}

/**
 * The participant shape the ranking engine can see.
 *
 * Every game-specific metric is OPTIONAL, and that is the whole design. Before X1 the
 * engine's participant interface was entirely trading-shaped - `currentCapital`, `pnl`,
 * `totalTrades`, `winningTrades`, `winRate` - which meant a second game could not be
 * ranked without either faking trading fields or branching on game type. Making them
 * optional lets a provider participant supply `score` alone.
 *
 * `ParticipantData`, whose trading fields are all required, is structurally assignable to
 * this, so nothing on the trading path had to change to adopt it.
 */
export interface RankableParticipant {
  userId: string;
  status: string;
  enteredAt: Date;
  /**
   * The general, cross-game result, stored RAW as the game reports it.
   *
   * Raw rather than pre-negated so that a leaderboard, a profile and a cross-game
   * aggregate can all read this field and show a race time as 92.4 seconds rather than
   * as -92.4. Ranking does the negating, at the moment of comparison, and nothing
   * persists the negated value.
   */
  score?: number;

  /**
   * Which way is better for THIS participant's game.
   *
   * On the participant rather than on the module because one provider module serves every
   * one of that provider's titles, and direction is a property of the title - a puzzle
   * game scores upward while a time trial scores downward. A module-level constant would
   * force one module per title, which is the opposite of plug-and-play.
   *
   * Absent means `higher_is_better`, which is correct for trading and for the large
   * majority of games. It is a display-independent ranking input, so it is threaded in at
   * finalization from the catalogue rather than stored on every participant row.
   */
  scoreDirection?: ScoreDirection;

  // Trading metrics. Present only for trading participants.
  currentCapital?: number;
  pnl?: number;
  pnlPercentage?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  winRate?: number;
}

export interface GameModule {
  /** Selects the module. Stored on the contest as `gameType`. */
  readonly type: GameType;
  /** Shown to operators. Never used as an identifier. */
  readonly label: string;
  readonly capabilities: GameCapabilities;
  readonly scoring: GameScoring;

  /**
   * The value this game ranks on, higher being better.
   *
   * Trading interprets `rankingMethod` as one of its six configurable metrics. A provider
   * game ignores the method and returns the reported `score`, negated when the game
   * declares `lower_is_better`, so a race time ranks correctly through the same
   * descending sort the engine already performs.
   */
  getRankingValue(participant: RankableParticipant, rankingMethod: string): number;

  /** The tie-break value, higher being better. Games with no tie-breaks return 0. */
  getTieBreakerValue(participant: RankableParticipant, tieBreaker: string): number;
}

/**
 * The result of an enablement check.
 *
 * Reason: this deliberately RETURNS rather than throws. Chapter 11 section 7 requires
 * `assertGameEnabled()` to return a result object and never throw, and the codebase
 * convention is the same - server actions return `{ success, error }` because Next.js
 * strips thrown error messages in production builds. A throw here would surface to a
 * player as "An error occurred in Server Components render" instead of a usable reason.
 *
 * The field is `gameModule` and not `module`: Next.js lints against assigning to a
 * variable called `module`, so the shorter name would break at every destructure.
 */
export type GameEnabledResult =
  | { enabled: true; gameModule: GameModule }
  | { enabled: false; reason: string };
