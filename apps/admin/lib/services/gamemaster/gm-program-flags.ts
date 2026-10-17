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

/**
 * May Game Masters create private contests (`24` s10 step 5)?
 *
 * Fails CLOSED, like `isGmJoinEnabled`. It gates CREATION only: the entry guard and the
 * discovery filters never read it, so switching it off hides nothing already created and
 * exposes nothing either.
 */
export async function isGmPrivateContestsEnabled(): Promise<boolean> {
  try {
    await connectToDatabase();
    const doc = await WhiteLabel.findOne()
      .select({ gmPrivateContestsEnabled: 1 })
      .lean<{ gmPrivateContestsEnabled?: unknown }>();
    return doc?.gmPrivateContestsEnabled === true;
  } catch (error) {
    console.warn("⚠️ Could not read gmPrivateContestsEnabled; refusing private contests:", error);
    return false;
  }
}

/**
 * May Game Masters create Free Private (GM-funded) contests?
 *
 * Fails CLOSED, like the two switches above, and gates CREATION only: entry, settlement and
 * refunds of a funded contest already created never read it, so switching it off can never
 * strand a reserve or leave a sponsored seat unpaid.
 */
export async function isGmFreePrivateContestsEnabled(): Promise<boolean> {
  try {
    await connectToDatabase();
    const doc = await WhiteLabel.findOne()
      .select({ gmFreePrivateContestsEnabled: 1 })
      .lean<{ gmFreePrivateContestsEnabled?: unknown }>();
    return doc?.gmFreePrivateContestsEnabled === true;
  } catch (error) {
    console.warn("?? Could not read gmFreePrivateContestsEnabled; refusing funded contests:", error);
    return false;
  }
}
