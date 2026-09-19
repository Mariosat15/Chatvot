"use client";

import { RankIcon } from "@/components/ui/GameIcon";
import { cn } from "@/lib/utils";

/** Shared rank badge + row tint so every board looks like Trading Leaderboard. */
export function rankRowTint(rank: number, isCurrentUser: boolean): string {
  if (isCurrentUser)
    return "bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent border-l-2 border-primary-500";
  if (rank === 1)
    return "bg-gradient-to-r from-yellow-500/20 via-yellow-500/5 to-transparent";
  if (rank === 2)
    return "bg-gradient-to-r from-gray-400/20 via-gray-400/5 to-transparent";
  if (rank === 3)
    return "bg-gradient-to-r from-amber-600/20 via-amber-600/5 to-transparent";
  if (rank <= 10)
    return "bg-gradient-to-r from-blue-500/10 via-transparent to-transparent";
  return "hover:bg-white/5";
}

export function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm",
        rank === 1 &&
          "bg-gradient-to-br from-yellow-500/30 to-amber-500/30 text-yellow-400 border border-yellow-500/30",
        rank === 2 &&
          "bg-gradient-to-br from-gray-400/30 to-gray-500/30 text-gray-300 border border-gray-500/30",
        rank === 3 &&
          "bg-gradient-to-br from-amber-600/30 to-orange-600/30 text-amber-500 border border-amber-600/30",
        rank > 3 && "bg-gray-800/50 text-gray-400 border border-gray-700/50",
      )}
    >
      {rank === 1 ? (
        <RankIcon rank={1} size={18} />
      ) : rank === 2 ? (
        <RankIcon rank={2} size={18} />
      ) : rank === 3 ? (
        <RankIcon rank={3} size={18} />
      ) : (
        `#${rank}`
      )}
    </div>
  );
}
