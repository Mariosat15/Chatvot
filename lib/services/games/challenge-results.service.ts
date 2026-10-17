import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import { resolveScoreDirection } from "./score-direction.service";
import { findCountedAttempt } from "./contest-results.service";
import type { AttemptsPolicy } from "./round-types";

/**
 * A player's own round-by-round record of a provider-game CHALLENGE, the 1v1 sibling of
 * `contest-results.service.ts`.
 *
 * WHY THIS IS SMALLER THAN THE COMPETITION VERSION, AND DELIBERATELY SO. A challenge has no
 * leaderboard, no rank and no separate prize-distribution row to reconcile against - it has
 * exactly two participants, and `ProviderChallengeLobby.tsx` already reads both of them
 * directly off `ChallengeParticipant` for the head-to-head panel. What that panel cannot show
 * is the shape of how a `best_of_n` or `sum_of_n` score was reached, which is the one thing
 * this file exists to answer - so it returns round history only, not an alternate copy of the
 * outcome the lobby already has correct.
 *
 * NO SEPARATE `/challenges/[id]/results` ROUTE EXISTS, on purpose. A competition needs one
 * because a participant's own record and the public leaderboard are different audiences for a
 * many-player contest; a challenge is two named seats, and the trading challenge page has
 * never redirected to a results page either - it renders `challengerFinalStats` /
 * `challengedFinalStats` inline and links out to `/trade?viewOnly=true` for the detail. This
 * mirrors that: the round history renders as a panel inside the lobby, gated on completion,
 * not a second page a completed challenge has to be redirected to.
 *
 * `findCountedAttempt` IS IMPORTED, NEVER RESTATED - it is the one place that judges which
 * attempt actually counted, and it must agree with `participant-score.service.ts`, which
 * wrote the score at ingestion time. Two copies of that rule is exactly the "one rule, two
 * copies" shape this codebase keeps finding (`referenceId`, `failedReason`, `challengeId`,
 * the Game Master `||`).
 */

export interface ChallengeRoundResult {
  attemptNumber: number;
  status: string;
  /** Absent is NOT zero. A round can complete with a genuine score of nothing. */
  score?: number;
  scoreBreakdown?: Record<string, unknown>;
  durationMs?: number;
  completedAt?: string;
  /** True for the attempt whose score became this player's challenge score. */
  isCounted: boolean;
}

export interface ChallengeRoundHistory {
  /** `higher_is_better` | `lower_is_better`, for labelling "best" correctly. */
  scoreDirection: string;
  attemptsPolicy: AttemptsPolicy;
  attemptsAllowed: number;
  rounds: ChallengeRoundResult[];
}

interface RoundRow {
  attemptNumber: number;
  status: string;
  rawScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  durationMs?: number;
  completedAt?: Date;
}

interface HistoryChallenge {
  _id: unknown;
  gameKey?: string;
  attemptsPolicy?: string;
  attemptsAllowed?: number;
}

export async function getChallengeRoundHistory(
  challenge: HistoryChallenge,
  userId: string,
): Promise<ChallengeRoundHistory> {
  await connectToDatabase();

  const [roundDocs, direction] = await Promise.all([
    GameRound.find({
      contestType: "challenge",
      contestId: challenge._id,
      userId,
      mode: "ranked",
    })
      .select("attemptNumber status rawScore scoreBreakdown durationMs completedAt")
      .sort({ attemptNumber: 1 })
      .lean<RoundRow[]>(),
    resolveScoreDirection(challenge.gameKey),
  ]);

  const policy = (challenge.attemptsPolicy ?? "single") as AttemptsPolicy;

  const rounds = roundDocs.map((r) => ({
    attemptNumber: r.attemptNumber,
    status: r.status,
    score: Number.isFinite(r.rawScore) ? r.rawScore : undefined,
    scoreBreakdown: r.scoreBreakdown,
    durationMs: r.durationMs,
    completedAt: r.completedAt?.toISOString(),
  }));

  const countedAttempt = findCountedAttempt(rounds, policy, direction);

  return {
    scoreDirection: direction,
    attemptsPolicy: policy,
    attemptsAllowed: challenge.attemptsAllowed ?? 1,
    rounds: rounds.map((r) => ({
      ...r,
      isCounted: countedAttempt !== null && r.attemptNumber === countedAttempt,
    })),
  };
}
