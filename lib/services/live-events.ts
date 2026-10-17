/**
 * Telling open screens that something changed, so they re-read it themselves.
 *
 * The event carries a topic and optionally an id - never the data. Reason: the
 * screen re-reads through the same loader that drew it, so the live view and
 * a fresh page load cannot disagree, and nothing private rides a broadcast.
 *
 * Dependency-free on purpose so it is mirrored byte for byte into `apps/admin`
 * (operators create, publish and cancel competitions there); a test pins the
 * two copies together. Same transport as `notification-push.ts`.
 */

const WEBSOCKET_SERVER_URL =
  process.env.WS_INTERNAL_URL ||
  process.env.WEBSOCKET_INTERNAL_URL ||
  "http://localhost:3003";

export type LiveTopic = "competitions" | "challenges" | "messages";

export interface LiveEventOptions {
  /** The record that changed, so a screen showing one record can ignore others. */
  id?: string;
  /** Who should hear it. Omitted means every signed-in player. */
  userIds?: readonly string[];
}

export async function publishLiveEventNow(
  topic: LiveTopic,
  options: LiveEventOptions = {},
): Promise<void> {
  const response = await fetch(`${WEBSOCKET_SERVER_URL}/internal/live-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      id: options.id,
      userIds: options.userIds ? [...options.userIds] : undefined,
    }),
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) {
    console.warn(`⚠️ Live event "${topic}" rejected with ${response.status}`);
  }
}

/**
 * Fire-and-forget form. Reason: callers are routes and workers that have
 * already committed a write; a slow or absent socket server must not delay or
 * fail them. Screens also re-check on a slow timer, so a lost signal only
 * means a later update, never a missing one.
 */
export function publishLiveEvent(
  topic: LiveTopic,
  options: LiveEventOptions = {},
): void {
  void publishLiveEventNow(topic, options).catch((error) => {
    console.warn(`⚠️ Live event "${topic}" failed:`, error);
  });
}
