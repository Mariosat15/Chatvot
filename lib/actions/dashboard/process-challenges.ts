/* eslint-disable */
// Reason: R21 extract — same disable as comprehensive-dashboard.actions.ts; typing
// the extracted `any`s in this commit would destroy the character-for-character proof.
/**
 * Challenge participation processing for the player dashboard (R21 extract).
 */
import { getDashboardRankingValue } from "@/lib/services/games/dashboard-contest-rank.service";
import type { ChallengeData } from "./types";

export type ProcessedChallenges = {
  active: ChallengeData[];
  pending: ChallengeData[];
  completed: ChallengeData[];
  stats: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    totalStaked: number;
    totalWon: number;
  };
};

export function processChallengeParticipations(params: {
  userId: string;
  allChallenges: any[];
  challengeParticipations: any[];
  opponentByChallengeId: Map<string, any>;
}): { processedChallenges: ProcessedChallenges } {
  const { userId, allChallenges, challengeParticipations, opponentByChallengeId } =
    params;

  const processedChallenges: ProcessedChallenges = {
    active: [] as ChallengeData[],
    pending: [] as ChallengeData[],
    completed: [] as ChallengeData[],
    stats: {
      total: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalStaked: 0,
      totalWon: 0,
    },
  };

  for (const challenge of allChallenges as any[]) {
    const userParticipation = (challengeParticipations as any[]).find(
      (p: any) => p.challengeId?.toString() === challenge._id.toString(),
    );

    if (!userParticipation) continue;

    const isChallenger = challenge.challengerId === userId;
    // Reason: Use the pre-fetched opponent map instead of searching user's own array (which never has opponent records)
    const opponentParticipation = opponentByChallengeId.get(
      challenge._id.toString(),
    );

    // Reason: Challenge model has challengerName/challengedName (not *Username), and no "name" field
    const opponentName = isChallenger
      ? challenge.challengedName
      : challenge.challengerName;

    // Reason: Use the challenge's ranking method to determine the correct "isLeading" comparison
    const challengeRankingMethod = challenge.rules?.rankingMethod || "pnl";
    const userRankingVal = getDashboardRankingValue(
      userParticipation,
      challengeRankingMethod,
    );
    const opponentRankingVal = opponentParticipation
      ? getDashboardRankingValue(opponentParticipation, challengeRankingMethod)
      : -Infinity;

    const challengeData: ChallengeData = {
      id: challenge._id.toString(),
      name: `Challenge vs ${opponentName || "Unknown"}`,
      status: challenge.status,
      startTime: challenge.startTime,
      endTime: challenge.endTime,
      stakeAmount: challenge.entryFee || 0, // Reason: model field is entryFee, not stakeAmount
      rankingMethod: challengeRankingMethod,
      opponent: opponentParticipation
        ? {
            name: opponentParticipation.username || opponentName || "Unknown",
            pnl: opponentParticipation.pnl || 0,
            pnlPercentage: opponentParticipation.pnlPercentage || 0,
            currentCapital: opponentParticipation.currentCapital || 0,
            winRate: opponentParticipation.winRate || 0,
            winningTrades: opponentParticipation.winningTrades || 0,
            losingTrades: opponentParticipation.losingTrades || 0,
            totalTrades: opponentParticipation.totalTrades || 0,
          }
        : null,
      userPnL: userParticipation.pnl || 0,
      userPnLPercentage: userParticipation.pnlPercentage || 0,
      userCurrentCapital: userParticipation.currentCapital || 0,
      userWinRate: userParticipation.winRate || 0,
      userWinningTrades: userParticipation.winningTrades || 0,
      userLosingTrades: userParticipation.losingTrades || 0,
      userTotalTrades: userParticipation.totalTrades || 0,
      userStartingCapital: userParticipation.startingCapital || 0,
      // Reason: Compare by the challenge's ranking method, not hardcoded PnL
      isLeading: userRankingVal >= opponentRankingVal,
      isWinner: userParticipation.isWinner,
      prizeWon: userParticipation.prizeReceived,
    };

    processedChallenges.stats.total++;
    processedChallenges.stats.totalStaked += challenge.entryFee || 0;

    if (challenge.status === "active") {
      processedChallenges.active.push(challengeData);
    } else if (challenge.status === "pending") {
      processedChallenges.pending.push(challengeData);
    } else if (challenge.status === "completed") {
      processedChallenges.completed.push(challengeData);
      if (userParticipation.isWinner) {
        processedChallenges.stats.wins++;
        processedChallenges.stats.totalWon +=
          userParticipation.prizeReceived || 0;
      } else {
        processedChallenges.stats.losses++;
      }
    }
  }

  const totalChallengeGames =
    processedChallenges.stats.wins + processedChallenges.stats.losses;
  processedChallenges.stats.winRate =
    totalChallengeGames > 0
      ? (processedChallenges.stats.wins / totalChallengeGames) * 100
      : 0;

  return { processedChallenges };
}
