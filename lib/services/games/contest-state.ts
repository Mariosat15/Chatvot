import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import type { IGameRound } from "@/database/models/games/game-round.model";

/**
 * Whether a contest can still accept a score (X3, ingestion gate 9).
 *
 * WHY `finalizing` COUNTS AS CLOSED, AND IS THE REASON THIS FILE EXISTS
 * --------------------------------------------------------------------
 * The obvious check is "is the contest completed". That is not enough. Both contest models
 * carry a `finalizing` state, and it is the genuinely dangerous window: ranking is being
 * computed from participant scores at that moment, so a score written during it may or may
 * not be included depending purely on timing. That is worse than a score arriving after
 * settlement, because a late score is at least consistently excluded and alerted, whereas
 * this one is a coin flip that leaves no trace.
 *
 * `cancelled` and `emergency_ended` are closed for a different reason - entry fees have been
 * refunded or the contest was finalized from a snapshot on a separate path, so a score has
 * nothing left to affect.
 */

/** Statuses in which no new score may be applied to ranking. */
const CLOSED_COMPETITION_STATUSES = [
  "finalizing",
  "completed",
  "cancelled",
  "emergency_ended",
];

const CLOSED_CHALLENGE_STATUSES = [
  "finalizing",
  "completed",
  "cancelled",
  "declined",
  "expired",
];

export type ContestAcceptance =
  | { acceptable: true }
  | { acceptable: false; reason: string; settled: boolean };

/**
 * Reason this FAILS CLOSED on a contest it cannot find: a round pointing at a contest that
 * does not exist is either corrupt data or a deleted contest, and in both cases scoring it
 * would write a number nothing can explain. Wrongly refusing produces an alert somebody
 * reads; wrongly accepting produces a payout nobody can trace.
 */
export async function canContestAcceptScore(
  round: Pick<IGameRound, "contestType" | "contestId">,
): Promise<ContestAcceptance> {
  // Practice belongs to no contest, is unranked and pays nothing, so there is nothing to
  // gate. It is also the one mode where a late score is harmless.
  if (round.contestType === "practice" || !round.contestId) {
    return { acceptable: true };
  }

  if (round.contestType === "competition") {
    const competition = await Competition.findById(round.contestId)
      .select("status")
      .lean<{ status?: string } | null>();

    if (!competition) {
      return {
        acceptable: false,
        reason: "The competition this round belongs to no longer exists.",
        settled: false,
      };
    }
    if (CLOSED_COMPETITION_STATUSES.includes(competition.status ?? "")) {
      return {
        acceptable: false,
        reason: `The competition is ${competition.status} and can no longer be scored.`,
        // `settled` drives whether this is recorded as a LATE result - an audited,
        // alerted, deliberately-not-applied score - rather than a plain refusal.
        settled: true,
      };
    }
    return { acceptable: true };
  }

  const challenge = await Challenge.findById(round.contestId)
    .select("status")
    .lean<{ status?: string } | null>();

  if (!challenge) {
    return {
      acceptable: false,
      reason: "The challenge this round belongs to no longer exists.",
      settled: false,
    };
  }
  if (CLOSED_CHALLENGE_STATUSES.includes(challenge.status ?? "")) {
    return {
      acceptable: false,
      reason: `The challenge is ${challenge.status} and can no longer be scored.`,
      settled: true,
    };
  }
  return { acceptable: true };
}
