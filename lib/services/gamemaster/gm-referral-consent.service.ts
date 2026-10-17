/**
 * The consent half of a Game Master's referral list (`External game plans/24` s5.6).
 *
 * "Referred" and "assigned" are two different states, and this keeps them apart:
 * - an ASSIGNED player has a `userreferrals` row and is read by `readReferredPlayers`; this
 *   service only adds whether they accepted, declined or have not answered the terms, and
 *   whether the Game Master's one reminder has been used;
 * - a REFERRED-ONLY player signed up through the link and is not attached until they accept.
 *   They are listed separately (`readAwaitingClaims`) and never counted as assigned.
 *
 * Reason it carries no email or phone: a referred-only player has accepted nothing, and an
 * assigned player's contact is decided by `toGameMasterReferralView` alone.
 */

import GmTermsRequest from "@/database/models/gamemaster/gm-terms-request.model";
import GmReferralClaim from "@/database/models/gamemaster/gm-referral-claim.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";
import { resolvePublicName } from "@/lib/utils/username";
import type { GmAwaitingClaimView, ReferralConsentState } from "./gm-referral-view";

/** Enough for a screen; a Game Master with more unanswered sign-ups sees the newest. */
export const AWAITING_CLAIMS_LIMIT = 200;

/** Per referralId: what the player answered and whether the one reminder was used. */
export async function readReferralConsentStates(
  referralIds: string[],
): Promise<Map<string, ReferralConsentState>> {
  const states = new Map<string, ReferralConsentState>();
  if (referralIds.length === 0) return states;
  const rows = await GmTermsRequest.find({ referralId: { $in: referralIds } })
    .select("referralId status sendCount")
    .lean<Array<{ referralId: string; status: string; sendCount?: number }>>();
  for (const row of rows) {
    states.set(row.referralId, {
      declined: row.status === "declined",
      termsSent: (row.sendCount ?? 0) > 0,
    });
  }
  return states;
}

/** Link sign-ups to this Game Master still waiting for, or refused by, the player. */
export async function readAwaitingClaims(gameMasterId: string): Promise<{
  rows: GmAwaitingClaimView[];
  pending: number;
  declined: number;
}> {
  const filter = { gameMasterId, status: { $in: ["pending", "accepting", "declined"] } };
  const [claims, pending, declined] = await Promise.all([
    GmReferralClaim.find(filter)
      .sort({ createdAt: -1 })
      .limit(AWAITING_CLAIMS_LIMIT)
      .select("userId status createdAt resolvedAt gmTermsReminderSent")
      .lean<
        Array<{
          _id: unknown;
          userId: string;
          status: string;
          createdAt?: Date;
          resolvedAt?: Date;
          gmTermsReminderSent?: boolean;
        }>
      >(),
    GmReferralClaim.countDocuments({ gameMasterId, status: { $in: ["pending", "accepting"] } }),
    GmReferralClaim.countDocuments({ gameMasterId, status: "declined" }),
  ]);
  const users = await getUsersByIds(claims.map((c) => c.userId));
  const rows = claims.map((claim): GmAwaitingClaimView => {
    const isDeclined = claim.status === "declined";
    const termsSent = claim.gmTermsReminderSent === true;
    return {
      claimId: String(claim._id),
      userId: claim.userId,
      // Reason: an unassigned player has accepted nothing, so the Game Master sees the
      // username every other player sees, never the real name.
      userName: users.get(claim.userId)?.publicName ?? resolvePublicName({ id: claim.userId }),
      referredAt: claim.createdAt ? new Date(claim.createdAt).toISOString() : null,
      consent: isDeclined ? "declined" : "pending",
      declinedAt: isDeclined && claim.resolvedAt ? new Date(claim.resolvedAt).toISOString() : null,
      termsSent,
      // Reason: the same once-only rule the route enforces - one reminder, never after a decline.
      canSendTerms: !isDeclined && !termsSent,
    };
  });
  return { rows, pending, declined };
}
