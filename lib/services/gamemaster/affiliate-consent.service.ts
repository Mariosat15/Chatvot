/**
 * ONE consent answer for every Game Master terms question a player can be asked
 * (`External game plans/24` s5.6). The modal never needs to know which of the two it is
 * looking at; this service does, and dispatches to the writer that already owns it:
 *
 * - kind `claim`   - a referral-link sign-up still pending (`referral-claim.service.ts`).
 *                    Accept attaches the player through `affiliate()`; Decline leaves them
 *                    independent for good.
 * - kind `request` - a player already affiliated with no consent recorded, whether the Game
 *                    Master sent the terms or the row predates them (`gm-terms-request.service.ts`).
 *                    Accept stamps consent on the existing row; Decline leaves the affiliation
 *                    exactly as it was (owner decision "keep").
 *
 * Reason it does not reimplement either: both writers already carry the locks, audit rows and
 * refusals that make an answer safe. A third copy of "accept" would be the third writer of
 * an affiliation.
 *
 * Claim first: a pending claim is the more consequential question (nothing is attached yet),
 * and `decideClaimPrompt` lapses a claim whenever the player is already affiliated, so the two
 * kinds are never both open for one player.
 */

import { notificationService } from "@/lib/services/notification.service";
import { getPublicName } from "@/lib/utils/user-lookup";
import {
  acceptReferralClaim,
  declineReferralClaim,
  getReferralClaimPrompt,
  type ClaimUser,
} from "./referral-claim.service";
import { answerTermsRequest, getTermsRequestPrompt } from "./gm-terms-request.service";
import { GENERIC_ERROR, resolveTermsReminderNotifications, type RequestMeta } from "./gm-terms-request-shared";
import type { AffiliateConsentKind } from "@/lib/utils/affiliate-consent-kind";

export type { AffiliateConsentKind } from "@/lib/utils/affiliate-consent-kind";

export type AffiliateConsentPrompt =
  | { show: false }
  | { show: true; kind: AffiliateConsentKind; gameMasterId: string; gameMasterName: string };

export type AffiliateConsentDecision = "accept" | "decline";

export type AffiliateConsentResult =
  | { success: true; kind: AffiliateConsentKind; decision: AffiliateConsentDecision; gameMasterName: string }
  | { success: false; code: string; error: string; retryable: boolean };

export function isAffiliateConsentDecision(value: unknown): value is AffiliateConsentDecision {
  return value === "accept" || value === "decline";
}

/** Is there a question waiting for this player? Fails quiet - not shown this visit, asked next time. */
export async function getAffiliateConsentPrompt(user: ClaimUser): Promise<AffiliateConsentPrompt> {
  const claim = await getReferralClaimPrompt(user);
  if (claim.show) {
    return { show: true, kind: "claim", gameMasterId: claim.gameMasterId, gameMasterName: await getPublicName(claim.gameMasterId) };
  }
  const request = await getTermsRequestPrompt(user.id);
  if (request.show) {
    return { show: true, kind: "request", gameMasterId: request.gameMasterId, gameMasterName: await getPublicName(request.gameMasterId) };
  }
  return { show: false };
}

/**
 * Claim answers did not tell the Game Master before s5.6; the list now does (badges), and the
 * bell says so too, with the same template a terms-request answer already uses.
 */
async function notifyGameMasterOfClaimAnswer(
  gameMasterId: string | undefined,
  user: ClaimUser,
  decision: AffiliateConsentDecision,
): Promise<void> {
  if (!gameMasterId) return;
  try {
    await notificationService.send({
      userId: gameMasterId,
      templateId: "gm_terms_request_answered",
      variables: {
        // Reason: the Game Master is another player, so they see the username.
        playerName: await getPublicName(user.id),
        answer: decision === "accept" ? "accepted" : "declined",
        outcomeLine:
          decision === "accept"
            ? "They now play under you with consent recorded."
            : "They will not be added to your referrals and will not be asked again.",
      },
    });
  } catch (error) {
    console.warn("⚠️ affiliate-consent: Game Master notification failed", error);
  }
}

export async function answerAffiliateConsent(input: {
  user: ClaimUser;
  decision: unknown;
  termsAcceptanceId?: unknown;
  meta?: RequestMeta;
}): Promise<AffiliateConsentResult> {
  try {
    const { user, decision } = input;
    if (!isAffiliateConsentDecision(decision)) {
      return { success: false, code: "invalid_decision", error: "Choose accept or decline.", retryable: false };
    }
    const prompt = await getAffiliateConsentPrompt(user);
    if (!prompt.show) {
      return {
        success: false,
        code: "no_open_consent",
        error: "There are no Game Master terms waiting for your answer.",
        retryable: false,
      };
    }

    if (prompt.kind === "claim") {
      const result =
        decision === "accept"
          ? await acceptReferralClaim({ user, termsAcceptanceId: input.termsAcceptanceId, ...input.meta })
          : await declineReferralClaim({ user, ...input.meta });
      if (!result.success) return result;
      // Reason: a repeated Accept reports `already_affiliated` - nothing new to tell anybody.
      if (result.outcome !== "already_affiliated") {
        await notifyGameMasterOfClaimAnswer(result.gameMasterId ?? prompt.gameMasterId, user, decision);
      }
    } else {
      const result = await answerTermsRequest({
        user,
        action: decision,
        termsAcceptanceId: input.termsAcceptanceId,
        meta: input.meta,
      });
      if (!result.success) return { ...result, retryable: decision === "accept" };
    }

    await resolveTermsReminderNotifications(user.id);
    return { success: true, kind: prompt.kind, decision, gameMasterName: prompt.gameMasterName };
  } catch (error) {
    console.error("❌ affiliate-consent: answer failed", error);
    return { success: false, code: "error", error: GENERIC_ERROR, retryable: true };
  }
}
