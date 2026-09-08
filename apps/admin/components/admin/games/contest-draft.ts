/**
 * The wizard's in-progress state, and the one place that turns it into a request.
 *
 * Kept out of the component so the shape is testable and so there is a single conversion
 * to the API's vocabulary. A form that builds its own payload inline is where a renamed
 * field goes unnoticed - it type-checks, posts, and the server reads `undefined`.
 */

import type { ConfigField } from "@/lib/services/games/config-schema";
import { resolveAttemptSeconds } from "@/lib/services/games/config-schema";
import { RESULT_GRACE_MARGIN_SECONDS } from "@/lib/services/games/contest-preflight";
import type {
  RoundStartPolicy,
  UnscoredContestPolicy,
} from "@/lib/services/games/round-types";

export interface ContestDraft {
  providerKey: string;
  gameCode: string;
  settings: Record<string, unknown>;

  name: string;
  description: string;

  /**
   * `datetime-local` strings, which are local-time and have no zone.
   *
   * THERE IS ONE CONTEST CLOCK AND NO SEPARATE PLAY WINDOW. The draft used to carry
   * `playWindowStart` and `playWindowEnd` as two more operator-set dates; see
   * `deriveWindow` below for why they are now computed from these two instead.
   */
  startTime: string;
  endTime: string;

  entryFee: number;
  minParticipants: number;
  maxParticipants: number;
  platformFeePercentage: number;
  prizeDistribution: { rank: number; percentage: number }[];

  attemptsPolicy: "single" | "best_of_n" | "sum_of_n";
  attemptsAllowed?: number;
  unresolvedRoundPolicy: "score_zero" | "exclude" | "hold_and_alert";
  unscoredContestPolicy: UnscoredContestPolicy;
  roundStartPolicy: RoundStartPolicy;
  resultGracePeriodSeconds: number;
  perRoundCostAcknowledged: boolean;

  /**
   * Publish on save rather than leaving a draft.
   *
   * NOT SENT TO THE CREATE ROUTE. The wizard calls the publish endpoint afterwards, so the
   * pre-flight runs a second time against the STORED record - which is the property that
   * makes publishing safe, and a `publish: true` flag on create would quietly discard it.
   */
  publishOnSave: boolean;
}

export const emptyDraft: ContestDraft = {
  providerKey: "",
  gameCode: "",
  settings: {},
  name: "",
  description: "",
  startTime: "",
  endTime: "",
  entryFee: 0,
  minParticipants: 2,
  maxParticipants: 100,
  platformFeePercentage: 10,
  // A sane default that already totals 100, so an operator who never opens the prize step
  // still produces a valid contest rather than a validation error they did not cause.
  prizeDistribution: [
    { rank: 1, percentage: 50 },
    { rank: 2, percentage: 30 },
    { rank: 3, percentage: 20 },
  ],
  attemptsPolicy: "single",
  unresolvedRoundPolicy: "score_zero",
  // Defaults to the refund, which is NOT the schema default. The schema keeps
  // `unclaimed_pool` so documents written before the field existed settle the way they always
  // did; a new contest an operator is creating today gets the owner's preferred answer.
  unscoredContestPolicy: "refund_entry_fees",
  // Reason: the owner's answer, 8 September 2026, and it AGREES with the schema default -
  // unlike the line above, these two are deliberately the same. Every player gets the same
  // playing time or does not start at all, which is only fair once the playing time is the
  // operator's own choice rather than a catalogue ceiling nobody set. The wizard used to
  // default to `until_window_closes`, which was the right answer while the gate reserved a
  // ceiling that could be five times the configured length; that arithmetic is fixed, so the
  // reservation now costs a player only the time they were actually going to be given.
  roundStartPolicy: "reserve_full_round",
  // A floor, not the value sent. `deriveResultGraceSeconds` raises it to cover the playing
  // time the operator chooses; this covers a ten-minute session, which is the default.
  resultGracePeriodSeconds: 900,
  perRoundCostAcknowledged: false,
  // Default on, per the owner: the common case is a contest meant to go live, and leaving it
  // in draft means an operator who does not notice has a contest nobody can see or enter.
  publishOnSave: true,
};

/**
 * How long the contest keeps accepting a late result, derived rather than asked for.
 *
 * NOBODY HAS A BASIS FOR CHOOSING THIS, which is why no screen offers it and why the draft's
 * value is a floor rather than an answer. It has to cover the longest attempt the contest can
 * produce plus a margin, or a round started at the last moment is cut off before its result
 * can arrive - and `contest-preflight.ts` refuses a contest whose grace is short. Since the
 * playing time is now an operator choice that can run to an hour, a fixed 900 seconds would
 * have refused every contest with a playing time above ten minutes, naming a field the
 * operator cannot see.
 *
 * IT ONLY EVER RAISES. A stored contest whose operator deliberately allowed longer keeps it;
 * lowering a grace period retroactively is how a result that was going to be counted stops
 * being counted.
 */
export function deriveResultGraceSeconds(
  draft: ContestDraft,
  attemptSeconds: number | undefined,
): number {
  if (attemptSeconds === undefined) return draft.resultGracePeriodSeconds;
  return Math.max(
    draft.resultGracePeriodSeconds,
    attemptSeconds + RESULT_GRACE_MARGIN_SECONDS,
  );
}

/**
 * The facts about the chosen title that the request body cannot be built without.
 *
 * Passed in rather than read from the draft because they belong to the CATALOGUE, not to the
 * operator's answers - the same reason `maxDurationSeconds` never became a draft field.
 */
export interface DraftTitleFacts {
  schemaFields?: ConfigField[];
  maxDurationSeconds?: number;
}

export function toRequestBody(
  draft: ContestDraft,
  title: DraftTitleFacts = {},
): Record<string, unknown> {
  return {
    name: draft.name,
    description: draft.description,
    providerKey: draft.providerKey,
    gameCode: draft.gameCode,
    settings: draft.settings,
    entryFee: draft.entryFee,
    minParticipants: draft.minParticipants,
    maxParticipants: draft.maxParticipants,
    platformFeePercentage: draft.platformFeePercentage,
    prizeDistribution: draft.prizeDistribution,
    // Sent as-is. The `datetime-local` value carries no zone, so `new Date()` on the server
    // would read it in the SERVER's zone, not the operator's. Appending nothing and letting
    // the browser resolve it is the fix: `toISOString` here pins the operator's own zone.
    ...deriveWindow(draft),
    attemptsPolicy: draft.attemptsPolicy,
    attemptsAllowed:
      draft.attemptsPolicy === "single" ? undefined : draft.attemptsAllowed,
    unresolvedRoundPolicy: draft.unresolvedRoundPolicy,
    unscoredContestPolicy: draft.unscoredContestPolicy,
    roundStartPolicy: draft.roundStartPolicy,
    resultGracePeriodSeconds: deriveResultGraceSeconds(
      draft,
      resolveAttemptSeconds(
        title.schemaFields ?? [],
        draft.settings,
        title.maxDurationSeconds,
      ),
    ),
    perRoundCostAcknowledged: draft.perRoundCostAcknowledged,
  };
}

/**
 * The contest clock, and the play window derived from it.
 *
 * ONE CLOCK, FOUR FIELDS ON THE WIRE. The server still stores `playWindowStart` and
 * `playWindowEnd`, and the round services still read them - `createRound` clamps a round's
 * `expiresAt` to the window end, and the launch service refuses before the window start. That
 * clamp is exactly the universal cut-off the owner asked for, so the fields earn their keep;
 * what had to go was the operator's ability to set them to something OTHER than the contest.
 *
 * Two dates that must agree is the "one rule, two copies" shape that has produced five defects
 * in this codebase already, so this is the only function that produces the pair. It is not
 * enough that the wizard stops asking: `toEditRequestBody` sends them too, and an edit that
 * moved `endTime` while leaving `playWindowEnd` behind would shorten play without touching any
 * field named "play".
 */
function deriveWindow(draft: ContestDraft): Record<string, string> {
  return {
    startTime: localToIso(draft.startTime),
    endTime: localToIso(draft.endTime),
    playWindowStart: localToIso(draft.startTime),
    playWindowEnd: localToIso(draft.endTime),
  };
}

/**
 * How the contest clock and the game's playing time relate - the one fact neither screen used
 * to state, and the reason the owner reported the sprint duration as confusing.
 *
 * THE OPERATOR MEETS TWO NUMBERS THAT BOTH LOOK LIKE "HOW LONG". The game's settings step
 * offers whatever the title's `configSchema` declares, one of which the title marks as its
 * play clock - how long ONE attempt lasts. The timing step sets the contest's own start and
 * end. Neither used to mention the other.
 *
 * IT USED TO READ A THIRD NUMBER THE OPERATOR NEVER SAW, and that was the defect rather than
 * a subtlety. The gate reserved `maxDurationSeconds` from the CATALOGUE - the title's ceiling,
 * which appears on no form - so a contest configured for two minutes had five reserved against
 * it and refused every attempt from the instant it opened. A long comment here used to defend
 * that as failing closed and warn against "fixing" it; see `contest-preflight.ts` for why that
 * argument was retired on 8 September 2026, and note it became untenable rather than merely
 * unhelpful once Sprint's clock could be set to an hour.
 *
 * `resolveAttemptSeconds` replaces it WITHOUT platform code learning a game's field name: the
 * title declares which setting is its clock, and a title that declares none still falls back
 * to the ceiling. A `switch` on game code here would break the "no developer needed for a new
 * title" claim exactly as it would in `ConfigSchemaFields`.
 *
 * ABSENT DURATION MEANS NO STATEMENT, never a guessed one. `RoundPreflight.tsx` applies no
 * gate when nothing declares a duration, so a screen that invented a deadline here would
 * contradict the server for the one class of title where nobody knows the answer.
 */
export function describeRoundFit(input: {
  startTime: string;
  endTime: string;
  /** The title's parsed `configSchema`. Empty is fine; it just means nothing is declared. */
  schemaFields?: ConfigField[];
  /** The operator's answers, which is where the declared clock's value lives. */
  settings?: Record<string, unknown>;
  /** The catalogue ceiling, used only when the title declares no play clock. */
  maxDurationSeconds?: number;
  /**
   * Absent means `reserve_full_round`, matching the schema, so a stored contest with no
   * policy is described by the rule it was created under.
   */
  roundStartPolicy?: RoundStartPolicy;
}):
  | {
      /** How long one attempt runs for, and therefore how much time is reserved. */
      reservedSeconds: number;
      /**
       * Present only while the contest reserves a full round. Under `until_window_closes`
       * there is no cut-off to name, and returning the arithmetic anyway is how a screen
       * ends up printing a deadline that does not exist.
       */
      lastAttemptStart?: Date;
      reservesFullRound: boolean;
      /**
       * True when no attempt could run to its natural length.
       *
       * A REFUSAL OR A WARNING DEPENDING ON THE POLICY, which is why the flag says what is
       * true rather than what the screen should do about it: reserving, nobody can start a
       * round at all and `contest-preflight.ts` refuses; until-close, every round is simply
       * shortened and the contest is legitimate.
       */
      windowTooShort: boolean;
      /** The contest's own length, so a caller can state both sides of the comparison. */
      windowSeconds: number;
    }
  | undefined {
  const attemptSeconds = resolveAttemptSeconds(
    input.schemaFields ?? [],
    input.settings,
    input.maxDurationSeconds,
  );
  if (attemptSeconds === undefined) return undefined;

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }

  const windowSeconds = (end.getTime() - start.getTime()) / 1000;
  const reservesFullRound = input.roundStartPolicy !== "until_window_closes";

  return {
    reservedSeconds: attemptSeconds,
    lastAttemptStart: reservesFullRound
      ? new Date(end.getTime() - attemptSeconds * 1000)
      : undefined,
    reservesFullRound,
    windowTooShort: windowSeconds < attemptSeconds,
    windowSeconds,
  };
}

/**
 * A duration an operator can read without doing arithmetic.
 *
 * The admin copy of the same helper in `contest-preflight.ts`, and deliberately a copy rather
 * than an import: that module is mirrored into both apps and this one is a browser component's
 * dependency. What matters is that the two agree in FORM, not that they share a function -
 * and neither decides anything, so a divergence is cosmetic rather than a rule with two
 * answers. Seconds are kept for anything that is not a whole number of minutes, because
 * rounding "90 seconds" to "1 minute" in a sentence about whether something FITS would be
 * wrong in the one direction that matters.
 */
export function describeDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} seconds`;
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return `${Math.round(seconds)} seconds`;
}

/**
 * The edit payload, which is deliberately NOT `toRequestBody` minus a few keys.
 *
 * Once anyone has entered the contest, only the fields on `EDITABLE_ONCE_ENTERED` may be
 * sent at all - the server refuses the whole request if a frozen field arrives, naming it.
 * So this omits them rather than sending them unchanged: submitting `entryFee` with its
 * existing value looks harmless and would be refused, and the operator would be told they
 * had tried to change a fee they had not touched.
 *
 * `providerKey`, `gameCode` and the content seed are absent at every state, because game
 * identity is never editable. That is not an omission to fix later - editing it is creating
 * a different contest, which is what the wizard is for.
 */
export function toEditRequestBody(
  draft: ContestDraft,
  options: { entered: boolean } & DraftTitleFacts,
): Record<string, unknown> {
  const always: Record<string, unknown> = {
    name: draft.name,
    description: draft.description,
    maxParticipants: draft.maxParticipants,
  };

  if (options.entered) return always;

  return {
    ...always,
    settings: draft.settings,
    entryFee: draft.entryFee,
    minParticipants: draft.minParticipants,
    platformFeePercentage: draft.platformFeePercentage,
    prizeDistribution: draft.prizeDistribution,
    ...deriveWindow(draft),
    attemptsPolicy: draft.attemptsPolicy,
    attemptsAllowed:
      draft.attemptsPolicy === "single" ? undefined : draft.attemptsAllowed,
    unresolvedRoundPolicy: draft.unresolvedRoundPolicy,
    unscoredContestPolicy: draft.unscoredContestPolicy,
    roundStartPolicy: draft.roundStartPolicy,
    resultGracePeriodSeconds: deriveResultGraceSeconds(
      draft,
      resolveAttemptSeconds(
        options.schemaFields ?? [],
        draft.settings,
        options.maxDurationSeconds,
      ),
    ),
    perRoundCostAcknowledged: draft.perRoundCostAcknowledged,
  };
}

/**
 * Converts a `datetime-local` value to an absolute instant in the operator's zone.
 *
 * Returns the input unchanged when empty or unparseable, so the server produces the "this
 * date is required / not valid" message rather than this function inventing one.
 */
function localToIso(value: string): string {
  if (!value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/**
 * The inverse, for populating the edit form from stored dates.
 *
 * Builds the string from LOCAL getters rather than slicing `toISOString()`, which is the
 * obvious version and is wrong by the operator's UTC offset: a contest starting at 09:00
 * local would render as 07:00 in a UTC+2 browser, and an operator who saved without
 * touching the field would silently move the start time two hours earlier.
 */
export function isoToLocal(value: string | Date | undefined | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
