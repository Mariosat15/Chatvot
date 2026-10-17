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
 * Reason: each send is a notification and an email to a player who has not yet agreed to
 * anything with this Game Master. Owner, 1 Oct 2026: a Game Master may send ONCE per
 * referral - the popup already shows on every visit while the answer is pending, so a second
 * send adds nothing but noise. Further reminders are an admin decision (unlimited, audited).
 *
 * The 24-hour cooldown that used to sit beside a cap of 3 was removed with it: under a cap of
 * one it can never fire, and a rule that cannot fire is an invitation to "fix" the cap back.
 */
export const TERMS_REQUEST_MAX_SENDS = 1;

export type TermsRequestSendRefusal =
  | "not_own_referral"
  | "referral_ended"
  | "already_accepted"
  | "declined"
  | "limit_reached";

export interface TermsRequestSendFacts {
  /** `classifyReferral(row).kind` - only the Game Master's own link may be asked. */
  kind: "own" | "external" | "unclassified";
  isActive: boolean;
  /** Whether the referral row already carries a terms acceptance. */
  termsAccepted: boolean;
  /** The existing request, when one was sent (or answered) before. */
  previous?: { sendCount: number; status?: TermsRequestStatus | null } | null;
}

export type TermsRequestSendDecision =
  | { ok: true }
  | { ok: false; reason: TermsRequestSendRefusal };

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
    // Reason: a decline is final - the player is never asked again, by anybody's button.
    if (previous.status === "declined") return { ok: false, reason: "declined" };
    if (previous.sendCount >= TERMS_REQUEST_MAX_SENDS) return { ok: false, reason: "limit_reached" };
  }
  return { ok: true };
}

export const TERMS_REQUEST_REFUSAL_COPY: ReadonlyMap<TermsRequestSendRefusal, string> = new Map([
  ["not_own_referral", "Terms can only be sent to players who joined through your own link."],
  ["referral_ended", "This player is no longer your referral."],
  ["already_accepted", "This player has already accepted the terms."],
  ["declined", "This player declined the terms, so they will not be asked again."],
  [
    "limit_reached",
    "You already sent the terms to this player. They will see them every time they open the app.",
  ],
]);
