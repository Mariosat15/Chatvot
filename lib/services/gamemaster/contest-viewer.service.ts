import { getPrivateContestMembership } from "./private-contest-membership.service";
import type { ContestViewer } from "./visible-contests";

/**
 * Who is looking at a contest list, for `visibleContestsFilter`.
 *
 * Never throws. Reason: a failed affiliation read must degrade to "public contests only",
 * never to an error page on a list every player opens - and never to "show everything",
 * which is the direction that leaks (R117).
 *
 * Reason `affiliatedGameMasterId` is the private-contest MEMBERSHIP (R121), not the earnings
 * affiliation: the card marks a contest "member" from it, so an unaccepted or expired link read
 * here would show the ordinary entry button over a contest the entry gate then refuses.
 */
export async function resolveContestViewer(
  userId: string | null | undefined,
): Promise<ContestViewer | null> {
  if (typeof userId !== "string" || userId.trim() === "") return null;
  try {
    return { userId, affiliatedGameMasterId: await getPrivateContestMembership(userId) };
  } catch (error) {
    console.warn("⚠️ Contest viewer affiliation read failed; showing public contests only:", error);
    return { userId, affiliatedGameMasterId: null };
  }
}
