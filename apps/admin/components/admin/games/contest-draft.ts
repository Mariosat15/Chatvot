/**
 * The wizard's in-progress state, and the one place that turns it into a request.
 *
 * Kept out of the component so the shape is testable and so there is a single conversion
 * to the API's vocabulary. A form that builds its own payload inline is where a renamed
 * field goes unnoticed - it type-checks, posts, and the server reads `undefined`.
 */

import type { UnscoredContestPolicy } from "@/lib/services/games/round-types";

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
  resultGracePeriodSeconds: number;
  perRoundCostAcknowledged: boolean;
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
  resultGracePeriodSeconds: 900,
  perRoundCostAcknowledged: false,
};

export function toRequestBody(draft: ContestDraft): Record<string, unknown> {
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
    resultGracePeriodSeconds: draft.resultGracePeriodSeconds,
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
 * How the contest clock and the game's own round length relate - the one fact neither screen
 * used to state, and the reason the owner reported the sprint duration as confusing.
 *
 * THE OPERATOR MEETS TWO NUMBERS THAT BOTH LOOK LIKE "HOW LONG" AND A THIRD THEY NEVER SEE.
 * The game's settings step offers whatever the title's `configSchema` declares - for Circuit
 * Sprint that is `durationSeconds`, 60 to 300 - which is how long ONE attempt lasts and is
 * passed straight to the game. The timing step sets the contest's own start and end. Neither
 * mentions the other, and the gate that actually decides when an attempt may start reads
 * `maxDurationSeconds` from the CATALOGUE, which appears on no form.
 *
 * That third number is not a bug and must not be "fixed" into the configured one. Chapter 03
 * section 1.2 specifies `now + maxDurationSeconds <= playWindowEnd`, deliberately the title's
 * ceiling rather than this contest's setting, so the platform can never admit an attempt that
 * the contest end would cut short - it fails closed, refusing slightly more than strictly
 * necessary. `round.service.ts` implements it and `contest-preflight.ts` checks it.
 *
 * So the fix is disclosure, not arithmetic: turn the ceiling into a wall-clock moment the
 * operator can read off, which is the single sentence that makes the two clocks relate.
 *
 * ABSENT DURATION MEANS NO STATEMENT, never a guessed one. `RoundPreflight.tsx` applies no
 * gate when the catalogue does not declare a duration, so a screen that invented a deadline
 * here would contradict the server for the one class of title where nobody knows the answer.
 */
export function describeRoundFit(input: {
  startTime: string;
  endTime: string;
  maxDurationSeconds?: number;
}):
  | {
      reservedSeconds: number;
      lastAttemptStart: Date;
      /** True when no attempt could ever finish, which the server refuses outright. */
      windowTooShort: boolean;
    }
  | undefined {
  const { maxDurationSeconds } = input;
  if (typeof maxDurationSeconds !== "number" || !(maxDurationSeconds > 0)) {
    return undefined;
  }

  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }

  const windowSeconds = (end.getTime() - start.getTime()) / 1000;

  return {
    reservedSeconds: maxDurationSeconds,
    lastAttemptStart: new Date(end.getTime() - maxDurationSeconds * 1000),
    windowTooShort: windowSeconds < maxDurationSeconds,
  };
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
  options: { entered: boolean },
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
    resultGracePeriodSeconds: draft.resultGracePeriodSeconds,
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
