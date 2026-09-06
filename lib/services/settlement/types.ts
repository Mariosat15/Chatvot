import type { ClientSession, Types } from "mongoose";

/**
 * The vocabulary the settlement stages share, whatever game produced the result.
 *
 * X5 extracted these stages out of `finalizeCompetition`, where they had grown to about
 * 900 lines inline. The split is the one chapter 09 predicted: closing positions and
 * recomputing stats from trades are TRADING, while ranking, paying prizes, taking the
 * platform fee, paying Game Masters and completing the contest are things every game needs.
 *
 * WHY EXTRACT RATHER THAN WRITE A SECOND PATH. A provider contest could have been paid by
 * its own copy of the payout loop, and it would have worked on the day it was written.
 * Stage 0 spent weeks undoing exactly that: four competition entry writers, `referenceId`
 * written identically by two of them, `challengeId` by nine. The rule it produced is that
 * one bug duplicated is not drift and no guard catches it - so money code gets ONE writer.
 */

/**
 * A ranked player, at the point where money is about to move.
 *
 * The trading fields are OPTIONAL and the game-agnostic ones are not. That is deliberate
 * and it is the whole shape of the generalisation: a chess puzzle has no profit and loss,
 * so a required `pnl` would force every future game to invent one. Chapter 05 section 10
 * makes it a binding rule - a figure is either generalised, or explicitly scoped and
 * labelled to one game, or removed. There is no third option, and an optional field that
 * only trading sets is the "explicitly scoped" case.
 */
export interface SettlementLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  /** Set by the payout stage. Starts at 0. */
  prizeAmount: number;
  isTied?: boolean;
  qualificationStatus?: string;
  disqualificationReason?: string;
  /** Trading only. */
  pnl?: number;
  /** Trading only. */
  finalCapital?: number;
  /** Provider games and any future score-reporting game. */
  score?: number;
}

/** What `distributePrizesWithTies` produces, narrowed to what the payout stage reads. */
export interface SettlementPrizeDistribution {
  rank: number;
  userId: string;
  prizeAmount: number;
  isTied?: boolean;
}

/**
 * The contest facts the shared stages need.
 *
 * Passed in rather than taking the Mongoose document, so a stage cannot quietly start
 * reading a trading field that a provider contest does not carry. It is the same reasoning
 * that keeps the pre-flight checklist on a hand-written input interface - except that there
 * it hid a field that did not exist, so here the field list is checked against the model.
 */
export interface SettlementContest {
  _id: Types.ObjectId;
  name: string;
  entryFee: number;
  startTime?: Date;
  endTime?: Date;
  gameMasterId?: string | null;
  platformFeePercentage: number;
}

export interface SettlementStageContext {
  session: ClientSession;
  contest: SettlementContest;
}
