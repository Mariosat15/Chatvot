/**
 * The admin's "Send terms" on Manage Game Masters -> Referrals (`External game plans/24` s5.6),
 * plus the read that fills that tab's consent and reminder columns.
 *
 * Reason it reaches `gm_referral_claims` and `gm_terms_requests` with the RAW driver: both
 * models are main-app only, and mirroring a model ahead of its caller is two copies agreeing
 * while one runs (R42). The field names below are the ones those two models declare.
 *
 * Admin reminders are deliberately different from the Game Master's:
 *  - unlimited - `adminTermsReminderCount` is its own counter and never touches `sendCount` or
 *    `gmTermsReminderSent`, which are the Game Master's once-only allowance;
 *  - audited - every send writes a `customer_audit_trail` row naming the admin;
 *  - refused for a referral that has already ANSWERED. A decline is final ("never prompted
 *    again"), and reminding someone who said no is the spam the rule exists to prevent.
 */

import mongoose from "mongoose";

// Reason: mongoose bundles its own `mongodb`, so `mongoose.connection.db` is not the top-level
// package's `Db`. Typing against mongoose's copy is what every caller actually holds.
type Db = mongoose.mongo.Db;
const ObjectId = mongoose.Types.ObjectId;
import { notificationService } from "@/lib/services/notification.service";
import type { ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";
import type { AdminAwaitingClaimRow, AdminTermsReminderState } from "../../admin/admin-terms-reminder-view";

export type { AdminAwaitingClaimRow, AdminTermsReminderState } from "../../admin/admin-terms-reminder-view";

export const GENERIC_ERROR = "Something went wrong. Please contact support.";
const FALLBACK_GM_NAME = "your Game Master";
/** Claim statuses that can still be answered - `accepting` is an Accept in flight. */
const OPEN_CLAIM_STATUSES = ["pending", "accepting"];
export const ADMIN_AWAITING_CLAIMS_LIMIT = 200;

export type AdminTermsReminderRefusal = "already_accepted" | "declined" | "not_found" | "not_game_master";

export type AdminTermsReminderResult =
  | { success: true; adminTermsReminderCount: number; target: "referral" | "claim" }
  | { success: false; code: AdminTermsReminderRefusal | "error"; error: string };

const REFUSAL_COPY = new Map<AdminTermsReminderRefusal, string>([
  ["already_accepted", "This player has already accepted the Game Master terms."],
  ["declined", "This player declined the Game Master terms. A decline is final, so no reminder is sent."],
  ["not_found", "This player is not a referral of this Game Master."],
  ["not_game_master", "This Game Master could not be found."],
]);

function refusal(code: AdminTermsReminderRefusal): AdminTermsReminderResult {
  return { success: false, code, error: REFUSAL_COPY.get(code) ?? GENERIC_ERROR };
}

function iso(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Consent and reminder facts for the assigned rows, keyed by `referralId`.
 *
 * Reason: `consent` reads the referral's own `termsAccepted` first, so a row with an
 * acceptance is "accepted" whatever a request document says; only then does a declined
 * request make it "declined". A legacy row that declined stays assigned (owner, "keep") - this
 * column says Declined while Assigned still says yes, which is exactly the two facts.
 */
export async function readAdminTermsStates(
  db: Db,
  rows: readonly Pick<ReferredPlayerRow, "referralId" | "termsAccepted">[],
): Promise<Map<string, AdminTermsReminderState>> {
  const ids = rows.map((r) => r.referralId);
  const requests = ids.length
    ? await db
        .collection("gm_terms_requests")
        .find(
          { referralId: { $in: ids } },
          { projection: { referralId: 1, status: 1, sendCount: 1, lastSentAt: 1, adminTermsReminderCount: 1, lastAdminTermsReminderAt: 1 } },
        )
        .toArray()
    : [];
  const byReferral = new Map(requests.map((doc) => [String(doc.referralId), doc]));
  const states = new Map<string, AdminTermsReminderState>();
  for (const row of rows) {
    const doc = byReferral.get(row.referralId);
    states.set(row.referralId, {
      consent: row.termsAccepted ? "accepted" : doc?.status === "declined" ? "declined" : "pending",
      gmReminderSent: count(doc?.sendCount) > 0,
      gmReminderSentAt: iso(doc?.lastSentAt),
      adminReminderCount: count(doc?.adminTermsReminderCount),
      lastAdminReminderAt: iso(doc?.lastAdminTermsReminderAt),
    });
  }
  return states;
}

/** Link sign-ups for this Game Master that are still pending or were declined, newest first. */
export async function readAdminAwaitingClaims(db: Db, gameMasterUserId: string): Promise<AdminAwaitingClaimRow[]> {
  const claims = await db
    .collection("gm_referral_claims")
    .find({ gameMasterId: gameMasterUserId, status: { $in: [...OPEN_CLAIM_STATUSES, "declined"] } })
    .sort({ createdAt: -1 })
    .limit(ADMIN_AWAITING_CLAIMS_LIMIT)
    .toArray();
  if (claims.length === 0) return [];
  const userIds = claims.map((c) => String(c.userId));
  const objectIds = userIds.filter((id) => ObjectId.isValid(id) && id.length === 24).map((id) => new ObjectId(id));
  // Reason: Better Auth keeps the identity in `_id`, and some rows also carry `id` - query
  // both or a player is silently nameless (R68).
  const users = await db
    .collection("user")
    .find({ $or: [{ _id: { $in: objectIds } }, { id: { $in: userIds } }] }, { projection: { _id: 1, id: 1, name: 1, email: 1 } })
    .toArray();
  const names = new Map<string, { name?: string; email?: string }>();
  for (const u of users) {
    const info = { name: typeof u.name === "string" ? u.name : undefined, email: typeof u.email === "string" ? u.email : undefined };
    names.set(String(u._id), info);
    if (typeof u.id === "string") names.set(u.id, info);
  }
  return claims.map((c) => {
    const user = names.get(String(c.userId));
    const declined = c.status === "declined";
    return {
      claimId: String(c._id),
      userId: String(c.userId),
      userName: user?.name ?? null,
      userEmail: user?.email ?? (typeof c.userEmail === "string" ? c.userEmail : null),
      referredAt: iso(c.createdAt),
      declinedAt: declined ? iso(c.resolvedAt) : null,
      consent: declined ? "declined" : "pending",
      gmReminderSent: c.gmTermsReminderSent === true,
      gmReminderSentAt: iso(c.gmTermsReminderSentAt),
      adminReminderCount: count(c.adminTermsReminderCount),
      lastAdminReminderAt: iso(c.lastAdminTermsReminderAt),
    };
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/**
 * Remind the player that the Game Master's terms are waiting. `gameMasterSubscriptionId` is the
 * id in the admin URL; the player is named by user id, and is looked up SCOPED to that Game
 * Master, so another Game Master's player reads as not found.
 */
export async function sendAdminTermsReminder(
  db: Db,
  input: {
    gameMasterSubscriptionId: string;
    playerUserId: string;
    admin: { id: string; email: string; name?: string };
    meta?: { ipAddress?: string; userAgent?: string };
    now?: Date;
  },
): Promise<AdminTermsReminderResult> {
  try {
    if (!ObjectId.isValid(input.gameMasterSubscriptionId) || typeof input.playerUserId !== "string" || !input.playerUserId) {
      return refusal("not_found");
    }
    const subscription = await db
      .collection("gamemastersubscriptions")
      .findOne({ _id: new ObjectId(input.gameMasterSubscriptionId) }, { projection: { userId: 1, userName: 1 } });
    if (!subscription?.userId) return refusal("not_game_master");
    const gameMasterUserId = String(subscription.userId);
    const gameMasterName = typeof subscription.userName === "string" && subscription.userName ? subscription.userName : FALLBACK_GM_NAME;
    const now = input.now ?? new Date();
    const stamp = { $inc: { adminTermsReminderCount: 1 }, $set: { lastAdminTermsReminderAt: now, updatedAt: now } };

    let target: "referral" | "claim";
    let targetId: string;
    let playerEmail = "";
    let newCount: number;

    const referral = await db
      .collection("userreferrals")
      .findOne(
        { gameMasterId: gameMasterUserId, userId: input.playerUserId, isActive: true },
        { sort: { referredAt: -1 }, projection: { _id: 1, userEmail: 1, termsAcceptanceId: 1 } },
      );
    if (referral) {
      if (typeof referral.termsAcceptanceId === "string" && referral.termsAcceptanceId) return refusal("already_accepted");
      target = "referral";
      targetId = String(referral._id);
      playerEmail = typeof referral.userEmail === "string" ? referral.userEmail : "";
      try {
        // Reason: one upsert is both the guard and the counter. The status filter refuses an
        // answered request; for a legacy row nobody sent, it creates the pending request with
        // `sendCount: 0`, so the Game Master's own one send is still unused.
        const updated = await db.collection("gm_terms_requests").findOneAndUpdate(
          { referralId: targetId, status: { $nin: ["accepted", "declined"] } },
          {
            ...stamp,
            $setOnInsert: {
              referralId: targetId,
              userId: input.playerUserId,
              userEmail: playerEmail,
              gameMasterId: gameMasterUserId,
              gameMasterName,
              status: "pending",
              sendCount: 0,
              createdAt: now,
            },
          },
          { upsert: true, returnDocument: "after" },
        );
        newCount = count(updated?.adminTermsReminderCount);
      } catch (error) {
        // Reason: the upsert collided with the unique `referralId` - the request exists and
        // did not match the filter, so it has already been answered.
        if (!isDuplicateKeyError(error)) throw error;
        const current = await db.collection("gm_terms_requests").findOne({ referralId: targetId }, { projection: { status: 1 } });
        return refusal(current?.status === "accepted" ? "already_accepted" : "declined");
      }
    } else {
      const claim = await db
        .collection("gm_referral_claims")
        .findOne({ gameMasterId: gameMasterUserId, userId: input.playerUserId }, { projection: { _id: 1, status: 1, userEmail: 1 } });
      if (!claim) return refusal("not_found");
      if (claim.status === "declined") return refusal("declined");
      if (claim.status === "accepted") return refusal("already_accepted");
      if (!OPEN_CLAIM_STATUSES.includes(String(claim.status))) return refusal("not_found");
      target = "claim";
      targetId = String(claim._id);
      playerEmail = typeof claim.userEmail === "string" ? claim.userEmail : "";
      const updated = await db
        .collection("gm_referral_claims")
        .findOneAndUpdate({ _id: claim._id, status: { $in: OPEN_CLAIM_STATUSES } }, stamp, { returnDocument: "after" });
      if (!updated) {
        const current = await db.collection("gm_referral_claims").findOne({ _id: claim._id }, { projection: { status: 1 } });
        return refusal(current?.status === "accepted" ? "already_accepted" : current?.status === "declined" ? "declined" : "not_found");
      }
      newCount = count(updated.adminTermsReminderCount);
    }

    // Reason: the notification carries only the Game Master's name - no player data, no terms.
    await notificationService.send({
      userId: input.playerUserId,
      templateId: "affiliate_terms_required",
      variables: { gameMasterName },
    });
    await writeAdminAudit(db, {
      playerUserId: input.playerUserId,
      playerEmail,
      admin: input.admin,
      gameMasterName,
      metadata: {
        gameMasterId: gameMasterUserId,
        [target === "referral" ? "referralId" : "claimId"]: targetId,
        adminTermsReminderCount: newCount,
      },
      meta: input.meta,
      now,
    });
    return { success: true, adminTermsReminderCount: newCount, target };
  } catch (error) {
    console.error("❌ admin-terms-reminder: send failed", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}

/** Best-effort, in the shape the main app's `writeAudit` writes - an audit must never undo the send. */
async function writeAdminAudit(
  db: Db,
  input: {
    playerUserId: string;
    playerEmail: string;
    admin: { id: string; email: string; name?: string };
    gameMasterName: string;
    metadata: Record<string, unknown>;
    meta?: { ipAddress?: string; userAgent?: string };
    now: Date;
  },
): Promise<void> {
  try {
    await db.collection("customer_audit_trail").insertOne({
      customerId: input.playerUserId,
      customerEmail: input.playerEmail,
      customerName: "",
      action: "admin_terms_reminder_sent",
      actionCategory: "assignment",
      description: `An admin reminded this player to answer the Game Master terms from ${input.gameMasterName}`,
      performedBy: { type: "admin", id: input.admin.id, email: input.admin.email, name: input.admin.name ?? "" },
      metadata: input.metadata,
      timestamp: input.now,
      ipAddress: input.meta?.ipAddress ?? "",
      userAgent: input.meta?.userAgent ?? "",
      createdAt: input.now,
      updatedAt: input.now,
    });
  } catch (error) {
    console.warn("⚠️ admin-terms-reminder: audit write failed", error);
  }
}
