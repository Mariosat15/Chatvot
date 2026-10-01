/**
 * "Send T&C" - a Game Master asks one of their OWN referred players, who is affiliated but
 * never accepted the Gamemaster terms, to read and answer them (`External game plans/24` s5.5).
 *
 * Three operations, all of which return a result and never throw:
 * - `sendTermsRequest`   - the Game Master's button. Notification + email + audit row.
 * - `getTermsRequestPrompt` - the player's screen asks "is there a request waiting for me?".
 * - `answerTermsRequest` - accept (stamps consent on the EXISTING row) or decline.
 *
 * Reason: a referral claim cannot carry this - `decideClaimPrompt` lapses a claim for a player
 * who is already affiliated, which is exactly this player. So requests live in their own
 * collection, and the consent is written by `recordAffiliationConsent`, which only ever stamps
 * an empty row and never creates one (`affiliate()` stays the single writer of affiliations).
 *
 * Declining changes NOTHING about the affiliation - D1 says a placed player moves only through
 * an audited admin move - it records the answer and tells the Game Master.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import UserReferral from "@/database/models/user-referral.model";
import GmTermsRequest from "@/database/models/gamemaster/gm-terms-request.model";
import { getUserById } from "@/lib/utils/user-lookup";
import { notificationService } from "@/lib/services/notification.service";
import { emailNotificationBridge } from "@/lib/services/email-notification-bridge";
import { classifyReferral } from "./referral-kind";
import { findSubscriptionForUser, toFacts } from "./affiliation.service";
import { recordAffiliationConsent } from "./affiliation-consent.service";
import {
  TERMS_REQUEST_REFUSAL_COPY,
  decideTermsRequestSend,
  type TermsRequestSendRefusal,
} from "./gm-terms-request-rules";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

export type SendTermsRequestResult =
  | { success: true; sendCount: number }
  | { success: false; code: TermsRequestSendRefusal | "not_found" | "not_game_master" | "error"; error: string; retryAt?: string };

export type TermsRequestPrompt =
  | { show: false }
  | { show: true; requestId: string; gameMasterId: string; gameMasterName: string };

export type AnswerTermsRequestResult =
  | { success: true; status: "accepted" | "declined" }
  | { success: false; code: string; error: string };

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface Actor {
  id: string;
  email?: string;
  name?: string;
}

function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

/** Best-effort - an audit write must never undo or block the action it describes. */
async function writeAudit(input: {
  customer: Actor;
  performer: Actor & { type: "user" };
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  meta?: RequestMeta;
}): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const now = new Date();
    await db.collection("customer_audit_trail").insertOne({
      customerId: input.customer.id,
      customerEmail: input.customer.email ?? "",
      customerName: input.customer.name ?? "",
      action: input.action,
      actionCategory: "assignment",
      description: input.description,
      performedBy: {
        type: input.performer.type,
        id: input.performer.id,
        email: input.performer.email ?? "",
        name: input.performer.name ?? "",
      },
      metadata: input.metadata,
      timestamp: now,
      ipAddress: input.meta?.ipAddress ?? "",
      userAgent: input.meta?.userAgent ?? "",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.warn("⚠️ gm-terms-request: audit write failed", error);
  }
}

/**
 * The player's account manager, if they have one, hears about the answer in the admin bell.
 * Best-effort, raw insert in the shape `customer-assignment/auto-assign` already writes.
 */
async function notifyAccountManager(input: {
  userId: string;
  playerName: string;
  playerEmail: string;
  gameMasterName: string;
  status: "accepted" | "declined";
}): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const assignment = await db
      .collection("customer_assignments")
      .findOne({ customerId: input.userId, isActive: true }, { projection: { employeeId: 1 } });
    const employeeId = assignment?.employeeId;
    if (!isObjectIdString(String(employeeId ?? ""))) return;
    const now = new Date();
    await db.collection("employee_notifications").insertOne({
      employeeId: new mongoose.Types.ObjectId(String(employeeId)),
      type: "system_message",
      title: `📜 Game Master terms ${input.status}`,
      message: `${input.playerName || input.playerEmail} ${input.status} the Game Master terms sent by ${input.gameMasterName}.`,
      metadata: {
        customerId: input.userId,
        customerEmail: input.playerEmail,
        customerName: input.playerName,
        gameMasterName: input.gameMasterName,
        termsRequestStatus: input.status,
      },
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.warn("⚠️ gm-terms-request: account manager notification failed", error);
  }
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

    const now = input.now ?? new Date();
    const previous = await GmTermsRequest.findOne({ referralId: String(referral._id) })
      .lean<{ sendCount?: number; lastSentAt?: Date | null }>();
    const decision = decideTermsRequestSend({
      kind: classifyReferral(referral).kind,
      isActive: referral.isActive === true,
      termsAccepted: Boolean(referral.termsAcceptanceId),
      previous: previous
        ? { sendCount: previous.sendCount ?? 0, lastSentAt: previous.lastSentAt ?? null }
        : null,
      now,
    });
    if (!decision.ok) {
      return {
        success: false,
        code: decision.reason,
        error: TERMS_REQUEST_REFUSAL_COPY.get(decision.reason) ?? GENERIC_ERROR,
        retryAt: decision.retryAt?.toISOString(),
      };
    }

    const player = await getUserById(referral.userId);
    const playerEmail = player?.email || referral.userEmail || "";
    const playerName = player?.name || playerEmail.split("@")[0] || "";
    const gameMasterName = gm.userName || "your Game Master";

    const saved = await GmTermsRequest.findOneAndUpdate(
      { referralId: String(referral._id) },
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

    // Reason: the in-app row is what pops the window on the player's open tab (the push carries
    // the templateId) and what stays in the bell if they were away. The template sends no email
    // because the dedicated email below exists - two emails for one request is noise.
    await notificationService.send({
      userId: referral.userId,
      templateId: "gm_terms_request",
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
      metadata: { referralId: String(referral._id), gameMasterId: input.gameMasterUserId, sendCount: saved?.sendCount ?? 1 },
      meta: input.meta,
    });

    return { success: true, sendCount: saved?.sendCount ?? 1 };
  } catch (error) {
    console.error("❌ gm-terms-request: send failed", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}

/**
 * A pending request is shown only while the row it is about is still active and still has no
 * terms. Anything else resolves it quietly - opening the email link after answering, or after
 * the affiliation ended, does nothing.
 */
export async function getTermsRequestPrompt(userId: string): Promise<TermsRequestPrompt> {
  try {
    await connectToDatabase();
    const request = await GmTermsRequest.findOne({ userId, status: "pending" })
      .sort({ lastSentAt: -1 })
      .lean<{ _id: unknown; referralId: string; gameMasterId: string; gameMasterName?: string }>();
    if (!request) return { show: false };

    const referral = await UserReferral.findOne({ _id: request.referralId, userId })
      .lean<{ isActive?: boolean; termsAcceptanceId?: string | null; gameMasterId?: string }>();
    const stillOpen =
      referral?.isActive === true &&
      !referral.termsAcceptanceId &&
      referral.gameMasterId === request.gameMasterId;
    if (!stillOpen) {
      await GmTermsRequest.updateOne(
        { _id: request._id, status: "pending" },
        { $set: { status: referral?.termsAcceptanceId ? "accepted" : "declined", resolvedAt: new Date() } },
      );
      return { show: false };
    }
    return {
      show: true,
      requestId: String(request._id),
      gameMasterId: request.gameMasterId,
      gameMasterName: request.gameMasterName || "your Game Master",
    };
  } catch (error) {
    console.warn("⚠️ gm-terms-request: prompt read failed", error);
    return { show: false };
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
    const request = await GmTermsRequest.findOne({ userId: input.user.id, status: "pending" })
      .sort({ lastSentAt: -1 })
      .lean<{ _id: unknown; referralId: string; gameMasterId: string; gameMasterName?: string }>();
    if (!request) {
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
        gameMasterId: request.gameMasterId,
        referralId: request.referralId,
        termsAcceptanceId: input.termsAcceptanceId,
      });
      if (!consent.success) return { success: false, code: consent.code, error: consent.error };
      termsAcceptanceId = input.termsAcceptanceId;
    }

    // Reason: one conditional update is the transition, so a double-click answers once.
    const claimed = await GmTermsRequest.updateOne(
      { _id: request._id, status: "pending" },
      { $set: { status, resolvedAt: new Date(), ...(termsAcceptanceId ? { termsAcceptanceId } : {}) } },
    );
    if (claimed.modifiedCount !== 1) return { success: true, status };

    const gameMasterName = request.gameMasterName || "your Game Master";
    const playerName = input.user.name || (input.user.email ?? "").split("@")[0] || "Your referral";
    await notificationService.send({
      userId: request.gameMasterId,
      templateId: "gm_terms_request_answered",
      variables: {
        playerName,
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
      gameMasterName,
      status,
    });
    await writeAudit({
      customer: input.user,
      performer: { type: "user", ...input.user },
      action: `gm_terms_request_${status}`,
      description: `Player ${status} the Game Master terms sent by ${gameMasterName}`,
      metadata: {
        referralId: request.referralId,
        gameMasterId: request.gameMasterId,
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
