"use client";

import { RankIcon } from "@/components/ui/GameIcon";
import { cn } from "@/lib/utils";

export interface MyBoardPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

/**
 * The viewer's own position on whichever board is showing.
 *
 * Reason: one definition, because the point of combining the boards is that a
 * player can find themselves on each of them. `unitLabel` exists because the
 * population differs by board — "traders" is wrong on a games board and
 * "players" is wrong on the trading one.
 */
export default function LeaderboardRankCard({
  position,
  unitLabel,
  unrankedMessage,
}: {
  position: MyBoardPosition | null;
  unitLabel: string;
  unrankedMessage: string;
}) {
  if (!position) return null;

  if (position.rank <= 0) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50 p-5 text-center">
        <p className="text-lg font-bold text-gray-300 mb-1">Unranked</p>
        <p className="text-sm text-gray-500">{unrankedMessage}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-transparent to-cyan-500/20 opacity-50" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500 to-transparent" />

      <div className="relative p-4 sm:p-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-5">
          <div
            className={cn(
              "relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center",
              position.rank === 1 &&
                "bg-gradient-to-br from-yellow-500/30 to-amber-500/30 border-2 border-yellow-500/50",
              position.rank === 2 &&
                "bg-gradient-to-br from-gray-400/30 to-gray-500/30 border-2 border-gray-400/50",
              position.rank === 3 &&
                "bg-gradient-to-br from-amber-600/30 to-orange-600/30 border-2 border-amber-600/50",
              position.rank > 3 &&
                "bg-gradient-to-br from-primary-500/30 to-cyan-500/30 border-2 border-primary-500/50",
            )}
          >
            {position.rank <= 3 ? (
              <RankIcon rank={position.rank} size={40} />
            ) : (
              <span className="text-xl sm:text-3xl font-black text-primary-400">
                #{position.rank}
              </span>
            )}
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Your Rank
            </p>
            <p className="text-2xl sm:text-4xl font-black text-white">
              #{position.rank}
            </p>
            <p className="text-sm text-gray-500">
              of {position.totalUsers} {unitLabel}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Percentile
          </p>
          <p className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            {position.percentile.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500">
            Top {(100 - position.percentile).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
