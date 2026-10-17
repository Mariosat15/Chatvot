/**
 * Players with no score yet share one rank, below everyone who has scored.
 *
 * Owner, 15 Oct 2026: players waiting in the lobby were shown as #1, #2... before anyone had
 * played, ranked by nothing more than the order they joined - "misleading". So until a player
 * records a score they all stand level: everyone is #1 before the first result, and once
 * somebody scores the waiting players share the place after the last scorer.
 *
 * DISPLAY ONLY, for a contest still running. Settlement ranks through its own path with the R45
 * eligibility gate, and a completed contest's board is left exactly as `calculateRankings` made it.
 * The order of the rows is untouched - only the rank number and the tie flag change - so the
 * scorers keep the order the engine gave them.
 */
export function levelUnscoredRanks<
  T extends { score?: number; rank: number; isTied?: boolean; tiedWith?: string[] },
>(rows: T[]): T[] {
  const hasScore = (row: T) =>
    typeof row.score === "number" && Number.isFinite(row.score);
  const scoredCount = rows.filter(hasScore).length;
  const sharedRank = scoredCount + 1;
  return rows.map((row) =>
    hasScore(row)
      ? row
      : // Not flagged as tied: a tie is a statement about equal SCORES, and these have none.
        { ...row, rank: sharedRank, isTied: false, tiedWith: [] },
  );
}
