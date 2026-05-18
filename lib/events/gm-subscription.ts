/**
 * Client-side custom event used to invalidate any UI that depends on the
 * current user's Game Master subscription status (e.g. the GM Dashboard
 * link in `UserSidebar`).
 *
 * Reason: the sidebar fetches `/api/gamemaster/status` once on mount and
 * lives in the app layout, so it stays mounted across client-side
 * navigation. Without an explicit signal it would only refresh after a
 * full page reload — making a fresh GM purchase / renewal invisible in
 * the menu until the user F5s.
 *
 * Listeners should subscribe to `GM_SUBSCRIPTION_CHANGED` on `window`
 * inside a `useEffect`. Emitters should call `notifyGmSubscriptionChanged()`
 * after their mutation has succeeded.
 */

export const GM_SUBSCRIPTION_CHANGED = "gm-subscription-changed";

export function notifyGmSubscriptionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GM_SUBSCRIPTION_CHANGED));
}
