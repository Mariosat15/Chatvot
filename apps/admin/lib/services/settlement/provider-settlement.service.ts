import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { payContestPrizes } from "./prize-payout.service";
import { settleFeesAndGameMasters } from "./fees.service";
import { completeContest } from "./contest-completion.service";
import { assessUnresolvedRounds } from "./unresolved-rounds";
import { refundExcludedParticipants } from "./exclusion-refund";
import type { SettlementLeaderboardEntry } from "./types";

/**
 * Settling a provider contest: rank the scores, pay the winners, close it out.
 *
 * WHAT MAKES THIS SHORT IS THE POINT. It is the trading finalize path with its first two
 * stages removed - no positions to close, no stats to recompute from trades - and every
 * remaining stage is the SAME FUNCTION the trading path calls. Chapter 09 predicted
 * exactly this: paying a provider contest is "an extraction, not a wiring job", and once
 * the extraction was done the wiring was forty lines.
 *
 * The alternative was a second payout loop. Stage 0 is the argument against it: four
 * competition entry writers, `referenceId` written identically by two of them and
 * `challengeId` by nine, producing the rule that one bug duplicated is not drift and that
 * no mirror guard will ever catch it. Money code gets one writer.
 *
 * WHERE THE SCORES COME FROM. Nothing here computes a score. They are written to
 * `participant.score` by `syncParticipantScore`, called from the single ingestion function as
 * each round's result arrives, and reconciliation has already applied the contest's
 * unresolved-round policy to anything that never came back. By the time settlement runs, the
 * scores are simply facts.
 *
 * THAT PARAGRAPH WAS FALSE UNTIL 5 SEPTEMBER 2026, and it is worth leaving the correction
 * visible rather than quietly fixing the tense. `applyResult` wrote `game_round` and stopped;
 * no code path had ever written `participant.score`. Every provider participant would have
 * settled on the seat default of zero, tied at rank 1, and taken an equal share of the pool
 * regardless of how well they played.
 *
 * Note the ingestion function lives in the MAIN app only, deliberately - mirroring it would
 * make two doors for scores, which is the one thing chapter 02 section 10 rule 3 forbids. This
 * settlement service is mirrored; the thing that feeds it is not.
 *
 * The tests below could not catch it because they seed the scores they rank, so they proved
 * that ranking works *given* scores and never that a score arrives. **An aside in a comment
 * is a claim, not a fact** - and this file's aside was the claim that hid the missing seam.
 */

export interface ProviderSettlementResult {
  success: boolean;
  error?: string;
  /** Present so this result is interchangeable with the trading path's at every caller. */
  message?: string;
  data?: {
    competitionId: string;
    competitionName: string;
    totalParticipants: number;
    winnersCount: number;
    prizePool: number;
    totalDistributed: number;
    leaderboard: SettlementLeaderboardEntry[];
  };
}

interface ProviderCompetitionDoc {
  _id: import("mongoose").Types.ObjectId;
  name: string;
  entryFee: number;
  currentParticipants?: number;
  prizePool?: number;
  platformFeePercentage: number;
  prizeDistribution?: { rank: number; percentage: number }[];
  startTime?: Date;
  endTime?: Date;
  gameMasterId?: string | null;
  gameKey?: string;
  rules?: Record<string, unknown>;
  /**
   * Drives the `exclude` refund and the `hold_and_alert` block. Read from the STORED
   * contest, never passed in by a caller - the same reasoning as the market-hours gate
   * taking its game type from the stored label rather than from request input.
   */
  unresolvedRoundPolicy?: string;
  status: string;
  save(opts: { session: import("mongoose").ClientSession }): Promise<unknown>;
}

/**
 * Which way this contest's scores rank, read once from the catalogue title.
 *
 * Reason it defaults to higher-is-better rather than refusing: an unrecognised or missing
 * direction must not silently INVERT a leaderboard, and upward is the direction every points
 * game uses. This is the same fail-closed instinct as the market-hours gate, applied to sort
 * order - the safe answer is the one that cannot reverse a result.
 *
 * The narrowing is deliberate rather than a cast. `scoreDirection` is a schema enum, but a
 * document written before the enum existed, or one hand-edited, can hold anything; treating
 * only the one known downward value as downward means no other string can reverse a payout.
 */
async function resolveContestScoreDirection(
  gameKey: string | undefined,
  session: import("mongoose").ClientSession,
): Promise<"higher_is_better" | "lower_is_better"> {
  // Reason this is a real case and not defensive noise: `gameKey` is optional on the contest
  // document, and the typecheck caught the assumption that it is not. An absent label cannot
  // resolve a title, so there is nothing to read and the safe upward default applies.
  if (!gameKey) {
    console.warn(
      "⚠️ Provider contest has no gameKey at settlement; ranking scores as higher-is-better.",
    );
    return "higher_is_better";
  }

  const title = await ProviderGame.findOne({ gameKey })
    .select("scoreDirection")
    .session(session)
    .lean<{ scoreDirection?: string } | null>();

  if (!title) {
    // Not fatal: the contest's own scores are still rankable, and refusing here would strand
    // a settleable contest because a catalogue row was removed. Loud, because a missing title
    // means `gameKey` no longer resolves and that affects more than this sort.
    console.warn(
      `⚠️ No catalogue entry for "${gameKey}" at settlement; ranking scores as higher-is-better.`,
    );
    return "higher_is_better";
  }

  return title.scoreDirection === "lower_is_better"
    ? "lower_is_better"
    : "higher_is_better";
}

/**
 * Settle a provider contest inside the caller's transaction.
 *
 * Takes the already-locked document rather than an id, because the optimistic
 * `active -> finalizing` claim and the lock release on failure belong to the caller. A
 * function that both claimed the lock and settled would have two ways to leave a contest
 * stranded in `finalizing` with nobody able to retry it.
 */
export async function settleProviderCompetition(
  competition: ProviderCompetitionDoc,
  session: import("mongoose").ClientSession,
): Promise<ProviderSettlementResult> {
  const competitionId = competition._id.toString();

  console.log(`🏁 Settling provider contest ${competitionId}`);

  const allParticipants = await CompetitionParticipant.find({
    competitionId,
  })
    .session(session)
    .lean<
      {
        userId: string;
        username?: string;
        score?: number;
        status?: string;
        enteredAt?: Date;
      }[]
    >();

  console.log(`Found ${allParticipants.length} participants`);

  // The contest's unresolved-round policy, applied here because this is the only place it
  // CAN be applied: it needs to move money and re-split the pool in one transaction.
  //
  // Re-derived from the stored rounds rather than taken from `reconcileRound`'s return
  // value, which is ephemeral and belongs to a worker process that has already exited.
  const assessment = await assessUnresolvedRounds({
    competitionId,
    storedPolicy: competition.unresolvedRoundPolicy,
    session,
  });

  // The NORMAL hold gate is before the optimistic lock, so a parked contest is left
  // untouched rather than claimed and released. Reaching this one means a round became
  // unresolved between that read and this transaction - rare, and it must still not pay out.
  //
  // It is a genuine second gate, not decoration: `provider-settlement-late-hold.test.ts`
  // drives exactly that race and goes red without this block. Note what makes the refusal
  // safe is in the caller - a `success: false` return has to abort and release the claim, or
  // this check trades a wrong payout for a contest stranded in `finalizing` for ever.
  if (assessment.blocksSettlement) {
    return {
      success: false,
      error:
        assessment.blockReason ??
        "Settlement is held: a round in this contest never reported a result.",
    };
  }

  const refund = await refundExcludedParticipants({
    session,
    contest: competition,
    userIds: assessment.excludedUserIds,
  });

  // EXCLUSION IS DONE BY FILTERING, NOT BY THE STATUS FIELD, and that is load-bearing.
  // `calculateRankings` does not filter on participant status at all - it reads `status`
  // only for the liquidation rule - so a player marked `refunded` would still be ranked and
  // could still be paid a prize. Their money would go out twice, as a refund and as
  // winnings. The refund service sets the status for the audit trail and every screen that
  // reads it; removing them from the contest is this line.
  const excluded = new Set(assessment.excludedUserIds);
  const participants = allParticipants.filter((p) => !excluded.has(p.userId));

  if (excluded.size > 0) {
    console.log(
      `🚫 [EXCLUDE] ${excluded.size} player(s) removed from ranking; ${refund.refundedUserIds.length} refunded (${refund.totalRefunded} credits), ${refund.alreadyRefundedUserIds.length} already refunded by an earlier run`,
    );
  }

  const { calculateRankings, distributePrizesWithTies } = await import(
    "@/lib/services/competition-ranking.service"
  );

  // ONE direction for the whole contest, read from the catalogue title.
  //
  // This used to be read off each participant row, which was a defect on two counts. The
  // field was declared on neither `CompetitionParticipant` copy, so the read returned
  // `undefined` for every player and the fallback below was not a fail-safe but the only
  // branch - a race game ranked as though higher were better, paying the slowest player
  // first. And it was the wrong SHAPE besides: chapter 05 section 2 keeps direction off the
  // participant precisely so two rows in one leaderboard cannot disagree.
  //
  // Note why the typecheck never objected: the participant read is a `.lean<{...}>()` with a
  // hand-written generic, so the compiler checked the annotation rather than the schema.
  // **An explicitly-typed lean read is a place a field that does not exist looks real.**
  const direction = await resolveContestScoreDirection(competition.gameKey, session);

  // Reason: `gameType` is passed so `calculateRankings` dispatches to the provider game
  // module, which ranks on `score` and applies the title's direction. Omit it and the
  // shared ranking step falls back to trading, reads every score as a missing PnL, ties
  // every player at rank 1 and splits the pool equally - which reads in production as a
  // prize-distribution bug rather than a missing argument.
  const rankedParticipants = calculateRankings(
    participants.map((p) => ({
      userId: p.userId,
      username: p.username || "Anonymous",
      score: p.score,
      scoreDirection: direction,
      status: p.status ?? "active",
      enteredAt: p.enteredAt ?? new Date(),
    })),
    {
      // A provider game reports one number, so the six trading ranking methods would be
      // six labels for one behaviour. The module ignores them by design.
      rankingMethod: "pnl" as const,
      tieBreaker1: "win_rate" as const,
      tieBreaker2: "join_time" as const,
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: false,
      ...(competition.rules || {}),
    },
    { competitionStatus: "completed", gameType: "provider" },
  );

  const leaderboard: SettlementLeaderboardEntry[] = rankedParticipants.map(
    (p) => ({
      rank: p.rank,
      userId: p.userId,
      username: p.username,
      // Reason: the RAW score, never the value the ranking engine compared on. A
      // lower-is-better title is negated only at comparison, so storing the comparison
      // value would show a race time as a negative number on every screen that reads the
      // stored leaderboard, and poison any cross-game total built from it.
      score: p.score,
      prizeAmount: 0,
      isTied: p.isTied,
      qualificationStatus: p.qualificationStatus,
      disqualificationReason: p.disqualificationReason,
    }),
  );

  // THE RE-SPLIT. Entry does `$inc: { currentParticipants: 1, prizePool: entryFee }` with
  // the FULL fee - the platform fee is taken later, out of the pool, not at the door - so a
  // refund removes exactly `entryFee` from both. Reducing by anything else is how a pool
  // drifts away from the fees behind it.
  //
  // It is persisted, not just held in a local: `finalLeaderboard` and the fee stage are
  // computed from the reduced pool, and a stored pool that still counted the removed player
  // would contradict the payouts on every screen that reads the contest.
  const refundedCount = refund.refundedUserIds.length;
  let prizePool = competition.prizePool || 0;
  let participantCount = competition.currentParticipants || 0;

  if (refund.totalRefunded > 0) {
    prizePool = Math.max(0, prizePool - refund.totalRefunded);
    participantCount = Math.max(0, participantCount - refundedCount);
    await Competition.findByIdAndUpdate(
      competitionId,
      {
        $set: { prizePool, currentParticipants: participantCount },
      },
      { session },
    );
  }

  // The same integrity cap the trading path applies. A stored pool higher than the fees
  // actually collected means phantom credits would be created out of a bug elsewhere.
  //
  // `participantCount` is the post-refund figure deliberately: computing the cap from the
  // original count would leave headroom for exactly the fees that were just handed back,
  // so the cap would stop catching the case it exists for.
  const actualCollectedFees = participantCount * (competition.entryFee || 0);

  if (prizePool > actualCollectedFees && actualCollectedFees > 0) {
    console.error(
      `🚨 [PROVIDER] PRIZE POOL INTEGRITY VIOLATION for ${competitionId}! stored ${prizePool}, collected ${actualCollectedFees}. Capping.`,
    );
    prizePool = actualCollectedFees;
    await Competition.findByIdAndUpdate(
      competitionId,
      { $set: { prizePool: actualCollectedFees } },
      { session },
    );
  }

  // A fraction, not a percentage. The stored field is 0-50 and
  // `distributePrizesWithTies` rejects anything above 1 - risk R30 was half a variable
  // named `platformFeePercentage` holding 0.2.
  const platformFeeFraction = competition.platformFeePercentage / 100;

  const prizeDistributions = distributePrizesWithTies(
    rankedParticipants,
    competition.prizeDistribution || [],
    prizePool,
    {
      rankingMethod: "pnl" as const,
      tieBreaker1: "win_rate" as const,
      tieBreaker2: "join_time" as const,
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: false,
      ...(competition.rules || {}),
    },
    platformFeeFraction,
  );

  console.log(
    `💎 Calculated ${prizeDistributions.length} prize distributions (including ties)`,
  );

  const { totalDistributed, winnersPaid, walletMap } = await payContestPrizes({
    session,
    contest: competition,
    distributions: prizeDistributions,
    leaderboard,
  });

  const qualifiedWinners = rankedParticipants.filter(
    (p) => p.qualificationStatus === "qualified",
  );

  await settleFeesAndGameMasters({
    session,
    contest: competition,
    prizePool,
    totalDistributed,
    prizeWinnerCount: prizeDistributions.length,
    expectedWinners: competition.prizeDistribution?.length || 0,
    qualifiedWinnersCount: qualifiedWinners.length,
    participants: participants.map((p) => ({ userId: p.userId })),
    walletMap,
    platformFeeFraction,
  });

  await completeContest({
    session,
    contest: competition,
    leaderboard,
    prizeWinnerCount: prizeDistributions.length,
  });

  console.log(
    `✅ Provider contest ${competition.name} settled: ${winnersPaid} winner(s), ${totalDistributed} credits distributed`,
  );

  return {
    success: true,
    data: {
      competitionId,
      competitionName: competition.name,
      totalParticipants: participants.length,
      winnersCount: winnersPaid,
      prizePool,
      totalDistributed,
      leaderboard: leaderboard.slice(0, 10),
    },
  };
}
