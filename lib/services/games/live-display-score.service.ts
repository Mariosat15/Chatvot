import { Types } from "mongoose";
import GameRound, {
  LIVE_ROUND_STATUSES,
} from "@/database/models/games/game-round.model";
import Competition from "@/database/models/trading/competition.model";
import {
  roundContributesScore,
  selectCountedAttempt,
  type RoundAttemptInput,
} from "./participant-score.service";
import type { AttemptsPolicy } from "./round-types";
import type { ProviderScoreDirection } from "@/lib/services/game-providers/contract";
import { resolveScoreDirection } from "./score-direction.service";

/**
 * The score a LIVE contest board should rank on RIGHT NOW.
 *
 * WHY THIS EXISTS. `participant.score` only moves when a round finishes (`applyResult` →
 * `syncParticipantScore`). Mid-round progress updates `scoreBreakdown` for the activity line
 * and, since 26 Sep 2026, may also carry a `provisionalScore` - the provider's running total
 * from the SAME scoring function that will produce the final result. Without folding that
 * into the board, every player stays tied or frozen until they submit, which is a photograph
 * of the start of the contest.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A SECOND SCORING DOOR FOR MONEY
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Settlement still reads only `participant.score`, which still only the single ingestion
 * path writes. This module is READ-ONLY over rounds and never touches a participant row. A
 * hostile or buggy provisional is overwritten the moment the result lands, and a contest
 * that settles mid-poll ranks on the stored seat scores alone.
 *
 * GAME-AGNOSTIC BY CONSTRUCTION. It never opens `scoreBreakdown`, never names a metric
 * (`boardsCompleted`, `questionsAnswered`, …), and never branches on `gameCode`. The
 * provider sends one number; we rank that number with the catalogue's score direction and
 * the contest's attempts policy - the same two facts settlement already uses.
 */

export interface LiveDisplayScore {
  /** Absent when the player has neither a finished scored round nor a provisional. */
  score?: number;
  durationMs?: number;
  scoreCompletedAt?: Date;
}

function isLiveStatus(status: string | undefined): boolean {
  return LIVE_ROUND_STATUSES.includes(status as (typeof LIVE_ROUND_STATUSES)[number]);
}

/**
 * Turn one persisted round into the attempt shape ranking already understands.
 *
 * Finished scoring rounds win with `rawScore`. Live rounds contribute only when the
 * provider sent a finite `provisionalScore`. A live round with breakdown but no provisional
 * is activity-only (pre-1.20 providers) and does not move the board order.
 */
export function attemptFromRound(round: {
  status?: string;
  rawScore?: number;
  provisionalScore?: number;
  durationMs?: number;
  provisionalDurationMs?: number;
  completedAt?: Date | string | null;
  progressAt?: Date | string | null;
}): RoundAttemptInput | null {
  if (
    roundContributesScore(round.status) &&
    typeof round.rawScore === "number" &&
    Number.isFinite(round.rawScore)
  ) {
    return {
      rawScore: round.rawScore,
      durationMs: round.durationMs,
      completedAt: round.completedAt,
    };
  }

  if (
    isLiveStatus(round.status) &&
    typeof round.provisionalScore === "number" &&
    Number.isFinite(round.provisionalScore)
  ) {
    return {
      rawScore: round.provisionalScore,
      durationMs: round.provisionalDurationMs,
      // Reason: progress time is the best stand-in for "when they got here" on a still-open
      // round; absent progressAt falls through selectCountedAttempt's finish-time branch.
      completedAt: round.progressAt ?? null,
    };
  }

  return null;
}

/**
 * Effective live-board scores for every seat that has something to show.
 *
 * Keyed by userId. A missing key means "no display score yet" - the board must render a
 * dash, never a phantom zero (R50).
 */
export async function resolveLiveDisplayScores(
  competitionId: string,
): Promise<{
  byUser: Map<string, LiveDisplayScore>;
  scoreDirection: ProviderScoreDirection;
  attemptsPolicy: AttemptsPolicy;
}> {
  const competition = (await Competition.findById(competitionId)
    .select("attemptsPolicy gameKey gameType")
    .lean()) as {
    attemptsPolicy?: string;
    gameKey?: string;
    gameType?: string;
  } | null;

  const scoreDirection =
    competition?.gameType === "provider"
      ? await resolveScoreDirection(competition.gameKey)
      : ("higher_is_better" as ProviderScoreDirection);

  const attemptsPolicy = (competition?.attemptsPolicy ?? "single") as AttemptsPolicy;

  const contestObjectId = Types.ObjectId.isValid(competitionId)
    ? new Types.ObjectId(competitionId)
    : competitionId;

  const rounds = await GameRound.find({
    contestId: contestObjectId,
    contestType: "competition",
  })
    .select(
      "userId status rawScore provisionalScore durationMs provisionalDurationMs completedAt progressAt",
    )
    .lean<
      {
        userId: string;
        status?: string;
        rawScore?: number;
        provisionalScore?: number;
        durationMs?: number;
        provisionalDurationMs?: number;
        completedAt?: Date | null;
        progressAt?: Date | null;
      }[]
    >();

  const byUserRounds = new Map<string, RoundAttemptInput[]>();
  for (const round of rounds) {
    const attempt = attemptFromRound(round);
    if (!attempt) continue;
    const list = byUserRounds.get(round.userId) ?? [];
    list.push(attempt);
    byUserRounds.set(round.userId, list);
  }

  const byUser = new Map<string, LiveDisplayScore>();
  for (const [userId, attempts] of byUserRounds) {
    const picked = selectCountedAttempt(attempts, attemptsPolicy, scoreDirection);
    if (!picked) continue;
    byUser.set(userId, {
      score: picked.score,
      durationMs: picked.durationMs,
      scoreCompletedAt: picked.scoreCompletedAt,
    });
  }

  return { byUser, scoreDirection, attemptsPolicy };
}
