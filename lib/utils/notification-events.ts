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
