"use client";

import { useState, useMemo } from "react";
import { formatProfitFactor } from "@/lib/services/trading-metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap,
  LayoutList,
  Sparkles,
  TrendingUp,
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { GameIcon, RankIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import LeaderboardChallengeButton from "@/components/leaderboard/LeaderboardChallengeButton";
import LeaderboardFriendButton from "@/components/leaderboard/LeaderboardFriendButton";
import MatchmakingCards from "@/components/leaderboard/MatchmakingCards";
import LeaderboardPageHeader from "@/components/leaderboard/LeaderboardPageHeader";
import LeaderboardRankCard from "@/components/leaderboard/LeaderboardRankCard";
import RankingsExplainer from "@/components/leaderboard/RankingsExplainer";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileImage from "@/components/ui/ProfileImage";
import ChallengeCreateDialog from "@/components/challenges/ChallengeCreateDialog";
import { useTerms } from "@/contexts/TerminologyContext";
import { cn } from "@/lib/utils";

// Types
interface LeaderboardFilters {
  search: string;
  rankRange: string;
  winRateRange: string;
  tradesRange: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface LeaderboardEntry {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  rank: number;
  isTied?: boolean;
  tiedWith?: string[];
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  totalPnl: number;
  totalPnlPercentage: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  competitionsEntered: number;
  competitionsWon: number;
  podiumFinishes: number;
  challengesEntered?: number;
  challengesWon?: number;
  totalBadges: number;
  legendaryBadges: number;
  overallScore: number;
}

interface MyPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

interface LeaderboardContentProps {
  leaderboard: LeaderboardEntry[];
  myPosition: MyPosition | null;
  currentUserId: string;
  /** When set, show pagination (client fetches one page at a time). */
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  /** The board dropdown, rendered in the shared header. */
  boardPicker?: React.ReactNode;
}

// Sort columns
type SortColumn =
  | "rank"
  | "pnl"
  | "roi"
  | "winrate"
  | "profitfactor"
  | "competitions"
  | "badges"
  | "score";

const defaultFilters: LeaderboardFilters = {
  search: "",
  rankRange: "all",
  winRateRange: "all",
  tradesRange: "all",
  sortBy: "score",
  sortOrder: "desc",
};

export default function LeaderboardContent({
  leaderboard,
  myPosition,
  currentUserId,
  totalCount: propTotalCount,
  page = 1,
  pageSize = 50,
  onPageChange,
  loading: paginationLoading = false,
  boardPicker,
}: LeaderboardContentProps) {
  const terms = useTerms();
  const isPaginated = typeof propTotalCount === "number" && typeof onPageChange === "function";
  const totalCount = propTotalCount ?? leaderboard.length;
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(
    null,
  );
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LeaderboardFilters>(defaultFilters);

  // Handle column sort click
  const handleSort = (column: SortColumn) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder:
        prev.sortBy === column && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
  };

  // Filter and sort the leaderboard
  const filteredLeaderboard = useMemo(() => {
    let result = [...leaderboard];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.username.toLowerCase().includes(searchLower) ||
          entry.email.toLowerCase().includes(searchLower),
      );
    }

    // Rank range filter
    if (filters.rankRange !== "all") {
      const maxRank = parseInt(filters.rankRange.replace("top", ""));
      if (!isNaN(maxRank)) {
        result = result.filter((e) => e.rank <= maxRank);
      }
    }

    // Win rate filter
    if (filters.winRateRange !== "all") {
      switch (filters.winRateRange) {
        case "50plus":
          result = result.filter((e) => e.winRate >= 50);
          break;
        case "60plus":
          result = result.filter((e) => e.winRate >= 60);
          break;
        case "70plus":
          result = result.filter((e) => e.winRate >= 70);
          break;
      }
    }

    // Trades filter
    if (filters.tradesRange !== "all") {
      switch (filters.tradesRange) {
        case "10plus":
          result = result.filter((e) => e.totalTrades >= 10);
          break;
        case "50plus":
          result = result.filter((e) => e.totalTrades >= 50);
          break;
        case "100plus":
          result = result.filter((e) => e.totalTrades >= 100);
          break;
      }
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case "rank":
          comparison = a.rank - b.rank;
          break;
        case "pnl":
          comparison = a.totalPnl - b.totalPnl;
          break;
        case "roi":
          comparison = a.totalPnlPercentage - b.totalPnlPercentage;
          break;
        case "winrate":
          comparison = a.winRate - b.winRate;
          break;
        case "profitfactor":
          comparison = a.profitFactor - b.profitFactor;
          break;
        case "competitions":
          comparison = a.competitionsWon - b.competitionsWon;
          break;
        case "badges":
          comparison = a.totalBadges - b.totalBadges;
          break;
        case "score":
        default:
          comparison = a.overallScore - b.overallScore;
      }
      return filters.sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }, [leaderboard, filters]);

  const hasActiveFilters =
    filters.search ||
    filters.rankRange !== "all" ||
    filters.winRateRange !== "all" ||
    filters.tradesRange !== "all";

  const resetFilters = () => setFilters(defaultFilters);

  // Rank visuals
  const getRankIcon = (rank: number, _isTied?: boolean) => {
    if (rank === 1) return <RankIcon rank={1} size={18} />;
    if (rank === 2) return <RankIcon rank={2} size={18} />;
    if (rank === 3) return <RankIcon rank={3} size={18} />;
    return <span className="text-sm font-bold text-gray-400">#{rank}</span>;
  };

  const getRankGradient = (rank: number, isCurrentUser: boolean) => {
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
  };

  const getLevelFromTitle = (title?: string): number => {
    if (!title) return 3;
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes("beginner") ||
      titleLower.includes("newbie") ||
      titleLower.includes("novice")
    )
      return 1;
    if (titleLower.includes("apprentice")) return 2;
    if (titleLower.includes("intermediate") || titleLower.includes("trader"))
      return 3;
    if (titleLower.includes("advanced") || titleLower.includes("skilled"))
      return 4;
    if (titleLower.includes("expert") || titleLower.includes("veteran"))
      return 5;
    if (titleLower.includes("master")) return 6;
    if (titleLower.includes("grandmaster") || titleLower.includes("elite"))
      return 7;
    if (titleLower.includes("legend") || titleLower.includes("champion"))
      return 8;
    return 3;
  };

  // Sort header component
  const SortHeader = ({
    column,
    label,
    align = "left",
  }: {
    column: SortColumn;
    label: string;
    align?: "left" | "right";
  }) => {
    const isActive = filters.sortBy === column;
    // Reason: the sort glyph occupies width even when it is invisible
    // (`opacity-0`), so on a right-aligned column it pushed the label ~16px
    // left of the numbers below it. Putting the glyph on the LEFT of the label
    // for those columns lets the label's right edge line up with the values,
    // which are flush right. Do not fold this back into a `justify-end` class.
    const icon = (
      <div
        className={cn(
          "transition-transform",
          isActive && filters.sortOrder === "asc" && "rotate-180",
        )}
      >
        {isActive ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
    return (
      <button
        onClick={() => handleSort(column)}
        className={cn(
          "flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors group",
          isActive ? "text-primary-400" : "text-gray-500 hover:text-gray-300",
          align === "right" && "justify-end",
        )}
      >
        {align === "right" ? (
          <>
            {icon}
            {label}
          </>
        ) : (
          <>
            {label}
            {icon}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col gap-6">
      <LeaderboardPageHeader
        title={`Trading ${terms.leaderboard}`}
        subtitle="Traders ranked by how they have traded"
        boardPicker={boardPicker}
        actions={
          <div className="flex p-1 bg-gray-900/80 rounded-xl border border-gray-800 backdrop-blur-sm">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "px-3 sm:px-4 py-2.5 sm:py-2 min-h-[44px] rounded-lg font-semibold text-sm transition-all flex items-center gap-1.5 sm:gap-2",
                viewMode === "table"
                  ? "bg-primary-500 text-white shadow-md"
                  : "text-gray-500 hover:text-white",
              )}
            >
              <LayoutList className="h-4 w-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "px-3 sm:px-4 py-2.5 sm:py-2 min-h-[44px] rounded-lg font-semibold text-sm transition-all flex items-center gap-1.5 sm:gap-2",
                viewMode === "cards"
                  ? "bg-primary-500 text-white shadow-md"
                  : "text-gray-500 hover:text-white",
              )}
            >
              <Sparkles className="h-4 w-4" />
              Match Cards
            </button>
          </div>
        }
      />

      <LeaderboardRankCard
        position={myPosition}
        unitLabel="traders"
        unrankedMessage="Place a trade in a competition to appear on this board"
      />

      {/* Match Cards View */}
      {viewMode === "cards" && (
        <MatchmakingCards currentUserId={currentUserId} />
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <>
          {/* Search & Filters */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur-sm overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search by username or email..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="pl-11 h-11 bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 rounded-xl focus:border-primary-500 focus:ring-primary-500/20"
                />
                {filters.search && (
                  <button
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, search: "" }))
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "h-11 px-4 rounded-xl border-gray-700 bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700 gap-2 font-semibold",
                    showFilters && "bg-gray-700 text-white border-gray-600",
                    hasActiveFilters &&
                      "border-primary-500/50 text-primary-400",
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                  )}
                </Button>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    onClick={resetFilters}
                    className="h-11 px-4 rounded-xl text-gray-500 hover:text-white hover:bg-gray-800"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Rank Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <GameIcon name="trophy" size={14} /> {terms.rank}
                    </label>
                    <select
                      value={filters.rankRange}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          rankRange: e.target.value,
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="all">All Ranks</option>
                      <option value="top10">Top 10</option>
                      <option value="top25">Top 25</option>
                      <option value="top50">Top 50</option>
                      <option value="top100">Top 100</option>
                    </select>
                  </div>

                  {/* Win Rate Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <GameIcon name="target" size={14} /> Win Rate
                    </label>
                    <select
                      value={filters.winRateRange}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          winRateRange: e.target.value,
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="all">Any</option>
                      <option value="50plus">50%+</option>
                      <option value="60plus">60%+</option>
                      <option value="70plus">70%+</option>
                    </select>
                  </div>

                  {/* Trades Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Trades
                    </label>
                    <select
                      value={filters.tradesRange}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          tradesRange: e.target.value,
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="all">Any</option>
                      <option value="10plus">10+ trades</option>
                      <option value="50plus">50+ trades</option>
                      <option value="100plus">100+ trades</option>
                    </select>
                  </div>

                  {/* Results count */}
                  <div className="flex items-end">
                    <div className="w-full h-10 px-4 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center justify-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-300">
                        {isPaginated
                          ? totalCount === 0
                            ? "0 traders"
                            : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} of ${totalCount}`
                          : `${filteredLeaderboard.length} traders`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard Table */}
          <div className="rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-[70px_minmax(180px,1fr)_80px_80px_80px_80px_80px_70px_80px_200px] gap-2 px-6 py-4 bg-gray-950/50 border-b border-gray-800">
              <SortHeader column="rank" label={terms.rank} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Trader
              </span>
              <SortHeader column="pnl" label="P&L" align="right" />
              <SortHeader column="roi" label="Trade ROI" align="right" />
              <SortHeader column="winrate" label="Win Rate" align="right" />
              <SortHeader
                column="profitfactor"
                label="P.Factor"
                align="right"
              />
              <SortHeader column="competitions" label={terms.contests} align="right" />
              <SortHeader column="badges" label="Badges" align="right" />
              <SortHeader column="score" label={terms.score} align="right" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                Actions
              </span>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-800/50">
              {filteredLeaderboard.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800/50 flex items-center justify-center">
                    <Users className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 mb-4 font-medium">
                    No traders match your filters
                  </p>
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl"
                  >
                    Reset Filters
                  </Button>
                </div>
              ) : (
                filteredLeaderboard.map((entry) => {
                  const isCurrentUser = entry.userId === currentUserId;

                  return (
                    <div
                      key={entry.userId}
                      className={cn(
                        "grid grid-cols-[70px_minmax(180px,1fr)_80px_80px_80px_80px_80px_70px_80px_200px] gap-2 px-6 py-4 items-center transition-all",
                        getRankGradient(entry.rank, isCurrentUser),
                      )}
                    >
                      {/* Rank */}
                      <div className="flex items-center">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm",
                            entry.rank === 1 &&
                              "bg-gradient-to-br from-yellow-500/30 to-amber-500/30 text-yellow-400 border border-yellow-500/30",
                            entry.rank === 2 &&
                              "bg-gradient-to-br from-gray-400/30 to-gray-500/30 text-gray-300 border border-gray-500/30",
                            entry.rank === 3 &&
                              "bg-gradient-to-br from-amber-600/30 to-orange-600/30 text-amber-500 border border-amber-600/30",
                            entry.rank > 3 &&
                              "bg-gray-800/50 text-gray-400 border border-gray-700/50",
                          )}
                        >
                          {entry.rank <= 3
                            ? getRankIcon(entry.rank)
                            : `#${entry.rank}`}
                        </div>
                      </div>

                      {/* Trader Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                          <ProfileImage
                            src={entry.profileImage}
                            fallbackLetter={entry.username}
                            size="md"
                            className="rounded-xl"
                          />
                          {isCurrentUser && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                              <span className="text-[10px] text-white font-bold">
                                YOU
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                setSelectedUser(entry);
                                setShowProfileCard(true);
                              }}
                              className={cn(
                                "font-semibold truncate hover:underline cursor-pointer transition-colors text-sm",
                                isCurrentUser
                                  ? "text-primary-400"
                                  : "text-white hover:text-primary-400",
                              )}
                            >
                              {entry.username}
                            </button>
                            {entry.userTitle && (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[11px] font-bold flex-shrink-0 bg-gray-800 border border-gray-700 inline-flex items-center gap-1",
                                  entry.userTitleColor || "text-purple-400",
                                )}
                              >
                                {entry.userTitleIcon && entry.userTitleIcon in GAME_ICONS ? (
                                  <GameIcon name={entry.userTitleIcon as GameIconName} size={12} />
                                ) : entry.userTitleIcon ? (
                                  <span>{entry.userTitleIcon}</span>
                                ) : null}
                                {entry.userTitle}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {entry.totalTrades} trades
                          </p>
                        </div>
                      </div>

                      {/* P&L */}
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-bold tabular-nums text-sm",
                            entry.totalPnl >= 0
                              ? "text-green-400"
                              : "text-red-400",
                          )}
                        >
                          {entry.totalPnl >= 0 ? "+" : ""}
                          {entry.totalPnl.toFixed(0)}
                        </p>
                      </div>

                      {/* ROI */}
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-bold tabular-nums text-sm",
                            entry.totalPnlPercentage >= 0
                              ? "text-green-400"
                              : "text-red-400",
                          )}
                        >
                          {entry.totalPnlPercentage >= 0 ? "+" : ""}
                          {entry.totalPnlPercentage.toFixed(2)}%
                        </p>
                      </div>

                      {/* Win Rate */}
                      <div className="text-right">
                        <p className="font-semibold tabular-nums text-sm text-white">
                          {entry.winRate.toFixed(1)}%
                        </p>
                      </div>

                      {/* Profit Factor */}
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-semibold tabular-nums text-sm",
                            entry.profitFactor >= 2
                              ? "text-green-400"
                              : entry.profitFactor >= 1
                                ? "text-yellow-400"
                                : "text-red-400",
                          )}
                        >
                          {formatProfitFactor(entry.profitFactor)}
                        </p>
                      </div>

                      {/* Competitions */}
                      <div className="text-right">
                        <span className="font-semibold tabular-nums text-sm text-yellow-400">
                          {entry.competitionsWon}/{entry.competitionsEntered}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <GameIcon name="starAward" size={16} />
                          <span className="font-semibold text-sm text-gray-300">
                            {entry.totalBadges}
                          </span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Zap className="h-4 w-4 text-primary-400" />
                          <span className="font-black text-primary-400 tabular-nums">
                            {entry.overallScore.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-center gap-4">
                        {!isCurrentUser ? (
                          <>
                            <LeaderboardFriendButton
                              userId={entry.userId}
                              username={entry.username}
                              isCurrentUser={isCurrentUser}
                            />
                            <LeaderboardChallengeButton
                              userId={entry.userId}
                              username={entry.username}
                              isCurrentUser={isCurrentUser}
                              winRate={entry.winRate}
                              totalTrades={entry.totalTrades}
                              competitionsEntered={entry.competitionsEntered}
                              competitionsWon={entry.competitionsWon}
                              challengesEntered={entry.challengesEntered || 0}
                              challengesWon={entry.challengesWon || 0}
                              level={getLevelFromTitle(entry.userTitle)}
                              profileImage={entry.profileImage}
                            />
                          </>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 text-xs font-bold">
                            • You
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination - when data is loaded via API (one page at a time) */}
            {isPaginated && totalCount > pageSize && (
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-800 bg-gray-950/30">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  disabled={page <= 1 || paginationLoading}
                  onClick={() => onPageChange?.(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-400">
                  {paginationLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    `Page ${page} of ${Math.ceil(totalCount / pageSize)}`
                  )}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  disabled={
                    page >= Math.ceil(totalCount / pageSize) || paginationLoading
                  }
                  onClick={() => onPageChange?.(page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Cards - Only visible on small screens */}
          <div className="lg:hidden space-y-3">
            {filteredLeaderboard.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;

              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "rounded-xl p-4 border transition-all",
                    isCurrentUser
                      ? "bg-gradient-to-br from-primary-500/10 to-cyan-500/10 border-primary-500/30"
                      : "bg-gray-900/80 border-gray-800",
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {/* Rank Badge */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                        entry.rank === 1 && "bg-yellow-500/20 text-yellow-400",
                        entry.rank === 2 && "bg-gray-500/20 text-gray-300",
                        entry.rank === 3 && "bg-amber-500/20 text-amber-500",
                        entry.rank > 3 && "bg-gray-800 text-gray-400",
                      )}
                    >
                      {entry.rank <= 3
                        ? getRankIcon(entry.rank)
                        : `#${entry.rank}`}
                    </div>

                    {/* Profile Image */}
                    <div className="relative flex-shrink-0">
                      <ProfileImage
                        src={entry.profileImage}
                        fallbackLetter={entry.username}
                        size="md"
                        className="rounded-xl"
                      />
                      {isCurrentUser && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">YOU</span>
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(entry);
                            setShowProfileCard(true);
                          }}
                          className={cn(
                            "font-semibold truncate hover:underline cursor-pointer transition-colors",
                            isCurrentUser ? "text-primary-400" : "text-white hover:text-primary-400",
                          )}
                        >
                          {entry.username}
                        </button>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 text-[11px] bg-primary-500/20 text-primary-400 rounded font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      {entry.userTitle && (
                        <span
                          className={cn(
                            "text-xs inline-flex items-center gap-1",
                            entry.userTitleColor || "text-purple-400",
                          )}
                        >
                          {entry.userTitleIcon && entry.userTitleIcon in GAME_ICONS ? (
                            <GameIcon name={entry.userTitleIcon as GameIconName} size={12} />
                          ) : entry.userTitleIcon ? (
                            <span>{entry.userTitleIcon}</span>
                          ) : null}
                          {entry.userTitle}
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4 text-primary-400" />
                        <span className="font-black text-primary-400">
                          {entry.overallScore.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center p-2 rounded-lg bg-gray-800/50">
                      <p
                        className={cn(
                          "font-bold text-xs",
                          entry.totalPnl >= 0
                            ? "text-green-400"
                            : "text-red-400",
                        )}
                      >
                        {entry.totalPnl >= 0 ? "+" : ""}
                        {entry.totalPnl.toFixed(0)}
                      </p>
                      <p className="text-[11px] text-gray-500">P&L</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-800/50">
                      <p
                        className={cn(
                          "font-bold text-xs",
                          entry.totalPnlPercentage >= 0
                            ? "text-green-400"
                            : "text-red-400",
                        )}
                      >
                        {entry.totalPnlPercentage >= 0 ? "+" : ""}
                        {entry.totalPnlPercentage.toFixed(2)}%
                      </p>
                      <p className="text-[11px] text-gray-500">Trade ROI</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-800/50">
                      <p className="font-bold text-xs text-white">
                        {entry.winRate.toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-gray-500">Win Rate</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-800/50">
                      <p className="font-bold text-xs text-white">
                        {entry.totalTrades}
                      </p>
                      <p className="text-[11px] text-gray-500">Trades</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isCurrentUser && (
                    <div className="flex gap-2">
                      <LeaderboardFriendButton
                        userId={entry.userId}
                        username={entry.username}
                        isCurrentUser={isCurrentUser}
                      />
                      <LeaderboardChallengeButton
                        userId={entry.userId}
                        username={entry.username}
                        isCurrentUser={isCurrentUser}
                        winRate={entry.winRate}
                        totalTrades={entry.totalTrades}
                        competitionsEntered={entry.competitionsEntered}
                        competitionsWon={entry.competitionsWon}
                        challengesEntered={entry.challengesEntered || 0}
                        challengesWon={entry.challengesWon || 0}
                        level={getLevelFromTitle(entry.userTitle)}
                        profileImage={entry.profileImage}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/*
            Reason: this panel used to publish a fixed percentage split — 30%
            Total P&L, 25% ROI and so on — which the score has never been
            computed from. The trading score adds up weighted points rather
            than shares of 100, so the honest thing is to name the ingredients
            in order of influence and not invent percentages for them.
          */}
          <RankingsExplainer
            weights={[]}
            intro={`Your trading ${terms.score} adds up points from everything below. It is one of the seven things that decide your place on the Global ${terms.leaderboard}.`}
            notes={[
              "Profit is worth the most — both the amount you made and how much you made relative to what you started with.",
              "How often you win, and how much you win compared with what you lose, come next.",
              `Winning a ${terms.contest} is worth more than finishing on the podium, and a podium is worth more than a ${terms.challenge} win.`,
              "Badges add a little, and legendary badges add more.",
              "A very high profit factor is capped, so one lucky run without a single loss cannot take the top spot on its own.",
              `Click a ${terms.player} name to open their card.`,
            ]}
          />
        </>
      )}

      {/* Profile Card Modal */}
      {selectedUser && (
        <ProfileCard
          show={showProfileCard}
          userId={selectedUser.userId}
          username={selectedUser.username}
          stats={{
            rank: selectedUser.rank,
            winRate: selectedUser.winRate,
            totalTrades: selectedUser.totalTrades,
            totalPnl: selectedUser.totalPnl,
            competitionsEntered: selectedUser.competitionsEntered,
            competitionsWon: selectedUser.competitionsWon,
            challengesEntered: selectedUser.challengesEntered,
            challengesWon: selectedUser.challengesWon,
            totalBadges: selectedUser.totalBadges,
            overallScore: selectedUser.overallScore,
            userTitle: selectedUser.userTitle,
            userTitleIcon: selectedUser.userTitleIcon,
            userTitleColor: selectedUser.userTitleColor,
          }}
          onClose={() => setShowProfileCard(false)}
        />
      )}

      {/* Challenge Dialog */}
      {showChallengeDialog && selectedUser && (
        <ChallengeCreateDialog
          open={showChallengeDialog}
          onOpenChange={(open) => setShowChallengeDialog(open)}
          challengedUser={{
            userId: selectedUser.userId,
            username: selectedUser.username,
          }}
        />
      )}
    </div>
  );
}
