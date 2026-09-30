/**
 * Game Master affiliation rules - the pure decision, no database access.
 *
 * `affiliation.service.ts` reads the facts (the joining player, the Game Master's
 * subscription, the player's current active referral and that referral's Game Master) and
 * hands them here. Keeping the decision pure means every rule is testable without a server
 * and the same answer can later be given to the admin reports (`External game plans/24`
 * s3, s7) without a second copy of the rule.
 *
 * Model-free on purpose (R58): nothing here may import a Mongoose model.
 */

export type AffiliationChannel = "gm_referral_link" | "chartvolt_join_gm";

export type AffiliationRefusalCode =
  | "invalid_input"
  | "self"
  | "gm_not_found"
  | "gm_not_joinable"
  | "already_affiliated_other"
  | "user_not_found"
  // Step 3 (`24` s5): consent to the Gamemaster terms, checked by `affiliate()`.
  | "terms_unavailable"
  | "terms_not_accepted"
  | "terms_outdated";

export type PreviousAffiliationEnd = "gm_expired" | "gm_deleted";

/** The subset of a Game Master subscription the rules read. */
export interface AffiliationGameMasterFacts {
  userId: string;
  userName?: string;
  status?: string;
  isPaused?: boolean;
  scheduledForDeletion?: boolean;
}

export type AffiliationDecision =
  | { kind: "refuse"; code: AffiliationRefusalCode; message: string }
  | { kind: "already_affiliated" }
  | { kind: "create"; endPrevious?: PreviousAffiliationEnd };

/**
 * May a player be attached to this Game Master through this channel?
 *
 * The referral link keeps exactly the rule sign-up has always applied - an `active`
 * subscription - because step 2 of the programme must not change sign-up behaviour.
 * Join GM (step 4) is stricter, per owner decision D7: a paused Game Master earns nothing
 * and one scheduled for deletion is leaving, so neither may be offered to a new player.
 */
export function isGameMasterJoinable(
  gm: AffiliationGameMasterFacts,
  channel: AffiliationChannel,
): boolean {
  if (gm.status !== "active") return false;
  if (channel === "gm_referral_link") return true;
  return gm.isPaused !== true && gm.scheduledForDeletion !== true;
}

/**
 * Has the player's current Game Master left for good (owner decision D4)?
 *
 * Only an expired or deleted subscription frees the player. Paused, suspended and
 * cancelled are NOT an end: each can come back, and letting a player move away while
 * their Game Master is merely suspended would let them dodge that Game Master's
 * commission on demand. Returns the reason to stamp on the ended row, or null.
 *
 * `undefined` means the subscription could not be found at all, which is how a deleted
 * Game Master looks from the referral row.
 */
export function previousAffiliationEnd(
  previousGm: AffiliationGameMasterFacts | undefined,
): PreviousAffiliationEnd | null {
  if (!previousGm) return "gm_deleted";
  if (previousGm.status === "expired") return "gm_expired";
  return null;
}

export interface AffiliationDecisionInput {
  userId: string;
  channel: AffiliationChannel;
  gm: AffiliationGameMasterFacts | undefined;
  /** The Game Master id on the player's ACTIVE referral row, if any. */
  activeGameMasterId?: string;
  /** That Game Master's subscription; `undefined` when it no longer exists. */
  activeGameMaster?: AffiliationGameMasterFacts;
}

/**
 * The one decision. Order is load-bearing:
 * 1. self before anything, so a Game Master can never be told they are "already
 *    affiliated" to themselves;
 * 2. an existing link to the SAME Game Master is idempotent success even if that Game
 *    Master is now paused - the player did nothing wrong and a double click must not read
 *    as a refusal;
 * 3. only then is the target's joinability checked;
 * 4. a link to ANOTHER Game Master refuses unless that Game Master has left for good (D1,
 *    D4) - and the refusal names them, because "you are already affiliated" with no name
 *    sends the player to support.
 */
export function decideAffiliation(input: AffiliationDecisionInput): AffiliationDecision {
  const { userId, channel, gm, activeGameMasterId, activeGameMaster } = input;

  if (!gm) {
    return {
      kind: "refuse",
      code: "gm_not_found",
      message: "This Game Master could not be found.",
    };
  }

  if (gm.userId === userId) {
    return {
      kind: "refuse",
      code: "self",
      message: "You cannot affiliate with yourself as a Game Master.",
    };
  }

  if (activeGameMasterId && activeGameMasterId === gm.userId) {
    return { kind: "already_affiliated" };
  }

  if (!isGameMasterJoinable(gm, channel)) {
    return {
      kind: "refuse",
      code: "gm_not_joinable",
      message: "This Game Master is not accepting new players right now.",
    };
  }

  if (activeGameMasterId) {
    const ended = previousAffiliationEnd(activeGameMaster);
    if (!ended) {
      const name = activeGameMaster?.userName?.trim();
      return {
        kind: "refuse",
        code: "already_affiliated_other",
        message: name
          ? `You are already affiliated with Game Master ${name}. Only an administrator can change this.`
          : "You are already affiliated with another Game Master. Only an administrator can change this.",
      };
    }
    return { kind: "create", endPrevious: ended };
  }

  return { kind: "create" };
}
