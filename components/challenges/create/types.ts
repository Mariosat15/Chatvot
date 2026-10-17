/**
 * The create dialog's own shapes, in a model-free module both the dialog and its parts import.
 *
 * Reason: the parts are `"use client"` and the dialog owns the state, so the two need one
 * definition of what a draft challenge looks like. A second copy is the "one rule, two copies"
 * shape - here it would drift as a field added on one side and read on the other, which the
 * compiler catches only while both spellings are identical.
 */

export interface ChallengeSettings {
  minEntryFee: number;
  maxEntryFee: number;
  defaultStartingCapital: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  defaultDurationMinutes: number;
  platformFeePercentage: number;
}

export interface ChallengeFormData {
  entryFee: number;
  duration: number;
  startingCapital: number;
  rankingMethod: string;
  tieBreaker1: string;
  tieBreaker2: string;
  minimumTrades: number;
  disqualifyOnLiquidation: boolean;
}
