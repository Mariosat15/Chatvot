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
