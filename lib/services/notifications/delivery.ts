/**
 * Delivering a notification that has just been stored.
 *
 * Reason: the socket half lives in `notification-push.ts`, which is
 * dependency-free so it can be mirrored into `apps/admin`. Email cannot be:
 * the bridge and the user lookup it needs exist only in the main app. Keeping
 * the two apart is what stops the admin copy importing modules it does not
 * have, rather than the two drifting over which notifications get pushed.
 */

import {
  deliverPush,
  type PushableNotification,
} from "./notification-push";

export type DeliverableNotification = PushableNotification;

export interface DeliveryChannels {
  email?: boolean;
}

async function emailNotification(
  notification: DeliverableNotification,
): Promise<void> {
  const [{ getUserById }, { emailNotificationBridge }] = await Promise.all([
    // Reason: relative, not "@/". An admin route reaches this file through
    // worker/jobs, and inside that build "@/" resolves to apps/admin, where
    // the bridge does not exist. A relative path always finds the main app's
    // own module whichever root the alias points at.
    import("../../utils/user-lookup"),
    import("../email-notification-bridge"),
  ]);

  const user = await getUserById(notification.userId);
  if (!user?.email || user.email === "unknown") return;

  await emailNotificationBridge.notificationAlert(
    { userId: notification.userId, email: user.email, name: user.name },
    {
      category: notification.category,
      templateId: notification.templateId,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
    },
  );
}

/**
 * Fan a stored notification out to the socket and, when the template says so,
 * to email. Fire-and-forget on both channels, for the reason in
 * `notification-push.ts`.
 */
export function deliverNotification(
  notification: DeliverableNotification,
  channels: DeliveryChannels = {},
): void {
  deliverPush(notification);

  if (channels.email) {
    void emailNotification(notification).catch((error) => {
      console.warn("⚠️ Notification email failed:", error);
    });
  }
}
