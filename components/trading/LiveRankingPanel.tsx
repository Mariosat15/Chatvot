"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  Loader2,
  Crown,
  Skull,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingEntry {
  rank: number;
  userId: string;
  username: string;
  profitPercent: number;
  displayValue: number;
  liveEquity: number;
  potentialReward: number;
  distanceToFirst: number;
  isDisqualified: boolean;
  status: string;
  rankingMethod?: string;
  isSeparator?: boolean;
}

interface LiveRankingPanelProps {
  competitionId: string;
  userId: string;
  className?: string;
}

export default function LiveRankingPanel({
  competitionId,
  userId,
  className,
}: LiveRankingPanelProps) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [prizePool, setPrizePool] = useState(0);
  const [rankingMethod, setRankingMethod] = useState<string>("pnl");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/competitions/${competitionId}/live-ranking`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch rankings");
      }

      setRankings(data.rankings || []);
      setUserRank(data.userRank);
      setTotalParticipants(data.totalParticipants || 0);
      setPrizePool(data.prizePool || 0);
      setRankingMethod(data.rankingMethod || "pnl");
      setError(null);
    } catch (err) {
      console.error("Error fetching live rankings:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchRankings();

    // Poll every 15 seconds for live updates (reduced from 5s to lower server load)
    const interval = setInterval(fetchRankings, 15000);

    return () => clearInterval(interval);
  }, [fetchRankings]);

  const getRankIcon = (rank: number, isDisqualified: boolean) => {
    if (isDisqualified) {
      return <Skull className="h-4 w-4 text-red-500" />;
    }

    switch (rank) {
      case 1:
        return <Trophy className="h-4 w-4 text-yellow-400" />;
      case 2:
        return <Trophy className="h-4 w-4 text-gray-400" />;
      case 3:
        return <Trophy className="h-4 w-4 text-orange-500" />;
      default:
        return (
          <span className="w-4 h-4 rounded-full bg-dark-500 flex items-center justify-center text-[10px] text-gray-400 font-bold">
            {rank}
          </span>
        );
    }
  };

  const getRankBgColor = (
    rank: number,
    isCurrentUser: boolean,
    isDisqualified: boolean,
  ) => {
    if (isDisqualified) return "bg-red-500/5 border-red-500/20";
    if (isCurrentUser) return "bg-primary/10 border-primary/30";
    if (rank === 1) return "bg-yellow-500/5 border-yellow-500/20";
    if (rank === 2) return "bg-gray-500/5 border-gray-500/20";
    if (rank === 3) return "bg-orange-500/5 border-orange-500/20";
    return "bg-dark-400/30 border-dark-500/30";
  };

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-gray-400">
            Loading rankings...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="text-center py-6">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={fetchRankings}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="text-center py-6">
          <Trophy className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No participants yet</p>
        </div>
      </div>
    );
  }

  // Get ranking method label
  const getRankingLabel = () => {
    switch (rankingMethod) {
      case "pnl":
        return "P&L";
      case "roi":
        return "ROI";
      case "total_capital":
        return "Equity";
      case "win_rate":
        return "Win %";
      case "total_wins":
        return "Wins";
      case "profit_factor":
        return "PF";
      default:
        return "P&L";
    }
  };

  // Format display value based on ranking method
  const formatDisplayValue = (value: number) => {
    switch (rankingMethod) {
      case "roi":
      case "win_rate":
        return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
      case "total_wins":
        return value.toString();
      case "profit_factor":
        return value.toFixed(2);
      default: // pnl, total_capital
        return `${value >= 0 ? "+" : ""}$${Math.abs(value).toFixed(2)}`;
    }
  };

  // Format distance to first based on ranking method
  const formatDistance = (value: number) => {
    if (value === 0) return null;
    switch (rankingMethod) {
      case "roi":
      case "win_rate":
        return `${value.toFixed(1)}%`;
      case "total_wins":
        return value.toString();
      case "profit_factor":
        return value.toFixed(2);
      default: // pnl, total_capital
        return `$${Math.abs(value).toFixed(0)}`;
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header - just show traders count and ranking type */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="size-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[10px] text-gray-400">
            {totalParticipants} traders
          </span>
          <span className="text-[10px] text-gray-600">•</span>
          <span className="text-[10px] text-primary/80">
            Ranked by {getRankingLabel()}
          </span>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-1 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        <div className="col-span-1">#</div>
        <div className="col-span-4">Trader</div>
        <div className="col-span-2 text-right">{getRankingLabel()}</div>
        <div className="col-span-3 text-right">Reward</div>
        <div className="col-span-2 text-right">To 1st</div>
      </div>

      {/* Rankings List */}
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-dark-500 scrollbar-track-transparent">
        {rankings.map((entry, index) => {
          const isCurrentUser = entry.userId === userId;

          // Show separator before user's out-of-top position
          if (entry.isSeparator && index > 0) {
            return (
              <div key={`sep-${entry.userId}`}>
                <div className="flex items-center justify-center py-1 my-1">
                  <MoreHorizontal className="h-4 w-4 text-gray-600" />
                </div>
                <RankingRow
                  entry={entry}
                  isCurrentUser={true}
                  getRankIcon={getRankIcon}
                  getRankBgColor={getRankBgColor}
                  formatDisplayValue={formatDisplayValue}
                  formatDistance={formatDistance}
                />
              </div>
            );
          }

          return (
            <RankingRow
              key={entry.userId}
              entry={entry}
              isCurrentUser={isCurrentUser}
              getRankIcon={getRankIcon}
              getRankBgColor={getRankBgColor}
              formatDisplayValue={formatDisplayValue}
              formatDistance={formatDistance}
            />
          );
        })}
      </div>

      {/* Your Position Summary (if in rankings) */}
      {userRank && (
        <div className="pt-2 mt-2 border-t border-dark-500/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Your Position:</span>
            <span
              className={cn(
                "font-bold",
                userRank <= 3 ? "text-yellow-400" : "text-gray-300",
              )}
            >
              #{userRank} of {totalParticipants}
            </span>
          </div>
        </div>
      )}

      {/* Prize Pool Info */}
      {prizePool > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg p-2.5 border border-yellow-500/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-yellow-400/80 flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              Prize Pool
            </span>
            <span className="font-bold text-yellow-400">
              ${prizePool.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Separate row component for cleaner rendering
function RankingRow({
  entry,
  isCurrentUser,
  getRankIcon,
  getRankBgColor,
  formatDisplayValue,
  formatDistance,
}: {
  entry: RankingEntry;
  isCurrentUser: boolean;
  getRankIcon: (rank: number, isDisqualified: boolean) => React.ReactNode;
  getRankBgColor: (
    rank: number,
    isCurrentUser: boolean,
    isDisqualified: boolean,
  ) => string;
  formatDisplayValue: (value: number) => string;
  formatDistance: (value: number) => string | null;
}) {
  const displayValue = entry.displayValue ?? entry.profitPercent;
  const distanceStr = formatDistance(entry.distanceToFirst);

  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-1 items-center px-2 py-2 rounded-lg border transition-all",
        getRankBgColor(entry.rank, isCurrentUser, entry.isDisqualified),
        isCurrentUser && "ring-1 ring-primary/50",
      )}
    >
      {/* Rank */}
      <div className="col-span-1 flex items-center">
        {getRankIcon(entry.rank, entry.isDisqualified)}
      </div>

      {/* Username */}
      <div className="col-span-4 min-w-0">
        <p
          className={cn(
            "text-xs font-medium truncate",
            isCurrentUser ? "text-primary" : "text-gray-200",
            entry.isDisqualified && "text-red-400 line-through",
          )}
        >
          {isCurrentUser ? "You" : entry.username}
        </p>
      </div>

      {/* Display Value (P&L, ROI, etc based on ranking method) */}
      <div className="col-span-2 text-right">
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            displayValue > 0
              ? "text-green-400"
              : displayValue < 0
                ? "text-red-400"
                : "text-gray-400",
          )}
        >
          {formatDisplayValue(displayValue)}
        </span>
      </div>

      {/* Potential Reward */}
      <div className="col-span-3 text-right">
        {entry.potentialReward > 0 ? (
          <span className="text-xs font-bold text-yellow-400 tabular-nums">
            ${entry.potentialReward.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </div>

      {/* Distance to 1st */}
      <div className="col-span-2 text-right">
        {entry.rank === 1 ? (
          <span className="text-xs text-yellow-400">🏆</span>
        ) : entry.isDisqualified ? (
          <span className="text-xs text-gray-600">—</span>
        ) : distanceStr ? (
          <span className="text-xs text-gray-400 tabular-nums flex items-center justify-end gap-0.5">
            <Target className="h-3 w-3 text-gray-500" />
            {distanceStr}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </div>
    </div>
  );
}
