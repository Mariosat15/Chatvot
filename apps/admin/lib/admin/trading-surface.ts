/**
 * The one answer to "does trading still matter on this admin screen?"
 *
 * WHY IT IS ONE FUNCTION AND NOT TWO CONDITIONS. `12` s5 asks for the price-feed panel to be
 * hidden when trading is off, and `12` s9's acceptance list asks for the whole TRADING group to
 * be hidden on the same flag. That is one question with two consumers - the overview's status
 * tile and the sidebar - and two copies of it is the "one rule, two copies" shape behind
 * `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, none of which
 * `check:mirrors` can see. Worse here than usual, because the two would disagree only in the
 * state nobody tests: trading switched off with a contest still running.
 *
 * WHY IT IS NOT `tradingEnabled` ALONE, which is what both plan entries literally say.
 * Switching trading off stops new trading contests being created and entered; **it does not
 * close the ones already running.** Every open position in them is still priced, still marked
 * to market and still settled from the same feed, and an operator running one still needs
 * symbols, market hours, risk limits and price health. `12` s9 says as much in its own words -
 * "and running trading contests still finish correctly" - so hiding the screens that operate
 * them contradicts the criterion's second half while satisfying its first.
 *
 * **A health indicator that disappears exactly when somebody needs it is worse than one shown
 * needlessly.** So the surfaces are withheld only once trading is off AND has nothing live,
 * which is the state the plan is really describing: a platform that has moved on from trading.
 *
 * MODEL-FREE ON PURPOSE. The sidebar is a `"use client"` component, so a module reaching for
 * Mongoose cannot be imported anywhere near it - the same constraint behind
 * `contest-control-copy.ts`, `round-resolution-actions.ts` and `components/games/play-state.ts`.
 * The facts are resolved server-side and passed in.
 *
 * Admin-only. `check:mirrors` compares models and says nothing about any of this.
 */

export interface TradingSurfaceFacts {
  /** Whether `WhiteLabel.enabledGameTypes` still contains trading. */
  tradingEnabled: boolean;
  /** Whether any `active` or `upcoming` contest is a trading one. */
  tradingHasLiveContests: boolean;
}

/**
 * Whether trading's own admin screens and status panels should be offered.
 *
 * // Reason it is stated as an OR rather than as "hidden when disabled": the two inputs answer
 * different questions - what an operator has configured, and what is actually happening - and
 * only the second one can make hiding harmful.
 */
export function isTradingSurfaceRelevant(facts: TradingSurfaceFacts): boolean {
  return facts.tradingEnabled || facts.tradingHasLiveContests;
}

/**
 * What the sidebar assumes when nobody has told it anything.
 *
 * **It must be visible, and that direction is load-bearing.** Resolving the facts needs a
 * settings read and a contest query, either of which can fail; and this flag is passed through
 * a prop, which a future caller can forget. Fail closed and an operator loses the six screens
 * that run a live trading contest because a database call timed out - with no error and nothing
 * to click. Fail open and the menu is merely untidy on a platform that has stopped trading.
 *
 * The same reasoning as `getEnabledGameTypes()` returning trading when its own read throws.
 */
export const TRADING_SURFACE_VISIBLE_BY_DEFAULT = true;
