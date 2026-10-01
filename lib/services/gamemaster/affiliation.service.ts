import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import UserReferral, {
  type AffiliationSurface,
} from "@/database/models/user-referral.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import {
  decideAffiliation,
  type AffiliationChannel,
  type AffiliationGameMasterFacts,
  type AffiliationRefusalCode,
  type PreviousAffiliationEnd,
} from "./affiliation-rules";
import { verifyGmTermsAcceptance } from "./gm-terms.service";
import { defaultSurfaceForSource } from "./referral-kind";

/**
 * The ONE writer of a player's Game Master affiliation (`External game plans/24` s3).
 *
 * Two stores hold the relationship - the `userreferrals` row (what settlement pays from) and
 * the fallback copy on the `user` document (`referredByGameMasterId`). This service writes
 * both in one transaction or neither, increments the Game Master's counters only when a row
 * is actually inserted, and never throws: every outcome is a result object.
 *
 * Sign-up (the referral link) goes through it from step 2; Join GM joins it in step 4.
 * A structural test forbids any other main-app file writing either store.
 */

const MAX_RETRIES = 5;
const DUPLICATE_KEY = 11000;
const GENERIC_ERROR = "Something went wrong. Please contact support.";
const AUDIT_COLLECTION = "customer_audit_trail";

export interface AffiliateInput {
  user: { id: string; email: string; name?: string };
  gameMaster: { referralCode: string } | { subscriptionId: string };
  channel: AffiliationChannel;
  /** Reporting only. Defaults to `signup` for the referral link. */
  surface?: AffiliationSurface;
  competitionId?: string;
  ipAddress?: string;
  userAgent?: string;
  /**
   * The `TermsAcceptance` id from the Gamemaster terms dialog. Required for Join GM; when
   * supplied on any channel it is verified and stamped on the row (`24` s3, s5).
   */
  termsAcceptanceId?: string;
}

export type AffiliateResult =
  | {
      success: true;
      created: boolean;
      alreadyAffiliated: boolean;
      gameMasterId: string;
      referralId?: string;
      endedPrevious?: PreviousAffiliationEnd;
    }
  | { success: false; code: AffiliationRefusalCode | "error"; error: string };

export interface ActiveAffiliation {
  gameMasterId: string;
  referralId?: string;
  source?: string;
  /** True when only the `user` document's fallback copy knows about it. */
  fromUserFallback: boolean;
}

/** Better Auth keeps identity in `_id`; legacy documents may carry an `id` field (R68). */
function userIdFilter(userId: string) {
  const or: Record<string, unknown>[] = [{ id: userId }, { _id: userId }];
  if (ObjectId.isValid(userId)) or.push({ _id: new ObjectId(userId) });
  return { $or: or };
}

function isTransientConflict(error: unknown): boolean {
  const e = error as {
    code?: number;
    hasErrorLabel?: (label: string) => boolean;
    errorLabels?: string[];
  };
  return (
    e?.code === 112 ||
    e?.hasErrorLabel?.("TransientTransactionError") === true ||
    e?.errorLabels?.includes("TransientTransactionError") === true
  );
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === DUPLICATE_KEY;
}

export function toFacts(sub: unknown): AffiliationGameMasterFacts | undefined {
  if (!sub) return undefined;
  const s = sub as Record<string, unknown>;
  return {
    userId: String(s.userId),
    userName: typeof s.userName === "string" ? s.userName : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    isPaused: s.isPaused === true,
    scheduledForDeletion: s.scheduledForDeletion === true,
  };
}

/**
 * A Game Master user may own more than one subscription document over time. The active one
 * is the answer when it exists; otherwise the most recent, so an expired Game Master reads
 * as expired rather than as missing (which would mean "deleted").
 */
export async function findSubscriptionForUser(
  gmUserId: string,
  // Reason: optional so the leaderboard (a read, no transaction) asks the SAME question
  // `affiliate()` asks, rather than restating "active, else most recent" in a second file.
  session: mongoose.ClientSession | null = null,
) {
  const active = await GameMasterSubscription.findOne({ userId: gmUserId, status: "active" })
    .session(session)
    .lean();
  if (active) return active;
  return GameMasterSubscription.findOne({ userId: gmUserId })
    .sort({ updatedAt: -1 })
    .session(session)
    .lean();
}

async function findTargetSubscription(
  target: AffiliateInput["gameMaster"],
  session: mongoose.ClientSession,
) {
  if ("referralCode" in target) {
    return GameMasterSubscription.findOne({ referralCode: target.referralCode })
      .session(session)
      .lean();
  }
  if (!mongoose.Types.ObjectId.isValid(target.subscriptionId)) return null;
  return GameMasterSubscription.findById(target.subscriptionId).session(session).lean();
}

function validateInput(input: AffiliateInput): string | null {
  const { user, gameMaster } = input;
  if (typeof user?.id !== "string" || user.id.trim() === "") return "missing user id";
  if (typeof user.email !== "string" || user.email.trim() === "") return "missing user email";
  if ("referralCode" in gameMaster) {
    if (typeof gameMaster.referralCode !== "string" || gameMaster.referralCode.trim() === "") {
      return "missing referral code";
    }
  } else if (typeof gameMaster?.subscriptionId !== "string") {
    return "missing subscription id";
  }
  if (input.channel !== "gm_referral_link" && input.channel !== "chartvolt_join_gm") {
    return "unknown channel";
  }
  return null;
}

/**
 * Records the outcome in the customer audit trail the admin app's user logs read.
 *
 * Reason: written AFTER the transaction and best-effort, following the auto-assign route's
 * precedent. An audit write failing must never undo an affiliation the player is owed, and
 * writing inside the transaction would make every affiliation depend on a collection that a
 * fresh database may not have yet. Raw insert into the admin model's collection
 * (`customer_audit_trail`, singular - the plural is a different, unread collection).
 */
async function writeAudit(
  input: AffiliateInput,
  action: "gm_affiliation_created" | "gm_affiliation_refused",
  description: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection(AUDIT_COLLECTION).insertOne({
      customerId: input.user.id,
      customerEmail: input.user.email.toLowerCase(),
      customerName: input.user.name?.trim() || input.user.email.split("@")[0],
      action,
      actionCategory: "assignment",
      description,
      performedBy: {
        employeeId: "system",
        employeeName:
          input.channel === "gm_referral_link" ? "System (sign-up)" : "Player (self-service)",
        employeeEmail: "system@gamemaster-affiliation",
        employeeRole: "system",
        department: "Game Master",
        isSuperAdmin: false,
      },
      metadata: { source: input.channel, surface: input.surface, ...metadata },
      timestamp: new Date(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.warn("⚠️ Game Master affiliation audit row not written:", error);
  }
}

/** The player's active Game Master, from the referral row or the user-document fallback. */
export async function getAffiliation(userId: string): Promise<ActiveAffiliation | null> {
  if (typeof userId !== "string" || userId.trim() === "") return null;
  await connectToDatabase();

  const row = await UserReferral.findOne({ userId, isActive: true }).lean<{
    _id: unknown;
    gameMasterId: string;
    source?: string;
  }>();
  if (row) {
    return {
      gameMasterId: row.gameMasterId,
      referralId: String(row._id),
      source: row.source,
      fromUserFallback: false,
    };
  }

  const db = mongoose.connection.db;
  if (!db) return null;
  const user = await db
    .collection("user")
    .findOne(userIdFilter(userId), { projection: { referredByGameMasterId: 1 } });
  const fallback = user?.referredByGameMasterId;
  if (typeof fallback === "string" && fallback.length > 0) {
    return { gameMasterId: fallback, fromUserFallback: true };
  }
  return null;
}

/**
 * Attach a player to a Game Master. Atomic, idempotent, never throws.
 *
 * Concurrency: the partial unique index `userId_active_unique` is the race guard. A losing
 * insert raises E11000 (or a transient write conflict); either way the attempt is abandoned
 * and retried, and the retry reads the winner's committed row - so a double submit to the
 * same Game Master resolves to `alreadyAffiliated` and a race to two different ones resolves
 * to one success and one `already_affiliated_other`. No path increments a counter twice.
 */
export async function affiliate(input: AffiliateInput): Promise<AffiliateResult> {
  const invalid = validateInput(input);
  if (invalid) {
    return { success: false, code: "invalid_input", error: GENERIC_ERROR };
  }

  const userId = input.user.id;
  // Reason: the default comes from `referral-kind.ts`, which the reports also use to fill a
  // surface on rows that carry none - the writer and the reader must not disagree about it.
  const surface: AffiliationSurface = input.surface ?? defaultSurfaceForSource(input.channel);
  const auditInput = { ...input, surface };

  try {
    await connectToDatabase();
  } catch (error) {
    console.error("❌ Affiliation: database unavailable:", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
  const db = mongoose.connection.db;
  if (!db) return { success: false, code: "error", error: GENERIC_ERROR };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const gmDoc = await findTargetSubscription(input.gameMaster, session);
      const gm = toFacts(gmDoc);

      const activeRow = await UserReferral.findOne({ userId, isActive: true })
        .session(session)
        .lean<{ _id: unknown; gameMasterId: string }>();

      let activeGmDoc: unknown;
      if (activeRow && (!gm || activeRow.gameMasterId !== gm.userId)) {
        activeGmDoc = await findSubscriptionForUser(activeRow.gameMasterId, session);
      }

      const decision = decideAffiliation({
        userId,
        channel: input.channel,
        gm,
        activeGameMasterId: activeRow?.gameMasterId,
        activeGameMaster: toFacts(activeGmDoc),
      });

      if (decision.kind === "refuse") {
        await session.abortTransaction();
        await writeAudit(auditInput, "gm_affiliation_refused", decision.message, {
          code: decision.code,
          reason: decision.message,
          gameMasterId: gm?.userId,
        });
        return { success: false, code: decision.code, error: decision.message };
      }

      if (decision.kind === "already_affiliated") {
        await session.abortTransaction();
        return {
          success: true,
          created: false,
          alreadyAffiliated: true,
          gameMasterId: gm!.userId,
          referralId: activeRow ? String(activeRow._id) : undefined,
        };
      }

      const gmSub = gmDoc as unknown as { _id: unknown; userId: string; userEmail?: string; referralCode: string };

      // Reason: consent is checked only once the rules say a row WOULD be created, so an
      // idempotent repeat or a D1 refusal never asks for terms, and before any write, so a
      // refusal leaves nothing behind. Join GM always needs it; the referral link has no
      // dialog yet (s5.3) and is checked only when an id is actually supplied.
      let terms: { termsAcceptanceId: string; termsSlug: string; termsVersion: string } | undefined;
      if (input.channel === "chartvolt_join_gm" || input.termsAcceptanceId !== undefined) {
        const verdict = await verifyGmTermsAcceptance({
          acceptanceId: input.termsAcceptanceId,
          userId,
          gameMasterId: gmSub.userId,
        });
        if (!verdict.ok) {
          await session.abortTransaction();
          if (verdict.code === "error") {
            return { success: false, code: "error", error: verdict.message };
          }
          await writeAudit(auditInput, "gm_affiliation_refused", verdict.message, {
            code: verdict.code,
            reason: verdict.message,
            gameMasterId: gmSub.userId,
            termsAcceptanceId: input.termsAcceptanceId,
          });
          return { success: false, code: verdict.code, error: verdict.message };
        }
        terms = verdict;
      }

      const now = new Date();

      if (decision.endPrevious && activeRow) {
        await UserReferral.updateOne(
          { _id: activeRow._id, isActive: true },
          { $set: { isActive: false, endedAt: now, endedReason: decision.endPrevious } },
          { session },
        );
        const previousSub = activeGmDoc as { _id?: unknown } | undefined;
        if (previousSub?._id) {
          await GameMasterSubscription.updateOne(
            { _id: previousSub._id, activeReferredUsers: { $gt: 0 } },
            { $inc: { activeReferredUsers: -1 } },
            { session },
          );
        }
      }

      const [created] = await UserReferral.create(
        [
          {
            userId,
            userEmail: input.user.email,
            userName: input.user.name,
            gameMasterId: gmSub.userId,
            gameMasterEmail: gmSub.userEmail || "",
            referralCode: gmSub.referralCode,
            referredAt: now,
            signupIP: input.ipAddress || undefined,
            signupUserAgent: input.userAgent || undefined,
            isActive: true,
            // Reason: `source` has no schema default by design (s2.1) - the writer states
            // how the affiliation happened, permanently.
            source: input.channel,
            ...(terms
              ? {
                  termsAcceptanceId: terms.termsAcceptanceId,
                  termsSlug: terms.termsSlug,
                  termsVersion: terms.termsVersion,
                }
              : {}),
            affiliatedVia: {
              surface,
              ...(input.competitionId ? { competitionId: input.competitionId } : {}),
            },
          },
        ],
        { session },
      );

      const userUpdate = await db.collection("user").updateOne(
        userIdFilter(userId),
        {
          $set: {
            referredByGameMasterId: gmSub.userId,
            referredByReferralCode: gmSub.referralCode,
            referredAt: now,
          },
        },
        { session },
      );
      if (userUpdate.matchedCount === 0) {
        await session.abortTransaction();
        console.error(`❌ Affiliation: user ${userId} not found; nothing written`);
        return { success: false, code: "user_not_found", error: GENERIC_ERROR };
      }

      await GameMasterSubscription.updateOne(
        { _id: gmSub._id },
        { $inc: { totalReferredUsers: 1, activeReferredUsers: 1 } },
        { session },
      );

      await session.commitTransaction();

      const referralId = String(created._id);
      await writeAudit(
        auditInput,
        "gm_affiliation_created",
        `Affiliated to Game Master ${gm?.userName || gmSub.userId} (${input.channel})`,
        {
          gameMasterId: gmSub.userId,
          gameMasterName: gm?.userName,
          referralId,
          competitionId: input.competitionId,
          endedPrevious: decision.endPrevious,
        },
      );

      return {
        success: true,
        created: true,
        alreadyAffiliated: false,
        gameMasterId: gmSub.userId,
        referralId,
        endedPrevious: decision.endPrevious,
      };
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch {
        /* already aborted */
      }
      // Reason: a lost race is not a failure - the retry reads the winner's row and
      // decides again (idempotent success, or already_affiliated_other).
      if ((isDuplicateKey(error) || isTransientConflict(error)) && attempt < MAX_RETRIES) {
        continue;
      }
      console.error("❌ Affiliation failed:", error);
      return { success: false, code: "error", error: GENERIC_ERROR };
    } finally {
      await session.endSession();
    }
  }

  return { success: false, code: "error", error: GENERIC_ERROR };
}
