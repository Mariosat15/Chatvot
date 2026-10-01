/**
 * The browser event that relays a pushed notification from the socket listener
 * to everything else on the page that shows notifications.
 *
 * Reason: `useWebSocket` opens a connection per call site, so having the bell
 * subscribe to the socket itself would mean two connections per signed-in tab
 * for one stream of messages. `ChallengePopup` is mounted once in the signed-in
 * layout and already holds a connection, so it re-broadcasts locally instead.
 *
 * Model-free and client-reachable (R58) — it must never import a Mongoose model.
 */
export const NOTIFICATION_PUSH_EVENT = "chartvolt:notification-push";

export function broadcastNotificationPush(detail: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_PUSH_EVENT, { detail }),
  );
}

/**
 * Every templateId a "please answer the Game Master terms" reminder has been sent under
 * (`External game plans/24` s5.6). One list for the modal (which reopens on a push carrying
 * one), the bell (whose click opens the modal instead of navigating) and the server (which
 * marks them read once the player answers). `gm_terms_request` stays for rows sent before
 * `affiliate_terms_required` existed.
 */
export const AFFILIATE_TERMS_TEMPLATE_IDS: readonly string[] = [
  "affiliate_terms_required",
  "gm_terms_request",
];

export function isAffiliateTermsTemplate(templateId: unknown): boolean {
  return typeof templateId === "string" && AFFILIATE_TERMS_TEMPLATE_IDS.includes(templateId);
}

/** Asks the mounted `AffiliateTermsModal` to re-read the server and open if anything is waiting. */
export const AFFILIATE_TERMS_OPEN_EVENT = "chartvolt:affiliate-terms-open";

export function openAffiliateTermsModal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AFFILIATE_TERMS_OPEN_EVENT));
}
