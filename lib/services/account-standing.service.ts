import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import AccountLockout, {
  type LockoutReason,
} from "@/database/models/account-lockout.model";
import { getUserRestrictions } from "@/lib/services/user-restriction.service";

/**
 * Is a signed-in player still allowed to be signed in?
 *
 * Read by `GET /api/user/account-standing`, which `AccountStandingGuard` polls from every
 * player page. It exists because the decisions an operator takes - lock, deactivate, ban,
 * suspend - were only ever checked at sign-in, so a player already signed in kept the whole
 * site until their session expired.
 */

export type AccountStandingReason =
  | "locked"
  | "deactivated"
  | "banned"
  | "suspended";

export type AccountStanding =
  | { ok: true }
  | {
      ok: false;
      reason: AccountStandingReason;
      /** Where the guard sends the player: sign-in for a removed session, review for a restriction. */
      action: "sign_out" | "review";
      message: string;
    };

// Reason: only lockouts a PERSON or the fraud system decided end a live session. A
// `failed_login` / `rate_limit` lockout is written by somebody typing wrong passwords at the
// player's email - kicking the real owner out of a session they already hold would hand any
// stranger a way to sign a player out of a contest by guessing at their address.
export const SESSION_ENDING_LOCKOUT_REASONS: readonly LockoutReason[] = [
  "admin_action",
  "suspicious_activity",
  "fraud_detection",
];

function userLookup(userId: string): Record<string, unknown> {
  const or: Record<string, unknown>[] = [{ id: userId }];
  // Reason: Better Auth's MongoDB adapter keeps the identity in `_id` (R68), so an `id`-only
  // query reports "no such user" for every real account while looking correct.
  if (/^[0-9a-fA-F]{24}$/.test(userId)) or.push({ _id: new ObjectId(userId) });
  return { $or: or };
}

export async function getAccountStanding(
  userId: string,
  email?: string | null,
): Promise<AccountStanding> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;

  let userEmail = email ?? undefined;
  if (db) {
    const user = await db
      .collection("user")
      .findOne(userLookup(userId), { projection: { isDeactivated: 1, email: 1 } });
    if (user?.isDeactivated === true) {
      return {
        ok: false,
        reason: "deactivated",
        action: "sign_out",
        message: "This account has been deactivated. Please contact support.",
      };
    }
    if (typeof user?.email === "string") userEmail = user.email;
  }

  const now = new Date();
  const identity: Record<string, unknown>[] = [{ userId }];
  if (userEmail) identity.push({ email: userEmail.toLowerCase() }, { email: userEmail });
  const lockout = await AccountLockout.findOne({
    isActive: true,
    reason: { $in: SESSION_ENDING_LOCKOUT_REASONS },
    $and: [
      { $or: identity },
      { $or: [{ lockedUntil: { $gt: now } }, { lockedUntil: null }] },
    ],
  })
    .select("_id")
    .lean();
  if (lockout) {
    return {
      ok: false,
      reason: "locked",
      action: "sign_out",
      message: "Your account has been locked. Please contact support.",
    };
  }

  const restrictions = await getUserRestrictions(userId);
  const banned = restrictions.find((r) => r.restrictionType === "banned");
  if (banned) {
    return {
      ok: false,
      reason: "banned",
      action: "review",
      message: "Your account has been banned.",
    };
  }
  // Reason: a suspension that still allows trading and entry (a duplicate-KYC challenge
  // block, for instance) is a partial restriction, and sending its owner to the review page
  // from every screen would lock them out of the parts they are still allowed to use.
  const fullSuspension = restrictions.find(
    (r) =>
      r.restrictionType === "suspended" &&
      r.canTrade === false &&
      r.canEnterCompetitions === false,
  );
  if (fullSuspension) {
    return {
      ok: false,
      reason: "suspended",
      action: "review",
      message: "Your account has been suspended.",
    };
  }

  return { ok: true };
}
