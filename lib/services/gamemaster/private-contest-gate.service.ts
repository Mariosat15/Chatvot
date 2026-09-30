/**
 * What the private-contest lobby gate offers a viewer who may not see the contest yet
 * (Gamemaster Program v2 step 6, `24` s6.2).
 *
 * The owner's requirement: a player who is not under the contest's Game Master sees
 * "Join GM to enter" instead of the entry button, accepts the terms, joins, and can then enter.
 *
 * Reason the state comes from `joinGmRowState`, the leaderboard's function, which in turn calls
 * `decideAffiliation` - the function `affiliate()` itself runs: a button offering a join the
 * server then refuses, or withholding one it would allow, is the "one rule, two copies" shape.
 */

import UserReferral from "@/database/models/user-referral.model";
import { findSubscriptionForUser, toFacts } from "./affiliation.service";
import type { AffiliationGameMasterFacts } from "./affiliation-rules";
import { isGmJoinEnabled } from "./gm-program-flags";
import { joinGmRowState } from "./gm-leaderboard-rules";

export type PrivateContestGateState =
  /** Show "Join GM to enter". */
  | "joinable"
  /** Affiliated to a different Game Master - only an admin can move them (D1). */
  | "locked"
  /** The contest's Game Master is paused, leaving or gone (D7), or the join failed to resolve. */
  | "unavailable"
  /** The platform Join GM switch is off. */
  | "join_disabled"
  /** Not signed in. */
  | "signed_out";

export interface PrivateContestGate {
  state: PrivateContestGateState;
  gameMasterName?: string;
  /** The Game Master's USER id - what the terms dialog records (probe 57). */
  gameMasterUserId?: string;
  /** The SUBSCRIPTION id - what the join URL carries. */
  subscriptionId?: string;
  /** The name of the Game Master a locked player already belongs to. */
  currentGameMasterName?: string;
}

export async function getPrivateContestGate(input: {
  gameMasterId: unknown;
  viewerUserId: string | null | undefined;
}): Promise<PrivateContestGate> {
  const gmUserId = typeof input.gameMasterId === "string" ? input.gameMasterId : "";
  try {
    const subscription = gmUserId ? await findSubscriptionForUser(gmUserId) : null;
    const facts = toFacts(subscription);
    const base: PrivateContestGate = {
      state: "unavailable",
      gameMasterName: facts?.userName,
      gameMasterUserId: gmUserId || undefined,
    };
    if (!subscription || !facts) return base;
    if (typeof input.viewerUserId !== "string" || input.viewerUserId.trim() === "") {
      return { ...base, state: "signed_out" };
    }
    if (!(await isGmJoinEnabled())) return { ...base, state: "join_disabled" };

    // Reason: the ACTIVE referral row only, the row `affiliate()` decides against.
    const activeRow = await UserReferral.findOne({ userId: input.viewerUserId, isActive: true })
      .select({ gameMasterId: 1 })
      .lean<{ gameMasterId: string }>();
    const activeGameMasterId = activeRow?.gameMasterId;
    const activeGameMaster: AffiliationGameMasterFacts | undefined = activeGameMasterId
      ? toFacts(await findSubscriptionForUser(activeGameMasterId))
      : undefined;

    const rowState = joinGmRowState({
      viewerUserId: input.viewerUserId,
      row: facts,
      activeGameMasterId,
      activeGameMaster,
    });
    const subscriptionId = String((subscription as { _id: unknown })._id);
    if (rowState === "joinable") return { ...base, state: "joinable", subscriptionId };
    if (rowState === "locked") {
      return { ...base, state: "locked", currentGameMasterName: activeGameMaster?.userName };
    }
    // `own` and `your_gm` cannot reach here - `canViewContest` admits both - so anything else
    // is a Game Master the rules will not offer.
    return base;
  } catch (error) {
    console.warn("⚠️ Private contest gate could not be resolved:", error);
    return { state: "unavailable", gameMasterUserId: gmUserId || undefined };
  }
}
