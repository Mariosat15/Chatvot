/**
 * What a competition CARD tells one viewer about a private Game Master contest
 * (Gamemaster Program v2, owner decision 30 Sep 2026: private contests are listed to every
 * signed-in player).
 *
 * A member (the creating Game Master, or a player affiliated to them) gets the ordinary card.
 * Anyone else gets the lobby gate's own answer - `joinable` ("Join GM to enter"), `locked`
 * (under another Game Master, D1), `unavailable` or `join_disabled` - so the card and the gate
 * the card links to cannot disagree. Reason: `getAffiliation` alone cannot tell locked from
 * joinable (an expired Game Master's affiliate may join a new one, D4); `decideAffiliation`
 * through the gate can.
 *
 * Seated players are not special-cased here: the card already knows `isUserIn` and shows the
 * seated state first (D5).
 *
 * Main app only; the admin app shows operators every contest (R42).
 */

import { getPrivateContestGate, type PrivateContestGateState } from "./private-contest-gate.service";
import { isPrivateContest } from "./private-contest-access.service";
import { canEnterPrivateContest, type ContestViewer } from "./visible-contests";

export type PrivateListingAccess = "member" | PrivateContestGateState;

export interface PrivateListingFacts {
  visibility?: unknown;
  gameMasterId?: unknown;
}

export interface PrivateListingAnnotation {
  privateAccess?: PrivateListingAccess;
  privateGameMasterName?: string;
}

/**
 * Adds `privateAccess` (and the Game Master's name) to every private contest in the list.
 * Public contests are returned untouched. Never throws - the gate itself fails to `unavailable`.
 */
export async function annotatePrivateContests<T extends PrivateListingFacts>(
  contests: T[],
  viewer: ContestViewer | null,
): Promise<(T & PrivateListingAnnotation)[]> {
  // Reason: one gate resolution per distinct Game Master, not per contest - a GM with twenty
  // private contests on one page costs the same few reads as one.
  const gates = new Map<string, ReturnType<typeof getPrivateContestGate>>();

  return Promise.all(
    contests.map(async (contest) => {
      if (!isPrivateContest(contest)) return contest;
      const gmId = typeof contest.gameMasterId === "string" ? contest.gameMasterId : "";
      const viewerId = viewer?.userId ?? null;
      if (
        (viewerId && gmId === viewerId) ||
        canEnterPrivateContest(contest, viewer?.affiliatedGameMasterId)
      ) {
        return { ...contest, privateAccess: "member" as const };
      }
      let pending = gates.get(gmId);
      if (!pending) {
        pending = getPrivateContestGate({ gameMasterId: gmId, viewerUserId: viewerId });
        gates.set(gmId, pending);
      }
      const gate = await pending;
      return {
        ...contest,
        privateAccess: gate.state,
        privateGameMasterName: gate.gameMasterName,
      };
    }),
  );
}
