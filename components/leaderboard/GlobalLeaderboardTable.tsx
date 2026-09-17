"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  X,
  Users,
  Filter,
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import ProfileImage from "@/components/ui/ProfileImage";
import ProfileCard from "@/components/profile/ProfileCard";
import LeaderboardFriendButton from "@/components/leaderboard/LeaderboardFriendButton";
import LeaderboardChallengeButton from "@/components/leaderboard/LeaderboardChallengeButton";
import {
  RankBadge,
  rankRowTint,
} from "@/components/leaderboard/leaderboard-row-chrome";
import { cn } from "@/lib/utils";
import type { GlobalScoreComponentId } from "@/lib/services/leaderboard/global-score";

export interface GlobalBoardRow {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  rank: number;
  isTied: boolean;
  score: number;
  tradingScore: number;
  tradingTrades: number;
  gamePoints: number;
  gamesPlayed: number;
  competitionsWon: number;
  challengesWon: number;
  level: number;
  levelTitle?: string;
  totalBadges: number;
  milestones: number;
  applied: { id: GlobalScoreComponentId; weight: number; position: number }[];
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
}

const COLS =
  "grid-cols-[70px_minmax(180px,1fr)_80px_80px_70px_70px_70px_70px_70px_80px_160px]";

function countedIds(row: GlobalBoardRow): Set<string> {
  return new Set(row.applied.map((a) => a.id));
}

function Cell({
  counted,
  children,
  className,
}: {
  counted: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-right font-mono text-sm tabular-nums", className)}>
      {counted ? children : <span className="text-gray-600">—</span>}
    </div>
  );
}

export default function GlobalLeaderboardTable({
  entries,
  viewerUserId,
  totalCount,
  page = 1,
  pageSize = 50,
  onPageChange,
  loading = false,
}: {
  entries: GlobalBoardRow[];
  viewerUserId?: string;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [rankRange, setRankRange] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<GlobalBoardRow | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const isPaginated =
    typeof totalCount === "number" && typeof onPageChange === "function";
  const count = totalCount ?? entries.length;

  const filtered = useMemo(() => {
    let rows = [...entries];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (e) =>
          e.username.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q),
      );
    }
    if (rankRange !== "all") {
      const max = parseInt(rankRange.replace("top", ""), 10);
      if (!Number.isNaN(max)) rows = rows.filter((e) => e.rank <= max);
    }
    return rows;
  }, [entries, search, rankRange]);

  const hasFilters = Boolean(search) || rankRange !== "all";

  const openProfile = (row: GlobalBoardRow) => {
    setSelected(row);
    setShowProfile(true);
  };

  return (
    <>
      <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search by username or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-11 bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 rounded-xl focus:border-primary-500"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "h-11 px-4 rounded-xl border-gray-700 bg-gray-800/50 text-gray-400 hover:text-white gap-2",
                showFilters && "bg-gray-700 text-white",
                hasFilters && "border-primary-500/50 text-primary-400",
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setRankRange("all");
                }}
                className="h-11 px-4 rounded-xl text-gray-500 hover:text-white"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {showFilters ? (
          <div className="px-4 pb-4 border-t border-gray-800 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Rank
              </label>
              <select
                value={rankRange}
                onChange={(e) => setRankRange(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm"
              >
                <option value="all">All ranks</option>
                <option value="top10">Top 10</option>
                <option value="top25">Top 25</option>
                <option value="top50">Top 50</option>
                <option value="top100">Top 100</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <div className="w-full h-10 px-4 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center justify-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-300">
                  {isPaginated
                    ? count === 0
                      ? "0 players"
                      : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count}`
                    : `${filtered.length} players`}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden shadow-xl">
        <div
          className={cn(
            "hidden lg:grid gap-2 px-6 py-4 bg-gray-950/50 border-b border-gray-800",
            COLS,
          )}
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Rank
          </span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Player
          </span>
          {[
            "Trading",
            "Games",
            "Comps",
            "1v1",
            "Level",
            "Badges",
            "Miles",
            "Score",
          ].map((label) => (
            <span
              key={label}
              className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right"
            >
              {label}
            </span>
          ))}
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
            Actions
          </span>
        </div>

        <div className="hidden lg:block divide-y divide-gray-800/50">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">
                {entries.length === 0
                  ? "Nobody is ranked yet. Play a game or trade to appear here."
                  : "No players match your filters"}
              </p>
            </div>
          ) : (
            filtered.map((row) => {
              const isMe = row.userId === viewerUserId;
              const counted = countedIds(row);
              return (
                <div
                  key={row.userId}
                  className={cn(
                    "grid gap-2 px-6 py-4 items-center transition-all",
                    COLS,
                    rankRowTint(row.rank, Boolean(isMe)),
                  )}
                >
                  <RankBadge rank={row.rank} />
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <ProfileImage
                        src={row.profileImage}
                        fallbackLetter={row.username}
                        size="md"
                        className="rounded-xl"
                      />
                      {isMe ? (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">
                            YOU
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openProfile(row)}
                          className={cn(
                            "font-semibold truncate hover:underline text-sm",
                            isMe
                              ? "text-primary-400"
                              : "text-white hover:text-primary-400",
                          )}
                        >
                          {row.username}
                        </button>
                        {row.userTitle ? (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-800 border border-gray-700 inline-flex items-center gap-1",
                              row.userTitleColor || "text-purple-400",
                            )}
                          >
                            {row.userTitleIcon &&
                            row.userTitleIcon in GAME_ICONS ? (
                              <GameIcon
                                name={row.userTitleIcon as GameIconName}
                                size={12}
                              />
                            ) : null}
                            {row.userTitle}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500">
                        {counted.has("trading")
                          ? `${row.tradingTrades} trades`
                          : counted.has("games")
                            ? `${row.gamesPlayed} games`
                            : "Getting started"}
                      </p>
                    </div>
                  </div>

                  <Cell counted={counted.has("trading")} className="text-gray-300">
                    {Math.round(row.tradingScore).toLocaleString()}
                  </Cell>
                  <Cell counted={counted.has("games")} className="text-gray-300">
                    {Math.round(row.gamePoints).toLocaleString()}
                  </Cell>
                  <Cell
                    counted={counted.has("competitions")}
                    className="text-yellow-400 font-semibold"
                  >
                    {row.competitionsWon}
                  </Cell>
                  <Cell
                    counted={counted.has("challenges")}
                    className="text-cyan-400 font-semibold"
                  >
                    {row.challengesWon}
                  </Cell>
                  <Cell counted={counted.has("level")} className="text-white">
                    {row.level}
                  </Cell>
                  <Cell counted={counted.has("badges")} className="text-gray-300">
                    {row.totalBadges}
                  </Cell>
                  <Cell
                    counted={counted.has("milestones")}
                    className="text-gray-300"
                  >
                    {row.milestones}
                  </Cell>
                  <div className="text-right flex items-center justify-end gap-1.5">
                    <Zap className="h-4 w-4 text-primary-400" />
                    <span className="font-black text-primary-400 tabular-nums">
                      {row.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    {!isMe ? (
                      <>
                        <LeaderboardFriendButton
                          userId={row.userId}
                          username={row.username}
                          isCurrentUser={false}
                        />
                        <LeaderboardChallengeButton
                          userId={row.userId}
                          username={row.username}
                          isCurrentUser={false}
                          competitionsWon={row.competitionsWon}
                          challengesWon={row.challengesWon}
                          level={row.level}
                          profileImage={row.profileImage}
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

        {/* Mobile */}
        <div className="lg:hidden divide-y divide-gray-800/60 p-3 space-y-3">
          {filtered.map((row) => {
            const isMe = row.userId === viewerUserId;
            const counted = countedIds(row);
            return (
              <div
                key={row.userId}
                className={cn(
                  "rounded-xl p-4 border",
                  isMe
                    ? "bg-primary-500/10 border-primary-500/30"
                    : "bg-gray-900/80 border-gray-800",
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <RankBadge rank={row.rank} />
                  <ProfileImage
                    src={row.profileImage}
                    fallbackLetter={row.username}
                    size="md"
                    className="rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => openProfile(row)}
                    className={cn(
                      "font-semibold truncate hover:underline flex-1 text-left",
                      isMe ? "text-primary-400" : "text-white",
                    )}
                  >
                    {row.username}
                  </button>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-primary-400" />
                    <span className="font-black text-primary-400">
                      {row.score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <Stat
                    label="Trading"
                    value={
                      counted.has("trading")
                        ? Math.round(row.tradingScore).toLocaleString()
                        : "—"
                    }
                  />
                  <Stat
                    label="Games"
                    value={
                      counted.has("games")
                        ? Math.round(row.gamePoints).toLocaleString()
                        : "—"
                    }
                  />
                  <Stat label="Comps" value={String(row.competitionsWon)} />
                  <Stat label="Badges" value={String(row.totalBadges)} />
                </div>
                {!isMe ? (
                  <div className="mt-3 flex justify-center gap-4">
                    <LeaderboardFriendButton
                      userId={row.userId}
                      username={row.username}
                      isCurrentUser={false}
                    />
                    <LeaderboardChallengeButton
                      userId={row.userId}
                      username={row.username}
                      isCurrentUser={false}
                      competitionsWon={row.competitionsWon}
                      challengesWon={row.challengesWon}
                      level={row.level}
                      profileImage={row.profileImage}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {isPaginated && count > pageSize ? (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-800 bg-gray-950/30">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange?.(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-gray-400">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin inline" />
              ) : (
                `Page ${page} of ${Math.ceil(count / pageSize)}`
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300"
              disabled={page >= Math.ceil(count / pageSize) || loading}
              onClick={() => onPageChange?.(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <ProfileCard
          show={showProfile}
          userId={selected.userId}
          username={selected.username}
          stats={{
            rank: selected.rank,
            totalTrades: selected.tradingTrades,
            competitionsWon: selected.competitionsWon,
            challengesWon: selected.challengesWon,
            totalBadges: selected.totalBadges,
            overallScore: selected.score,
            userTitle: selected.userTitle,
            userTitleIcon: selected.userTitleIcon,
            userTitleColor: selected.userTitleColor,
          }}
          onClose={() => setShowProfile(false)}
        />
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800/50 p-2">
      <p className="text-gray-500 mb-0.5">{label}</p>
      <p className="font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}
