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
 * How late in the contest a player may still START a round.
 *
 * Owner decision, 7 September 2026, and it is a reversal of a rule rather than a new option,
 * so the reasoning matters more than usual.
 *
 * Chapter 03 section 1.2 specified `now + maxDurationSeconds <= playWindowEnd`: a round may
 * only start if the title's LONGEST possible round would still fit. That is
 * `reserve_full_round`, it is still available, and it was the only behaviour until now. Its
 * justification was fairness - "a round cut short by the window would be scored on a partial
 * game, and the player would rightly call that unfair".
 *
 * TWO THINGS BROKE THAT JUSTIFICATION.
 *
 * The first is arithmetic the rule never accounted for. The gate reserved the CATALOGUE
 * ceiling, not the length the operator configured, so Circuit Sprint reserved 300 seconds
 * whatever `durationSeconds` said. A contest shorter than 300 seconds therefore refused every
 * round from the instant it opened, telling players "there is not enough time left in this
 * competition" while a countdown beside it said minutes remained. That is what the owner
 * reported, and no amount of rewording fixes it.
 *
 * The second is that the premise is no longer true. A partial round IS scored on merit -
 * solving two boards of five beats solving one, and the whole point of the contest is best
 * performance rather than completion. A round cut short by the contest end is now the same
 * event as a round cut short by its own clock, which every title already scores. So the
 * fairness argument has moved: refusing the attempt is the unfair option, because it denies a
 * paying entrant any chance to place while telling them the contest still has time in it.
 *
 * `until_window_closes` therefore permits the start and relies on DISCLOSURE instead: the
 * pre-flight tells the player exactly how much play time they will get before the contest
 * closes it, so spending an attempt on a shortened round is their informed choice. There is
 * deliberately no minimum - inventing a floor would put back a hidden refusal of the same
 * shape, differing only in the number.
 *
 * THE FIRST OF THOSE TWO REASONS WAS FIXED RATHER THAN LIVED WITH, on 8 September 2026, and
 * that changed which policy is the sensible default. The gate now reserves the playing time
 * the operator actually chose - a title declares which of its settings is its clock, and
 * `resolveAttemptSeconds` reads it - so reserving costs a player only the time they were
 * going to be given anyway, never a ceiling nobody set. `attemptSeconds` on
 * `RoundContestConfig` carries the mechanism.
 *
 * SO THE OWNER'S ANSWER MOVED WITH IT: `reserve_full_round` is now the wizard's default too,
 * and the two defaults AGREE. The reversal is recorded here rather than by rewriting the
 * paragraphs above, because "the fairness rule was suspended while the arithmetic under it was
 * wrong, then restored once it was right" is the fact a later reader needs - not a docstring
 * that reads as though the rule had never moved. `until_window_closes` remains, and remains
 * the right choice for a contest short enough that a full session cannot fit.
 */
export type RoundStartPolicy = "reserve_full_round" | "until_window_closes";

export const ROUND_START_POLICIES: RoundStartPolicy[] = [
  "reserve_full_round",
  "until_window_closes",
];

/**
 * What each choice means for the operator, in one sentence each.
 *
 * Same reasoning as `UNSCORED_CONTEST_POLICY_COPY` below, including the `Map`: the key comes
 * from a stored document, so an object lookup walks the prototype chain and `"constructor"`
 * returns something truthy that survives a `!copy` test.
 */
export const ROUND_START_POLICY_COPY: ReadonlyMap<
  RoundStartPolicy,
  { label: string; consequence: string }
> = new Map([
  [
    "reserve_full_round",
    {
      label: "Everybody gets the full playing time",
      consequence:
        "The contest stops accepting new attempts one full playing time before it ends, so no attempt is ever cut short and every player is scored over the same length of play. The cut-off reserves the playing time you configured, not some hidden maximum. The contest has to be longer than one playing time or nobody could start at all.",
    },
  ],
  [
    "until_window_closes",
    {
      label: "Players can start at any time until the contest ends",
      consequence:
        "A player who starts near the end is closed when the contest closes and scored on whatever they achieved in the time they had - so a late starter is ranked against players who had longer. They are told how long they will get before they spend the attempt. Pick this when the contest is too short to fit a full playing time, or when late entry matters more than equal time.",
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
  /**
   * From the catalogue. The title's absolute ceiling for any round.
   *
   * STILL THE BASIS FOR `expiresAt`, deliberately, even though `attemptSeconds` below is the
   * better estimate of how long the player will actually be playing. `expiresAt` is not a
   * clock - the game owns the clock - it is the moment after which the reconciliation net may
   * assume a round is over. Setting it to the exact configured length would make it fire while
   * a player who loaded the board a few seconds after the round was created is still on their
   * last board. Generous is the correct direction for a safety net, and tight is the correct
   * direction for the fairness gate, which is why the two read different fields. Do not merge
   * them.
   */
  maxDurationSeconds?: number;
  /**
   * How long one attempt of THIS contest actually runs for.
   *
   * Resolved by `resolveAttemptSeconds` from the setting the title DECLARED as its play clock,
   * falling back to `maxDurationSeconds` for a title that declares none. It is what the
   * fairness gate reserves, so a contest configured for ten minutes reserves ten - not the
   * hour the catalogue permits.
   *
   * ABSENT MEANS FALL BACK TO THE CEILING, which is what every caller did before this field
   * existed. A caller that forgets it therefore over-reserves and refuses attempts that would
   * have fitted: wrong, but wrong loudly, which is the direction a missed call site should
   * fail in.
   */
  attemptSeconds?: number;
  /**
   * Whether a round may start that the contest end will cut short.
   *
   * Absent means `reserve_full_round`, matching the schema default, so a contest written
   * before the field existed keeps the behaviour it was created under.
   */
  roundStartPolicy?: RoundStartPolicy;
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
