import type { RankableParticipant } from "../types";

/**
 * Trading's ranking and tie-break metrics (X1 seam 1).
 *
 * MOVED, NOT REWRITTEN. Both functions are the switches that lived in
 * `lib/services/competition-ranking.service.ts`, carried across unchanged - same cases,
 * same order, same fallbacks, same `9999` sentinel, same negations. Every behaviour below
 * is pinned by the golden baseline captured before this move
 * (`__tests__/services/ranking-regression.test.ts`), which must stay green without being
 * regenerated. If it goes red, this extraction is wrong.
 *
 * The one difference from the originals is `?? 0` on each field read. That is required
 * because the shared `RankableParticipant` marks trading metrics optional so a provider
 * participant can be ranked without them. It cannot change trading behaviour: all six
 * fields are declared `required` with numeric defaults on both participant models, so
 * they are never absent on a real trading row.
 */

export function getTradingRankingValue(
  participant: RankableParticipant,
  method: string,
): number {
  switch (method) {
    case "pnl":
      return participant.pnl ?? 0;
    case "roi":
      return participant.pnlPercentage ?? 0;
    case "total_capital":
      return participant.currentCapital ?? 0;
    case "win_rate":
      return participant.winRate ?? 0;
    case "total_wins":
      return participant.winningTrades ?? 0;
    case "profit_factor": {
      // Profit Factor = Total Wins / Total Losses
      const totalWins = participant.winningTrades ?? 0;
      const totalLosses = participant.losingTrades ?? 0;
      if (totalLosses === 0) return totalWins > 0 ? 9999 : 0; // Infinity if all wins
      return totalWins / totalLosses;
    }
    default:
      return participant.pnl ?? 0;
  }
}

export function getTradingTieBreakerValue(
  participant: RankableParticipant,
  tieBreaker: string,
): number {
  switch (tieBreaker) {
    case "trades_count":
      // Negative because fewer is better (more efficient)
      return -(participant.totalTrades ?? 0);
    case "win_rate":
      return participant.winRate ?? 0;
    case "total_capital":
      return participant.currentCapital ?? 0;
    case "roi":
      return participant.pnlPercentage ?? 0;
    case "join_time":
      // Negative because earlier is better
      return -new Date(participant.enteredAt).getTime();
    default:
      return 0;
  }
}
