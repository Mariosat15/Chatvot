/**
 * Reading a contest's game label in admin screens.
 *
 * THIS IS DELIBERATELY NOT `isProviderContest`, AND THE DIFFERENCE MATTERS.
 * `lib/services/games/contest-config.ts` already exports a function of that name, and it
 * answers a stricter question: it requires the label **and** a provider key **and** a game
 * code, because a contest labelled provider with no keys cannot launch a round.
 *
 * An admin screen is asking something else. It wants to know **what kind of contest this
 * row is**, so that it can label it and withhold the trading editor from it. A half-built
 * provider contest is still a provider contest for both of those purposes - arguably more
 * urgently, since it is the one an operator needs to see and must not "fix" by saving it
 * through a trading form.
 *
 * Using the strict helper here would have been the natural mistake, and it fails silently in
 * the worst direction: a provider contest missing its keys would render as a trading contest,
 * with a trading Edit button, and no badge to suggest otherwise.
 *
 * Not mirrored. `apps/admin/lib/admin/` is admin-only, like `game-sections.ts`, so
 * `check:mirrors` says nothing about this file and there is no second copy to keep in step.
 */

/** The label every contest created before the game label existed resolves to. */
export const DEFAULT_GAME_TYPE = "trading";

interface GameLabelled {
  gameType?: string | null;
}

/**
 * The contest's game type, with an absent label resolved to trading.
 *
 * Reason the fallback is load-bearing rather than defensive: `gameType` has a schema
 * **default** of "trading", and much of this codebase reads with `.lean()`, which skips
 * hydration - so a contest stored before the label existed comes back with no `gameType` key
 * at all rather than with the default filled in. `GET /api/competitions` is one such read.
 */
export function resolveContestGameType(
  contest: GameLabelled | null | undefined,
): string {
  const label = contest?.gameType;
  return typeof label === "string" && label.length > 0
    ? label
    : DEFAULT_GAME_TYPE;
}

/**
 * True when this contest is labelled as belonging to an external provider's game.
 *
 * Asks only about the label. See the file comment for why that is the right question for a
 * screen and the wrong one for a round launch.
 */
export function hasProviderGameLabel(
  contest: GameLabelled | null | undefined,
): boolean {
  return resolveContestGameType(contest) === "provider";
}
