/**
 * The one place a Game Master referral link is spelled.
 *
 * Reason: two writers built `/register?ref=` and stored it on the subscription, but the only
 * sign-up route is `/sign-up` - there is no `/register` page and no rewrite. The Game Master's
 * own dashboard derives `/sign-up?ref=` from the browser, so the GM always saw a working link
 * while every admin screen showed the stored, dead one. A player following the copied link hit a
 * 404 and the referral was lost with nothing logged. Readers therefore rebuild the link from the
 * code rather than trusting the stored copy, which also repairs subscriptions written earlier.
 *
 * Model-free and mirrored into `apps/admin` byte for byte (pinned by a test).
 */

export const REFERRAL_SIGNUP_PATH = "/sign-up";

const FALLBACK_APP_URL = "https://app.chartvolt.com";

/** Base URL of the PLAYER app. `NEXT_PUBLIC_APP_URL` is the player app in both apps. */
export function playerAppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  return (configured || FALLBACK_APP_URL).replace(/\/+$/, "");
}

/** Full referral link for a code, or `""` when there is no code to link to. */
export function buildReferralLink(
  referralCode: string | null | undefined,
  baseUrl: string = playerAppBaseUrl(),
): string {
  if (typeof referralCode !== "string" || referralCode.trim() === "") return "";
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(referralCode.trim())}`;
}
