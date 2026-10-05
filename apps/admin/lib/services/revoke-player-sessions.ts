import { ObjectId } from "mongodb";

/**
 * The one database call this helper makes.
 *
 * // Reason: typed structurally rather than as `Db` from "mongodb", because the admin app
 * resolves two copies of the driver's types (its own and the one bundled with Mongoose), and
 * `connection.db` from one is not assignable to `Db` from the other.
 */
interface SessionStore {
  collection(name: string): {
    deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount?: number }>;
  };
}

/**
 * Deletes every Better Auth session a player holds, so a lock or deactivation takes effect
 * on their next request rather than when their cookie expires.
 *
 * // Reason: the Better Auth MongoDB adapter may store `session.userId` as an ObjectId, and
 * `deleteMany({ userId: "<hex>" })` then matches nothing while reporting success - the same
 * silent miss as R68. Both shapes are matched.
 *
 * Never throws: revoking is belt-and-braces beside the live standing check, and an operator's
 * lock must still be recorded if the session collection is unreachable.
 */
export async function revokePlayerSessions(
  db: SessionStore | undefined | null,
  userId: string | undefined | null,
): Promise<number> {
  if (!db || !userId) return 0;
  try {
    const ids: unknown[] = [userId];
    if (/^[0-9a-fA-F]{24}$/.test(userId)) ids.push(new ObjectId(userId));
    const result = await db.collection("session").deleteMany({ userId: { $in: ids } });
    return result.deletedCount ?? 0;
  } catch (error) {
    console.warn("⚠️ [Sessions] Could not revoke player sessions:", error);
    return 0;
  }
}
