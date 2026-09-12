import type { ClientSession, HydratedDocument } from "mongoose";
import type { IChallenge } from "@/database/models/trading/challenge.model";
import type { IChallengeParticipant } from "@/database/models/trading/challenge-participant.model";
import { payContestPrizes } from "./prize-payout.service";
import { settleFeesAndGameMasters } from "./fees.service";
import type {
  SettlementContest,
  SettlementLeaderboardEntry,
  SettlementPrizeDistribution,
} from "./types";

/**
 * Settling a finished 1v1 challenge onto the shared payout and fee code.
 *
 * Ranking, tie-breaking and disqualification stay HERE - the game-agnostic dispatcher's
 * registry tripwire only knows `["trading", "provider"]`, and a challenge's outcome rule is
 * decided by `Challenge.rules`, not by a game module. What moves onto shared code is the
 * money: paying the winner (`payContestPrizes`) and the platform fee / unclaimed pool /
 * Game Master referral share (`settleFeesAndGameMasters`) are the exact same arithmetic a
 * competition already runs, keyed off `contestKind: "challenge"` (see `types.ts`).
 *
 * Completion deliberately does NOT call the shared `completeContest()` stage - a challenge
 * has its own two-participant document shape (no `finalLeaderboard`, no
 * `currentParticipants`), so the challenge and participant documents are updated directly
 * below instead.
 *
 * Three things were fixed while this logic was moved rather than copied, because a rewrite
 * is exactly when a sibling bug is found (Stage 0's rule: if it is buggy here, it is
 * probably buggy there too):
 *
 * 1. The tiebreaker's "join_time" case read `participant.enteredAt`, a field
 *    `ChallengeParticipant` has never declared (it is `joinedAt`) - so it always compared
 *    `Date.now()` against itself and could never resolve a tie.
 * 2. Under the admin's `challenger_wins` tie policy, the pre-unification code paid the
 *    challenger the full prize but never went back to correct the challenge document,
 *    which had already been saved with `isTie: true, winnerId: undefined` moments earlier -
 *    the stored record disagreed with what was actually paid. Here the tie is resolved
 *    BEFORE the challenge document is written, so the two cannot diverge.
 * 3. Under the `both_lose` tie policy, neither participant's `.status` was ever moved to
 *    "completed" - only the winner/loser and split-prize branches touched it - so a tied,
 *    nobody-wins challenge left both rows stuck at "active" forever. It also never recorded
 *    an unclaimed-pool row despite a comment claiming it was "already recorded above" (that
 *    sentence was true only of the both-disqualified branch next to it). Routing every
 *    no-distribution outcome through `settleFeesAndGameMasters` fixes both: it always marks
 *    participants completed when the challenge is not both-disqualified, and its own
 *    `prizeWinnerCount === 0` branch always records the unclaimed pool.
 */

type TieBreaker = NonNullable<IChallenge["rules"]["tieBreaker1"]>;

function getRankingValue(
  participant: HydratedDocument<IChallengeParticipant>,
  method: string,
): number {
  switch (method) {
    case "pnl":
      return participant.pnl || 0;
    case "roi":
      return participant.pnlPercentage || 0;
    case "total_capital":
      return participant.currentCapital || 0;
    case "win_rate":
      return participant.winRate || 0;
    case "total_wins":
      return participant.winningTrades || 0;
    case "profit_factor": {
      const totalWins = participant.winningTrades || 0;
      const totalLosses = participant.losingTrades || 0;
      if (totalLosses === 0) return totalWins > 0 ? 9999 : 0;
      return totalWins / totalLosses;
    }
    default:
      return participant.pnl || 0;
  }
}

function getTieBreakerValue(
  participant: HydratedDocument<IChallengeParticipant>,
  tieBreaker: string,
): number {
  switch (tieBreaker) {
    case "trades_count":
      return -(participant.totalTrades || 0); // Negative because fewer is better
    case "win_rate":
      return participant.winRate || 0;
    case "total_capital":
      return participant.currentCapital || 0;
    case "roi":
      return participant.pnlPercentage || 0;
    case "join_time":
      return -new Date(participant.joinedAt || Date.now()).getTime();
    default:
      return 0;
  }
}

export interface SettleChallengeInput {
  session: ClientSession;
  challenge: HydratedDocument<IChallenge>;
  challenger: HydratedDocument<IChallengeParticipant>;
  challenged: HydratedDocument<IChallengeParticipant>;
  /** `ChallengeSettings.getSingleton()`'s tie policy. Defaults match the settings model's own default. */
  tiePrizeDistribution?: "split_equally" | "challenger_wins" | "both_lose";
}

export interface SettleChallengeResult {
  winnerId: string | null;
  winnerName: string | null;
  winnerPnL: number;
  loserId: string | null;
  loserName: string | null;
  loserPnL: number;
  isTie: boolean;
  noWinner: boolean;
}

export async function settleChallenge({
  session,
  challenge,
  challenger,
  challenged,
  tiePrizeDistribution = "split_equally",
}: SettleChallengeInput): Promise<SettleChallengeResult> {
  // ---------- Disqualification (minimum trades OR liquidation, matching competitions) ----------
  const minTrades = challenge.rules.minimumTrades || 1;
  const disqualifyOnLiquidation = challenge.rules.disqualifyOnLiquidation !== false;

  const challengerMinTradesFail = challenger.totalTrades < minTrades;
  const challengedMinTradesFail = challenged.totalTrades < minTrades;
  const challengerLiquidated =
    disqualifyOnLiquidation && challenger.status === "liquidated";
  const challengedLiquidated =
    disqualifyOnLiquidation && challenged.status === "liquidated";
  const challengerDisqualified = challengerMinTradesFail || challengerLiquidated;
  const challengedDisqualified = challengedMinTradesFail || challengedLiquidated;

  if (challengerDisqualified && challenger.status !== "disqualified") {
    challenger.status = "disqualified";
    challenger.disqualificationReason = challengerLiquidated
      ? "Account liquidated"
      : `Did not make minimum ${minTrades} trade(s)`;
    await challenger.save({ session });
  }
  if (challengedDisqualified && challenged.status !== "disqualified") {
    challenged.status = "disqualified";
    challenged.disqualificationReason = challengedLiquidated
      ? "Account liquidated"
      : `Did not make minimum ${minTrades} trade(s)`;
    await challenged.save({ session });
  }

  // ---------- Winner determination ----------
  let winnerId: string | null = null;
  let winnerName: string | null = null;
  let loserId: string | null = null;
  let loserName: string | null = null;
  let isTie = false;
  let winnerPnL = 0;
  let loserPnL = 0;

  const challengerValue = getRankingValue(challenger, challenge.rules.rankingMethod);
  const challengedValue = getRankingValue(challenged, challenge.rules.rankingMethod);
  const bothDisqualified = challengerDisqualified && challengedDisqualified;

  if (bothDisqualified) {
    console.log(
      `⚠️ Both players disqualified in challenge ${challenge._id}, platform keeps pool`,
    );
  } else if (challengerDisqualified) {
    winnerId = challenged.userId;
    winnerName = challenged.username;
    loserId = challenger.userId;
    loserName = challenger.username;
    winnerPnL = challengedValue;
    loserPnL = challengerValue;
  } else if (challengedDisqualified) {
    winnerId = challenger.userId;
    winnerName = challenger.username;
    loserId = challenged.userId;
    loserName = challenged.username;
    winnerPnL = challengerValue;
    loserPnL = challengedValue;
  } else {
    const epsilon = 0.001; // For floating point comparison

    if (Math.abs(challengerValue - challengedValue) < epsilon) {
      let resolved = false;
      const tieBreakers: (TieBreaker | undefined)[] = [
        challenge.rules.tieBreaker1,
        challenge.rules.tieBreaker2,
      ];

      for (const tieBreaker of tieBreakers) {
        if (resolved || !tieBreaker || tieBreaker === "split_prize") continue;

        const challengerTie = getTieBreakerValue(challenger, tieBreaker);
        const challengedTie = getTieBreakerValue(challenged, tieBreaker);

        if (Math.abs(challengerTie - challengedTie) >= epsilon) {
          if (challengerTie > challengedTie) {
            winnerId = challenger.userId;
            winnerName = challenger.username;
            loserId = challenged.userId;
            loserName = challenged.username;
            winnerPnL = challengerValue;
            loserPnL = challengedValue;
          } else {
            winnerId = challenged.userId;
            winnerName = challenged.username;
            loserId = challenger.userId;
            loserName = challenger.username;
            winnerPnL = challengedValue;
            loserPnL = challengerValue;
          }
          resolved = true;
          console.log(`  Winner determined by tiebreaker: ${tieBreaker}`);
        }
      }

      if (!resolved) {
        isTie = true;
        console.log(`  Challenge is a TRUE tie - all criteria matched`);
      }
    } else if (challengerValue > challengedValue) {
      winnerId = challenger.userId;
      winnerName = challenger.username;
      loserId = challenged.userId;
      loserName = challenged.username;
      winnerPnL = challengerValue;
      loserPnL = challengedValue;
    } else {
      winnerId = challenged.userId;
      winnerName = challenged.username;
      loserId = challenger.userId;
      loserName = challenger.username;
      winnerPnL = challengedValue;
      loserPnL = challengerValue;
    }
  }

  // Reason: resolved BEFORE the challenge document is written (see fix 2 in the file
  // comment), so `challenge.winnerId`/`isTie` can never disagree with who was actually paid.
  if (isTie && tiePrizeDistribution === "challenger_wins") {
    winnerId = challenger.userId;
    winnerName = challenger.username;
    loserId = challenged.userId;
    loserName = challenged.username;
    winnerPnL = challengerValue;
    loserPnL = challengedValue;
    isTie = false;
  }

  const noWinner = !winnerId && !isTie;

  // ---------- Persist the challenge's own record of the outcome ----------
  challenge.winnerId = winnerId || undefined;
  challenge.winnerName = winnerName || undefined;
  challenge.winnerPnL = winnerPnL;
  challenge.loserId = loserId || undefined;
  challenge.loserName = loserName || undefined;
  challenge.loserPnL = loserPnL;
  challenge.isTie = isTie;
  challenge.noWinner = noWinner ? true : undefined;

  challenge.challengerFinalStats = {
    finalCapital: challenger.currentCapital,
    pnl: challenger.pnl,
    pnlPercentage: challenger.pnlPercentage,
    totalTrades: challenger.totalTrades,
    winRate: challenger.winRate,
    isDisqualified: challengerDisqualified,
    disqualificationReason: challenger.disqualificationReason,
  };
  challenge.challengedFinalStats = {
    finalCapital: challenged.currentCapital,
    pnl: challenged.pnl,
    pnlPercentage: challenged.pnlPercentage,
    totalTrades: challenged.totalTrades,
    winRate: challenged.winRate,
    isDisqualified: challengedDisqualified,
    disqualificationReason: challenged.disqualificationReason,
  };
  challenge.status = "completed";
  await challenge.save({ session });

  // ---------- Build what the shared stages need ----------
  const winnerPrize = challenge.winnerPrize;
  let distributions: SettlementPrizeDistribution[] = [];

  if (winnerId && !isTie) {
    distributions = [{ rank: 1, userId: winnerId, prizeAmount: winnerPrize, isTied: false }];
  } else if (isTie && tiePrizeDistribution === "split_equally") {
    // First participant gets ceiling, second gets floor - no credits lost to rounding.
    const halfPrize = winnerPrize / 2;
    distributions = [
      { rank: 1, userId: challenger.userId, prizeAmount: Math.ceil(halfPrize), isTied: true },
      { rank: 1, userId: challenged.userId, prizeAmount: Math.floor(halfPrize), isTied: true },
    ];
  }
  // Both disqualified, or a true tie under "both_lose": no distributions. The unclaimed
  // pool this leaves is recorded by `settleFeesAndGameMasters` itself, below.

  const leaderboard: SettlementLeaderboardEntry[] = [challenger, challenged].map((p) => ({
    rank: isTie || !winnerId ? 1 : p.userId === winnerId ? 1 : 2,
    userId: p.userId,
    username: p.username,
    prizeAmount: 0, // filled in by payContestPrizes
    pnl: p.pnl,
    finalCapital: p.currentCapital,
    qualificationStatus: p.status === "disqualified" ? "disqualified" : "qualified",
    disqualificationReason: p.disqualificationReason,
  }));

  const contest: SettlementContest = {
    _id: challenge._id,
    name: `${challenge.challengerName} vs ${challenge.challengedName}`,
    entryFee: challenge.entryFee,
    startTime: challenge.startTime,
    endTime: challenge.endTime,
    // Reason: a challenge is never "created by" a Game Master the way a competition can be -
    // there is no such field on the model - so this is always absent and `isGmCreated`
    // naturally evaluates false in the fee stage below.
    gameMasterId: null,
    platformFeePercentage: challenge.platformFeePercentage,
    contestKind: "challenge",
  };

  const totalDistributed = distributions.reduce((sum, d) => sum + d.prizeAmount, 0);

  const { walletMap } =
    distributions.length > 0
      ? await payContestPrizes({ session, contest, distributions, leaderboard })
      : { walletMap: new Map() };

  await settleFeesAndGameMasters({
    session,
    contest,
    prizePool: challenge.prizePool,
    totalDistributed,
    prizeWinnerCount: distributions.length,
    expectedWinners: 1,
    qualifiedWinnersCount: [challengerDisqualified, challengedDisqualified].filter(
      (d) => !d,
    ).length,
    participants: [{ userId: challenger.userId }, { userId: challenged.userId }],
    walletMap,
    platformFeeFraction: challenge.platformFeePercentage / 100,
  });

  // ---------- Mark participants by what was actually paid ----------
  // Reason: the both-disqualified case leaves both rows at "disqualified" (already saved
  // above) rather than overwriting that with "completed" - every other outcome (a winner,
  // any resolved tie, or a genuine "both_lose" tie) moves both participants to "completed".
  if (!bothDisqualified) {
    for (const participant of [challenger, challenged]) {
      const dist = distributions.find((d) => d.userId === participant.userId);
      if (dist) {
        participant.isWinner = true;
        participant.prizeReceived = dist.prizeAmount;
      }
      participant.status = "completed";
      await participant.save({ session });
    }
  }

  return { winnerId, winnerName, winnerPnL, loserId, loserName, loserPnL, isTie, noWinner };
}
