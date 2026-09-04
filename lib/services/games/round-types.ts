import type { Types } from "mongoose";

/**
 * Types shared by the round and ingestion services (X3).
 *
 * Kept separate so neither service has to import the other, and so the 500-line limit is a
 * consequence of design rather than a thing to work around.
 */

/** Chapter 04 section 2.1. `unlimited_in_window` from chapter 03 is deliberately absent. */
export type AttemptsPolicy = "single" | "best_of_n" | "sum_of_n";

/** Chapter 04 section 2.1 / chapter 07 section 2.3. */
export type UnresolvedRoundPolicy = "score_zero" | "exclude" | "hold_and_alert";

export const ATTEMPTS_POLICIES: AttemptsPolicy[] = [
  "single",
  "best_of_n",
  "sum_of_n",
];

export const UNRESOLVED_ROUND_POLICIES: UnresolvedRoundPolicy[] = [
  "score_zero",
  "exclude",
  "hold_and_alert",
];

/**
 * The round rules a contest imposes, passed IN rather than read from the contest.
 *
 * Reason: X3 builds the round lifecycle; X5 integrates it with contests. Reading
 * `Competition` here would mean adding six fields to two mirrored contest models in this
 * phase, for a code path nothing calls yet - the same "a number nothing maintains and
 * nothing reads" trap that made X1 defer the participant score backfill. The caller owns
 * where these come from, so X5 can wire them to real contest fields without changing this
 * service at all.
 */
export interface RoundContestConfig {
  attemptsPolicy: AttemptsPolicy;
  /** Used by best_of_n and sum_of_n. Ignored by single, which is always 1. */
  attemptsAllowed?: number;
  /** No round may be startable that could outlive this. */
  playWindowEnd: Date;
  /** Shared by every round in the contest, so all players face identical content. */
  contentSeed?: string;
  /** From the catalogue. Used to check the round can finish inside the play window. */
  maxDurationSeconds?: number;
  /** Settings for the provider, already validated against the title's configSchema. */
  settings?: Record<string, unknown>;
}

export interface CreateRoundInput {
  providerKey: string;
  gameCode: string;
  gameKey: string;
  userId: string;
  contestType: "competition" | "challenge" | "practice";
  contestId?: Types.ObjectId | null;
  participantId?: Types.ObjectId | null;
  config: RoundContestConfig;
  /** Where the player returns after playing. */
  returnUrl: string;
  /** Where the provider posts the result. */
  resultCallbackUrl: string;
  /** Non-identifying display name. A provider never receives an email or a wallet. */
  displayName?: string;
  locale?: string;
  country?: string;
}

/** Why a round could not be created. Distinguished so the player sees a usable reason. */
export type CreateRoundRefusal =
  | "provider_unavailable"
  | "attempts_exhausted"
  | "round_already_live"
  | "play_window_too_short"
  | "play_window_closed"
  | "provider_error";

export type CreateRoundOutcome =
  | {
      success: true;
      roundId: string;
      launchUrl: string;
      attemptNumber: number;
      /** True when an existing round was returned instead of a new one being created. */
      idempotent: boolean;
    }
  | { success: false; refusal: CreateRoundRefusal; error: string };
