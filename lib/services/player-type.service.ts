import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/database/mongoose";
import { rolesPromotedBy, type PlayerActivity } from "@/lib/utils/player-type";

/**
 * Upgrades a player to `both` the first time they do the other kind of thing:
 * a gamer placing a trade, or a trader starting a game round.
 *
 * Reason: one conditional `updateOne` rather than read-then-write. The filter
 * names the only roles this activity may promote, so a Game Master, a staff
 * account or a player already on `both` is never touched, and two concurrent
 * calls cannot race each other into a wrong value. After the first promotion
 * every later call matches nothing and costs one indexed query.
 *
 * Never throws: it runs after a trade or a round has already succeeded, and a
 * failed label update must not turn that success into an error.
 */
export async function recordPlayerActivity(
  userId: string,
  activity: PlayerActivity,
): Promise<void> {
  if (!userId) return;
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return;

    // Reason: Better Auth's MongoDB adapter keeps the identity in `_id`, while some
    // older rows also carry `id` (R68). Match every shape the user may be stored under.
    const identity: Record<string, unknown>[] = [{ id: userId }, { _id: userId }];
    if (ObjectId.isValid(userId)) identity.push({ _id: new ObjectId(userId) });

    const promotable = rolesPromotedBy(activity);
    const roleClauses: Record<string, unknown>[] = [];
    for (const role of promotable) {
      if (role === null) {
        // Missing has three shapes: absent, null and "".
        roleClauses.push({ role: { $exists: false } }, { role: null }, { role: "" });
      } else {
        roleClauses.push({ role });
      }
    }

    const result = await db.collection("user").updateOne(
      { $and: [{ $or: identity }, { $or: roleClauses }] },
      { $set: { role: "both", playerTypeUpgradedAt: new Date(), updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      console.log(`🔄 Player type: ${userId} is now "both" (first ${activity} activity)`);
    }
  } catch (error) {
    console.warn("⚠️ Could not update player type:", error);
  }
}
