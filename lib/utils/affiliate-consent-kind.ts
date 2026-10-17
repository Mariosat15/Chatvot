/**
 * The two kinds of Game Master terms question a player can be asked (`External game plans/24`
 * s5.6), shared by `affiliate-consent.service.ts` and `AffiliateTermsModal.tsx`.
 *
 * Model-free and client-reachable (R58) - it must never import a Mongoose model.
 */

export type AffiliateConsentKind = "claim" | "request";

/**
 * The ConsentRecord `affiliationSource` the terms dialog records for each kind. The claim value
 * is the one `affiliate()` verifies for a link sign-up, so it must not change.
 */
export const CONSENT_AFFILIATION_SOURCE = {
  claim: "gm_referral_link",
  request: "gm_terms_request",
} as const satisfies Readonly<Record<AffiliateConsentKind, string>>;

export function isAffiliateConsentKind(value: unknown): value is AffiliateConsentKind {
  return value === "claim" || value === "request";
}
