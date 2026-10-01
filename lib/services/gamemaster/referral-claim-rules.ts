import { decideAffiliation, type AffiliationGameMasterFacts } from "./affiliation-rules";

/**
 * Pure rules for a referral-link sign-up waiting on the player's consent (`24` s5.3).
 *
 * Model-free so the prompt component can import the types (R58) and so every rule here is
 * testable without a database.
 */

export const REFERRAL_CLAIM_STATUSES = [
  "pending", // waiting for the player to answer
  "accepting", // an Accept is in flight; nothing else may resolve it meanwhile
  "accepted", // affiliated through `affiliate()`
  "declined", // the player said no - never attached, never asked again
  "refused", // the player said yes and the single writer refused (D1, GM gone, ...)
  "lapsed", // the link stopped applying before the player answered
] as const;
export type ReferralClaimStatus = (typeof REFERRAL_CLAIM_STATUSES)[number];

/**
 * How long an Accept may hold the claim before another request may take it over.
 * Reason: an Accept that crashed between claiming and resolving would otherwise strand the
 * claim in `accepting` for ever - the prompt would never show and Decline would refuse.
 */
export const ACCEPTING_STALE_MS = 2 * 60 * 1000;

/**
 * Refusals from `affiliate()` that say nothing final about the player's answer: consent that
 * expired or was for an older wording, the page being briefly unavailable, or an outage. The
 * claim goes back to `pending` and the prompt asks again. Every other refusal is final.
 * `gm_not_joinable` is here for the reason the prompt WAITS on it: a Game Master suspended
 * between the prompt and the click can come back, and the player has not said no.
 * Reason: a `Set`, since the code comes from a result object (prototype-chain rule).
 */
export const RETRYABLE_ACCEPT_CODES: ReadonlySet<string> = new Set([
  "gm_not_joinable",
  "terms_not_accepted",
  "terms_outdated",
  "terms_unavailable",
  "error",
]);

export interface PendingClaimFacts {
  status: ReferralClaimStatus;
  gameMasterId: string;
  updatedAt?: Date | string;
}

export type ClaimPromptDecision =
  | { kind: "none" }
  | { kind: "wait" }
  | { kind: "show"; gameMasterId: string }
  | { kind: "lapse"; reason: string };

/** Is a claim open for an answer - pending, or an Accept that has stalled? */
export function isClaimOpen(claim: PendingClaimFacts | null | undefined, now: Date): boolean {
  if (!claim) return false;
  if (claim.status === "pending") return true;
  if (claim.status !== "accepting") return false;
  const at = claim.updatedAt ? new Date(claim.updatedAt).getTime() : NaN;
  return !Number.isFinite(at) || now.getTime() - at >= ACCEPTING_STALE_MS;
}

/**
 * Should the player's visit show the terms prompt?
 *
 * Reason: the prompt must never offer a join the single writer would refuse, so the answer
 * is `decideAffiliation` itself - the function `affiliate()` runs - never a second copy of
 * D1/D4 here:
 * - `create` shows the prompt (including a player whose previous Game Master expired, D4);
 * - `already_affiliated` (they joined this Game Master from the leaderboard first) and the
 *   final refusals - another active Game Master (D1), the Game Master gone, self - close it;
 * - `gm_not_joinable` WAITS: a suspended Game Master can come back, and closing the claim
 *   then would silently cost them a player who never said no.
 */
export function decideClaimPrompt(input: {
  userId: string;
  claim: PendingClaimFacts | null | undefined;
  gm: AffiliationGameMasterFacts | undefined;
  activeGameMasterId?: string;
  activeGameMaster?: AffiliationGameMasterFacts;
  now: Date;
}): ClaimPromptDecision {
  const { claim, now } = input;
  if (!claim || !isClaimOpen(claim, now)) return { kind: "none" };
  const decision = decideAffiliation({
    userId: input.userId,
    channel: "gm_referral_link",
    gm: input.gm,
    activeGameMasterId: input.activeGameMasterId,
    activeGameMaster: input.activeGameMaster,
  });
  if (decision.kind === "create") return { kind: "show", gameMasterId: claim.gameMasterId };
  if (decision.kind === "already_affiliated") return { kind: "lapse", reason: "already_affiliated" };
  if (decision.code === "gm_not_joinable") return { kind: "wait" };
  return { kind: "lapse", reason: decision.code };
}
