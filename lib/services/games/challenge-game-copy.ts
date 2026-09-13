import type { ChallengeableTitle } from "./challengeable-titles.service";

/**
 * What the picker has chosen. Trading carries no title - it is not a `ChallengeableTitle`
 * and never will be, so a switch on `selection.type` is exhaustive without a third case.
 * Defined here rather than in `ChallengeGamePicker.tsx` so this module and the picker can
 * both import it with no cycle between them.
 */
export type ChallengeGameSelection =
  | { type: "trading" }
  | { type: "provider"; title: ChallengeableTitle };

/**
 * The copy that changes on the "create a challenge" dialog once a game other than Trading
 * can be picked.
 *
 * MODEL-FREE BY REQUIREMENT: `ChallengeCreateDialog.tsx` is `"use client"`, and this module
 * is imported directly (not just for its types), so it must never reach a Mongoose model -
 * the same constraint that keeps `game-categories.ts` and `play-shape.ts` free of one. It
 * imports `ChallengeableTitle` and `ChallengeGameSelection` only as TYPES (`import type`),
 * which are erased at compile time and cannot smuggle a driver import into the client bundle
 * (R58).
 *
 * WHY THIS EXISTS AS ITS OWN MODULE rather than inline ternaries in the dialog: every string
 * here has a trading-shaped default that would otherwise silently describe a provider
 * challenge as a trading one - "Minimum Trades", "Liquidation = Auto-Lose" - the exact
 * failure class the trading-shaped-service rule warns about, one dialog along. Centralising
 * the strings means adding a second provider game later touches this file once rather than
 * every place the dialog mentions trading.
 */

const TRADING_LABEL = "Trading";

export function challengeGameLabel(selection: ChallengeGameSelection): string {
  return selection.type === "trading" ? TRADING_LABEL : selection.title.displayName;
}

export function challengeSubtitle(selection: ChallengeGameSelection): string {
  return selection.type === "trading"
    ? "1v1 Trading Battle · Winner Takes All"
    : `1v1 ${selection.title.displayName} Challenge · Winner Takes All`;
}

/**
 * The yellow qualification note at the foot of the dialog.
 *
 * Trading's version names `minimumTrades` because that field genuinely gates a trading
 * challenge. A provider round has no such setting - eligibility is `hasResult`, decided at
 * settlement from whether a score was ever recorded - so restating "at least N trades" for a
 * provider game would describe a rule that does not apply to it.
 */
export function challengeQualificationCopy(
  selection: ChallengeGameSelection,
  opponentName: string,
  minimumTrades: number,
): string {
  if (selection.type === "trading") {
    return `Credits are only deducted if ${opponentName} accepts. Both players need at least ${minimumTrades} trade${
      minimumTrades > 1 ? "s" : ""
    } to qualify — otherwise they get disqualified!`;
  }
  return `Credits are only deducted if ${opponentName} accepts. Both players must post a result to qualify — a player who never finishes their round forfeits their share of the pool.`;
}

/**
 * The note explaining why a provider challenge is fair despite being played at two different
 * moments (accept, then whenever each player presses Play). Absent for Trading, which has no
 * `contentSeed` and needs no such reassurance.
 */
export function challengeContentSeedNote(selection: ChallengeGameSelection): string | null {
  if (selection.type === "trading") return null;
  return `Both players face the exact same ${selection.title.displayName} round, so the comparison is fair even though you may not play at the same time.`;
}

/** Why a title's card is disabled in the picker. Mirrors admin's `StepChooseGame.tsx`. */
export function challengeUnavailableReason(title: ChallengeableTitle): string | undefined {
  if (!title.supportsOneVsOne) return "Does not support 1v1 challenges";
  if (!title.supportsContentSeed) return "Cannot guarantee identical content for both players";
  if (!title.schemaOk) return "Settings could not be validated";
  return undefined;
}
