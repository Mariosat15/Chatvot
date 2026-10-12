import { AlertTriangle, Ban, CheckCircle, Skull, Target } from "lucide-react";
import type { CompetitionRules } from "./dashboard-model";

interface DashboardBannersProps {
  isDisqualified: boolean;
  isLiquidated: boolean;
  isAtRisk: boolean;
  isActive: boolean;
  rules?: CompetitionRules;
  totalTrades: number;
  winRate: number;
}

/**
 * The qualification banners above the panel. Moved out of `CompetitionDashboard.tsx` with the
 * wording unchanged: these are the rules that decide whether a player can be paid at all.
 */
export function DashboardBanners({
  isDisqualified,
  isLiquidated,
  isAtRisk,
  isActive,
  rules,
  totalTrades,
  winRate,
}: DashboardBannersProps) {
  const minimumTrades = rules?.minimumTrades || 0;
  const minimumWinRate = rules?.minimumWinRate || 0;
  const needsMoreTrades = minimumTrades > 0 && totalTrades < minimumTrades;
  const tradesRemaining = Math.max(0, minimumTrades - totalTrades);
  const belowWinRate = minimumWinRate > 0 && winRate < minimumWinRate;

  if (isDisqualified) {
    return (
      <div className="animate-pulse rounded-xl border-2 border-red-500/50 bg-gradient-to-r from-red-900/50 via-red-800/50 to-red-900/50 p-4 shadow-lg shadow-red-500/20">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-red-500/30 p-3">
            <Skull className="h-8 w-8 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="flex items-center gap-2 text-xl font-bold text-red-400">
              <Ban className="h-5 w-5" />
              YOU ARE DISQUALIFIED
            </h3>
            <p className="text-sm text-red-300/80">
              {isLiquidated
                ? "Your account was liquidated. You are no longer eligible for prizes in this competition."
                : "You have been disqualified from this competition."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAtRisk) {
    return (
      <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-900/30 via-orange-900/30 to-amber-900/30 p-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-xl bg-amber-500/20 p-3">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-amber-400">
                ⚠️ DISQUALIFICATION WARNING
              </h3>
              <p className="text-sm text-amber-300/70">
                You are at risk of being disqualified! Take action before the competition ends.
              </p>
            </div>
            <div className="space-y-2">
              {needsMoreTrades && (
                <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-gray-900/50 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    <span className="text-sm text-gray-300">Minimum Trades Required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-red-400">
                      {totalTrades}/{minimumTrades}
                    </span>
                    <span className="rounded bg-orange-500/20 px-2 py-1 text-xs font-semibold text-orange-400">
                      {tradesRemaining} more needed!
                    </span>
                  </div>
                </div>
              )}
              {belowWinRate && (
                <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-gray-900/50 p-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">Minimum Win Rate Required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-red-400">{winRate.toFixed(1)}%</span>
                    <span className="text-xs text-yellow-400">/ {minimumWinRate}% min</span>
                  </div>
                </div>
              )}
              {rules?.disqualifyOnLiquidation && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                  <Skull className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-red-300">
                    Remember: Getting liquidated = instant disqualification!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isActive && rules && (minimumTrades > 0 || minimumWinRate > 0)) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-gradient-to-r from-green-900/20 via-emerald-900/20 to-green-900/20 p-3">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-400" />
          <span className="text-sm font-medium text-green-400">
            ✅ You meet all qualification requirements! Keep trading to improve your rank.
          </span>
          {minimumTrades > 0 && (
            <span className="ml-auto text-xs text-green-300/70">
              Trades: {totalTrades}/{minimumTrades} ✓
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}
