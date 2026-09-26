/**
 * Pushing a stored notification to its owner the instant it is written.
 *
 * Reason: one seam for the whole lifecycle. Every notification the platform
 * writes travels through `notificationService.send`, which calls this, so a new
 * template — a new challenge state, a new competition event — reaches the
 * player's screen with no transport change and no case to add in the WebSocket
 * server.
 *
 * This POSTs to the socket server itself rather than going through
 * `messaging/websocket-notifier.ts`, and the reason is the mirror: `apps/admin`
 * has no copy of that file, so a notification an operator causes — cancelling a
 * challenge, say — would be stored and silently never pushed. Being
 * dependency-free is what lets this module be mirrored byte for byte into the
 * admin app, and a test pins the two copies together.
 */

// Server-to-server, so the internal HTTP address and never the public wss://.
const WEBSOCKET_SERVER_URL =
  process.env.WS_INTERNAL_URL ||
  process.env.WEBSOCKET_INTERNAL_URL ||
  "http://localhost:3003";

export interface PushableNotification {
  _id: unknown;
  userId: string;
  templateId?: string;
  type?: string;
  category?: string;
  title: string;
  message: string;
  icon?: string;
  color?: string;
  priority?: string;
  actionUrl?: string;
  actionText?: string;
  createdAt?: string | Date;
}

export async function pushNotification(
  notification: PushableNotification,
): Promise<void> {
  const response = await fetch(
    `${WEBSOCKET_SERVER_URL}/internal/user-notification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: notification.userId,
        notification: {
          _id: String(notification._id),
          templateId: notification.templateId,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          icon: notification.icon,
          color: notification.color,
          priority: notification.priority,
          // Reason: the click target travels with the push, so the popup and
          // the bell's list send a player to the same place. Without it the
          // banner is an announcement nobody can act on.
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
          createdAt:
            notification.createdAt instanceof Date
              ? notification.createdAt.toISOString()
              : notification.createdAt || new Date().toISOString(),
        },
      }),
      // Short, because an API route must not wait on the socket server.
      signal: AbortSignal.timeout(2000),
    },
  );

  if (!response.ok) {
    console.warn(`⚠️ Notification push rejected with ${response.status}`);
  }
}

/**
 * Fire-and-forget form.
 *
 * Deliberately not awaited by callers: this sits between a player pressing a
 * button and the response they are waiting for, so a slow or absent socket
 * server must not delay or fail a write that has already committed.
 */
export function deliverPush(notification: PushableNotification): void {
  void pushNotification(notification).catch((error) => {
    console.warn("⚠️ Notification push failed:", error);
  });
}
