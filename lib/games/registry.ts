import type { GameModule, GameType } from "./types";
import { tradingGameModule } from "./trading";

/**
 * The module registry (X1, chapter 11 section 3).
 *
 * This is the ONLY place that knows which game modules exist. Everything else resolves a
 * module by the `gameType` stored on the contest, which is what makes adding a game a
 * registration rather than an edit spread across the engine.
 *
 * Invariant 1: the contest engine never imports a specific game folder. It imports this.
 *
 * The provider module is registered here in X4. One provider module serves every game
 * from every provider - which company and which title are data on the contest, not code -
 * so this list does NOT grow per game or per provider.
 */
const MODULES: readonly GameModule[] = [tradingGameModule];

/** Every registered module. Order is registration order and carries no meaning. */
export function listGameModules(): readonly GameModule[] {
  return MODULES;
}

/**
 * Resolve a module by game type.
 *
 * Returns `undefined` rather than throwing or falling back to trading. Reason: a silent
 * fallback is how a provider contest gets settled by trading code - every score read as
 * zero, every player tied, prizes paid to the wrong people, and no error anywhere. The
 * caller must decide what an unknown game type means in its context.
 */
export function getGameModule(gameType: GameType): GameModule | undefined {
  return MODULES.find((candidate) => candidate.type === gameType);
}

/**
 * The game type to assume when a contest carries no label.
 *
 * Invariant 5: the label is required on write, and a missing label on read means trading.
 * The model defaults cover anything written through Mongoose; this covers the two ways
 * around them - documents written before X1, and the Game Master route that inserts with
 * the raw MongoDB driver and bypasses defaults entirely (risk R7).
 */
export function resolveGameType(
  stored: string | null | undefined,
): GameType {
  return stored && stored.trim().length > 0 ? stored : tradingGameModule.type;
}

/**
 * Resolve a module for a contest that is already under way, treating an absent label as
 * trading. Returns `undefined` only for a genuinely unknown game type.
 *
 * Two reasons this lives in `registry.ts` rather than beside `assertGameEnabled` in
 * `index.ts`:
 *
 *   - It is SYNCHRONOUS and consults no flags. `index.ts` reaches for the database to
 *     read `enabledGameTypes`, and the ranking engine - a pure function called in a sort
 *     comparator - must not drag a database import in behind it.
 *   - Ranking and settlement MUST NOT check whether a game is enabled. A contest players
 *     paid to enter has to finish and pay out even if an operator disables the game
 *     while it is running. Chapter 18 section 6: let running contests finish, or cancel
 *     with full refunds - never strand a paid entry.
 */
export function getGameModuleOrTrading(
  gameType: GameType | null | undefined,
): GameModule | undefined {
  return getGameModule(resolveGameType(gameType));
}
