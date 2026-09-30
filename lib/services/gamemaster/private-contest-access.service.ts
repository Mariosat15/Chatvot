/**
 * Who may OPEN a `gm_private` contest's page and its per-contest data - the one answer
 * (Gamemaster Program v2 step 6, `External game plans/24-gamemaster-program-v2.md` s4, s6.2).
 *
 * The list readers already hide a private contest (step 5) and the entry gate already refuses a
 * seat (`canEnterPrivateContest`). What was left is somebody holding the direct link: the lobby,
 * the arena and the live standings answered anyone. Every one of those now asks this module, so
 * the page and the API cannot disagree about one viewer.
 *
 * Order, and every step is load-bearing:
 * 1. Not private - anybody.
 * 2. No signed-in viewer - nobody.
 * 3. The creating Game Master - always, or they cannot see the contest they just made.
 * 4. Already seated - always (owner decision D5). Eligibility is checked at ENTRY only, so a
 *    player whose Game Master changed later keeps seeing the contest they paid for.
 * 5. Otherwise the same `canEnterPrivateContest` the entry gate uses.
 *
 * Fails CLOSED: a database error answers "may not view". A wrongly hidden page is a player who
 * complains; a wrongly shown one leaks a private leaderboard.
 *
 * Main app only; the admin app shows operators every contest (R42).
 */

import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { getAffiliation } from "./affiliation.service";
import { resolveCompetitionVisibility } from "./competition-visibility";
import { canEnterPrivateContest } from "./visible-contests";

export interface ContestAccessFacts {
  visibility?: unknown;
  gameMasterId?: unknown;
}

export function isPrivateContest(contest: ContestAccessFacts): boolean {
  return resolveCompetitionVisibility(contest.visibility) === "gm_private";
}

/**
 * May this viewer see the contest? `isSeated` lets a caller that has already read the seat (the
 * lobby does, in its `Promise.all`) skip a second query; absent means "look it up".
 */
export async function canViewContest(
  competitionId: string,
  contest: ContestAccessFacts,
  userId: string | null | undefined,
  options: { isSeated?: boolean } = {},
): Promise<boolean> {
  if (!isPrivateContest(contest)) return true;
  if (typeof userId !== "string" || userId.trim() === "") return false;
  if (typeof contest.gameMasterId === "string" && contest.gameMasterId === userId) return true;

  try {
    const seated =
      options.isSeated ??
      (await CompetitionParticipant.exists({ competitionId: String(competitionId), userId })) !==
        null;
    if (seated) return true;

    const affiliation = await getAffiliation(userId);
    return canEnterPrivateContest(contest, affiliation?.gameMasterId);
  } catch (error) {
    console.warn("⚠️ Private contest access check failed; refusing:", error);
    return false;
  }
}

/**
 * The route form: loads only the two fields the rule reads. A contest that does not exist
 * answers `true`, deliberately - the route's own not-found handling then runs unchanged, so this
 * check never turns a 404 into something else or a 200 into a 404 for a public contest.
 */
export async function canViewContestById(
  competitionId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  try {
    await connectToDatabase();
    const contest = await Competition.findById(competitionId)
      .select({ visibility: 1, gameMasterId: 1 })
      .lean<ContestAccessFacts | null>();
    if (!contest) return true;
    return canViewContest(competitionId, contest, userId);
  } catch (error) {
    console.warn("⚠️ Private contest access lookup failed; refusing:", error);
    return false;
  }
}
