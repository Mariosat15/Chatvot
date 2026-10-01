/**
 * Whose PRIVATE contests may this player see and enter? The one answer, read by the entry gate,
 * the lobby gate (`canViewContest`) and the contest list (`resolveContestViewer`), so the three
 * cannot disagree about one player (R121).
 *
 * A player counts as a member of a Game Master's private contests only when ALL hold:
 * 1. an ACTIVE `UserReferral` row exists for them (the row `affiliate()` decides against);
 * 2. that row carries an accepted Affiliate Terms id - the same "accepted" rule the GM and admin
 *    referral views use (`referral-read-model.ts`), so a link those pages hide grants nothing;
 * 3. that row's Game Master has not left for good - `previousAffiliationEnd`, the D4 rule that
 *    already frees a player whose Game Master expired or was deleted.
 *
 * Reason this is NOT `getAffiliation`: that function answers "who earns from this player" and
 * deliberately counts an unaccepted row (an admin move carries no terms over, D6) and the
 * `user.referredByGameMasterId` fallback. Private-contest access used it, so a player the GM and
 * admin pages showed as Ended could still open and enter the contest while the gate, deciding
 * "already your GM", offered no Join GM button. Membership is a stricter question than earnings.
 *
 * Never reads the user-document fallback: a fallback has no referral row and so no consent.
 */

import { connectToDatabase } from "@/database/mongoose";
import UserReferral from "@/database/models/user-referral.model";
import { findSubscriptionForUser, toFacts } from "./affiliation.service";
import { previousAffiliationEnd } from "./affiliation-rules";

export function hasAcceptedAffiliateTerms(row: { termsAcceptanceId?: unknown } | null | undefined): boolean {
  return typeof row?.termsAcceptanceId === "string" && row.termsAcceptanceId.trim() !== "";
}

/** The Game Master user id whose private contests this player may enter, or null. */
export async function getPrivateContestMembership(userId: string): Promise<string | null> {
  if (typeof userId !== "string" || userId.trim() === "") return null;
  await connectToDatabase();

  const row = await UserReferral.findOne({ userId, isActive: true })
    .select({ gameMasterId: 1, termsAcceptanceId: 1 })
    .lean<{ gameMasterId?: string; termsAcceptanceId?: unknown }>();
  if (!row || typeof row.gameMasterId !== "string" || row.gameMasterId === "") return null;
  if (!hasAcceptedAffiliateTerms(row)) return null;

  // Reason: D4 - an expired or deleted Game Master has ended the relationship even though the
  // row stays active until the player joins somebody else, so it no longer opens their contests.
  const gm = toFacts(await findSubscriptionForUser(row.gameMasterId));
  if (previousAffiliationEnd(gm) !== null) return null;
  return row.gameMasterId;
}
