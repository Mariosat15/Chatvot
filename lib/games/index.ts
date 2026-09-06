import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";

import type { GameEnabledResult, GameType } from "./types";
import { getGameModule, resolveGameType } from "./registry";

export type {
  GameModule,
  GameType,
  GameCapabilities,
  GameScoring,
  GameEnabledResult,
  ScoreDirection,
} from "./types";
export { TRADING_GAME_TYPE, PROVIDER_GAME_TYPE } from "./types";
export {
  getGameModule,
  listGameModules,
  resolveGameType,
  getGameModuleOrTrading,
  contestGameLabel,
  gameNeedsMarketHours,
} from "./registry";

/**
 * The public entry point to the games layer (X1, chapter 11 section 3).
 *
 * Import from here, never from `./trading` or `./provider`. Invariant 1 is enforced with
 * ESLint `no-restricted-imports` for exactly this reason: the moment the contest engine
 * imports one game's folder, that game stops being replaceable.
 */

const FALLBACK_ENABLED_GAME_TYPES = ["trading"];

/**
 * Which game types an operator has switched on.
 *
 * WHERE THIS MAY BE USED: creating a contest, discovering or browsing games, entering a
 * contest.
 *
 * WHERE IT MAY NOT: any stats, leaderboard, ranking or progression READ path. Summing a
 * player's totals over the currently-enabled set means disabling a game retroactively
 * subtracts everything earned in it - a player who reached level 12 partly through a
 * provider game drops to level 9 because an operator switched it off, with no error and
 * no notification. Totals accumulate on settlement instead. Risk R29, invariant 9, and
 * the design in "External game plans/05" section 11.3.
 */
export async function getEnabledGameTypes(): Promise<string[]> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne()
      .select("enabledGameTypes")
      .lean<{ enabledGameTypes?: string[] }>();

    const configured = settings?.enabledGameTypes;
    // Reason: an empty array is treated as unconfigured, not as "every game is off".
    // A misconfiguration that silently disables all contests is worse than one that
    // leaves the platform in its pre-games state.
    if (!configured?.length) return FALLBACK_ENABLED_GAME_TYPES;

    return configured;
  } catch (error) {
    // Reason: a settings read failing must not take contests down with it. Trading is
    // the safe answer because it is what the platform ran before any of this existed.
    console.warn(
      "⚠️ Could not read enabledGameTypes, falling back to trading only:",
      error,
    );
    return FALLBACK_ENABLED_GAME_TYPES;
  }
}

/**
 * Resolve a game type to its module, checking that it is both known and switched on.
 *
 * Returns a result object and NEVER throws - chapter 11 section 7, and the codebase
 * convention that Next.js strips thrown error messages in production builds.
 *
 * An unlabelled contest resolves to trading (invariant 5), which covers documents written
 * before X1 and the Game Master route that bypasses Mongoose defaults (risk R7).
 */
export async function assertGameEnabled(
  gameType: GameType | null | undefined,
): Promise<GameEnabledResult> {
  const resolved = resolveGameType(gameType);
  // Reason: not named `module` - Next.js lints against assigning to that identifier.
  const gameModule = getGameModule(resolved);

  if (!gameModule) {
    // Reason: deliberately does NOT fall back to trading. Settling a provider contest
    // with trading code reads every score as zero, ties every player at rank 1 and pays
    // the wrong people - silently. An unknown game must stop the caller.
    return {
      enabled: false,
      reason: `Unknown game type "${resolved}". No module is registered for it.`,
    };
  }

  const enabledTypes = await getEnabledGameTypes();
  if (!enabledTypes.includes(resolved)) {
    return {
      enabled: false,
      reason: `${gameModule.label} is not currently enabled on this platform.`,
    };
  }

  return { enabled: true, gameModule };
}

