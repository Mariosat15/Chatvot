import { Award } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  resolveResultMetric,
  resolveSettledResultRows,
  type SettledLeaderboardEntry,
} from "@/lib/admin/contest-result-presentation";

/**
 * The settled snapshot, which was rendered by no admin screen at all.
 *
 * `finalLeaderboard` is written at settlement by `prize-payout.service.ts` with each player's
 * rank, score, real `prizeAmount`, `isTied` and the qualification verdict as it stood - and
 * **every one of those fields was invisible in the product.** The one record the money was
 * actually paid from could not be read anywhere.
 *
 * WHY A SECOND TABLE RATHER THAN COLUMNS ON THE LIVE ONE. The two answer different questions
 * and can legitimately disagree. The live board is recomputed on every request, so it says how
 * the contest would rank *today*; this says how it ranked when the credits moved. When they
 * differ - a late score rejected, a participant row edited, a disqualification recorded at the
 * time - the live one is the one that cannot explain the payout, and merging them hides exactly
 * that difference.
 *
 * `isTied` is the field worth having most: a tie is why two players can hold one rank and why a
 * rank's payment is not the configured share. It was stored and unreadable.
 *
 * IT RENDERS NOTHING WHEN THERE IS NO RECORD, rather than an empty table. An empty panel headed
 * "Settled Result" is indistinguishable from data that failed to load - the same reason the
 * player lobby hides the prize panel on a contest with no configured shares.
 *
 * NOT MIRRORED. `apps/admin/components/` is admin-only.
 */
export default function SettledResultPanel({
  finalLeaderboard,
  isProviderGame,
  creditSymbol,
}: {
  finalLeaderboard?: SettledLeaderboardEntry[] | null;
  isProviderGame: boolean;
  /** `AppSettings.credits.symbol`. A prize is paid in credits, never in fiat. */
  creditSymbol?: string;
}) {
  const rows = resolveSettledResultRows(finalLeaderboard);
  if (!rows) return null;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl mt-6">
      <h2 className="text-xl font-bold text-gray-100 mb-2 flex items-center gap-2">
        <Award className="h-5 w-5 text-emerald-400" />
        Settled Result
      </h2>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Recorded when prizes were paid. The board above is recalculated on every
        visit, so if the two disagree this one is what the payouts were based on.
      </p>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {rows.map((row, index) => {
          // The same resolver the live board uses, so a provider contest shows its score here
          // and a trading contest shows its P&L - and neither screen can drift into showing
          // the other game's metric.
          const metric = resolveResultMetric(row, isProviderGame);
          const wasDisqualified = row.qualificationStatus === "disqualified";

          return (
            <div
              key={`${row.userId ?? "row"}-${index}`}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                wasDisqualified
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-gray-800/50 border-gray-700"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-full bg-gray-700 text-gray-200 flex items-center justify-center font-bold">
                  {wasDisqualified ? "✗" : (row.rank ?? "-")}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-100 truncate">
                      {row.username || row.userId || "Unknown"}
                    </p>
                    {row.isTied && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-xs font-semibold">
                        TIED
                      </span>
                    )}
                    {wasDisqualified && (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-semibold">
                        DISQUALIFIED
                      </span>
                    )}
                  </div>
                  {/*
                    The stored reason, not a re-derived one. A disqualification an operator has
                    to explain to a player is the one thing here that cannot be reconstructed
                    afterwards.
                  */}
                  {row.disqualificationReason && (
                    <p className="text-xs text-red-300/80 mt-1">
                      {row.disqualificationReason}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-100">
                  {metric.value}
                </p>
                <p className="text-xs text-gray-500">{metric.label}</p>
                {typeof row.prizeAmount === "number" && row.prizeAmount > 0 && (
                  <p className="text-xs text-yellow-400 font-semibold mt-1">
                    Paid: {formatVolts(row.prizeAmount, { symbol: creditSymbol })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
