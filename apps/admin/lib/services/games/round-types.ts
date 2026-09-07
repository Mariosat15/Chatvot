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
 * Where the pot goes when a contest finishes and NOBODY recorded a score.
 *
 * Owner decision, 7 September 2026, answering open question 17. Distinct from
 * `UnresolvedRoundPolicy` above, which is about ONE round that never reported - this is about
 * the whole contest producing no result at all. A contest can hit this with every round
 * resolved perfectly, if every player simply scored nothing.
 *
 * It is NOT the answer for a disqualification. A player who broke a rule has a result, so
 * their fee stays with the contest and reaches the unclaimed pool exactly as in a trading
 * contest. See `lib/services/settlement/unscored-refund.ts`.
 */
export type UnscoredContestPolicy = "unclaimed_pool" | "refund_entry_fees";

export const UNSCORED_CONTEST_POLICIES: UnscoredContestPolicy[] = [
  "unclaimed_pool",
  "refund_entry_fees",
];

/**
 * What each choice means for the operator, in one sentence each.
 *
 * Lives beside the type rather than in the component for the reason the round-resolution
 * action list does: the wizard, the editor and the validator all need the same words, and a
 * screen offering a consequence the server does not deliver is worse than no explanation.
 * This module imports no models, so a `"use client"` component can read it.
 *
 * A `Map`, NOT an object, and for the same reason as the round-inspector action list and
 * `competition-update-fields.ts`: the key arrives from a stored document, so an object lookup
 * walks the prototype chain and `"__proto__"` or `"constructor"` returns something TRUTHY that
 * survives a `!copy` test and only reads as blank several lines later. A `Map` makes the lookup
 * total, so a value the type system does not really guarantee resolves to `undefined` and the
 * caller's `?.` does what it looks like it does.
 */
export const UNSCORED_CONTEST_POLICY_COPY: ReadonlyMap<
  UnscoredContestPolicy,
  { label: string; consequence: string }
> = new Map([
  [
    "refund_entry_fees",
    {
      label: "Refund entry fees, less the platform fee",
      consequence:
        "Every player gets their entry fee back minus the platform fee. The platform still keeps its fee because the contest was hosted and the rounds were launched. Players are told why the refund is smaller than what they paid.",
    },
  ],
  [
    "unclaimed_pool",
    {
      label: "Send the pot to the unclaimed pool",
      consequence:
        "Nobody is refunded and the whole pot, less the platform fee, is recorded as unclaimed platform funds. This is what a trading contest does when no player qualifies.",
    },
  ],
]);

/**
 * How long after the play window a late provider result is still welcome (chapter 04
 * section 2.1), when a contest does not name its own.
 *
 * IT LIVES HERE, NOT IN `reconciliation.service.ts`, and the reason is not tidiness.
 * Settlement waits out this window before it will rank anybody - and settlement runs in
 * **both** apps, while the reconciliation service exists only in the main one. Importing it
 * from there compiles in the main app and fails the admin typecheck.
 *
 * The stronger reason is what a second copy would do. Two defaults for the same window is
 * the "one rule, two copies" shape behind five defects here, and this one is silent in a
 * particularly bad way: the app with the shorter default settles first, so **whether a
 * last-minute finisher is paid would depend on which cron claimed the contest.** That is
 * exactly R26's failure mode. There is one definition and both apps import it.
 */
export const DEFAULT_RESULT_GRACE_SECONDS = 600;

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
