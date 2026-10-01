/**
 * Rules for a Game Master sending the Game Master terms to their own referral.
 *
 * Model-free on purpose: the send route, the player prompt and the tests all ask the
 * same questions, and a second copy of "may this be sent again" is the "one rule, two
 * copies" shape behind several defects in this programme (`External game plans/24`).
 */

export const TERMS_REQUEST_STATUSES = ["pending", "accepted", "declined"] as const;
export type TermsRequestStatus = (typeof TERMS_REQUEST_STATUSES)[number];

/**
 * Reason: each send is a notification and an email to a player who has not yet agreed
 * to anything with this Game Master. Without a cooldown a button press is a way to
 * spam somebody; without a cap it is a way to do it for ever.
 */
export const TERMS_REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const TERMS_REQUEST_MAX_SENDS = 3;

export type TermsRequestSendRefusal =
  | "not_own_referral"
  | "referral_ended"
  | "already_accepted"
  | "cooldown"
  | "limit_reached";

export interface TermsRequestSendFacts {
  /** `classifyReferral(row).kind` - only the Game Master's own link may be asked. */
  kind: "own" | "external" | "unclassified";
  isActive: boolean;
  /** Whether the referral row already carries a terms acceptance. */
  termsAccepted: boolean;
  /** The existing request, when one was sent before. */
  previous?: { sendCount: number; lastSentAt: Date | null } | null;
  now: Date;
}

export type TermsRequestSendDecision =
  | { ok: true }
  | { ok: false; reason: TermsRequestSendRefusal; retryAt?: Date };

export function decideTermsRequestSend(facts: TermsRequestSendFacts): TermsRequestSendDecision {
  // Reason: an external referral came through somebody else's channel, so the Game
  // Master did not recruit them and has no standing to ask them for consent.
  if (facts.kind !== "own") return { ok: false, reason: "not_own_referral" };
  if (!facts.isActive) return { ok: false, reason: "referral_ended" };
  // Reason: checked against the referral row, never against the request's status - the
  // row is what affiliation reads, and a player could have accepted another way.
  if (facts.termsAccepted) return { ok: false, reason: "already_accepted" };

  const previous = facts.previous;
  if (previous) {
    if (previous.sendCount >= TERMS_REQUEST_MAX_SENDS) {
      return { ok: false, reason: "limit_reached" };
    }
    if (previous.lastSentAt) {
      const retryAt = new Date(previous.lastSentAt.getTime() + TERMS_REQUEST_COOLDOWN_MS);
      if (facts.now < retryAt) return { ok: false, reason: "cooldown", retryAt };
    }
  }
  return { ok: true };
}

export const TERMS_REQUEST_REFUSAL_COPY: ReadonlyMap<TermsRequestSendRefusal, string> = new Map([
  ["not_own_referral", "Terms can only be sent to players who joined through your own link."],
  ["referral_ended", "This player is no longer your referral."],
  ["already_accepted", "This player has already accepted the terms."],
  ["cooldown", "You already sent the terms recently. You can send them again in 24 hours."],
  [
    "limit_reached",
    `You have sent the terms ${TERMS_REQUEST_MAX_SENDS} times. Please contact support if the player still needs them.`,
  ],
]);
