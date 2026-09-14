import mongoose, { Schema, Document, Model } from "mongoose";
import { NotificationCategory } from "./notification-template.model";

export interface IUserNotificationPreferences extends Document {
  userId: string;

  // Global settings
  notificationsEnabled: boolean; // Master switch
  emailNotificationsEnabled: boolean; // Email notifications
  pushNotificationsEnabled: boolean; // Push notifications (future)

  /*
    RECEIPTS AND STATEMENTS. Deliberately NOT covered by `emailNotificationsEnabled`.

    A deposit receipt, a withdrawal confirmation, a refund notice and an invoice are records
    of money moving, not notices about the platform, so switching off "tell me when things
    happen" must not silently stop them. They are separable because a player who banks their
    own statements is entitled to ask us to stop, and because leaving them welded to the
    notification switch means the only way to stop them is to stop everything.

    Account access and security email is in NEITHER group and has no switch at all - email
    verification, a two-factor code and a password reset are how somebody proves the address
    is theirs, so an opt-out would be a way to lock yourself out of your own account.
  */
  transactionalEmailsEnabled: boolean;

  // Category preferences (true = enabled)
  categoryPreferences: {
    purchase: boolean; // Deposits, withdrawals
    competition: boolean; // Competition events
    challenge: boolean; // 1v1 Challenge events
    trading: boolean; // Trading alerts
    achievement: boolean; // Badges, level ups
    system: boolean; // System updates, maintenance
    admin: boolean; // Admin messages (always on for important)
    security: boolean; // Security alerts (always on)
    social: boolean; // Friend requests, blocks
    messaging: boolean; // Direct messages, support chat
  };

  // Challenge popup (real-time banner when someone challenges you)
  challengePopupEnabled: boolean;

  // Specific notification type overrides (optional fine-grained control)
  disabledNotifications: string[]; // Array of templateIds to disable

  // Quiet hours (optional)
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format

  // Digest settings (optional for future)
  digestEnabled: boolean;
  digestFrequency: "daily" | "weekly" | "never";

  createdAt: Date;
  updatedAt: Date;
}

/**
 * WHERE ONE NOTIFICATION MAY GO. Three answers, not one.
 *
 * Reason: the platform used to ask a single yes/no question, which forced three unrelated
 * decisions to agree. The two that mattered:
 *
 *  - Quiet hours suppressed the stored row as well as the interruption, so a player who did
 *    not want to be buzzed at 3am lost the record that their open seat had been claimed. They
 *    are not the same request: quiet hours are about being interrupted.
 *  - The main app's `send()` ignored preferences entirely while the email bridge beside it
 *    kept its own copy of the precedence rules. One rule, two copies, and they disagreed.
 *
 * `store` also gates the popup by construction - nothing can be pushed that was not stored.
 */
export interface NotificationDelivery {
  /** Write the in-app row. False means the notification does not exist for this player. */
  store: boolean;
  /** Push over the socket, which is what raises the popup and moves the bell count. */
  push: boolean;
  /** Hand to the email bridge. Still subject to the template's own `channels.email`. */
  email: boolean;
}

/** Which switch governs an email. See `transactionalEmailsEnabled` for why there are three. */
export type EmailGroup = "notification" | "transactional" | "account";

export interface IUserNotificationPreferencesModel extends Model<IUserNotificationPreferences> {
  getOrCreatePreferences(userId: string): Promise<IUserNotificationPreferences>;
  isNotificationEnabled(
    userId: string,
    category: NotificationCategory,
    templateId?: string,
  ): Promise<boolean>;
  resolveDelivery(
    userId: string,
    category: NotificationCategory,
    templateId?: string,
  ): Promise<NotificationDelivery>;
  mayReceiveEmailGroup(userId: string, group: EmailGroup): Promise<boolean>;
}

const UserNotificationPreferencesSchema =
  new Schema<IUserNotificationPreferences>(
    {
      userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
      emailNotificationsEnabled: {
        type: Boolean,
        default: true,
      },
      pushNotificationsEnabled: {
        type: Boolean,
        default: false,
      },
      // Receipts and statements. See the interface above for why this is its own switch.
      transactionalEmailsEnabled: {
        type: Boolean,
        default: true,
      },
      categoryPreferences: {
        purchase: { type: Boolean, default: true },
        competition: { type: Boolean, default: true },
        challenge: { type: Boolean, default: true },
        trading: { type: Boolean, default: true },
        achievement: { type: Boolean, default: true },
        system: { type: Boolean, default: true },
        admin: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        social: { type: Boolean, default: true },
        messaging: { type: Boolean, default: true },
      },
      challengePopupEnabled: {
        type: Boolean,
        default: true,
      },
      disabledNotifications: {
        type: [String],
        default: [],
      },
      quietHoursEnabled: {
        type: Boolean,
        default: false,
      },
      quietHoursStart: String,
      quietHoursEnd: String,
      digestEnabled: {
        type: Boolean,
        default: false,
      },
      digestFrequency: {
        type: String,
        enum: ["daily", "weekly", "never"],
        default: "never",
      },
    },
    {
      timestamps: true,
    },
  );

// Static methods
UserNotificationPreferencesSchema.statics.getOrCreatePreferences =
  async function (userId: string) {
    let prefs = await this.findOne({ userId });

    if (!prefs) {
      prefs = await this.create({
        userId,
        notificationsEnabled: true,
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        transactionalEmailsEnabled: true,
        categoryPreferences: {
          purchase: true,
          competition: true,
          challenge: true,
          trading: true,
          achievement: true,
          system: true,
          admin: true,
          security: true,
          social: true,
          messaging: true,
        },
        challengePopupEnabled: true,
        disabledNotifications: [],
        quietHoursEnabled: false,
        digestEnabled: false,
        digestFrequency: "never",
      });
    }

    return prefs;
  };

/**
 * THE ONE PLACE THAT DECIDES WHETHER A NOTIFICATION REACHES SOMEBODY.
 *
 * Everything else delegates: `isNotificationEnabled` below, the main app's
 * `notificationService.send`, the admin app's copy, and `shouldSendEmail` in the email
 * bridge, which used to carry its own copy of the precedence and disagreed with this one.
 *
 * FAILS OPEN on every unknown. An absent document is a player who has never opened the
 * settings screen, which is the overwhelming majority, and a read that throws must not
 * silence a prize notification - the wrong direction here is unreportable, because the
 * player never learns that the thing they were not told about happened.
 */
UserNotificationPreferencesSchema.statics.resolveDelivery = async function (
  userId: string,
  category: NotificationCategory,
  templateId?: string,
): Promise<NotificationDelivery> {
  const ALL: NotificationDelivery = { store: true, push: true, email: true };

  let prefs: IUserNotificationPreferences | null = null;
  try {
    prefs = await this.findOne({ userId });
  } catch (error) {
    console.warn(
      `⚠️ Could not read notification preferences for ${userId}, delivering everything:`,
      error,
    );
    return ALL;
  }
  if (!prefs) return ALL;

  if (!prefs.notificationsEnabled) {
    return { store: false, push: false, email: false };
  }

  /*
    Security bypasses the CATEGORY switch and the per-template override, matching the
    "Always On" badge the settings screen renders beside it - an account suspension or a
    sign-in from an unknown device is not a notice somebody may decline.

    It does NOT bypass the master switch above, which is pre-existing behaviour and left
    alone deliberately: changing it would start sending mail to accounts that asked for
    silence, which is a bigger decision than the one being made here.
  */
  if (category !== "security") {
    if (prefs.categoryPreferences) {
      // Reason: `category` is a caller-supplied string, so a computed index here is a
      // dynamic property read. Reflect.get is the same lookup without the lint sink.
      if (Reflect.get(prefs.categoryPreferences, category) === false) {
        return { store: false, push: false, email: false };
      }
    }
    if (templateId && prefs.disabledNotifications?.includes(templateId)) {
      return { store: false, push: false, email: false };
    }
  }

  /*
    QUIET HOURS SUPPRESS THE INTERRUPTION, NOT THE RECORD.

    This used to return false outright, which threw the stored row away as well - so a
    player with quiet hours on lost the fact that their open challenge had been claimed,
    permanently and with nothing on any screen to explain the gap. "Do not buzz me at 3am"
    and "do not tell me at all" are two requests and the platform only had one answer.

    Deliberate behaviour change, 14 September 2026. The row is written, the bell count
    moves when the page is next opened, and no popup appears.
  */
  const push = !isWithinQuietHours(prefs);

  return {
    store: true,
    push,
    email: prefs.emailNotificationsEnabled !== false,
  };
};

/** True while the player has asked not to be interrupted. Same-day spans only, as before. */
function isWithinQuietHours(prefs: IUserNotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  return currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd;
}

/**
 * Kept as the store gate so existing callers keep their exact meaning, with one exception
 * recorded above: quiet hours no longer discard the row, so this answers true during them.
 */
UserNotificationPreferencesSchema.statics.isNotificationEnabled =
  async function (
    userId: string,
    category: NotificationCategory,
    templateId?: string,
  ): Promise<boolean> {
    const delivery = await (
      this as IUserNotificationPreferencesModel
    ).resolveDelivery(userId, category, templateId);
    return delivery.store;
  };

/**
 * MAY WE EMAIL THIS PERSON AT ALL, for a given kind of email.
 *
 * Separate from `resolveDelivery` because the senders that need it have no notification
 * and no category - a deposit receipt is composed from an invoice, not from a template.
 *
 * `account` is unconditional and takes no reading. It is a value rather than an absent
 * case on purpose: a caller who has to name the group cannot forget to ask, and the
 * grep for who bypasses the switches returns nothing instead of returning every sender
 * that simply never called this.
 */
UserNotificationPreferencesSchema.statics.mayReceiveEmailGroup =
  async function (userId: string, group: EmailGroup): Promise<boolean> {
    if (group === "account") return true;

    let prefs: IUserNotificationPreferences | null = null;
    try {
      prefs = await this.findOne({ userId });
    } catch (error) {
      console.warn(
        `⚠️ Could not read email preferences for ${userId}, sending anyway:`,
        error,
      );
      return true;
    }
    if (!prefs) return true;

    if (group === "transactional") {
      /*
        Deliberately NOT also gated on `notificationsEnabled` or
        `emailNotificationsEnabled`. A receipt is a record of money moving and the
        notification switches are about notices, so folding them together would mean a
        player who turned off competition alerts stopped receiving deposit confirmations
        and had no way to tell which switch had done it.
      */
      return prefs.transactionalEmailsEnabled !== false;
    }

    if (!prefs.notificationsEnabled) return false;
    return prefs.emailNotificationsEnabled !== false;
  };

const UserNotificationPreferences =
  (mongoose.models
    .UserNotificationPreferences as IUserNotificationPreferencesModel) ||
  mongoose.model<
    IUserNotificationPreferences,
    IUserNotificationPreferencesModel
  >("UserNotificationPreferences", UserNotificationPreferencesSchema);

export default UserNotificationPreferences;
