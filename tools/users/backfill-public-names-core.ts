import type { mongo } from "mongoose";
import { resolvePublicName } from "@/lib/utils/username";
import {
  syncPublicNameCopies,
  type PublicNameSyncCounts,
} from "@/lib/services/username-sync.service";

/**
 * Rewrites the name copies already stored on other collections (leaderboard seats,
 * challenges, friendships, chats) to each player's public name.
 *
 * Reason: before usernames existed those copies were written with the REAL name, and
 * other players read them. New writes are already correct and a username change re-syncs
 * that player, but rows written before this change stay wrong until this runs once.
 *
 * Report-only unless `apply` is true. It never touches the `user` document itself and
 * never invents a username - a player without one keeps the generated public name until
 * they choose one.
 */

export interface PublicNameBackfillOutcome {
  users: number;
  withUsername: number;
  withoutUsername: number;
  synced: number;
  failed: number;
  totals: PublicNameSyncCounts;
}

export async function backfillPublicNames(
  db: mongo.Db,
  { apply }: { apply: boolean },
): Promise<PublicNameBackfillOutcome> {
  const outcome: PublicNameBackfillOutcome = {
    users: 0,
    withUsername: 0,
    withoutUsername: 0,
    synced: 0,
    failed: 0,
    totals: {},
  };
  const totals = new Map<string, number>();

  const cursor = db
    .collection("user")
    .find({}, { projection: { _id: 1, id: 1, username: 1 } });

  for await (const user of cursor) {
    outcome.users += 1;
    const hasUsername = typeof user.username === "string" && user.username.trim() !== "";
    if (hasUsername) outcome.withUsername += 1;
    else outcome.withoutUsername += 1;

    if (!apply) continue;

    // Reason: Better Auth keeps the identity in `_id`; `id` is only present on some
    // documents (R68), and the denormalized rows store the string form.
    const userId = typeof user.id === "string" && user.id ? user.id : String(user._id);
    const publicName = resolvePublicName({ username: user.username, id: userId });
    try {
      const counts = await syncPublicNameCopies(userId, publicName);
      outcome.synced += 1;
      for (const [key, value] of Object.entries(counts)) {
        totals.set(key, (totals.get(key) ?? 0) + value);
      }
    } catch (error) {
      outcome.failed += 1;
      console.warn(`⚠️ Could not sync stored names for user ${userId}:`, error);
    }
  }

  outcome.totals = Object.fromEntries(totals);
  return outcome;
}
