/**
 * Open challenges - a challenge nobody is named on.
 *
 * Model-free by requirement, not by preference: `ChallengeCard.tsx` and the challenges
 * page are `"use client"`, so anything they import must not reach a Mongoose model
 * (R58). The same reasoning put `components/games/play-state.ts` and the round
 * resolution action list in their own modules.
 *
 * Reason: openness is an EXPLICIT stored flag, never inferred from `challengedId` being
 * absent. The two readings differ in the direction they fail. Inferred, a bug that drops
 * `challengedId` from a directed challenge turns it into one anybody may claim - a
 * stranger takes a seat that was offered to a named friend, and a real entry fee is
 * debited. With the flag, the same bug produces a challenge nobody can accept, which is
 * visible, refundable and complained about. A capability gate fails closed.
 */

/** What a screen calls the opponent of a challenge nobody has taken yet. */
export const OPEN_CHALLENGE_OPPONENT_LABEL = "Open to anyone";

/** The subset of a challenge needed to answer either question below. */
export interface OpenChallengeFacts {
  openToAnyone?: boolean | null;
  challengedId?: string | null;
}

/**
 * Was this challenge offered to anybody rather than to one named player?
 *
 * Stays true after somebody claims it - it is a statement about how the challenge was
 * created, which is what a screen needs to explain why a stranger is in it.
 */
export function isOpenChallenge(challenge: OpenChallengeFacts): boolean {
  return challenge.openToAnyone === true;
}

/**
 * Is the second seat still empty?
 *
 * Reason: "missing" has three shapes - absent, `null` and `""` - and only the first is
 * obvious. The create path omits the key entirely, but a half-run migration or a bad
 * edit leaves one of the other two, and a check written `=== undefined` reads the seat
 * as taken while the document dump looks correct.
 */
export function isUnclaimedOpenChallenge(
  challenge: OpenChallengeFacts,
): boolean {
  return isOpenChallenge(challenge) && !challenge.challengedId;
}

/**
 * The name to show where a screen would otherwise write the opponent's.
 *
 * Returns the label rather than an empty string, because "vs " followed by nothing reads
 * as a rendering fault rather than as an invitation.
 */
export function challengeOpponentLabel(
  name: string | null | undefined,
  challenge: OpenChallengeFacts,
): string {
  if (name) return name;
  return isUnclaimedOpenChallenge(challenge)
    ? OPEN_CHALLENGE_OPPONENT_LABEL
    : "Unknown";
}
