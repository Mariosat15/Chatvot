/**
 * Who is disqualified on a trading leaderboard, and why.
 *
 * Shared by the desktop table (`CompetitionLeaderboard`) and the phone row list
 * (`MobileLobbyLeaderboard`), so the two screens cannot disagree about one player.
 * Minimum trades only counts once the contest is completed, so a player is not told
 * they are out while they still have time to trade.
 */

export type QualificationEntry = {
  qualificationStatus?: string;
  status?: string;
  totalTrades: number;
  disqualificationReason?: string;
};

export type QualificationContext = {
  competitionStatus?: string;
  minimumTrades: number;
};

function belowMinimumTrades(
  entry: QualificationEntry,
  { competitionStatus, minimumTrades }: QualificationContext,
): boolean {
  return (
    competitionStatus === "completed" &&
    minimumTrades > 0 &&
    entry.totalTrades < minimumTrades
  );
}

export function isLeaderboardEntryDisqualified(
  entry: QualificationEntry,
  context: QualificationContext,
): boolean {
  if (entry.qualificationStatus === "disqualified") return true;
  if (entry.status === "liquidated") return true;
  return belowMinimumTrades(entry, context);
}

export function leaderboardDisqualificationReason(
  entry: QualificationEntry,
  context: QualificationContext,
): string {
  if (entry.disqualificationReason) return entry.disqualificationReason;
  if (entry.status === "liquidated") return "Liquidated";
  if (belowMinimumTrades(entry, context)) {
    return `Insufficient trades (${entry.totalTrades}/${context.minimumTrades})`;
  }
  return "Disqualified";
}
