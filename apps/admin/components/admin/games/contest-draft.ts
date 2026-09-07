/**
 * The wizard's in-progress state, and the one place that turns it into a request.
 *
 * Kept out of the component so the shape is testable and so there is a single conversion
 * to the API's vocabulary. A form that builds its own payload inline is where a renamed
 * field goes unnoticed - it type-checks, posts, and the server reads `undefined`.
 */

export interface ContestDraft {
  providerKey: string;
  gameCode: string;
  settings: Record<string, unknown>;

  name: string;
  description: string;

  /** `datetime-local` strings, which are local-time and have no zone. */
  startTime: string;
  endTime: string;
  playWindowStart: string;
  playWindowEnd: string;

  entryFee: number;
  minParticipants: number;
  maxParticipants: number;
  platformFeePercentage: number;
  prizeDistribution: { rank: number; percentage: number }[];

  attemptsPolicy: "single" | "best_of_n" | "sum_of_n";
  attemptsAllowed?: number;
  unresolvedRoundPolicy: "score_zero" | "exclude" | "hold_and_alert";
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
  playWindowStart: "",
  playWindowEnd: "",
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
    startTime: localToIso(draft.startTime),
    endTime: localToIso(draft.endTime),
    playWindowStart: localToIso(draft.playWindowStart),
    playWindowEnd: localToIso(draft.playWindowEnd),
    attemptsPolicy: draft.attemptsPolicy,
    attemptsAllowed:
      draft.attemptsPolicy === "single" ? undefined : draft.attemptsAllowed,
    unresolvedRoundPolicy: draft.unresolvedRoundPolicy,
    resultGracePeriodSeconds: draft.resultGracePeriodSeconds,
    perRoundCostAcknowledged: draft.perRoundCostAcknowledged,
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
    startTime: localToIso(draft.startTime),
    endTime: localToIso(draft.endTime),
    playWindowStart: localToIso(draft.playWindowStart),
    playWindowEnd: localToIso(draft.playWindowEnd),
    attemptsPolicy: draft.attemptsPolicy,
    attemptsAllowed:
      draft.attemptsPolicy === "single" ? undefined : draft.attemptsAllowed,
    unresolvedRoundPolicy: draft.unresolvedRoundPolicy,
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
