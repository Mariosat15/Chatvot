import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";

/**
 * Is the Gamemaster leaderboard and Join GM switched on (`24` s10 step 4)?
 *
 * Fails CLOSED: only a stored `true` opens it. Reason: this switch gates a permanent,
 * money-attributing action, so a missing settings document, a failed read or a bad edit
 * storing `"true"` as a string must keep the feature dark rather than launch it.
 */
export async function isGmJoinEnabled(): Promise<boolean> {
  try {
    await connectToDatabase();
    const doc = await WhiteLabel.findOne().select({ gmJoinEnabled: 1 }).lean<{ gmJoinEnabled?: unknown }>();
    return doc?.gmJoinEnabled === true;
  } catch (error) {
    console.warn("⚠️ Could not read gmJoinEnabled; treating Join GM as switched off:", error);
    return false;
  }
}
