/**
 * Admin move and detach of a player's Game Master affiliation (`External game plans/24` s7.3,
 * task 4 of the v2 programme). Owner decision D1: a player under another Game Master is
 * locked, and ONLY an audited admin reassignment moves them - this is that reassignment.
 *
 * It mirrors the main app's single writer (`lib/services/gamemaster/affiliation.service.ts`)
 * rather than calling it, because that file is main-app only and imports through `@/`. The
 * semantics that must agree are the ones settlement reads:
 *   - at most one ACTIVE `userreferrals` row per player (partial unique index = race guard);
 *   - the `user` document's `referredByGameMasterId` fallback follows the active row - and on a
 *     DETACH it is removed, because `calculate.ts` pays the fallback when no active row exists,
 *     so leaving it would keep paying the Game Master the player was just detached from;
 *   - `activeReferredUsers` is decremented on the old subscription, incremented on the new.
 *
 * Model-light on purpose: the referral model is imported RELATIVELY (vitest aliases `@` to the
 * repository root), subscriptions and users are reached with the raw driver exactly as every
 * other admin Game Master route does, and the caller connects first. Never throws.
 */

import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import UserReferral from "../../../database/models/user-referral.model";

export const GENERIC_ERROR = "Something went wrong. Please contact support.";
export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 500;
const MAX_RETRIES = 5;
const DUPLICATE_KEY = 11000;
const AUDIT_COLLECTION = "customer_audit_trail";

export interface AdminActor {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface Common {
  userId: string;
  reason: string;
  actor: AdminActor;
  ipAddress?: string;
  userAgent?: string;
}
export interface MoveAffiliationInput extends Common {
  targetSubscriptionId: string;
}
export type DetachAffiliationInput = Common;

export type AdminAffiliationRefusal =
  | "invalid_input"
  | "reason_required"
  | "not_affiliated"
  | "target_not_found"
  | "target_not_active"
  | "already_with_target"
  | "self_referral"
  | "user_not_found";

export type AdminAffiliationResult =
  | {
      success: true;
      action: "move" | "detach";
      userId: string;
      fromGameMasterId: string;
      toGameMasterId: string | null;
      endedReferralId: string | null;
      referralId: string | null;
    }
  | { success: false; code: AdminAffiliationRefusal | "error"; error: string };

// Reason: operator-facing, so each refusal says what to do. Unexpected failures stay generic.
export const REFUSAL_MESSAGES: Readonly<Record<AdminAffiliationRefusal, string>> = {
  invalid_input: "The request is missing the player or the Game Master.",
  reason_required: `Give a reason of at least ${MIN_REASON_LENGTH} characters - it is recorded in the audit trail.`,
  not_affiliated: "This player is not affiliated with any Game Master.",
  target_not_found: "That Game Master subscription does not exist.",
  target_not_active: "That Game Master is not active (expired, paused or being deleted), so a player cannot be moved to them.",
  already_with_target: "This player is already with that Game Master.",
  self_referral: "A Game Master cannot be assigned as their own referrer.",
  user_not_found: "The player's account could not be found.",
};

const refuse = (code: AdminAffiliationRefusal): AdminAffiliationResult => ({
  success: false,
  code,
  // eslint-disable-next-line security/detect-object-injection -- code is a typed union literal
  error: REFUSAL_MESSAGES[code],
});

/** Trimmed reason, or null when too short / too long / not a string. */
export function normaliseReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const r = reason.trim();
  return r.length >= MIN_REASON_LENGTH && r.length <= MAX_REASON_LENGTH ? r : null;
}

/** Better Auth keeps identity in `_id`; legacy documents may carry an `id` field (R68). */
function userIdFilter(userId: string) {
  const or: Record<string, unknown>[] = [{ id: userId }, { _id: userId }];
  if (ObjectId.isValid(userId)) or.push({ _id: new ObjectId(userId) });
  return { $or: or };
}

function isRetryable(error: unknown): boolean {
  const e = error as { code?: number; errorLabels?: string[]; hasErrorLabel?: (l: string) => boolean };
  return (
    e?.code === DUPLICATE_KEY ||
    e?.code === 112 ||
    e?.hasErrorLabel?.("TransientTransactionError") === true ||
    e?.errorLabels?.includes("TransientTransactionError") === true
  );
}

type Session = mongoose.ClientSession;
type Doc = Record<string, unknown>;

/** Active subscription for a Game Master user, else the most recent (as the main writer). */
async function findSubscriptionForUser(gmUserId: string, session: Session): Promise<Doc | null> {
  const subs = mongoose.connection.db!.collection("gamemastersubscriptions");
  const active = await subs.findOne({ userId: gmUserId, status: "active" }, { session });
  if (active) return active;
  return subs.findOne({ userId: gmUserId }, { sort: { updatedAt: -1 }, session });
}

interface Current {
  gameMasterId: string;
  row: Doc | null;
  user: Doc;
}

/** The player's active affiliation: the referral row, else the user-document fallback. */
async function readCurrent(userId: string, session: Session): Promise<Current | AdminAffiliationRefusal> {
  const db = mongoose.connection.db!;
  const user = await db.collection("user").findOne(userIdFilter(userId), { session });
  if (!user) return "user_not_found";
  const row = await db.collection("userreferrals").findOne({ userId, isActive: true }, { session });
  if (row && typeof row.gameMasterId === "string") return { gameMasterId: row.gameMasterId, row, user };
  const fallback = user.referredByGameMasterId;
  if (typeof fallback === "string" && fallback.length > 0) return { gameMasterId: fallback, row: null, user };
  return "not_affiliated";
}

/** End the active row and release its slot on the old subscription. */
async function endCurrent(current: Current, endedReason: string, now: Date, session: Session) {
  if (!current.row) return null;
  await UserReferral.updateOne(
    { _id: current.row._id, isActive: true },
    { $set: { isActive: false, endedAt: now, endedReason } },
    { session },
  );
  const previous = await findSubscriptionForUser(current.gameMasterId, session);
  if (previous?._id) {
    await mongoose.connection.db!.collection("gamemastersubscriptions").updateOne(
      { _id: previous._id, activeReferredUsers: { $gt: 0 } },
      { $inc: { activeReferredUsers: -1 } },
      { session },
    );
  }
  return String(current.row._id);
}

/**
 * Customer audit trail row with the REAL admin as `performedBy` - the user logs screen reads
 * this collection. Best-effort after commit, following the main writer: an audit failure must
 * never undo a change that has been made. The system audit log is written by the route.
 */
async function writeCustomerAudit(
  action: "gm_affiliation_reassigned" | "gm_affiliation_detached",
  input: Common,
  user: Doc,
  description: string,
  metadata: Doc,
) {
  try {
    const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
    const now = new Date();
    await mongoose.connection.db!.collection(AUDIT_COLLECTION).insertOne({
      customerId: input.userId,
      customerEmail: email,
      customerName: (typeof user.name === "string" && user.name.trim()) || email.split("@")[0],
      action,
      actionCategory: "assignment",
      description,
      performedBy: {
        employeeId: input.actor.id,
        employeeName: input.actor.name || input.actor.email.split("@")[0],
        employeeEmail: input.actor.email,
        employeeRole: input.actor.role,
        department: "Game Master",
        isSuperAdmin: input.actor.role === "super_admin",
      },
      metadata: { reason: input.reason, ...metadata },
      timestamp: now,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.warn("⚠️ Admin affiliation audit row not written:", error);
  }
}

function validCommon(input: Common): AdminAffiliationRefusal | null {
  if (typeof input?.userId !== "string" || input.userId.trim() === "") return "invalid_input";
  if (typeof input.actor?.id !== "string" || typeof input.actor.email !== "string") return "invalid_input";
  return null;
}

/** Run `body` in a transaction, retrying a lost race exactly as the main writer does. */
async function inTransaction(
  label: string,
  body: (session: Session) => Promise<AdminAffiliationResult>,
): Promise<AdminAffiliationResult> {
  if (!mongoose.connection.db) return { success: false, code: "error", error: GENERIC_ERROR };
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await body(session);
      if (result.success) await session.commitTransaction();
      else await session.abortTransaction();
      return result;
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch {
        /* already aborted */
      }
      // Reason: a lost race re-reads the winner's committed state and decides again.
      if (isRetryable(error) && attempt < MAX_RETRIES) continue;
      console.error(`❌ Admin affiliation ${label} failed:`, error);
      return { success: false, code: "error", error: GENERIC_ERROR };
    } finally {
      await session.endSession();
    }
  }
  return { success: false, code: "error", error: GENERIC_ERROR };
}

/** Move a player to another Game Master. The old row ends `admin_reassigned`. */
export async function moveAffiliation(input: MoveAffiliationInput): Promise<AdminAffiliationResult> {
  const invalid = validCommon(input);
  if (invalid) return refuse(invalid);
  const reason = normaliseReason(input.reason);
  if (!reason) return refuse("reason_required");
  if (typeof input.targetSubscriptionId !== "string" || !ObjectId.isValid(input.targetSubscriptionId)) {
    return refuse("target_not_found");
  }
  const audited = { ...input, reason };
  let user: Doc = {};
  let fromGameMasterId = "";

  const result = await inTransaction("move", async (session) => {
    const db = mongoose.connection.db!;
    const target = await db
      .collection("gamemastersubscriptions")
      .findOne({ _id: new ObjectId(input.targetSubscriptionId) }, { session });
    if (!target || typeof target.userId !== "string") return refuse("target_not_found");
    // Reason: D7 hides paused and deleting Game Masters, so a player is never parked under one.
    if (target.status !== "active" || target.isPaused === true || target.scheduledForDeletion === true) {
      return refuse("target_not_active");
    }
    if (target.userId === input.userId) return refuse("self_referral");

    const current = await readCurrent(input.userId, session);
    if (typeof current === "string") return refuse(current);
    if (current.gameMasterId === target.userId) return refuse("already_with_target");
    user = current.user;
    fromGameMasterId = current.gameMasterId;

    const now = new Date();
    const endedReferralId = await endCurrent(current, "admin_reassigned", now, session);
    const email = typeof current.user.email === "string" ? current.user.email : "";
    const [created] = await UserReferral.create(
      [
        {
          userId: input.userId,
          userEmail: email,
          userName: typeof current.user.name === "string" ? current.user.name : undefined,
          gameMasterId: target.userId,
          gameMasterEmail: typeof target.userEmail === "string" ? target.userEmail : "",
          referralCode: target.referralCode,
          referredAt: now,
          isActive: true,
          // Reason: no terms acceptance is carried over - the player accepted the OLD Game
          // Master's terms, so the new one does not see their contact details (D6).
          source: "admin_assigned",
          affiliatedVia: { surface: "admin" },
        },
      ],
      { session },
    );
    await db.collection("user").updateOne(
      userIdFilter(input.userId),
      {
        $set: {
          referredByGameMasterId: target.userId,
          referredByReferralCode: target.referralCode,
          referredAt: now,
        },
      },
      { session },
    );
    await db.collection("gamemastersubscriptions").updateOne(
      { _id: target._id },
      { $inc: { totalReferredUsers: 1, activeReferredUsers: 1 } },
      { session },
    );
    return {
      success: true,
      action: "move",
      userId: input.userId,
      fromGameMasterId: current.gameMasterId,
      toGameMasterId: target.userId,
      endedReferralId,
      referralId: String(created._id),
    };
  });

  if (result.success) {
    await writeCustomerAudit(
      "gm_affiliation_reassigned",
      audited,
      user,
      `Game Master reassigned from ${fromGameMasterId} to ${result.toGameMasterId} by an admin: ${reason}`,
      {
        fromGameMasterId,
        toGameMasterId: result.toGameMasterId,
        endedReferralId: result.endedReferralId,
        referralId: result.referralId,
      },
    );
  }
  return result;
}

/** Detach a player from their Game Master without moving them. The row ends `admin_detached`. */
export async function detachAffiliation(input: DetachAffiliationInput): Promise<AdminAffiliationResult> {
  const invalid = validCommon(input);
  if (invalid) return refuse(invalid);
  const reason = normaliseReason(input.reason);
  if (!reason) return refuse("reason_required");
  const audited = { ...input, reason };
  let user: Doc = {};

  const result = await inTransaction("detach", async (session) => {
    const current = await readCurrent(input.userId, session);
    if (typeof current === "string") return refuse(current);
    user = current.user;
    const endedReferralId = await endCurrent(current, "admin_detached", new Date(), session);
    // Reason: settlement pays the user-document fallback when no active row exists, so a
    // detach that left it would keep paying the Game Master the player was detached from.
    await mongoose.connection.db!.collection("user").updateOne(
      userIdFilter(input.userId),
      { $unset: { referredByGameMasterId: "", referredByReferralCode: "" } },
      { session },
    );
    return {
      success: true,
      action: "detach",
      userId: input.userId,
      fromGameMasterId: current.gameMasterId,
      toGameMasterId: null,
      endedReferralId,
      referralId: null,
    };
  });

  if (result.success) {
    await writeCustomerAudit(
      "gm_affiliation_detached",
      audited,
      user,
      `Detached from Game Master ${result.fromGameMasterId} by an admin: ${reason}`,
      { fromGameMasterId: result.fromGameMasterId, endedReferralId: result.endedReferralId },
    );
  }
  return result;
}
