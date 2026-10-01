import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import {
  GM_AFFILIATION_TERMS_SLUG,
  decideGmTermsAcceptance,
  liveGmTermsFrom,
  type GmTermsRefusalCode,
  type LiveGmTermsFacts,
} from "./gm-terms-rules";

/**
 * Recording and verifying consent to the Gamemaster Affiliation Terms (`24` s5).
 *
 * Main app only, deliberately: nothing in `apps/admin` records or checks a player's consent,
 * and mirroring ahead of a caller is two copies agreeing while one runs (R42).
 *
 * Never throws. An acceptance is written only against a live, versioned page, and always
 * carries the Game Master it was given to - so it can later prove exactly what was agreed.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";
const AUDIT_COLLECTION = "customer_audit_trail";

export interface RecordGmTermsInput {
  user: { id: string; email: string; name?: string };
  gameMasterId: string;
  competitionId?: string;
  /** Which door the consent was given at. Labelling only; never widens what it proves. */
  affiliationSource?: GmConsentSource;
  ipAddress?: string;
  userAgent?: string;
}

// Reason: `gm_terms_request` labels consent given AFTER affiliation, when a Game Master sent
// the terms to an own referral who never recorded them (s5.5). Labelling only, like the rest.
export type GmConsentSource = "chartvolt_join_gm" | "gm_referral_link" | "gm_terms_request";
const CONSENT_SOURCES: ReadonlySet<string> = new Set<GmConsentSource>([
  "chartvolt_join_gm",
  "gm_referral_link",
  "gm_terms_request",
]);

/** Narrow a browser-supplied label; anything unknown reads as Join GM, the historical value. */
export function toGmConsentSource(value: unknown): GmConsentSource {
  return typeof value === "string" && CONSENT_SOURCES.has(value)
    ? (value as GmConsentSource)
    : "chartvolt_join_gm";
}

export type RecordGmTermsResult =
  | { success: true; acceptanceId: string; termsVersion: string }
  | {
      success: false;
      code: "invalid_input" | "gm_not_found" | "terms_unavailable" | "error";
      error: string;
    };

export type VerifyGmTermsResult =
  | { ok: true; termsAcceptanceId: string; termsSlug: string; termsVersion: string }
  | { ok: false; code: GmTermsRefusalCode | "error"; message: string };

const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** The live Game Master terms, or undefined when missing, inactive or unversioned (s5.4). */
export async function getLiveGmTerms(): Promise<
  (LiveGmTermsFacts & { title: string }) | undefined
> {
  const page = await SitePage.findOne({
    slug: GM_AFFILIATION_TERMS_SLUG,
    category: "action_terms",
  })
    .select("title version isActive")
    .lean<{ title?: string; version?: string; isActive?: boolean }>();
  const live = liveGmTermsFrom(page);
  return live ? { ...live, title: page?.title || GM_AFFILIATION_TERMS_SLUG } : undefined;
}

async function writeAcceptedAudit(
  input: RecordGmTermsInput,
  acceptanceId: string,
  termsVersion: string,
  gameMasterName: string | undefined,
): Promise<void> {
  // Reason: best-effort after the write, as in affiliation.service - the audit row must
  // never be the reason a player's consent is lost. Raw insert into the admin model's
  // collection (`customer_audit_trail`, singular).
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection(AUDIT_COLLECTION).insertOne({
      customerId: input.user.id,
      customerEmail: input.user.email.toLowerCase(),
      customerName: input.user.name?.trim() || input.user.email.split("@")[0],
      action: "gm_terms_accepted",
      actionCategory: "assignment",
      description: `Accepted Gamemaster Affiliation Terms v${termsVersion} for ${gameMasterName || input.gameMasterId}`,
      performedBy: {
        employeeId: "system",
        employeeName: "Player (self-service)",
        employeeEmail: "system@gamemaster-affiliation",
        employeeRole: "system",
        department: "Game Master",
        isSuperAdmin: false,
      },
      metadata: {
        acceptanceId,
        termsSlug: GM_AFFILIATION_TERMS_SLUG,
        termsVersion,
        gameMasterId: input.gameMasterId,
        competitionId: input.competitionId,
      },
      timestamp: new Date(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.warn("⚠️ Gamemaster terms audit row not written:", error);
  }
}

/** Record that a player accepted the Game Master terms for one specific Game Master. */
export async function recordGmTermsAcceptance(
  input: RecordGmTermsInput,
): Promise<RecordGmTermsResult> {
  if (
    !isNonEmpty(input?.user?.id) ||
    !isNonEmpty(input.user.email) ||
    !isNonEmpty(input.gameMasterId) ||
    input.gameMasterId === input.user.id
  ) {
    return { success: false, code: "invalid_input", error: "Invalid Game Master terms request." };
  }

  try {
    await connectToDatabase();

    // Reason: the Game Master id comes from the browser. Checking it exists keeps junk ids
    // out of the consent record; whether they are JOINABLE is the affiliation service's
    // question, asked at join time, and answering it here would be a second copy.
    const gm = await GameMasterSubscription.findOne({ userId: input.gameMasterId })
      .select("userName")
      .lean<{ userName?: string }>();
    if (!gm) {
      return { success: false, code: "gm_not_found", error: "Game Master not found." };
    }

    const live = await getLiveGmTerms();
    if (!live) {
      return {
        success: false,
        code: "terms_unavailable",
        error: "Game Master terms are not available right now. Please try again later.",
      };
    }

    const acceptance = await TermsAcceptance.create({
      userId: input.user.id,
      termsSlug: GM_AFFILIATION_TERMS_SLUG,
      termsTitle: live.title,
      termsVersion: live.version,
      context: {
        gameMasterId: input.gameMasterId,
        affiliationSource: toGmConsentSource(input.affiliationSource),
        ...(isNonEmpty(input.competitionId) ? { competitionId: input.competitionId } : {}),
      },
      ipAddress: input.ipAddress || "",
      userAgent: input.userAgent || "",
      acceptedAt: new Date(),
    });

    const acceptanceId = String(acceptance._id);
    await writeAcceptedAudit(input, acceptanceId, live.version, gm.userName);
    return { success: true, acceptanceId, termsVersion: live.version };
  } catch (error) {
    console.error("❌ Recording Gamemaster terms acceptance failed:", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}

/**
 * Does this acceptance id prove consent to join THIS Game Master under the CURRENT wording?
 * Called by `affiliate()` on BOTH channels (Join GM, and the referral link since s5.3)
 * before anything is written.
 */
export async function verifyGmTermsAcceptance(input: {
  acceptanceId: string | undefined;
  userId: string;
  gameMasterId: string;
  now?: Date;
}): Promise<VerifyGmTermsResult> {
  try {
    await connectToDatabase();
    const live = await getLiveGmTerms();

    let acceptance = null;
    if (isNonEmpty(input.acceptanceId) && mongoose.Types.ObjectId.isValid(input.acceptanceId)) {
      acceptance = await TermsAcceptance.findById(input.acceptanceId).lean<{
        userId: string;
        termsSlug: string;
        termsVersion?: string;
        context?: { gameMasterId?: string };
        acceptedAt: Date;
      }>();
    }

    const decision = decideGmTermsAcceptance({
      userId: input.userId,
      gameMasterId: input.gameMasterId,
      live,
      acceptance: acceptance
        ? {
            userId: acceptance.userId,
            termsSlug: acceptance.termsSlug,
            termsVersion: acceptance.termsVersion,
            gameMasterId: acceptance.context?.gameMasterId,
            acceptedAt: acceptance.acceptedAt,
          }
        : null,
      now: input.now ?? new Date(),
    });
    if (!decision.ok) return decision;

    return {
      ok: true,
      termsAcceptanceId: String(input.acceptanceId),
      termsSlug: GM_AFFILIATION_TERMS_SLUG,
      termsVersion: live!.version,
    };
  } catch (error) {
    console.error("❌ Verifying Gamemaster terms acceptance failed:", error);
    return { ok: false, code: "error", message: GENERIC_ERROR };
  }
}
