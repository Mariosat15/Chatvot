import type { ArenaStandings } from "@/lib/services/games/arena-standings.service";

/**
 * The contest figures the live provider starts from: the standings read wins, the stored
 * competition fills anything it did not carry.
 */
export function toInitialContest(
  contest: ArenaStandings["contest"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any,
) {
  return {
    currentParticipants: contest.currentParticipants,
    maxParticipants: contest.maxParticipants ?? competition.maxParticipants,
    prizePool: contest.prizePool ?? competition.prizePool,
    prizePoolCredits: contest.prizePoolCredits ?? competition.prizePoolCredits,
    entryFee: contest.entryFee ?? competition.entryFee,
    platformFeePercentage:
      contest.platformFeePercentage ?? competition.platformFeePercentage,
    prizeDistribution: contest.prizeDistribution ?? competition.prizeDistribution,
  };
}
