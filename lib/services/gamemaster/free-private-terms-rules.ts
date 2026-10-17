/**
 * Free Private Competition Terms - the pure rules.
 *
 * Model-free by requirement: `CompetitionEntryButton.tsx` is `"use client"` and imports the
 * slug from here (R58), so this file must never import a Mongoose model.
 *
 * What an acceptance proves: THIS player agreed to THIS wording for THIS Game Master-funded
 * competition. It is per competition rather than per Game Master, because each funded contest
 * is a separate sponsorship with its own conditions (no withdrawable credit, prizes only).
 */

export const FREE_PRIVATE_TERMS_SLUG = "terms-free-private-competition";

export type FreePrivateTermsRefusalCode =
  | "free_private_terms_unavailable"
  | "free_private_terms_required";

export interface FreePrivateTermsAcceptanceFacts {
  userId: string;
  termsSlug: string;
  termsVersion?: string;
  gameMasterId?: string;
  competitionId?: string;
}

export type FreePrivateTermsDecision =
  | { ok: true }
  | { ok: false; code: FreePrivateTermsRefusalCode; message: string };

export function decideFreePrivateTermsAcceptance(input: {
  userId: string;
  gameMasterId: string;
  competitionId: string;
  /** Live page version; undefined when missing, inactive or unversioned. */
  liveVersion: string | undefined;
  acceptance: FreePrivateTermsAcceptanceFacts | null | undefined;
}): FreePrivateTermsDecision {
  const { userId, gameMasterId, competitionId, liveVersion, acceptance } = input;

  // Reason: fail closed - consent to unversioned or withdrawn wording proves nothing.
  if (!liveVersion) {
    return {
      ok: false,
      code: "free_private_terms_unavailable",
      message: "Free Private Competition terms are not available right now. Please try again later.",
    };
  }

  const required: FreePrivateTermsDecision = {
    ok: false,
    code: "free_private_terms_required",
    message: "Please accept the Free Private Competition terms before joining.",
  };
  if (!acceptance) return required;
  // Reason: every clause identifies WHAT was agreed to; a real acceptance for another player,
  // contest, Game Master or wording proves nothing about this entry.
  if (acceptance.userId !== userId) return required;
  if (acceptance.termsSlug !== FREE_PRIVATE_TERMS_SLUG) return required;
  if (acceptance.competitionId !== competitionId) return required;
  if (acceptance.gameMasterId !== gameMasterId) return required;
  if (acceptance.termsVersion !== liveVersion) return required;
  return { ok: true };
}
