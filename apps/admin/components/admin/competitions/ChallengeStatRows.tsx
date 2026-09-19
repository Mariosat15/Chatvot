/**
 * A settled challenge player's figures on the challenge detail screen. R92.
 *
 * WHY IT IS A COMPONENT. There were copies of "what does this player's result look like" in
 * three screens, none of which knew about a provider game.
 *
 * COUNT CORRECTED 16 September 2026, and the correction is the useful part. This comment used
 * to say "four copies": the detail screen's pair plus the analytics screen's two-row pair. It
 * missed `ChallengesAdminSection.tsx`, whose drawer wrote the same four rows twice again - so
 * there were SIX, and the two nobody had counted were the ones still rendering +0.00 / 0 / 0.0%
 * for a provider challenge a day after R92 was recorded as read-side-fixed on the others. Left
 * visible rather than quietly renumbered, because "count the writers before unifying anything"
 * has now cost a missed offender in this very file's own justification.
 *
 * All three screens reach the same rule through `resolveResultMetric`, which is the thing that
 * actually has to agree.
 *
 * The four trading rows are WITHHELD rather than zeroed on a provider game, for the reason
 * that made R92 invisible: `pnl`, `pnlPercentage`, `totalTrades` and `winRate` are all absent
 * on a provider challenge, so a `?? 0` renders `+0.00`, `+0.00%`, `0` and `0.0%` - four
 * plausible figures, every one of them a statement the settlement never made.
 *
 * Server-safe: no hooks, no state. It is rendered from a server component.
 */

import {
  resolveResultMetric,
  type ResultRow,
} from "@/lib/admin/contest-result-presentation";
import type { TerminologyPack } from "@/lib/constants/terminology";

interface Props {
  stats: ResultRow & { winRate?: number | null };
  isProviderGame: boolean;
  terms: TerminologyPack;
}

export default function ChallengeStatRows({
  stats,
  isProviderGame,
  terms,
}: Props) {
  const metric = resolveResultMetric(stats, isProviderGame, terms);

  if (isProviderGame) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{metric.label}:</span>
        <span className="font-bold text-white">{metric.value}</span>
      </div>
    );
  }

  const pnl = stats.pnl ?? 0;
  const pnlPercentage = stats.pnlPercentage ?? 0;

  return (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">P&L:</span>
        <span
          className={`font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}
        >
          {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">ROI:</span>
        <span
          className={
            pnlPercentage >= 0 ? "text-green-400" : "text-red-400"
          }
        >
          {pnlPercentage >= 0 ? "+" : ""}
          {pnlPercentage.toFixed(2)}%
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Trades:</span>
        <span className="text-white">{stats.totalTrades ?? 0}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Win Rate:</span>
        <span className="text-white">{(stats.winRate ?? 0).toFixed(1)}%</span>
      </div>
    </>
  );
}
