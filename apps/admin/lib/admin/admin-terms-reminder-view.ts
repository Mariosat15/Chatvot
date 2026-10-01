/**
 * Model-free shapes and wording for the admin Referrals tab's consent and reminder columns.
 *
 * Reason: the tab is `"use client"`, so it must not import the service that reaches the driver
 * (R58). The service and the tab both import these, so the server's answer and the screen's
 * labels cannot drift apart.
 */

export type AdminConsent = "accepted" | "pending" | "declined";

export interface AdminTermsReminderState {
  consent: AdminConsent;
  /** Whether the Game Master used their one "Send terms". */
  gmReminderSent: boolean;
  gmReminderSentAt: string | null;
  adminReminderCount: number;
  lastAdminReminderAt: string | null;
}

/** A link sign-up still waiting for an answer - referred, NOT assigned. */
export interface AdminAwaitingClaimRow extends AdminTermsReminderState {
  claimId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  referredAt: string | null;
  declinedAt: string | null;
}

export const ADMIN_CONSENT_LABELS: ReadonlyMap<AdminConsent, string> = new Map([
  ["accepted", "Accepted"],
  ["pending", "Pending Terms"],
  ["declined", "Declined"],
]);

/**
 * Whether the admin may remind this player. Unlimited, but never after an answer: an accepted
 * player has nothing to answer and a decline is final.
 */
export function canAdminSendTerms(state: Pick<AdminTermsReminderState, "consent"> | null | undefined): boolean {
  return state?.consent === "pending";
}
