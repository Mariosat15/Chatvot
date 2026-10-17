import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import Competition from "@/database/models/trading/competition.model";
import { liveGmTermsFrom } from "./gm-terms-rules";
import {
  FREE_PRIVATE_TERMS_SLUG,
  decideFreePrivateTermsAcceptance,
  type FreePrivateTermsDecision,
} from "./free-private-terms-rules";

/**
 * Recording and verifying consent to the Free Private Competition Terms.
 *
 * Main app only: `apps/admin` neither records nor checks a player's consent (R42).
 * Never throws. The Game Master id written into the acceptance is read from the stored
 * competition, never from the browser - otherwise a player could record consent naming
 * any Game Master and the record would prove nothing about who sponsored the entry.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

type ClientSession = mongoose.mongo.ClientSession;

export type RecordFreePrivateTermsResult =
  | { success: true; acceptanceId: string; termsVersion: string }
  | {
      success: false;
      code: "invalid_input" | "not_funded" | "terms_unavailable" | "error";
      error: string;
    };

/** The live page version; undefined when missing, inactive or unversioned (fail closed). */
export async function getLiveFreePrivateTerms(): Promise<
  { version: string; title: string } | undefined
> {
  const page = await SitePage.findOne({
    slug: FREE_PRIVATE_TERMS_SLUG,
    category: "action_terms",
  })
    .select("title version isActive")
    .lean<{ title?: string; version?: string; isActive?: boolean }>();
  // Reason: the same "active AND versioned" rule as the Game Master terms - reused, not
  // restated, so the two consent pages cannot disagree about what counts as live.
  const live = liveGmTermsFrom(page);
  return live ? { version: live.version, title: page?.title || FREE_PRIVATE_TERMS_SLUG } : undefined;
}

export async function recordFreePrivateTermsAcceptance(input: {
  user: { id: string };
  competitionId: unknown;
  ipAddress?: string;
  userAgent?: string;
}): Promise<RecordFreePrivateTermsResult> {
  const competitionId = input.competitionId;
  if (
    typeof input?.user?.id !== "string" ||
    typeof competitionId !== "string" ||
    !mongoose.Types.ObjectId.isValid(competitionId)
  ) {
    return { success: false, code: "invalid_input", error: "Invalid competition." };
  }

  try {
    await connectToDatabase();
    const competition = await Competition.findById(competitionId)
      .select("fundingMode visibility gameMasterId")
      .lean<{ fundingMode?: string; visibility?: string; gameMasterId?: string }>();
    if (
      !competition ||
      competition.fundingMode !== "gm_funded" ||
      competition.visibility !== "gm_private" ||
      typeof competition.gameMasterId !== "string"
    ) {
      return {
        success: false,
        code: "not_funded",
        error: "This competition is not funded by a Game Master.",
      };
    }

    const live = await getLiveFreePrivateTerms();
    if (!live) {
      return {
        success: false,
        code: "terms_unavailable",
        error: "Free Private Competition terms are not available right now. Please try again later.",
      };
    }

    const acceptance = await TermsAcceptance.create({
      userId: input.user.id,
      termsSlug: FREE_PRIVATE_TERMS_SLUG,
      termsTitle: live.title,
      termsVersion: live.version,
      context: { gameMasterId: competition.gameMasterId, competitionId },
      ipAddress: input.ipAddress || "",
      userAgent: input.userAgent || "",
      acceptedAt: new Date(),
    });
    return { success: true, acceptanceId: String(acceptance._id), termsVersion: live.version };
  } catch (error) {
    console.error("❌ Recording Free Private terms acceptance failed:", error);
    return { success: false, code: "error", error: GENERIC_ERROR };
  }
}

/**
 * Has this player accepted the CURRENT Free Private terms for THIS competition and its
 * Game Master? Called inside the entry transaction, before any money moves.
 */
export async function verifyFreePrivateTermsAcceptance(
  input: { userId: string; competitionId: string; gameMasterId: string },
  session?: ClientSession,
): Promise<FreePrivateTermsDecision> {
  const live = await getLiveFreePrivateTerms();
  const acceptance = await TermsAcceptance.findOne({
    userId: input.userId,
    termsSlug: FREE_PRIVATE_TERMS_SLUG,
    "context.competitionId": input.competitionId,
  })
    .sort({ acceptedAt: -1 })
    .session(session ?? null)
    .lean<{
      userId: string;
      termsSlug: string;
      termsVersion?: string;
      context?: { gameMasterId?: string; competitionId?: string };
    }>();

  return decideFreePrivateTermsAcceptance({
    userId: input.userId,
    gameMasterId: input.gameMasterId,
    competitionId: input.competitionId,
    liveVersion: live?.version,
    acceptance: acceptance
      ? {
          userId: acceptance.userId,
          termsSlug: acceptance.termsSlug,
          termsVersion: acceptance.termsVersion,
          gameMasterId: acceptance.context?.gameMasterId,
          competitionId: acceptance.context?.competitionId,
        }
      : null,
  });
}
