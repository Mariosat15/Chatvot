/**
 * Operator-facing wording for the live-contest controls (X6, chapter 12 section 3).
 *
 * WHY THIS IS A MODULE AND NOT SEVEN TERNARIES IN THE COMPONENT
 * ------------------------------------------------------------
 * `CompetitionAdminActions.tsx` is a `"use client"` component, so it cannot import a service
 * that reaches a Mongoose model - and the label it needs is derived from the stored contest.
 * The same constraint that produced `components/games/play-state.ts` and the round-resolution
 * action list. Both of those were first written as a second copy of a rule; this one is the
 * shared module from the start, and the drift it prevents is not cosmetic: a dialog that
 * promises to close positions on a puzzle contest is telling an operator a falsehood about a
 * money-adjacent action they are about to confirm.
 *
 * WHY THE CONSEQUENCE LISTS ARE NOT JUST RE-WORDED
 * -----------------------------------------------
 * They genuinely differ. Pausing a trading contest stops orders and closes nothing; pausing a
 * provider contest stops rounds being started or resumed. Emergency-cancelling a trading
 * contest closes every open position at market and records the P&L; a provider contest has no
 * position to close and instead has its live rounds voided. A wording pass that only swapped
 * the noun would have left the operator with a list of consequences that do not happen.
 *
 * THE PANEL SAID SEVEN TRADING-SHAPED THINGS BEFORE THIS. The worst was the emergency-cancel
 * dialog: "All positions will be closed at current prices", above a confirm button, on a
 * contest with no positions. The second worst was quieter - pausing reported "Trading is now
 * frozen" while the pause was, until this slice, not enforced on a provider round at all, so
 * the message was doubly wrong and nothing anywhere disagreed with it.
 */

export interface ContestControlCopy {
  /** What the players are doing. "Play" for a game, "Trading" for a trading contest. */
  activityNoun: string;
  /** Toast shown once a pause lands. */
  pausedToast: string;
  /** Sub-line under the PAUSED banner when the operator left no reason. */
  pausedBannerFallback: string;
  /** One-line description at the top of the pause dialog. */
  pauseDialogDescription: string;
  /** What pausing actually does, in order. */
  pauseConsequences: string[];
  /** One-line description at the top of the emergency-cancel dialog. */
  emergencyDialogDescription: string;
  /** What emergency-cancelling actually does, in order. */
  emergencyConsequences: string[];
}

const TRADING: ContestControlCopy = {
  activityNoun: "Trading",
  pausedToast: "Competition paused. Trading is now frozen.",
  pausedBannerFallback: "Trading is frozen",
  pauseDialogDescription:
    "Temporarily freeze all trading activity in this competition.",
  pauseConsequences: [
    "Prevent any new orders from being placed",
    "Prevent any positions from being closed",
    "Notify all participants",
    "Extend the end time when resumed",
  ],
  emergencyDialogDescription:
    "This is for critical situations only. All positions will be closed at current prices.",
  emergencyConsequences: [
    "Immediately close ALL open positions at current market prices",
    "Calculate and record all P&L",
    "Refund all participants their FULL entry fees",
    "Mark the competition as emergency cancelled",
    "This action CANNOT be undone",
  ],
};

const PROVIDER: ContestControlCopy = {
  activityNoun: "Play",
  pausedToast: "Competition paused. No new rounds can be started.",
  pausedBannerFallback: "Play is paused",
  pauseDialogDescription:
    "Temporarily stop players starting or continuing rounds in this competition.",
  pauseConsequences: [
    "Prevent any new round from being started",
    // Reason this is called out separately: a player mid-round is the case an operator will
    // ask about, and the honest answer is that they cannot reopen the round once they leave
    // it - the pre-flight refuses a resume while the contest is paused, deliberately, because
    // letting them continue defeats the control while appearing to honour it.
    "Prevent a player resuming a round they already have open",
    "Notify all participants",
    "Extend the play window and the end time when resumed",
  ],
  emergencyDialogDescription:
    "This is for critical situations only. Every round still in flight will be voided.",
  emergencyConsequences: [
    "Immediately void ALL rounds still in flight - no score from them will count",
    "Refund all participants their FULL entry fees",
    "Mark the competition as emergency cancelled",
    "This action CANNOT be undone",
  ],
};

/**
 * Pick the wording for a contest.
 *
 * Takes a boolean the SERVER derived from the stored game label, never a game type read from
 * the request: what an operator is told about a money-adjacent action must not be changeable
 * by the caller, the same rule that stops the market-hours gate taking its deciding value
 * from caller input.
 */
export function contestControlCopy(isProviderGame: boolean): ContestControlCopy {
  return isProviderGame ? PROVIDER : TRADING;
}
