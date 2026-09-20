import mongoose, { type ClientSession } from "mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import GameRound, {
  canTransitionRound,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import { resolveScoringRules } from "@/lib/services/games/score-direction.service";
import { syncParticipantScore } from "@/lib/services/games/participant-score.service";
import { formatVolts } from "@/lib/utils/format-volts";
import { notificationService } from "@/lib/services/notification.service";
import { payContestPrizes } from "./prize-payout.service";
import { completeContest } from "./contest-completion.service";
import type { SettlementLeaderboardEntry } from "./types";

/**
 * Dedicated re-settle for a completed provider contest (X9 / E7 / `06` s7.2).
 *
 * WHY THIS IS NOT `adjust-results`. That route lets an operator type a new rank or prize by
 * hand. Re-settle voids disputed rounds, recomputes scores from what remains, re-ranks with
 * the same engine as first settlement, claws back old prizes and pays the new board. Scores
 * still come only from `game_round` via `syncParticipantScore` — never from the admin form.
 *
 * OUT OF SCOPE ON PURPOSE. Platform fee and Game Master shares already booked on first
 * settle are left alone (reversing them is a separate money product). XP / badges from
 * `awardContestRewards` are not rewound. Challenges are not covered.
 */

const MIN_REASON_LENGTH = 10;

export interface ResettleInput {
  competitionId: string;
  /** Provider roundIds to void before re-ranking. */
  roundIds: string[];
  incidentId: string;
  reason: string;
  adminId: string;
  adminEmail: string;
}

export interface ResettleResult {
  success: boolean;
  error?: string;
  data?: {
    voidedRoundIds: string[];
    clawedBack: number;
    paidOut: number;
    winnersPaid: number;
  };
}

interface LeaderboardRow {
  userId?: unknown;
  username?: string;
  rank?: number;
  prizeAmount?: number;
  score?: number;
}

export async function resettleProviderCompetition(
  input: ResettleInput,
): Promise<ResettleResult> {
  const reason = input.reason?.trim() ?? "";
  if (reason.length < MIN_REASON_LENGTH) {
    return {
      success: false,
      error: `A reason of at least ${MIN_REASON_LENGTH} characters is required.`,
    };
  }
  if (!input.incidentId?.trim()) {
    return { success: false, error: "incidentId is required for the audit trail." };
  }
  if (!Array.isArray(input.roundIds) || input.roundIds.length === 0) {
    return {
      success: false,
      error: "At least one roundId to void is required.",
    };
  }

  // Deduplicate without inventing order — a Set has no prototype-chain lookup trap.
  const uniqueRoundIds = [...new Set(input.roundIds.map(String))];

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const competition = await Competition.findById(input.competitionId).session(
      session,
    );
    if (!competition) {
      await session.abortTransaction();
      return { success: false, error: "Competition not found." };
    }

    if (competition.status !== "completed") {
      await session.abortTransaction();
      return {
        success: false,
        error: `Only a completed contest can be re-settled (status is "${competition.status}").`,
      };
    }

    // Label alone — a keyless provider draft is still not a trading contest.
    const gameType = competition.gameType || competition.gameKey;
    const isProvider =
      gameType === "provider" ||
      String(competition.gameKey || "").startsWith("provider:");
    if (!isProvider) {
      await session.abortTransaction();
      return {
        success: false,
        error: "Re-settle is for provider contests only. Use Adjust results for trading.",
      };
    }

    if (
      !competition.finalLeaderboard ||
      !Array.isArray(competition.finalLeaderboard) ||
      competition.finalLeaderboard.length === 0
    ) {
      await session.abortTransaction();
      return {
        success: false,
        error:
          "This contest has no stored finalLeaderboard, so there is no prize snapshot to reverse.",
      };
    }

    const voidedRoundIds: string[] = [];
    const affectedUserIds = new Set<string>();

    for (const roundId of uniqueRoundIds) {
      const round = await GameRound.findOne({ roundId }).session(session);
      if (!round) {
        await session.abortTransaction();
        return { success: false, error: `No round with id "${roundId}".` };
      }
      if (String(round.contestId) !== String(competition._id)) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Round ${roundId} does not belong to this contest.`,
        };
      }
      if (round.contestType !== "competition") {
        await session.abortTransaction();
        return {
          success: false,
          error: `Round ${roundId} is not a competition round.`,
        };
      }

      // Idempotent: already voided counts as success for that id.
      if (round.status === "voided") {
        voidedRoundIds.push(roundId);
        affectedUserIds.add(round.userId);
        continue;
      }

      if (!canTransitionRound(round.status as RoundStatus, "voided")) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Round ${roundId} is "${round.status}" and cannot be voided.`,
        };
      }

      round.status = "voided";
      round.resultSource = "manual";
      round.resultReceivedAt = new Date();
      const flags = Array.isArray(round.integrityFlags)
        ? [...round.integrityFlags]
        : [];
      flags.push(`dispute_void:${input.incidentId}`);
      round.integrityFlags = flags;
      await round.save({ session });

      voidedRoundIds.push(roundId);
      affectedUserIds.add(round.userId);
    }

    const scoringRules = await resolveScoringRules(competition.gameKey, session);

    // Re-sync every seat so a void that clears a player's only score `$unset`s it (R50).
    const seats = await CompetitionParticipant.find({
      competitionId: competition._id.toString(),
    }).session(session);

    for (const seat of seats) {
      const sync = await syncParticipantScore({
        contestId: competition._id as mongoose.Types.ObjectId,
        userId: seat.userId,
        contestType: "competition",
        scoreDirection: scoringRules.direction,
        session,
      });
      if (!sync.synced) {
        await session.abortTransaction();
        return {
          success: false,
          error: `Could not re-sync score for ${seat.username}: ${sync.reason}`,
        };
      }
    }

    const clawed = await clawbackAllPrizes({
      session,
      competitionId: competition._id.toString(),
      competitionName: competition.name,
      leaderboard: competition.finalLeaderboard as LeaderboardRow[],
      incidentId: input.incidentId,
      reason,
      adminId: input.adminId,
    });
    if (!clawed.ok) {
      await session.abortTransaction();
      return { success: false, error: clawed.error };
    }

    const redistributed = await redistributePrizes({
      session,
      competition,
      scoringRules,
    });
    if (!redistributed.ok) {
      await session.abortTransaction();
      return { success: false, error: redistributed.error };
    }

    await session.commitTransaction();

    // Notifications after commit — same fire-and-forget shape as adjust-results.
    for (const note of clawed.notifications) {
      await notificationService.createCustom(note);
    }
    for (const note of redistributed.notifications) {
      await notificationService.createCustom(note);
    }

    console.log(
      `♻️ Re-settled competition ${input.competitionId} by ${input.adminEmail}: voided ${voidedRoundIds.length}, clawed ${clawed.total}, paid ${redistributed.totalDistributed}`,
    );

    return {
      success: true,
      data: {
        voidedRoundIds,
        clawedBack: clawed.total,
        paidOut: redistributed.totalDistributed,
        winnersPaid: redistributed.winnersPaid,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Re-settle failed:", error);
    return {
      success: false,
      error: "Something went wrong. Please contact support.",
    };
  } finally {
    session.endSession();
  }
}

async function clawbackAllPrizes(input: {
  session: ClientSession;
  competitionId: string;
  competitionName: string;
  leaderboard: LeaderboardRow[];
  incidentId: string;
  reason: string;
  adminId: string;
}): Promise<
  | {
      ok: true;
      total: number;
      notifications: {
        userId: string;
        type: string;
        title: string;
        message: string;
        icon: string;
        category: string;
        priority: string;
        color: string;
      }[];
    }
  | { ok: false; error: string }
> {
  let total = 0;
  const notifications: {
    userId: string;
    type: string;
    title: string;
    message: string;
    icon: string;
    category: string;
    priority: string;
    color: string;
  }[] = [];

  for (const row of input.leaderboard) {
    const prize = Number(row.prizeAmount) || 0;
    if (prize <= 0 || !row.userId) continue;

    const userId = String(row.userId);
    const wallet = await CreditWallet.findOne({ userId }).session(input.session);
    if (!wallet) {
      return {
        ok: false,
        error: `Cannot reclaim ${formatVolts(prize)} from user ${userId}: no wallet. Nothing was changed.`,
      };
    }
    if (wallet.creditBalance < prize) {
      return {
        ok: false,
        error: `Cannot reclaim ${formatVolts(prize)} from user ${userId}: balance is ${formatVolts(wallet.creditBalance)}. Nothing was changed.`,
      };
    }

    await CreditWallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { creditBalance: -prize } },
      { session: input.session },
    );

    await WalletTransaction.create(
      [
        {
          userId,
          transactionType: "prize_reclaim",
          amount: -prize,
          balanceBefore: wallet.creditBalance,
          balanceAfter: wallet.creditBalance - prize,
          competitionId: input.competitionId,
          status: "completed",
          description: `Prize reclaimed for re-settle: ${input.reason}`,
          metadata: {
            incidentId: input.incidentId,
            reason: input.reason,
            adjustedBy: input.adminId,
            resettle: true,
          },
        },
      ],
      { session: input.session },
    );

    total += prize;
    notifications.push({
      userId,
      type: "prize_adjustment",
      title: "⚠️ Competition Re-settled",
      message: `Your prize of ${formatVolts(prize)} for ${input.competitionName} was reclaimed while results were corrected. Reason: ${input.reason}`,
      icon: "alert-triangle",
      category: "trading",
      priority: "urgent",
      color: "red",
    });
  }

  return { ok: true, total, notifications };
}

async function redistributePrizes(input: {
  session: ClientSession;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- live Mongoose document
  competition: any;
  scoringRules: Awaited<ReturnType<typeof resolveScoringRules>>;
}): Promise<
  | {
      ok: true;
      totalDistributed: number;
      winnersPaid: number;
      notifications: {
        userId: string;
        type: string;
        title: string;
        message: string;
        icon: string;
        category: string;
        priority: string;
        color: string;
      }[];
    }
  | { ok: false; error: string }
> {
  const { session, competition, scoringRules } = input;
  const competitionId = competition._id.toString();

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

  const { calculateRankings, distributePrizesWithTies } = await import(
    "@/lib/services/competition-ranking.service"
  );

  const rankedParticipants = calculateRankings(
    allParticipants.map((p) => ({
      userId: p.userId,
      username: p.username || "Anonymous",
      score: p.score,
      scoreDirection: scoringRules.direction,
      zeroIsValidResult: scoringRules.zeroIsValidResult,
      minimumEligibleScore: scoringRules.minimumEligibleScore,
      status: p.status ?? "active",
      enteredAt: p.enteredAt ?? new Date(),
    })),
    {
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
      score: p.score,
      prizeAmount: 0,
      isTied: p.isTied,
      qualificationStatus: p.qualificationStatus,
      disqualificationReason: p.disqualificationReason,
    }),
  );

  const prizePool = competition.prizePool || 0;
  const platformFeeFraction = (competition.platformFeePercentage || 0) / 100;

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

  const { totalDistributed, winnersPaid } = await payContestPrizes({
    session,
    contest: competition,
    distributions: prizeDistributions,
    leaderboard,
  });

  await completeContest({
    session,
    contest: competition,
    leaderboard,
    prizeWinnerCount: prizeDistributions.length,
  });

  const notifications = leaderboard
    .filter((row) => (row.prizeAmount || 0) > 0)
    .map((row) => ({
      userId: row.userId,
      type: "prize_adjustment",
      title: "💰 Competition Re-settled",
      message: `After a result correction you placed #${row.rank} in ${competition.name} and received ${formatVolts(row.prizeAmount)}.`,
      icon: "gift",
      category: "trading",
      priority: "high",
      color: "green",
    }));

  return {
    ok: true,
    totalDistributed,
    winnersPaid,
    notifications,
  };
}
