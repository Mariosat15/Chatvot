import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { resolveScoreDirection } from "./score-direction.service";
import type { AttemptsPolicy } from "./round-types";

/**
 * Everything a player's own post-contest results screen needs for a provider contest.
 *
 * WHY THIS IS A SERVICE AND NOT A READ IN THE PAGE. The trading results page does its reads
 * inline and is 300 lines of aggregation as a result; it is also the page that threw on every
 * provider contest, because a `.lean()` with a hand-written generic let it read three capital
 * fields the participant schema does not store for a provider seat. Keeping the reads here
 * means the shape is one testable thing, and the page renders what it is given.
 *
 * WHAT IS DELIBERATELY NOT HERE: the entry-fee refund the screen explains. It was, for one
 * commit, and invariant 6 of `__tests__/services/round-lifecycle.test.ts` caught it - chapter
 * 11 seam 4 bans every money import from `lib/services/games/`, blocked-by-default, and
 * `wallet-transaction.model` matches. The read moved to `findUnscoredRefund` beside the code
 * that writes the row, which also collapsed a duplicated reason string. **Do not bring it
 * back by relaxing the guard**: an import grants writes as readily as reads, so "reads are
 * fine" is not a property a rule about import strings can express.
 *
 * IT REPORTS, IT DOES NOT DECIDE. Nothing in here recomputes a rank, a prize or an
 * eligibility - all three are settled facts by the time this screen exists, stored on the
 * participant and in `finalLeaderboard`. Recomputing any of them would give the player a
 * second opinion that can disagree with what they were actually paid, which is exactly the
 * class of bug that made the admin view look broken (R46).
 */

export interface PlayerRoundResult {
  attemptNumber: number;
  status: string;
  /** Absent is NOT zero. A round can complete with a genuine score of nothing. */
  score?: number;
  scoreBreakdown?: Record<string, unknown>;
  durationMs?: number;
  completedAt?: string;
  replayUrl?: string;
  /** True for the attempt whose score became the participant's contest score. */
  isCounted: boolean;
}

export interface ProviderContestResults {
  /** The score that was ranked. Absent when the player never recorded one. */
  finalScore?: number;
  rank?: number;
  totalParticipants: number;
  prizeAmount: number;
  isTied: boolean;
  qualificationStatus?: string;
  disqualificationReason?: string;
  /** `higher_is_better` | `lower_is_better`, for labelling "best" correctly. */
  scoreDirection: string;
  attemptsPolicy: AttemptsPolicy;
  attemptsAllowed: number;
  rounds: PlayerRoundResult[];
}

interface ParticipantRow {
  score?: number;
  rank?: number;
  status?: string;
}

interface RoundRow {
  attemptNumber: number;
  status: string;
  rawScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  durationMs?: number;
  completedAt?: Date;
  replayUrl?: string;
}

interface LeaderboardRow {
  userId: string;
  rank: number;
  prizeAmount?: number;
  score?: number;
  isTied?: boolean;
  qualificationStatus?: string;
  disqualificationReason?: string;
}

interface ResultsContest {
  _id: unknown;
  gameKey?: string;
  attemptsPolicy?: string;
  attemptsAllowed?: number;
  currentParticipants?: number;
  finalLeaderboard?: LeaderboardRow[];
}

/**
 * Which attempt actually counted, given the contest's attempts policy.
 *
 * Exported because it is the one piece of judgement on this screen and it must agree with
 * `participant-score.service.ts`, which is what wrote the score at ingestion time. The two
 * are separate code today - this one reports, that one decides - so a test pins them against
 * the same policy list rather than trusting the coincidence.
 *
 * `sum_of_n` deliberately marks NOTHING as counted: every scored round contributed, so
 * highlighting one would be a lie about how the total was reached.
 */
export function findCountedAttempt(
  rounds: { attemptNumber: number; score?: number }[],
  policy: AttemptsPolicy,
  scoreDirection: string,
): number | null {
  const scored = rounds.filter((r) => Number.isFinite(r.score));
  if (scored.length === 0) return null;

  if (policy === "sum_of_n") return null;

  if (policy === "single") return scored[0].attemptNumber;

  // best_of_n. The direction is read rather than assumed: for a time trial the best round is
  // the LOWEST, and marking the slowest attempt as the one that counted would be a visible
  // contradiction of the leaderboard right beside it.
  const lowerIsBetter = scoreDirection === "lower_is_better";

  return scored.reduce((best, candidate) => {
    const better = lowerIsBetter
      ? (candidate.score as number) < (best.score as number)
      : (candidate.score as number) > (best.score as number);
    return better ? candidate : best;
  }).attemptNumber;
}

export async function getProviderContestResults(
  contest: ResultsContest,
  userId: string,
): Promise<ProviderContestResults | null> {
  await connectToDatabase();

  const contestId = String(contest._id);

  const [participant, roundDocs, direction] = await Promise.all([
    CompetitionParticipant.findOne({ competitionId: contestId, userId })
      .select("score rank status")
      .lean<ParticipantRow>(),
    GameRound.find({ contestId: contest._id, userId, mode: "ranked" })
      .select(
        "attemptNumber status rawScore scoreBreakdown durationMs completedAt replayUrl",
      )
      .sort({ attemptNumber: 1 })
      .lean<RoundRow[]>(),
    resolveScoreDirection(contest.gameKey),
  ]);

  // Reason for refusing rather than rendering an empty screen: this page is a player's own
  // record of a contest they entered. Without a seat there is nothing personal to show, and
  // the caller redirects them to the contest page, which has the public leaderboard.
  if (!participant) return null;

  const policy = (contest.attemptsPolicy ?? "single") as AttemptsPolicy;

  const rounds = roundDocs.map((r) => ({
    attemptNumber: r.attemptNumber,
    status: r.status,
    score: Number.isFinite(r.rawScore) ? r.rawScore : undefined,
    scoreBreakdown: r.scoreBreakdown,
    durationMs: r.durationMs,
    completedAt: r.completedAt?.toISOString(),
    replayUrl: r.replayUrl,
  }));

  const countedAttempt = findCountedAttempt(rounds, policy, direction);

  /*
    The stored leaderboard is the authority for rank, prize and why a player was or was not
    paid, because it is the snapshot settlement wrote. The participant row carries `rank` too
    and they can differ: a live leaderboard read mid-contest updates the participant, while
    `finalLeaderboard` is frozen at the moment the money moved. Showing the participant's copy
    would occasionally tell a player a different rank from the one they were paid for.
  */
  const entry = contest.finalLeaderboard?.find(
    (row) => String(row.userId) === String(userId),
  );

  return {
    // The leaderboard snapshot first, falling back to the participant for a contest settled
    // before `score` was stored on the leaderboard at all.
    finalScore: Number.isFinite(entry?.score)
      ? entry?.score
      : Number.isFinite(participant.score)
        ? participant.score
        : undefined,
    rank: entry?.rank ?? participant.rank,
    totalParticipants: contest.currentParticipants ?? 0,
    prizeAmount: entry?.prizeAmount ?? 0,
    isTied: Boolean(entry?.isTied),
    qualificationStatus: entry?.qualificationStatus,
    disqualificationReason: entry?.disqualificationReason,
    scoreDirection: direction,
    attemptsPolicy: policy,
    attemptsAllowed: contest.attemptsAllowed ?? 1,
    rounds: rounds.map((r) => ({
      ...r,
      isCounted: countedAttempt !== null && r.attemptNumber === countedAttempt,
    })),
  };
}
