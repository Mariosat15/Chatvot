/* eslint-disable */
// Reason: R21 extract — same disable as comprehensive-dashboard.actions.ts; typing
// the extracted `any`s in this commit would destroy the character-for-character proof.
/**
 * Competition participation processing for the player dashboard (R21 extract).
 */
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { createDashboardRankResolver } from "@/lib/services/games/dashboard-contest-rank.service";
import type { CompetitionData } from "./types";

export type ProcessedCompetitions = {
  active: CompetitionData[];
  upcoming: CompetitionData[];
  completed: CompetitionData[];
  stats: {
    total: number;
    won: number;
    topThreeFinishes: number;
    averageRank: number;
    bestRank: number;
  };
};

export async function processCompetitionParticipations(params: {
  userId: string;
  competitionParticipations: any[];
  allCompetitions: any[];
}): Promise<{ processedCompetitions: ProcessedCompetitions }> {
  const { userId, competitionParticipations, allCompetitions } = params;

  const competitionsMap = new Map(
    allCompetitions.map((c: any) => [c._id.toString(), c]),
  );

  const processedCompetitions: ProcessedCompetitions = {
    active: [] as CompetitionData[],
    upcoming: [] as CompetitionData[],
    completed: [] as CompetitionData[],
    stats: {
      total: competitionParticipations.length,
      won: 0,
      topThreeFinishes: 0,
      averageRank: 0,
      bestRank: Infinity,
    },
  };

  let totalRankSum = 0;
  let rankedCount = 0;

  // Pre-fetch all participants for active competitions (needed for Win Potential card)
  const activeCompetitionIds = allCompetitions
    .filter((c: any) => c.status === "active")
    .map((c: any) => c._id);

  const allActiveParticipants = await CompetitionParticipant.find({
    competitionId: { $in: activeCompetitionIds },
  })
    .select(
      "userId competitionId pnl currentCapital startingCapital currentRank totalTrades winningTrades losingTrades status score",
    )
    .limit(10000)
    .lean();

  // Group participants by competition
  const participantsByCompetition = new Map<string, any[]>();
  for (const p of allActiveParticipants as any[]) {
    const compId = p.competitionId?.toString();
    if (!participantsByCompetition.has(compId)) {
      participantsByCompetition.set(compId, []);
    }
    participantsByCompetition.get(compId)!.push(p);
  }

  // Reason: ONE resolver for the whole request, so the score direction is read once per game
  // key rather than once per contest. Shared with `/api/competitions/dashboard-live`, which
  // refreshes these same cards - a second copy of the sort would show the player one rank on
  // load and another fifteen seconds later.
  const { resolveRank } = createDashboardRankResolver();

  for (const participation of competitionParticipations as any[]) {
    const competition = competitionsMap.get(
      participation.competitionId?.toString(),
    );
    if (!competition) continue;

    // Get all participants for this competition (for win potential calculation)
    const competitionParticipants =
      participantsByCompetition.get(competition._id.toString()) || [];

    // Map participants to the format needed by WinPotentialCard
    const mappedParticipants = competitionParticipants.map((p: any) => ({
      userId: p.userId?.toString() || "",
      currentCapital: p.currentCapital || 0,
      startingCapital:
        p.startingCapital || competition.startingCapital || 10000,
      pnl: p.pnl || 0,
      pnlPercentage: p.pnlPercentage || 0,
      totalTrades: p.totalTrades || 0,
      winningTrades: p.winningTrades || 0,
      losingTrades: p.losingTrades || 0,
      winRate:
        p.totalTrades > 0 ? ((p.winningTrades || 0) / p.totalTrades) * 100 : 0,
      averageWin: p.averageWin || 0,
      averageLoss: p.averageLoss || 0,
      currentRank: p.currentRank || 0,
      status: p.status || "active",
    }));

    // Reason: participation.currentRank from DB can be stale or 0, so a live rank is sorted
    // from the participants. The sort itself lives in one place and must stay there - see
    // `dashboard-contest-rank.service.ts` for why a second copy is a visible defect rather
    // than a tidiness question.
    const computedRank = await resolveRank({
      competition,
      participants: competitionParticipants,
      userId,
      fallbackRank: participation.currentRank || 0,
    });

    const compData: CompetitionData = {
      id: competition._id.toString(),
      name: competition.name,
      status: competition.status,
      startTime: competition.startTime,
      endTime: competition.endTime,
      prizePool: competition.prizePool || competition.prizePoolCredits || 0,
      entryFee: competition.entryFee || competition.entryFeeCredits || 0,
      currentRank: computedRank,
      totalParticipants: competition.currentParticipants || 0,
      gameType: competition.gameType,
      gameKey: competition.gameKey,
      // Reason: NOT `|| 0`. An absent score means no round has reported yet, and the card
      // shows "-" for that rather than claiming the player scored nothing.
      score: participation.score,
      pnl: participation.pnl || 0,
      pnlPercentage: participation.pnlPercentage || 0,
      currentCapital: participation.currentCapital || 0,
      startingCapital:
        participation.startingCapital || competition.startingCapital || 10000,
      totalTrades: participation.totalTrades || 0,
      winningTrades: participation.winningTrades || 0,
      losingTrades: participation.losingTrades || 0,
      winRate: participation.winRate || 0,
      openPositions: participation.currentOpenPositions || 0,
      prizeWon: participation.prizeWon,
      // Win Potential Card data
      rankingMethod: competition.rules?.rankingMethod || "pnl",
      prizeDistribution: competition.prizeDistribution || [],
      minimumTrades: competition.rules?.minimumTrades || 0,
      userParticipation: {
        userId: userId,
        currentCapital: participation.currentCapital || 0,
        startingCapital:
          participation.startingCapital || competition.startingCapital || 10000,
        pnl: participation.pnl || 0,
        pnlPercentage: participation.pnlPercentage || 0,
        totalTrades: participation.totalTrades || 0,
        winningTrades: participation.winningTrades || 0,
        losingTrades: participation.losingTrades || 0,
        winRate:
          participation.totalTrades > 0
            ? ((participation.winningTrades || 0) / participation.totalTrades) *
              100
            : 0,
        averageWin: participation.averageWin || 0,
        averageLoss: participation.averageLoss || 0,
        currentRank: computedRank,
        status: participation.status || "active",
      },
      allParticipants: mappedParticipants,
    };

    if (competition.status === "active") {
      processedCompetitions.active.push(compData);
    } else if (competition.status === "upcoming") {
      processedCompetitions.upcoming.push(compData);
    } else if (competition.status === "completed") {
      processedCompetitions.completed.push(compData);

      if (participation.currentRank === 1) processedCompetitions.stats.won++;
      if (participation.currentRank <= 3)
        processedCompetitions.stats.topThreeFinishes++;
    }

    if (participation.currentRank > 0) {
      totalRankSum += participation.currentRank;
      rankedCount++;
      if (participation.currentRank < processedCompetitions.stats.bestRank) {
        processedCompetitions.stats.bestRank = participation.currentRank;
      }
    }
  }

  processedCompetitions.stats.averageRank =
    rankedCount > 0 ? totalRankSum / rankedCount : 0;
  if (processedCompetitions.stats.bestRank === Infinity)
    processedCompetitions.stats.bestRank = 0;

  return { processedCompetitions };
}
