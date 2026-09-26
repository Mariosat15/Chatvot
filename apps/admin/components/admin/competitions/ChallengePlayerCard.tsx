"use client";

/**
 * One side of a settled challenge, on the analytics screen. R92.
 *
 * WHY IT IS A COMPONENT RATHER THAN JSX IN THE PAGE. `CompetitionAnalytics.tsx` rendered the
 * challenger and the challenged as two hand-written copies of the same markup, and the copies
 * had already drifted apart in exactly the way that shape always drifts: both read a field
 * called `totalPnL` which `challengerFinalStats` has never had. One card here means one answer
 * for both players, and it takes the file back under its own weight.
 *
 * WHAT IT DOES NOT DECIDE. It does not decide what a player's performance figure IS - that is
 * `resolveResultMetric`, the same function the contest view screen calls, so a provider
 * challenge and a provider competition cannot report the same result two different ways. Nor
 * does it decide whether a trade count belongs on screen: `resolveParticipantSubline` answers
 * that, and driving the row off its `null` rather than off a second `isProviderGame` test here
 * is what stops the two questions being answered separately later.
 */

import {
  resolveParticipantSubline,
  resolveResultMetric,
  type ResultRow,
} from "@/lib/admin/contest-result-presentation";
import type { TerminologyPack } from "@/lib/constants/terminology";

interface Props {
  name: string;
  stats?: ResultRow & { isDisqualified?: boolean };
  isWinner: boolean;
  isProviderGame: boolean;
  creditSymbol: string;
  terms: TerminologyPack;
}

export default function ChallengePlayerCard({
  name,
  stats,
  isWinner,
  isProviderGame,
  creditSymbol,
  terms,
}: Props) {
  const row: ResultRow = stats ?? {};
  const metric = resolveResultMetric(row, isProviderGame, terms);
  const subline = resolveParticipantSubline(row, isProviderGame);

  const toneClass =
    metric.tone === "positive"
      ? "text-green-400"
      : metric.tone === "negative"
        ? "text-red-400"
        : "text-white";

  return (
    <div
      className={`rounded-lg p-4 ${
        isWinner
          ? "bg-green-900/20 border border-green-500/30"
          : stats?.isDisqualified
            ? "bg-red-900/20 border border-red-500/30"
            : "bg-gray-800/50"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-white">{name}</span>
        {stats?.isDisqualified && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
            Disqualified
          </span>
        )}
      </div>
      <div className="space-y-1 text-sm">
        {subline !== null && (
          <div className="flex justify-between">
            <span className="text-gray-400">Trades:</span>
            <span className="text-white">{row.totalTrades ?? 0}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">{metric.label}:</span>
          <span className={toneClass}>
            {/* Reason the symbol is on the trading branch only: a trading challenge's P&L is
                money, a provider game's score is a number of whatever the title counts, and
                prefixing a credit symbol to it would state a value the platform never set. */}
            {isProviderGame ? metric.value : `${creditSymbol} ${metric.value}`}
            {metric.sub && (
              <span className="text-gray-500 ml-1">({metric.sub})</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
