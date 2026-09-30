import { getAffiliation } from "./affiliation.service";
import type { ContestViewer } from "./visible-contests";

/**
 * Who is looking at a contest list, for `visibleContestsFilter`.
 *
 * Never throws. Reason: a failed affiliation read must degrade to "public contests only",
 * never to an error page on a list every player opens - and never to "show everything",
 * which is the direction that leaks (R117).
 */
export async function resolveContestViewer(
  userId: string | null | undefined,
): Promise<ContestViewer | null> {
  if (typeof userId !== "string" || userId.trim() === "") return null;
  try {
    const affiliation = await getAffiliation(userId);
    return { userId, affiliatedGameMasterId: affiliation?.gameMasterId ?? null };
  } catch (error) {
    console.warn("⚠️ Contest viewer affiliation read failed; showing public contests only:", error);
    return { userId, affiliatedGameMasterId: null };
  }
}
