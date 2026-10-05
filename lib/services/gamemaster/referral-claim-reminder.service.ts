/**
 * The Game Master's "Send terms" button for a referral that is still only a CLAIM - a player
 * who signed up through the link and has not answered the terms yet (`External game plans/24`
 * s5.6). Same rules and same notification as `sendTermsRequest`, which handles players who are
 * already affiliated; this one handles the pending half of the list.
 *
 * Reason it is a separate writer: a claim is not an affiliation, so there is no `userreferrals`
 * row to key a `gm_terms_requests` document on. The once-only flag lives on the claim itself.
 * Sending changes nothing about the claim - it only reminds the player; the modal they already
 * see on every visit is still the one place they answer.
 */

import { connectToDatabase } from "@/database/mongoose";
import GmReferralClaim from "@/database/models/gamemaster/gm-referral-claim.model";
import { getPublicName, getUserById } from "@/lib/utils/user-lookup";
import { notificationService } from "@/lib/services/notification.service";
import { emailNotificationBridge } from "@/lib/services/email-notification-bridge";
import { findSubscriptionForUser, toFacts } from "./affiliation.service";
import {
  TERMS_REQUEST_REFUSAL_COPY,
  decideTermsRequestSend,
  type TermsRequestSendRefusal,
} from "./gm-terms-request-rules";
import { GENERIC_ERROR, isObjectIdString, writeAudit, type RequestMeta } from "./gm-terms-request-shared";

/** Claim statuses that can still be answered - `accepting` is an Accept in flight. */
export const OPEN_CLAIM_STATUSES: readonly string[] = ["pending", "accepting"];

export type SendClaimReminderResult =
  | { success: true; sendCount: 1 }
  | { success: false; code: TermsRequestSendRefusal | "not_found" | "not_game_master" | "error"; error: string };

function refusal(reason: TermsRequestSendRefusal): SendClaimReminderResult {
  return { success: false, code: reason, error: TERMS_REQUEST_REFUSAL_COPY.get(reason) ?? GENERIC_ERROR };
}

export async function sendReferralClaimReminder(input: {
  gameMasterUserId: string;
  claimId: unknown;
  now?: Date;
  meta?: RequestMeta;
}): Promise<SendClaimReminderResult> {
  try {
    if (!isObjectIdString(input.claimId)) {
      return { success: false, code: "not_found", error: "This referral could not be found." };
    }
    await connectToDatabase();
    const gm = toFacts(await findSubscriptionForUser(input.gameMasterUserId));
    if (!gm || gm.status !== "active" || gm.isPaused || gm.scheduledForDeletion) {
      return { success: false, code: "not_game_master", error: "Only an active Game Master can send the terms." };
    }

    // Reason: scoped to the SESSION Game Master, so another Game Master's claim id reads as
    // not found rather than being sendable.
    const claim = await GmReferralClaim.findOne({ _id: input.claimId, gameMasterId: input.gameMasterUserId })
      .lean<{ _id: unknown; userId: string; userEmail?: string; status: string; gmTermsReminderSent?: boolean }>();
    if (!claim) return { success: false, code: "not_found", error: "This referral could not be found." };

    // Reason: the same decision the affiliated-row button uses, so both halves of the list
    // refuse with the same words. A lapsed or refused claim is a referral that has ended.
    const decision = decideTermsRequestSend({
      kind: "own",
      isActive: claim.status !== "lapsed" && claim.status !== "refused",
      termsAccepted: claim.status === "accepted",
      previous: {
        sendCount: claim.gmTermsReminderSent === true ? 1 : 0,
        status: claim.status === "declined" ? "declined" : undefined,
      },
    });
    if (!decision.ok) return refusal(decision.reason);

    const now = input.now ?? new Date();
    // Reason: THIS is the lock - one conditional update, so two clicks at once send once.
    const claimed = await GmReferralClaim.updateOne(
      {
        _id: claim._id,
        gameMasterId: input.gameMasterUserId,
        status: { $in: OPEN_CLAIM_STATUSES },
        gmTermsReminderSent: { $ne: true },
      },
      { $set: { gmTermsReminderSent: true, gmTermsReminderSentAt: now } },
    );
    if (claimed.modifiedCount !== 1) {
      const current = await GmReferralClaim.findOne({ _id: claim._id }).lean<{ status?: string }>();
      if (current?.status === "declined") return refusal("declined");
      if (current?.status === "accepted") return refusal("already_accepted");
      return refusal("limit_reached");
    }

    const player = await getUserById(claim.userId);
    const playerEmail = player?.email || claim.userEmail || "";
    const playerName = player?.name || playerEmail.split("@")[0] || "";
    const gameMasterName = await getPublicName(input.gameMasterUserId);

    await notificationService.send({
      userId: claim.userId,
      templateId: "affiliate_terms_required",
      variables: { gameMasterName },
    });
    if (playerEmail) {
      await emailNotificationBridge
        .gmTermsRequest({ userId: claim.userId, email: playerEmail, name: playerName }, gameMasterName)
        .catch((error: unknown) => console.warn("⚠️ referral-claim-reminder: email failed", error));
    }
    await writeAudit({
      customer: { id: claim.userId, email: playerEmail, name: playerName },
      performer: { type: "user", id: input.gameMasterUserId, name: gameMasterName },
      action: "gm_terms_request_sent",
      description: `${gameMasterName} sent the Game Master terms to this pending referral`,
      metadata: { claimId: String(claim._id), gameMasterId: input.gameMasterUserId, sendCount: 1 },
      meta: input.meta,
    });
    return { success: true, sendCount: 1 };
  } catch (error) {
    console.error("❌ referral-claim-reminder: send failed", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}
