/**
 * "Send T&C" - a Game Master asks one of their OWN referred players, who is affiliated but
 * never accepted the Gamemaster terms, to read and answer them (`External game plans/24` s5.5,
 * reworked in s5.6).
 *
 * Four operations, all of which return a result and never throw:
 * - `sendTermsRequest`   - the Game Master's button. ONCE per referral. Notification + email + audit.
 * - `findOpenTermsTarget` - "which affiliation is still waiting for this player's answer?".
 * - `getTermsRequestPrompt` - the player's screen asks the question above.
 * - `answerTermsRequest` - accept (stamps consent on the EXISTING row) or decline.
 *
 * Reason: a referral claim cannot carry this - `decideClaimPrompt` lapses a claim for a player
 * who is already affiliated, which is exactly this player. So requests live in their own
 * collection, and the consent is written by `recordAffiliationConsent`, which only ever stamps
 * an empty row and never creates one (`affiliate()` stays the single writer of affiliations).
 *
 * Owner decision, s5.6 ("keep"): a player attached before the terms existed is asked on their
 * next visit WITHOUT anybody pressing Send - the prompt is driven by the stored state, so
 * `findOpenTermsTarget` finds their row even when no request document exists yet. Declining
 * changes NOTHING about the affiliation - D1 says a placed player moves only through an
 * audited admin move - it records the answer, stops the prompt for good and tells the GM.
 */

import { connectToDatabase } from "@/database/mongoose";
import UserReferral from "@/database/models/user-referral.model";
import GmTermsRequest from "@/database/models/gamemaster/gm-terms-request.model";
import { getPublicName, getUserById } from "@/lib/utils/user-lookup";
import { notificationService } from "@/lib/services/notification.service";
import { emailNotificationBridge } from "@/lib/services/email-notification-bridge";
import { classifyReferral } from "./referral-kind";
import { findSubscriptionForUser, toFacts } from "./affiliation.service";
import { recordAffiliationConsent } from "./affiliation-consent.service";
import {
  TERMS_REQUEST_MAX_SENDS,
  TERMS_REQUEST_REFUSAL_COPY,
  decideTermsRequestSend,
  type TermsRequestSendRefusal,
} from "./gm-terms-request-rules";
import {
  GENERIC_ERROR,
  isDuplicateKeyError,
  isObjectIdString,
  notifyAccountManager,
  writeAudit,
  type Actor,
  type RequestMeta,
} from "./gm-terms-request-shared";

export type { RequestMeta } from "./gm-terms-request-shared";

export type SendTermsRequestResult =
  | { success: true; sendCount: number }
  | { success: false; code: TermsRequestSendRefusal | "not_found" | "not_game_master" | "error"; error: string };

export type TermsRequestPrompt =
  | { show: false }
  | { show: true; requestId: string | null; gameMasterId: string; gameMasterName: string };

export type AnswerTermsRequestResult =
  | { success: true; status: "accepted" | "declined" }
  | { success: false; code: string; error: string };

/** One affiliation still waiting for the player's answer. `requestId` is null for a legacy row nobody sent. */
export interface OpenTermsTarget {
  referralId: string;
  userEmail: string;
  gameMasterId: string;
  gameMasterName: string;
  requestId: string | null;
}

const FALLBACK_GM_NAME = "your Game Master";

function refusal(reason: TermsRequestSendRefusal): SendTermsRequestResult {
  return { success: false, code: reason, error: TERMS_REQUEST_REFUSAL_COPY.get(reason) ?? GENERIC_ERROR };
}

export async function sendTermsRequest(input: {
  gameMasterUserId: string;
  referralId: unknown;
  now?: Date;
  meta?: RequestMeta;
}): Promise<SendTermsRequestResult> {
  try {
    if (!isObjectIdString(input.referralId)) {
      return { success: false, code: "not_found", error: "This referral could not be found." };
    }
    await connectToDatabase();
    const gm = toFacts(await findSubscriptionForUser(input.gameMasterUserId));
    if (!gm || gm.status !== "active" || gm.isPaused || gm.scheduledForDeletion) {
      return { success: false, code: "not_game_master", error: "Only an active Game Master can send the terms." };
    }

    // Reason: the Game Master is the SESSION user - a referral id belonging to anybody else
    // reads exactly like one that does not exist, so ids cannot be probed.
    const referral = await UserReferral.findOne({
      _id: input.referralId,
      gameMasterId: input.gameMasterUserId,
    }).lean<{
      _id: unknown;
      userId: string;
      userEmail?: string;
      isActive?: boolean;
      termsAcceptanceId?: string | null;
      source?: unknown;
      affiliatedVia?: { surface?: unknown } | null;
    }>();
    if (!referral) {
      return { success: false, code: "not_found", error: "This referral could not be found." };
    }

    const referralId = String(referral._id);
    const now = input.now ?? new Date();
    const previous = await GmTermsRequest.findOne({ referralId })
      .lean<{ sendCount?: number; status?: "pending" | "accepted" | "declined" | null }>();
    const decision = decideTermsRequestSend({
      kind: classifyReferral(referral).kind,
      isActive: referral.isActive === true,
      termsAccepted: Boolean(referral.termsAcceptanceId),
      previous: previous ? { sendCount: previous.sendCount ?? 0, status: previous.status } : null,
    });
    if (!decision.ok) return refusal(decision.reason);

    const player = await getUserById(referral.userId);
    const playerEmail = player?.email || referral.userEmail || "";
    const playerName = player?.name || playerEmail.split("@")[0] || "";
    const gameMasterName = await getPublicName(input.gameMasterUserId);

    // Reason: the decision above read a snapshot; THIS is the lock. The filter only matches a
    // request that still has a send left and was not declined, so two clicks at once send once.
    // When a document exists but fails the filter, the upsert collides on the unique
    // `referralId` index - that E11000 is the loser of the race, not a fault.
    let saved: { sendCount?: number } | null;
    try {
      saved = await GmTermsRequest.findOneAndUpdate(
        { referralId, status: { $ne: "declined" }, sendCount: { $lt: TERMS_REQUEST_MAX_SENDS } },
        {
          $set: {
            userId: referral.userId,
            userEmail: playerEmail,
            gameMasterId: input.gameMasterUserId,
            gameMasterName,
            status: "pending",
            lastSentAt: now,
            resolvedAt: null,
          },
          $inc: { sendCount: 1 },
        },
        { upsert: true, new: true },
      ).lean<{ sendCount?: number }>();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const current = await GmTermsRequest.findOne({ referralId }).lean<{ status?: string }>();
      return refusal(current?.status === "declined" ? "declined" : "limit_reached");
    }

    // Reason: the in-app row is what opens the modal on the player's open tab (the push carries
    // the templateId) and what stays in the bell if they were away. The template sends no email
    // because the dedicated email below exists - two emails for one request is noise.
    await notificationService.send({
      userId: referral.userId,
      templateId: "affiliate_terms_required",
      variables: { gameMasterName },
    });
    if (playerEmail) {
      await emailNotificationBridge
        .gmTermsRequest({ userId: referral.userId, email: playerEmail, name: playerName }, gameMasterName)
        .catch((error: unknown) => console.warn("⚠️ gm-terms-request: email failed", error));
    }

    await writeAudit({
      customer: { id: referral.userId, email: playerEmail, name: playerName },
      performer: { type: "user", id: input.gameMasterUserId, name: gameMasterName },
      action: "gm_terms_request_sent",
      description: `${gameMasterName} sent the Game Master terms to this player`,
      metadata: { referralId, gameMasterId: input.gameMasterUserId, sendCount: saved?.sendCount ?? 1 },
      meta: input.meta,
    });

    return { success: true, sendCount: saved?.sendCount ?? 1 };
  } catch (error) {
    console.error("❌ gm-terms-request: send failed", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}

/**
 * The affiliation still waiting for this player's answer, or null.
 *
 * A pending request is honoured only while the row it is about is still active and still has
 * no terms; anything else resolves it quietly. With no pending request, an OWN active row with
 * no terms under an active Game Master is the target too (the legacy "keep" decision) - unless
 * the player already answered it, which is exactly what a resolved request document records.
 */
export async function findOpenTermsTarget(userId: string): Promise<OpenTermsTarget | null> {
  const request = await GmTermsRequest.findOne({ userId, status: "pending" })
    .sort({ lastSentAt: -1 })
    .lean<{ _id: unknown; referralId: string; gameMasterId: string; gameMasterName?: string; userEmail?: string }>();
  if (request) {
    const referral = await UserReferral.findOne({ _id: request.referralId, userId })
      .lean<{ isActive?: boolean; termsAcceptanceId?: string | null; gameMasterId?: string }>();
    const stillOpen =
      referral?.isActive === true &&
      !referral.termsAcceptanceId &&
      referral.gameMasterId === request.gameMasterId;
    if (stillOpen) {
      return {
        referralId: request.referralId,
        userEmail: request.userEmail ?? "",
        gameMasterId: request.gameMasterId,
        gameMasterName: request.gameMasterName || FALLBACK_GM_NAME,
        requestId: String(request._id),
      };
    }
    await GmTermsRequest.updateOne(
      { _id: request._id, status: "pending" },
      { $set: { status: referral?.termsAcceptanceId ? "accepted" : "declined", resolvedAt: new Date() } },
    );
  }

  // Reason: `$in: [null, ""]` matches all three shapes of "no terms" - absent, null and "".
  const row = await UserReferral.findOne({
    userId,
    isActive: true,
    termsAcceptanceId: { $in: [null, ""] },
  }).lean<{
    _id: unknown;
    gameMasterId?: string;
    userEmail?: string;
    source?: unknown;
    affiliatedVia?: { surface?: unknown } | null;
  }>();
  if (!row?.gameMasterId || classifyReferral(row).kind !== "own") return null;

  const referralId = String(row._id);
  const answered = await GmTermsRequest.exists({ referralId, status: { $in: ["accepted", "declined"] } });
  if (answered) return null;

  // Reason: a paused or deleted Game Master cannot take a new consent - asking would invite an
  // Accept that `recordAffiliationConsent` then refuses.
  const gm = toFacts(await findSubscriptionForUser(row.gameMasterId));
  if (!gm || gm.status !== "active" || gm.isPaused || gm.scheduledForDeletion) return null;

  return {
    referralId,
    userEmail: row.userEmail ?? "",
    gameMasterId: row.gameMasterId,
    gameMasterName: await getPublicName(row.gameMasterId),
    requestId: null,
  };
}

export async function getTermsRequestPrompt(userId: string): Promise<TermsRequestPrompt> {
  try {
    await connectToDatabase();
    const target = await findOpenTermsTarget(userId);
    if (!target) return { show: false };
    return {
      show: true,
      requestId: target.requestId,
      gameMasterId: target.gameMasterId,
      gameMasterName: target.gameMasterName,
    };
  } catch (error) {
    console.warn("⚠️ gm-terms-request: prompt read failed", error);
    return { show: false };
  }
}

/**
 * Records the answer on the request document, creating it for a legacy row nobody sent.
 * Returns false when another request already answered it (a double-click), so the caller
 * reports success without notifying twice.
 */
async function recordAnswer(
  target: OpenTermsTarget,
  userId: string,
  status: "accepted" | "declined",
  termsAcceptanceId: string | undefined,
): Promise<boolean> {
  const now = new Date();
  const answer = { status, resolvedAt: now, ...(termsAcceptanceId ? { termsAcceptanceId } : {}) };
  // Reason: one conditional update is the transition, so a double-click answers once.
  const pending = await GmTermsRequest.updateOne({ referralId: target.referralId, status: "pending" }, { $set: answer });
  if (pending.modifiedCount === 1) return true;
  if (target.requestId) return false;
  try {
    const created = await GmTermsRequest.updateOne(
      { referralId: target.referralId },
      {
        $setOnInsert: {
          referralId: target.referralId,
          userId,
          userEmail: target.userEmail,
          gameMasterId: target.gameMasterId,
          gameMasterName: target.gameMasterName,
          sendCount: 0,
          ...answer,
        },
      },
      { upsert: true },
    );
    return created.upsertedCount === 1;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

export async function answerTermsRequest(input: {
  user: Actor;
  action: unknown;
  termsAcceptanceId?: unknown;
  meta?: RequestMeta;
}): Promise<AnswerTermsRequestResult> {
  try {
    if (input.action !== "accept" && input.action !== "decline") {
      return { success: false, code: "invalid_action", error: "Choose accept or decline." };
    }
    await connectToDatabase();
    const target = await findOpenTermsTarget(input.user.id);
    if (!target) {
      return { success: false, code: "no_request", error: "There is no Game Master terms request waiting for you." };
    }

    const status = input.action === "accept" ? "accepted" : "declined";
    let termsAcceptanceId: string | undefined;
    if (status === "accepted") {
      if (typeof input.termsAcceptanceId !== "string" || !input.termsAcceptanceId) {
        return { success: false, code: "terms_missing", error: GENERIC_ERROR };
      }
      // Reason: consent first. If the stamp is refused the request stays pending, so the
      // player can try again rather than the request vanishing with nothing recorded.
      const consent = await recordAffiliationConsent({
        userId: input.user.id,
        gameMasterId: target.gameMasterId,
        referralId: target.referralId,
        termsAcceptanceId: input.termsAcceptanceId,
      });
      if (!consent.success) return { success: false, code: consent.code, error: consent.error };
      termsAcceptanceId = input.termsAcceptanceId;
    }

    if (!(await recordAnswer(target, input.user.id, status, termsAcceptanceId))) {
      return { success: true, status };
    }

    const playerName = input.user.name || (input.user.email ?? "").split("@")[0] || "Your referral";
    await notificationService.send({
      userId: target.gameMasterId,
      templateId: "gm_terms_request_answered",
      variables: {
        // Reason: the Game Master is another player, so they see the username;
        // the account-manager alert below is admin-only and keeps the real name.
        playerName: await getPublicName(input.user.id),
        answer: status,
        outcomeLine:
          status === "accepted"
            ? "They now play under you with consent recorded."
            : "Nothing changed - they stay on your referrals without consent.",
      },
    });
    await notifyAccountManager({
      userId: input.user.id,
      playerName,
      playerEmail: input.user.email ?? "",
      gameMasterName: target.gameMasterName,
      status,
    });
    await writeAudit({
      customer: input.user,
      performer: { type: "user", ...input.user },
      action: `gm_terms_request_${status}`,
      description: `Player ${status} the Game Master terms sent by ${target.gameMasterName}`,
      metadata: {
        referralId: target.referralId,
        gameMasterId: target.gameMasterId,
        legacyPrompt: target.requestId === null,
        ...(termsAcceptanceId ? { termsAcceptanceId } : {}),
      },
      meta: input.meta,
    });
    return { success: true, status };
  } catch (error) {
    console.error("❌ gm-terms-request: answer failed", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}
