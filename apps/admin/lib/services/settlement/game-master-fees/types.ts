/**
 * Types for the Game Master referral fee stage.
 *
 * The rule that shapes all of this, and which is easy to get backwards: a Game Master
 * earns from the entry fees of players THEY REFERRED, in any contest those players enter -
 * not from contests the Game Master created. So this stage cares who introduced each
 * participant and nothing at all about who set the contest up.
 *
 * It follows that the stage is game-agnostic and always was. An entry fee is an entry fee
 * whether the player then trades, solves a puzzle or plays a provider title, which is why
 * X5 could extract it unchanged rather than generalise it.
 */

import type mongoose from "mongoose";

/**
 * The raw driver handle.
 *
 * Reason it comes via `mongoose.mongo` rather than an import from "mongodb": the driver is
 * a transitive dependency here, and `apps/admin` carries its own `node_modules/mongoose`.
 * Reaching through the mongoose namespace guarantees the same driver types the models were
 * built against, whichever copy npm hoisted.
 */
export type SettlementDb = mongoose.mongo.Db;

export type GmSubscriptionDoc = { _id: unknown; [key: string]: unknown };

export interface ReferredUser {
  userId: string;
  userName: string;
  userEmail: string;
}

export interface GameMasterPayment {
  gmId: string;
  gmSubscription: GmSubscriptionDoc;
  users: ReferredUser[];
  feePercentage: number;
  totalEarning: number;
}

export interface RetainedGmFee {
  gmId: string;
  gmEmail?: string;
  users: ReferredUser[];
  wouldHaveEarned: number;
  feePercentage: number;
  subscriptionStatus: string;
}

export interface GameMasterFeeCalculation {
  payments: GameMasterPayment[];
  /** Before the platform-fee cap is applied. */
  totalGmEarnings: number;
  retained: RetainedGmFee[];
}

/** The participants this stage needs - id only, because that is all a referral joins on. */
export interface SettlementParticipantRef {
  userId: string;
}
