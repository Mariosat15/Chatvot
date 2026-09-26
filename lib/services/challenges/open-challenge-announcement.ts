/**
 * Telling everybody else that a seat is open.
 *
 * An open challenge is the one challenge event with no addressee. Every other
 * notification in the `challenge` category is sent to a participant about their own
 * challenge; this one is sent to people who have no relationship to it yet, which is
 * exactly why it is the only one that can be a nuisance and the only one that needs an
 * audience decision of its own.
 *
 * Reason: `notificationService.send()` is per user, and a fan-out loop over it is one
 * `findOne` for the template, one for the preferences and one `create` per player. This
 * reads the template once, the preferences once, and writes one `insertMany` - but it
 * must reach the identical decision `send()` would, which is why the precedence rules
 * come from `resolveDeliveryFrom` rather than being restated here. A second copy of
 * "may this player be notified" is the shape behind `referenceId`, `failedReason` and
 * `challengeId`, and here it would read as a player's switch being ignored.
 */

import { connectToDatabase } from "@/database/mongoose";
import Notification from "@/database/models/notification.model";
import NotificationTemplate from "@/database/models/notification-template.model";
import UserNotificationPreferences, {
  DELIVERY_PREFERENCE_FIELDS,
  resolveDeliveryFrom,
  type DeliveryPreferenceFacts,
} from "@/database/models/user-notification-preferences.model";
import UserPresence from "@/database/models/user-presence.model";
import BlockedUser from "@/database/models/messaging/blocked-user.model";
import UserGamePreference from "@/database/models/games/user-game-preference.model";
import { replaceVariables } from "../notification.service";
import {
  deliverPush,
  type PushableNotification,
} from "../notifications/notification-push";

export const OPEN_CHALLENGE_TEMPLATE_ID = "challenge_open_posted";

/**
 * A ceiling on one announcement, not a page size.
 *
 * Reason: this is the only notification on the platform addressed to the whole player
 * base, so it is the only one where a single `insertMany` grows with the size of the
 * platform. The cap keeps one player creating a challenge from writing an unbounded
 * batch inside a request that has already debited their wallet. It is deliberately far
 * above any plausible audience today, so reaching it is a signal rather than a routine
 * truncation - and it is logged when it bites, because a silently truncated audience is
 * indistinguishable from nobody being interested.
 */
const MAX_ANNOUNCEMENT_RECIPIENTS = 5000;

export interface OpenChallengeAnnouncement {
  /** The document id, which is what `/challenges/[id]` resolves. */
  challengeId: string;
  challengerId: string;
  challengerName: string;
  /** The stored contest label, used to honour a per-game opt-out. */
  gameKey: string;
  /** What a player reads - "Trading", or the catalogue title's display name. */
  gameName: string;
  entryFee: number;
  winnerPrize: number;
}

/**
 * Who hears about it.
 *
 * Three exclusions, each for a different reason:
 *
 * - the creator, who already knows;
 * - anybody either side of a block, because an announcement is a message from one
 *   player to another however it is delivered, and a blocked player reappearing in
 *   somebody's bell is the block not working;
 * - anybody who has said they do not want to be challenged at this game, which is the
 *   same declaration the create route enforces. The gate deliberately does not read it
 *   for an open challenge - there is nobody to ask - but the audience question is the
 *   opposite way round and the declaration answers it exactly.
 *
 * The base set is players with a `UserPresence` document, which is every player who has
 * ever been online. The alternative is the whole user collection, which includes
 * accounts that have never signed in a second time and grows without bound.
 */
async function resolveAudience(
  announcement: OpenChallengeAnnouncement,
): Promise<string[]> {
  const [presence, blocks, optedOut] = await Promise.all([
    UserPresence.find({ acceptingChallenges: true })
      .select("userId")
      .limit(MAX_ANNOUNCEMENT_RECIPIENTS)
      .lean<{ userId: string }[]>(),
    BlockedUser.find({
      $or: [
        { blockerUserId: announcement.challengerId },
        { blockedUserId: announcement.challengerId },
      ],
    })
      .select("blockerUserId blockedUserId")
      .lean<{ blockerUserId: string; blockedUserId: string }[]>(),
    UserGamePreference.find({
      gameKey: announcement.gameKey,
      willingToBeChallenged: false,
    })
      .select("userId")
      .lean<{ userId: string }[]>(),
  ]);

  if (presence.length >= MAX_ANNOUNCEMENT_RECIPIENTS) {
    console.warn(
      `⚠️ Open-challenge announcement truncated at ${MAX_ANNOUNCEMENT_RECIPIENTS} recipients`,
    );
  }

  const excluded = new Set<string>([announcement.challengerId]);
  for (const block of blocks) {
    excluded.add(block.blockerUserId);
    excluded.add(block.blockedUserId);
  }
  for (const row of optedOut) {
    excluded.add(row.userId);
  }

  const audience: string[] = [];
  const seen = new Set<string>();
  for (const row of presence) {
    if (!row.userId || excluded.has(row.userId) || seen.has(row.userId)) {
      continue;
    }
    seen.add(row.userId);
    audience.push(row.userId);
  }
  return audience;
}

/**
 * Store one notification per eligible player and push the ones not in quiet hours.
 *
 * Fire-and-forget at the call site: this runs after two wallets have been committed, so
 * it must not be able to fail the creation of the challenge.
 */
export async function announceOpenChallenge(
  announcement: OpenChallengeAnnouncement,
): Promise<number> {
  await connectToDatabase();

  const template = await NotificationTemplate.findOne({
    templateId: OPEN_CHALLENGE_TEMPLATE_ID,
    isEnabled: true,
  });

  // Reason: seeding is `$setOnInsert`, so a template added to the defaults reaches an
  // existing database only when something runs the seed. `send()` retries the same way
  // for the same reason - without it, every deployment older than this template
  // announces nothing and reports success.
  let resolved = template;
  if (!resolved) {
    const { checkAndSeedTemplates } = await import(
      "@/lib/services/notification-seed.service"
    );
    await checkAndSeedTemplates();
    resolved = await NotificationTemplate.findOne({
      templateId: OPEN_CHALLENGE_TEMPLATE_ID,
      isEnabled: true,
    });
  }

  if (!resolved) {
    console.warn(
      `Notification template '${OPEN_CHALLENGE_TEMPLATE_ID}' not found or disabled`,
    );
    return 0;
  }

  const audience = await resolveAudience(announcement);
  if (audience.length === 0) return 0;

  const preferences = await UserNotificationPreferences.find({
    userId: { $in: audience },
  })
    .select(DELIVERY_PREFERENCE_FIELDS)
    .lean<(DeliveryPreferenceFacts & { userId: string })[]>();

  const byUser = new Map<string, DeliveryPreferenceFacts>();
  for (const row of preferences) {
    byUser.set(row.userId, row);
  }

  const variables: Record<string, string | number> = {
    challengeId: announcement.challengeId,
    challengerName: announcement.challengerName,
    gameName: announcement.gameName,
    entryFee: announcement.entryFee,
    winnerPrize: announcement.winnerPrize,
  };

  const title = replaceVariables(resolved.title, variables);
  const message = replaceVariables(resolved.message, variables);
  const actionUrl = resolved.actionUrl
    ? replaceVariables(resolved.actionUrl, variables)
    : undefined;

  const rows: Record<string, unknown>[] = [];
  const pushTo = new Set<string>();

  for (const userId of audience) {
    const delivery = resolveDeliveryFrom(
      // An absent preferences document means the player has never opened the settings
      // screen, which is not a decision - `resolveDeliveryFrom` reads it as "deliver".
      byUser.get(userId),
      resolved.category,
      resolved.templateId,
    );
    if (!delivery.store) continue;
    if (delivery.push) pushTo.add(userId);

    rows.push({
      userId,
      templateId: resolved.templateId,
      title,
      message,
      icon: resolved.icon,
      category: resolved.category,
      type: resolved.type,
      priority: resolved.priority,
      color: resolved.color,
      actionUrl,
      actionText: resolved.actionText,
      isRead: false,
      metadata: variables,
      isInstant: false,
    });
  }

  if (rows.length === 0) return 0;

  // Reason: the model is widened to `any` by the `models.X || model(...)` guard, so
  // `insertMany` gives back `unknown` rows. The shape asserted here is only what the
  // push needs; it is the same object `Notification.create` returns on the single-send
  // path, which is what `deliverPush` is already given there.
  const stored = (await Notification.insertMany(rows)) as unknown as {
    _id: unknown;
    userId: string;
    toObject(): PushableNotification;
  }[];

  /*
    The push is per recipient because the socket server is per recipient - every
    internal endpoint routes to `broadcastToParticipant`. A broadcast channel would be a
    second delivery path that no preference check stands in front of, which is precisely
    how a player who switched this off would still get the popup.
  */
  for (const row of stored) {
    if (!pushTo.has(row.userId)) continue;
    deliverPush({ ...row.toObject(), _id: row._id });
  }

  return rows.length;
}
