import { connectToDatabase } from "@/database/mongoose";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";

/**
 * Who is a Game Master right now, for the badge shown beside a player's name.
 *
 * The test is the same one `/api/gamemaster/status` applies to the signed-in user: a
 * subscription that is `active` and whose `endDate` has not passed. Reason: `status` alone
 * is not enough - the renewal job flips an expired row to `expired` on a schedule, so in
 * the gap a lapsed subscription still says `active` and the badge would outlive the role.
 */
export function activeGameMasterFilter(now: Date = new Date()) {
  return { status: "active", endDate: { $gt: now } };
}

/** Distinct user ids holding an active Game Master subscription. Never throws. */
export async function getActiveGameMasterIds(): Promise<string[]> {
  try {
    await connectToDatabase();
    const ids = await GameMasterSubscription.distinct(
      "userId",
      activeGameMasterFilter(),
    );
    return ids.map((id) => String(id));
  } catch (error) {
    console.warn("⚠️ [GM BADGE] Could not read active Game Masters:", error);
    return [];
  }
}
