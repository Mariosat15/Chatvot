"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Skull, Target, Swords, Crown, Loader2 } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";

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

interface GameLiveRankingPanelProps {
  competitionId: string;
  userId?: string;
  className?: string;
}

export default function GameLiveRankingPanel({
  competitionId,
  userId,
  className,
}: GameLiveRankingPanelProps) {
  const { settings } = useAppSettings();
  const currSymbol = settings?.currency?.symbol || "€";
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
      if (!response.ok) {
        const data = await response.json();
        if (data.status === "completed" || data.status === "cancelled") {
          setError("Competition ended");
          return;
        }
        throw new Error(data.error || "Failed to fetch");
      }

      const data = await response.json();
      setRankings(data.rankings || []);
      setUserRank(data.userRank);
      setTotalParticipants(data.totalParticipants || 0);
      setPrizePool(data.prizePool || 0);
      setRankingMethod(data.rankingMethod || "pnl");
      setError(null);
    } catch (err) {
      console.error("Error fetching rankings:", err);
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetchRankings();
    // Poll every 15 seconds (reduced from 5s to lower server load)
    const interval = setInterval(fetchRankings, 15000);
    return () => clearInterval(interval);
  }, [fetchRankings]);

  // Reason: Listen for the "rankingRefreshNeeded" custom event dispatched when a
  // position is closed. This triggers an immediate re-fetch so the user sees
  // updated win rate / PnL without waiting for the next 15-second poll.
  useEffect(() => {
    const handleRefresh = () => {
      fetchRankings();
    };
    window.addEventListener("rankingRefreshNeeded", handleRefresh);
    return () => window.removeEventListener("rankingRefreshNeeded", handleRefresh);
  }, [fetchRankings]);

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
        return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
      case "total_wins":
        return value.toString();
      case "profit_factor":
        return value.toFixed(2);
      default:
        return `${value >= 0 ? "+" : "-"}${currSymbol}${Math.abs(value).toFixed(0)}`;
    }
  };

  // Format distance to first
  const formatDistance = (value: number) => {
    if (value === 0) return null;
    switch (rankingMethod) {
      case "roi":
      case "win_rate":
        return `${value.toFixed(1)}%`;
      case "total_wins":
        return value.toString();
      default:
        return `${currSymbol}${Math.abs(value).toFixed(0)}`;
    }
  };

  // Get rank display with gaming flair
  const getRankDisplay = (rank: number, isDisqualified: boolean) => {
    if (isDisqualified) {
      return <Skull className="w-4 h-4 text-red-500" />;
    }
    switch (rank) {
      case 1:
        return <span className="text-lg">🥇</span>;
      case 2:
        return <span className="text-lg">🥈</span>;
      case 3:
        return <span className="text-lg">🥉</span>;
      default:
        return (
          <span className="text-xs font-bold text-purple-300">#{rank}</span>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 p-6">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="text-purple-300 text-sm">Loading rankings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 p-4">
        <div className="text-center text-gray-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 overflow-hidden",
        className,
      )}
    >
      {/* Gaming Header */}
      <div className="bg-gradient-to-r from-yellow-600 via-orange-500 to-red-500 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-white drop-shadow-lg" />
          <span className="text-white font-bold text-lg">Leaderboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
          <span className="text-white/90 text-xs font-medium">
            {totalParticipants} warriors
          </span>
        </div>
      </div>

      {/* Ranking Method Badge */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-purple-400 uppercase tracking-wider font-medium">
            ⚔️ Ranked by {getRankingLabel()}
          </span>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-purple-500/10 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
        <div className="col-span-1">#</div>
        <div className="col-span-4">Warrior</div>
        <div className="col-span-2 text-right">{getRankingLabel()}</div>
        <div className="col-span-3 text-right">💰 Reward</div>
        <div className="col-span-2 text-right">🎯 Gap</div>
      </div>

      {/* Rankings List */}
      <div className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-transparent">
        {rankings.map((entry, index) => {
          const isCurrentUser = entry.userId === userId;
          const displayValue = entry.displayValue ?? entry.profitPercent;
          const distanceStr = formatDistance(entry.distanceToFirst);

          // Separator for user outside top 10
          if (entry.isSeparator && index > 0) {
            return (
              <div key={`sep-${entry.userId}`}>
                <div className="flex items-center justify-center py-1 my-1">
                  <div className="flex items-center gap-2 text-purple-500">
                    <span className="text-xs">• • •</span>
                  </div>
                </div>
                <RankingRow
                  entry={entry}
                  isCurrentUser={true}
                  displayValue={displayValue}
                  distanceStr={distanceStr}
                  formatDisplayValue={formatDisplayValue}
                  getRankDisplay={getRankDisplay}
                  currSymbol={currSymbol}
                />
              </div>
            );
          }

          return (
            <RankingRow
              key={entry.userId}
              entry={entry}
              isCurrentUser={isCurrentUser}
              displayValue={displayValue}
              distanceStr={distanceStr}
              formatDisplayValue={formatDisplayValue}
              getRankDisplay={getRankDisplay}
              currSymbol={currSymbol}
            />
          );
        })}
      </div>

      {/* Your Position Summary */}
      {userRank && (
        <div className="px-4 py-3 border-t-2 border-purple-500/30 bg-purple-500/10">
          <div className="flex items-center justify-between">
            <span className="text-purple-300 text-sm flex items-center gap-2">
              <Swords className="w-4 h-4" />
              Your Position:
            </span>
            <span
              className={cn(
                "font-black text-lg",
                userRank <= 3 ? "text-yellow-400" : "text-purple-300",
              )}
            >
              #{userRank} of {totalParticipants}
            </span>
          </div>
        </div>
      )}

      {/* Prize Pool - Gaming Style */}
      {prizePool > 0 && (
        <div className="p-3 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 border-t-2 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/game-icons/treasure.png"
                alt="Prize"
                width={24}
                height={24}
                className="drop-shadow-lg"
              />
              <span className="text-yellow-300 font-bold">Prize Pool</span>
            </div>
            <span className="text-2xl font-black text-yellow-400 drop-shadow-lg">
              {currSymbol}{prizePool.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Ranking Row Component
function RankingRow({
  entry,
  isCurrentUser,
  displayValue,
  distanceStr,
  formatDisplayValue,
  getRankDisplay,
  currSymbol,
}: {
  entry: RankingEntry;
  isCurrentUser: boolean;
  displayValue: number;
  distanceStr: string | null;
  formatDisplayValue: (value: number) => string;
  getRankDisplay: (rank: number, isDisqualified: boolean) => React.ReactNode;
  currSymbol: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-1 items-center px-4 py-2.5 transition-all border-b border-purple-500/10",
        isCurrentUser
          ? "bg-gradient-to-r from-purple-500/30 to-pink-500/20 border-l-4 border-l-purple-500"
          : entry.rank <= 3 && !entry.isDisqualified
            ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/5"
            : "hover:bg-purple-500/10",
        entry.isDisqualified && "opacity-60",
      )}
    >
      {/* Rank */}
      <div className="col-span-1 flex items-center justify-center">
        {getRankDisplay(entry.rank, entry.isDisqualified)}
      </div>

      {/* Username */}
      <div className="col-span-4 min-w-0">
        <p
          className={cn(
            "text-sm font-bold truncate",
            isCurrentUser ? "text-purple-300" : "text-white",
            entry.isDisqualified && "text-red-400 line-through",
          )}
        >
          {isCurrentUser ? "⚔️ You" : entry.username}
        </p>
      </div>

      {/* Display Value */}
      <div className="col-span-2 text-right">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
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
          <span className="text-sm font-bold text-yellow-400 tabular-nums">
            {currSymbol}{entry.potentialReward.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </div>

      {/* Distance to 1st */}
      <div className="col-span-2 text-right">
        {entry.rank === 1 ? (
          <span className="text-lg">👑</span>
        ) : entry.isDisqualified ? (
          <span className="text-xs text-gray-600">💀</span>
        ) : distanceStr ? (
          <span className="text-xs text-orange-400 tabular-nums font-medium">
            {distanceStr}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </div>
    </div>
  );
}
