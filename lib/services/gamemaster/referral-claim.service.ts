import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import GmReferralClaim from "@/database/models/gamemaster/gm-referral-claim.model";
import UserReferral from "@/database/models/user-referral.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { decideAffiliation } from "./affiliation-rules";
import { affiliate, findSubscriptionForUser, toFacts } from "./affiliation.service";
import {
  ACCEPTING_STALE_MS,
  RETRYABLE_ACCEPT_CODES,
  decideClaimPrompt,
} from "./referral-claim-rules";

/**
 * A referral-link sign-up waiting on the player's consent (`External game plans/24` s5.3).
 *
 * Sign-up records a claim; the player's first visit asks; only an acceptance becomes an
 * affiliation, and only through `affiliate()`, the single writer - this file never touches
 * `userreferrals` or the user fallback. A decline is final: the player is never attached to
 * that Game Master and never asked again.
 *
 * Concurrency: every transition is ONE conditional update on `status`, so an Accept and a
 * Decline racing each other cannot both win, and an Accept holds the claim (`accepting`)
 * while `affiliate()` runs. Never throws.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";
const AUDIT_COLLECTION = "customer_audit_trail";

export interface ClaimUser {
  id: string;
  email: string;
  name?: string;
}

type ClaimAuditAction = "gm_referral_link_pending" | "gm_referral_link_declined" | "gm_referral_link_lapsed";

async function writeClaimAudit(
  user: ClaimUser,
  action: ClaimAuditAction,
  description: string,
  metadata: Record<string, unknown>,
  request?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  // Reason: best-effort, after the state change - as in affiliation.service. An audit write
  // failing must never cost a player their answer.
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection(AUDIT_COLLECTION).insertOne({
      customerId: user.id,
      customerEmail: user.email.toLowerCase(),
      customerName: user.name?.trim() || user.email.split("@")[0],
      action,
      actionCategory: "assignment",
      description,
      performedBy: {
        employeeId: "system",
        employeeName: action === "gm_referral_link_declined" ? "Player (self-service)" : "System (sign-up)",
        employeeEmail: "system@gamemaster-affiliation",
        employeeRole: "system",
        department: "Game Master",
        isSuperAdmin: false,
      },
      metadata: { source: "gm_referral_link", ...metadata },
      timestamp: new Date(),
      ipAddress: request?.ipAddress,
      userAgent: request?.userAgent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.warn("⚠️ Referral claim audit row not written:", error);
  }
}

/** Filter matching a claim that is open for an answer: pending, or an Accept that stalled. */
function openClaimFilter(userId: string, now: Date) {
  return {
    userId,
    $or: [
      { status: "pending" },
      { status: "accepting", updatedAt: { $lte: new Date(now.getTime() - ACCEPTING_STALE_MS) } },
    ],
  };
}

export type RecordClaimResult =
  | { recorded: true; created: boolean; gameMasterId: string }
  | { recorded: false; reason: string };

/**
 * Sign-up: remember which Game Master's link the player used, without attaching them.
 * Reason: refused at sign-up exactly when `affiliate()` would refuse (unknown code, a Game
 * Master no longer active) - the writer's own decision, never a second copy - so the prompt
 * is never offered for a link that was already dead when it was clicked.
 */
export async function recordReferralClaim(input: {
  user: ClaimUser;
  referralCode: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<RecordClaimResult> {
  const { user, referralCode } = input;
  if (typeof user?.id !== "string" || !user.id.trim() || typeof user.email !== "string" || !user.email.trim()) {
    return { recorded: false, reason: "invalid_input" };
  }
  if (typeof referralCode !== "string" || !referralCode.trim()) {
    return { recorded: false, reason: "invalid_input" };
  }
  try {
    await connectToDatabase();
    const sub = await GameMasterSubscription.findOne({ referralCode }).lean();
    const gm = toFacts(sub);
    const decision = decideAffiliation({ userId: user.id, channel: "gm_referral_link", gm });
    if (decision.kind === "refuse") {
      await writeClaimAudit(user, "gm_referral_link_lapsed", decision.message, {
        code: decision.code,
        reason: decision.message,
        referralCode,
        gameMasterId: gm?.userId,
      }, input);
      return { recorded: false, reason: decision.code };
    }

    const result = await GmReferralClaim.updateOne(
      { userId: user.id },
      {
        $setOnInsert: {
          userId: user.id,
          userEmail: user.email.toLowerCase(),
          referralCode,
          gameMasterId: gm!.userId,
          gameMasterName: gm!.userName,
          status: "pending",
          signupIP: input.ipAddress || undefined,
          signupUserAgent: input.userAgent || undefined,
        },
      },
      { upsert: true },
    );
    const created = result.upsertedCount === 1;
    if (created) {
      await writeClaimAudit(user, "gm_referral_link_pending", "Waiting for the player to accept the Gamemaster terms", {
        referralCode,
        gameMasterId: gm!.userId,
        gameMasterName: gm!.userName,
      }, input);
    }
    return { recorded: true, created, gameMasterId: gm!.userId };
  } catch (error) {
    console.error("❌ Recording referral claim failed:", error);
    return { recorded: false, reason: "error" };
  }
}

export type ClaimPrompt =
  | { show: false }
  | { show: true; gameMasterId: string; gameMasterName: string };

/**
 * Should this visit show the terms prompt? Closes (lapses) a claim the single writer would
 * refuse for good, so a dead link never prompts and never prompts again.
 */
export async function getReferralClaimPrompt(user: ClaimUser, now = new Date()): Promise<ClaimPrompt> {
  try {
    await connectToDatabase();
    const claim = await GmReferralClaim.findOne({ userId: user.id }).lean();
    if (!claim) return { show: false };

    const sub = await GameMasterSubscription.findOne({ referralCode: claim.referralCode }).lean();
    const activeRow = await UserReferral.findOne({ userId: user.id, isActive: true })
      .lean<{ gameMasterId: string }>();
    const activeGm = activeRow ? await findSubscriptionForUser(activeRow.gameMasterId) : undefined;

    const decision = decideClaimPrompt({
      userId: user.id,
      claim,
      gm: toFacts(sub),
      activeGameMasterId: activeRow?.gameMasterId,
      activeGameMaster: toFacts(activeGm),
      now,
    });

    if (decision.kind === "lapse") {
      const lapsed = await GmReferralClaim.updateOne(openClaimFilter(user.id, now), {
        $set: { status: "lapsed", resolution: decision.reason, resolvedAt: now },
      });
      if (lapsed.modifiedCount === 1) {
        await writeClaimAudit(user, "gm_referral_link_lapsed", `Referral link no longer applies (${decision.reason})`, {
          code: decision.reason,
          reason: decision.reason,
          gameMasterId: claim.gameMasterId,
        });
      }
      return { show: false };
    }
    if (decision.kind !== "show") return { show: false };
    return {
      show: true,
      gameMasterId: decision.gameMasterId,
      gameMasterName: toFacts(sub)?.userName || claim.gameMasterName || "your Game Master",
    };
  } catch (error) {
    // Reason: fail quiet - a prompt that cannot be decided is simply not shown this visit;
    // the claim stays pending and is asked again next time.
    console.error("❌ Reading referral claim failed:", error);
    return { show: false };
  }
}

export type ClaimAnswerResult =
  | { success: true; outcome: "affiliated" | "already_affiliated" | "declined"; gameMasterId?: string }
  | { success: false; code: string; error: string; retryable: boolean };

/** The player accepted: attach them through the single writer, with their consent id. */
export async function acceptReferralClaim(input: {
  user: ClaimUser;
  termsAcceptanceId: unknown;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ClaimAnswerResult> {
  const { user } = input;
  const now = new Date();
  try {
    await connectToDatabase();
    const claim = await GmReferralClaim.findOneAndUpdate(
      openClaimFilter(user.id, now),
      { $set: { status: "accepting" } },
      { new: true },
    ).lean();

    if (!claim) {
      const existing = await GmReferralClaim.findOne({ userId: user.id }).lean();
      if (existing?.status === "accepted") {
        return { success: true, outcome: "already_affiliated", gameMasterId: existing.gameMasterId };
      }
      return {
        success: false,
        code: existing?.status === "accepting" ? "in_progress" : "no_open_claim",
        error: "There is no Game Master invitation waiting for an answer.",
        retryable: false,
      };
    }

    const result = await affiliate({
      user,
      gameMaster: { referralCode: claim.referralCode },
      channel: "gm_referral_link",
      surface: "signup",
      // Reason: `affiliate()` verifies the id belongs to THIS player, THIS Game Master and the
      // current wording, so a junk or borrowed value is refused there, before any write.
      termsAcceptanceId: typeof input.termsAcceptanceId === "string" ? input.termsAcceptanceId : undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    if (result.success) {
      const outcome = result.created ? "affiliated" : "already_affiliated";
      await GmReferralClaim.updateOne(
        { _id: claim._id, status: "accepting" },
        {
          $set: {
            status: "accepted",
            resolution: outcome,
            termsAcceptanceId: input.termsAcceptanceId,
            resolvedAt: new Date(),
          },
        },
      );
      return { success: true, outcome, gameMasterId: result.gameMasterId };
    }

    const retryable = RETRYABLE_ACCEPT_CODES.has(result.code);
    await GmReferralClaim.updateOne(
      { _id: claim._id, status: "accepting" },
      retryable
        ? { $set: { status: "pending" } }
        : { $set: { status: "refused", resolution: result.code, resolvedAt: new Date() } },
    );
    return { success: false, code: result.code, error: result.error, retryable };
  } catch (error) {
    console.error("❌ Accepting referral claim failed:", error);
    return { success: false, code: "error", error: GENERIC_ERROR, retryable: true };
  }
}

/** The player declined: never attached to that Game Master, never asked again. */
export async function declineReferralClaim(input: {
  user: ClaimUser;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ClaimAnswerResult> {
  const { user } = input;
  const now = new Date();
  try {
    await connectToDatabase();
    const claim = await GmReferralClaim.findOneAndUpdate(
      openClaimFilter(user.id, now),
      { $set: { status: "declined", resolution: "declined", resolvedAt: now } },
      { new: true },
    ).lean();
    if (!claim) {
      const existing = await GmReferralClaim.findOne({ userId: user.id }).lean();
      // Reason: a repeated Decline (double click, second tab) is success, not an error.
      if (existing?.status === "declined") return { success: true, outcome: "declined" };
      return {
        success: false,
        code: existing?.status === "accepting" ? "in_progress" : "no_open_claim",
        error: "There is no Game Master invitation waiting for an answer.",
        retryable: false,
      };
    }
    await writeClaimAudit(user, "gm_referral_link_declined", "Declined the Gamemaster terms", {
      gameMasterId: claim.gameMasterId,
      gameMasterName: claim.gameMasterName,
      referralCode: claim.referralCode,
    }, input);
    return { success: true, outcome: "declined", gameMasterId: claim.gameMasterId };
  } catch (error) {
    console.error("❌ Declining referral claim failed:", error);
    return { success: false, code: "error", error: GENERIC_ERROR, retryable: true };
  }
}
