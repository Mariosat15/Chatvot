import { getGameModuleOrTrading, resolveGameType } from "./registry";
import { TRADING_GAME_TYPE, PROVIDER_GAME_TYPE } from "./types";

/**
 * X1 seam 3: which module settles a contest.
 *
 * WHY THIS EXISTS AS ONE FUNCTION. Chapter 11 section 2 re-measured the finalization
 * entry points on 4 September 2026 and found **ten in the main app**, not the five the
 * plan listed - including two that were missing entirely and one invoked from a **page
 * component**. Putting a dispatch at each call site is only correct while that list is
 * complete and stays complete, and this codebase demonstrably keeps adding callers.
 *
 * So the dispatch goes INSIDE `finalizeCompetition` and `finalizeChallenge` instead -
 * four places across two apps rather than twelve and counting - and every caller,
 * including the ones nobody has written yet, is correct by construction.
 *
 * Missing one means a provider contest is settled by trading code: every score read as
 * zero, every rank equal, prizes paid to the wrong players. Silently.
 */

export type SettlementRoute =
  | { ok: true }
  | { ok: false; error: string; reason: "unknown_game" | "no_settle_path" };

/**
 * Decide whether the trading settlement path may run for this contest.
 *
 * Returns a result object rather than throwing, because every caller is a server action
 * returning `{ success, error }` - Next.js strips thrown error messages in production
 * builds, so a throw would reach the operator as a render error instead of a reason.
 *
 * The two refusals are kept distinct on purpose. `unknown_game` means the data or the
 * registry is wrong and someone must look; `no_settle_path` means the label is valid and
 * this simply is not trading, which is the normal case the moment a provider contest
 * exists and the expected state until X5 adds its settle path.
 *
 * It deliberately does NOT consult `enabledGameTypes`. A contest players paid to enter
 * must finish and pay out even if an operator disables the game while it is running -
 * chapter 18 section 6: let running contests finish, or cancel with full refunds, but
 * never strand a paid entry.
 */
export function routeToTradingSettlement(
  gameType: string | null | undefined,
  contestDescription: string,
): SettlementRoute {
  const resolved = resolveGameType(gameType);
  const gameModule = getGameModuleOrTrading(resolved);

  if (!gameModule) {
    return {
      ok: false,
      reason: "unknown_game",
      error: `Cannot settle ${contestDescription}: no game module is registered for "${resolved}". Refusing rather than settling it as trading, which would pay the wrong players.`,
    };
  }

  if (gameModule.type !== TRADING_GAME_TYPE) {
    return {
      ok: false,
      reason: "no_settle_path",
      error: `Cannot settle ${contestDescription}: it is a ${gameModule.label} contest and the trading settlement path does not apply to it.`,
    };
  }

  return { ok: true };
}

/**
 * Which settlement path settles this contest - the X5 replacement for asking only whether
 * trading applies.
 *
 * WHY A SEPARATE FUNCTION RATHER THAN A THIRD OUTCOME ON THE ONE ABOVE. Challenges still
 * have only a trading path, and `routeToTradingSettlement` is what asks them the yes/no
 * question. Widening it would have made every challenge caller handle a "provider" answer
 * it cannot act on, so the narrow question keeps its narrow function.
 *
 * IT FAILS CLOSED ON AN UNKNOWN LABEL, and that asymmetry is deliberate. Wrongly refusing
 * to settle leaves a contest visibly stuck and someone reports it within the hour; wrongly
 * settling pays real credits to the wrong players and is not reversible. So a label with
 * no registered module refuses, and never falls through to trading.
 */
export type SettlementPath =
  | { path: "trading" }
  | { path: "provider" }
  | { path: "none"; error: string; reason: "unknown_game" | "no_settle_path" };

export function resolveSettlementPath(
  gameType: string | null | undefined,
  contestDescription: string,
): SettlementPath {
  const resolved = resolveGameType(gameType);
  const gameModule = getGameModuleOrTrading(resolved);

  if (!gameModule) {
    return {
      path: "none",
      reason: "unknown_game",
      error: `Cannot settle ${contestDescription}: no game module is registered for "${resolved}". Refusing rather than settling it as trading, which would pay the wrong players.`,
    };
  }

  if (gameModule.type === TRADING_GAME_TYPE) return { path: "trading" };
  if (gameModule.type === PROVIDER_GAME_TYPE) return { path: "provider" };

  return {
    path: "none",
    reason: "no_settle_path",
    error: `Cannot settle ${contestDescription}: it is a ${gameModule.label} contest and no settlement path is implemented for it yet.`,
  };
}
