/**
 * Gamemaster affiliation terms - the pure rules (`External game plans/24` s5).
 *
 * Model-free by requirement: `components/ActionTermsDialog.tsx` is `"use client"` and imports
 * the slug from here (R58), so this file must never import a Mongoose model.
 *
 * What an acceptance proves: THIS player agreed to THIS Game Master under THIS wording,
 * recently. Every clause is checked, because each one missing is a different way to join a
 * Game Master on consent given to something else.
 */

export const GM_AFFILIATION_TERMS_SLUG = "terms-gamemaster-affiliation";

/**
 * How long an acceptance stays usable for a join.
 * Reason: the acceptance is the consent for one join the player is about to make, not a
 * standing permission - an id replayed a week later is consent to a decision nobody is
 * making any more.
 */
export const GM_TERMS_ACCEPTANCE_MAX_AGE_MS = 30 * 60 * 1000;

/** Clock skew tolerated for an acceptance stamped slightly "in the future". */
const FUTURE_SKEW_MS = 60 * 1000;

export type GmTermsRefusalCode = "terms_unavailable" | "terms_not_accepted" | "terms_outdated";

/** The live terms page. `undefined` means missing, inactive or unversioned. */
export interface LiveGmTermsFacts {
  version: string;
}

export interface GmTermsAcceptanceFacts {
  userId: string;
  termsSlug: string;
  termsVersion?: string;
  gameMasterId?: string;
  acceptedAt: Date;
}

export type GmTermsDecision =
  | { ok: true }
  | { ok: false; code: GmTermsRefusalCode; message: string };

/**
 * A page is usable for consent only while it is active AND carries a version.
 * Reason: fail closed (s5.4). An unversioned page cannot say which wording was agreed to,
 * and a deactivated one is an operator saying "stop taking this consent" - serving the
 * built-in text instead would record consent to words the operator withdrew.
 */
export function liveGmTermsFrom(
  page: { isActive?: boolean; version?: unknown } | null | undefined,
): LiveGmTermsFacts | undefined {
  if (!page || page.isActive !== true) return undefined;
  if (typeof page.version !== "string" || page.version.trim() === "") return undefined;
  return { version: page.version };
}

export function decideGmTermsAcceptance(input: {
  userId: string;
  gameMasterId: string;
  live: LiveGmTermsFacts | undefined;
  acceptance: GmTermsAcceptanceFacts | null | undefined;
  now: Date;
}): GmTermsDecision {
  const { userId, gameMasterId, live, acceptance, now } = input;

  if (!live) {
    return {
      ok: false,
      code: "terms_unavailable",
      message: "Game Master terms are not available right now. Please try again later.",
    };
  }

  const notAccepted: GmTermsDecision = {
    ok: false,
    code: "terms_not_accepted",
    message: "Please accept the Game Master terms before joining.",
  };
  if (!acceptance) return notAccepted;
  // Reason: all three identify WHAT was agreed to. An acceptance for another player, another
  // slug or another Game Master is a real document proving nothing about this join.
  if (acceptance.userId !== userId) return notAccepted;
  if (acceptance.termsSlug !== GM_AFFILIATION_TERMS_SLUG) return notAccepted;
  if (acceptance.gameMasterId !== gameMasterId) return notAccepted;

  const outdated: GmTermsDecision = {
    ok: false,
    code: "terms_outdated",
    message: "The Game Master terms have changed or your acceptance expired. Please accept them again.",
  };
  if (acceptance.termsVersion !== live.version) return outdated;

  const acceptedAt = acceptance.acceptedAt instanceof Date ? acceptance.acceptedAt.getTime() : NaN;
  if (!Number.isFinite(acceptedAt)) return outdated;
  const age = now.getTime() - acceptedAt;
  if (age > GM_TERMS_ACCEPTANCE_MAX_AGE_MS || age < -FUTURE_SKEW_MS) return outdated;

  return { ok: true };
}

/**
 * Replace `{{name}}` placeholders in terms copy.
 * Reason: the Game Master's name is user-controlled, so HTML sections get it escaped - the
 * dialog renders those with `dangerouslySetInnerHTML`. Text sections are React-escaped
 * already. An unknown placeholder is left visible rather than blanked, so a typo in the
 * operator's copy shows up instead of silently deleting words from a consent document.
 */
export function interpolateTermsText(
  text: string,
  variables: Readonly<Record<string, string>> | undefined,
  html: boolean,
): string {
  if (!variables || typeof text !== "string") return text;
  const known = new Map(Object.entries(variables));
  return text.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
    const value = known.get(key);
    if (value === undefined) return match;
    return html ? escapeHtml(value) : value;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
