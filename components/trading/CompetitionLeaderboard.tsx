"use client";

import { useState } from "react";
import { Trophy, Ban, AlertTriangle, Skull, ShieldX } from "lucide-react";
import { useDragScroll } from "@/hooks/useDragScroll";
import { LeaderboardPager, PAGE_SIZE } from "./LeaderboardPager";
import { GameIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import {
  NeonRankBadge,
  neonRowClasses,
} from "@/components/neon/LeaderboardRow";
import { NEON_TABLE_HEAD } from "@/components/neon/tokens";
import ProfileCard from "@/components/profile/ProfileCard";
import { GameMasterBadge } from "@/components/gamemaster/GameMasterBadge";
import {
  isLeaderboardEntryDisqualified,
  leaderboardDisqualificationReason,
} from "./leaderboard-qualification";

interface LeaderboardEntry {
  _id: string;
  userId?: string;
  username: string;
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  currentCapital: number;
  startingCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  currentRank: number;
  status: string;
  isTied?: boolean;
  tiedWith?: string[];
  qualificationStatus?: "qualified" | "disqualified";
  disqualificationReason?: string;
}

interface CompetitionLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  userParticipantId?: string;
  prizeDistribution: { rank: number; percentage: number }[];
  minimumTrades?: number;
  competitionStatus?: "upcoming" | "active" | "completed" | "cancelled";
}

/** One column template for the header and every row, so the two cannot drift apart. */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_96px_88px_80px_84px_64px_72px] items-center gap-3";

/*
 * Five rows per page (`PAGE_SIZE`, owner 12 Oct 2026). The board never scrolls vertically; a
 * wide table is dragged sideways instead of showing a scrollbar.
 */

export default function CompetitionLeaderboard({
  leaderboard,
  userParticipantId,
  prizeDistribution,
  minimumTrades = 0,
  competitionStatus,
}: CompetitionLeaderboardProps) {
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(
    null,
  );
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [page, setPage] = useState(0);
  /*
    The scroller stays mounted even when the board is empty: the hook attaches its listeners
    once, on mount, so a board that starts empty and fills on a live refresh would otherwise
    never become draggable.
  */
  const dragRef = useDragScroll<HTMLDivElement>({
    direction: "horizontal",
    speed: 1,
  });

  const pageCount = Math.max(1, Math.ceil(leaderboard.length / PAGE_SIZE));
  // A live refresh can shrink the board under the open page; clamp rather than show nothing.
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageEntries = leaderboard.slice(pageStart, pageStart + PAGE_SIZE);

  const getPrizePercentage = (rank: number) => {
    const prize = prizeDistribution.find((p) => p.rank === rank);
    return prize ? prize.percentage : 0;
  };

  // Helper to get disqualification icon
  const getDisqualificationIcon = (reason?: string) => {
    if (!reason) return <Ban className="h-3.5 w-3.5" />;

    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes("liquidat"))
      return <Skull className="h-3.5 w-3.5" />;
    if (lowerReason.includes("fraud") || lowerReason.includes("ban"))
      return <ShieldX className="h-3.5 w-3.5" />;
    if (lowerReason.includes("trade"))
      return <AlertTriangle className="h-3.5 w-3.5" />;
    return <Ban className="h-3.5 w-3.5" />;
  };

  // Check if entry is disqualified (either explicitly or via status)
  // Only check minimum trades when competition is completed - don't confuse users during active competition
  const qualification = { competitionStatus, minimumTrades };
  const isEntryDisqualified = (entry: LeaderboardEntry) =>
    isLeaderboardEntryDisqualified(entry, qualification);

  // Get disqualification reason
  const getDisqualificationReason = (entry: LeaderboardEntry) =>
    leaderboardDisqualificationReason(entry, qualification);

  const calculateProfitFactor = (entry: LeaderboardEntry) => {
    if (entry.losingTrades === 0) return entry.winningTrades > 0 ? 9999 : 0;
    return entry.winningTrades / entry.losingTrades;
  };

  const struck = "text-gray-500 line-through";

  return (
    <div>
      <div
        ref={dragRef}
        className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {leaderboard.length === 0 ? (
          <div className="py-12 text-center">
            <Trophy className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              No traders yet - be the first on the board!
            </p>
          </div>
        ) : (
          <div className="min-w-[760px] space-y-2.5">
            {/* Header */}
            <div className={`${GRID} px-4 pb-1 ${NEON_TABLE_HEAD}`}>
              <div>Trader</div>
              <div className="text-right">Capital</div>
              <div className="text-right">P&L</div>
              <div className="text-right">ROI %</div>
              <div className="text-right">Win Rate</div>
              <div className="text-right">Trades</div>
              <div className="text-right">P.Factor</div>
            </div>

            {pageEntries.map((entry, pageIndex) => {
              // The global position, so a rank fallback on page 2 reads 6, not 1.
              const index = pageStart + pageIndex;
              const rank = entry.currentRank || index + 1;
              const isCurrentUser = entry._id === userParticipantId;
              const prizePercentage = getPrizePercentage(rank);
              const isPrizePosition = prizePercentage > 0;
              const winRate =
                entry.totalTrades > 0
                  ? (entry.winningTrades / entry.totalTrades) * 100
                  : 0;
              const profitFactor = calculateProfitFactor(entry);
              const isDisqualified = isEntryDisqualified(entry);
              const disqualificationReason = isDisqualified
                ? getDisqualificationReason(entry)
                : "";

              return (
                <div
                  key={entry._id}
                  /*
                The row shell comes from the shared kit's framed (`flush`) set: a gold frame for
                the leader, a blue glow for "you". Disqualification is tested FIRST and keeps its
                own treatment: it must beat both "this is you" and "this is a paid position",
                because a struck-through row tinted as a winner would read as a prize a
                disqualified trader is about to be paid.
              */
                  className={`relative px-4 py-3.5 ${
                    isDisqualified
                      ? "rounded-xl border border-rose-500/30 bg-rose-500/5 opacity-70"
                      : neonRowClasses({
                          /*
                        `isPrizePosition`, not the raw rank, decides the podium tint here. A
                        trading contest can pay four places or one, so the kit's top-three
                        default would tint a third place that wins nothing and leave a paid
                        fourth plain. The leader keeps rank 1 so it gets the gold frame.
                      */
                          rank: isPrizePosition ? (rank === 1 ? 1 : 2) : 99,
                          isCurrentUser,
                          variant: "flush",
                        })
                  }`}
                >
                  {isDisqualified && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center">
                      <div className="h-[2px] w-full bg-red-500/60" />
                    </div>
                  )}

                  <div className={GRID}>
                    {/* Rank + trader */}
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                          entry.isTied && !isDisqualified
                            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#080C18]"
                            : ""
                        }`}
                      >
                        {isDisqualified ? (
                          <Ban className="h-5 w-5 text-red-500" />
                        ) : (
                          <NeonRankBadge rank={rank} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedUser(entry);
                              setShowProfileCard(true);
                            }}
                            className={`cursor-pointer truncate text-base font-bold transition-colors hover:underline ${
                              isDisqualified
                                ? "text-red-400/70 line-through"
                                : isCurrentUser
                                  ? "text-sky-200"
                                  : "text-gray-100 hover:text-sky-300"
                            }`}
                          >
                            {entry.username}
                          </button>
                          <GameMasterBadge userId={entry.userId} />
                          {entry.userTitle && !isDisqualified && (
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-xs font-semibold ${entry.userTitleColor || "text-purple-400"}`}
                            >
                              {entry.userTitleIcon &&
                              entry.userTitleIcon in GAME_ICONS ? (
                                <GameIcon
                                  name={entry.userTitleIcon as GameIconName}
                                  size={12}
                                />
                              ) : entry.userTitleIcon ? (
                                <span>{entry.userTitleIcon}</span>
                              ) : null}
                              {entry.userTitle}
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="shrink-0 rounded-md border border-sky-400/50 bg-sky-500/20 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
                              You
                            </span>
                          )}
                          {entry.isTied && !isDisqualified && (
                            <span className="flex shrink-0 items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
                              = #{entry.currentRank}
                              {entry.tiedWith && entry.tiedWith.length > 0 && (
                                <span className="text-amber-300/70">
                                  ({entry.tiedWith.length + 1} equal)
                                </span>
                              )}
                            </span>
                          )}
                          {isDisqualified && (
                            <span className="flex shrink-0 items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                              {getDisqualificationIcon(disqualificationReason)}
                              DISQUALIFIED
                            </span>
                          )}
                        </div>
                        {isDisqualified && (
                          <p className="mt-1 text-xs font-medium text-red-400">
                            ❌ Reason: {disqualificationReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Capital */}
                    <div className="flex items-baseline justify-end gap-1 whitespace-nowrap">
                      <span
                        className={`text-base font-bold tabular-nums ${isDisqualified ? struck : "text-gray-100"}`}
                      >
                        {entry.currentCapital.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">pts</span>
                    </div>

                    {/* P&L */}
                    <p
                      className={`text-right text-base font-bold tabular-nums whitespace-nowrap ${
                        isDisqualified
                          ? struck
                          : entry.pnl >= 0
                            ? "text-green-400"
                            : "text-red-400"
                      }`}
                    >
                      {entry.pnl >= 0 ? "+" : ""}
                      {entry.pnl.toFixed(2)}
                    </p>

                    {/* ROI % */}
                    <p
                      className={`text-right text-base font-bold tabular-nums whitespace-nowrap ${
                        isDisqualified
                          ? struck
                          : entry.pnlPercentage >= 0
                            ? "text-green-400"
                            : "text-red-400"
                      }`}
                    >
                      {entry.pnlPercentage >= 0 ? "+" : ""}
                      {entry.pnlPercentage.toFixed(2)}%
                    </p>

                    {/* Win Rate */}
                    <div className="text-right whitespace-nowrap">
                      <p
                        className={`text-base font-bold tabular-nums ${isDisqualified ? struck : "text-gray-100"}`}
                      >
                        {winRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.winningTrades}W/{entry.losingTrades}L
                      </p>
                    </div>

                    {/* Trades */}
                    <p
                      className={`text-right text-base font-bold tabular-nums ${
                        isDisqualified
                          ? competitionStatus === "completed" &&
                            minimumTrades > 0 &&
                            entry.totalTrades < minimumTrades
                            ? "text-red-400"
                            : struck
                          : minimumTrades > 0 &&
                              entry.totalTrades < minimumTrades &&
                              competitionStatus === "active"
                            ? "text-amber-400" // Warning color during active competition
                            : "text-gray-100"
                      }`}
                    >
                      {entry.totalTrades}
                      {minimumTrades > 0 && (
                        <span
                          className={`ml-0.5 text-sm ${
                            entry.totalTrades >= minimumTrades
                              ? "text-green-400"
                              : competitionStatus === "completed"
                                ? "text-red-400"
                                : "text-amber-400"
                          }`}
                        >
                          /{minimumTrades}
                        </span>
                      )}
                    </p>

                    {/* Profit Factor */}
                    <p
                      className={`text-right text-base font-bold tabular-nums whitespace-nowrap ${
                        isDisqualified
                          ? struck
                          : profitFactor >= 2
                            ? "text-green-400"
                            : profitFactor >= 1
                              ? "text-amber-400"
                              : "text-red-400"
                      }`}
                    >
                      {profitFactor === 9999 ? "∞" : profitFactor.toFixed(2)}
                    </p>
                  </div>

                  {/* Prize line (qualified only) */}
                  {isPrizePosition && !isDisqualified && (
                    <div className="mt-3 border-t border-amber-400/20 pt-2.5">
                      <p className="text-sm font-medium text-amber-300">
                        🏆 Prize position: {prizePercentage}% of pool
                        {entry.isTied &&
                          entry.tiedWith &&
                          entry.tiedWith.length > 0 && (
                            <span className="ml-2 text-amber-200/80">
                              (Split with {entry.tiedWith.length} other
                              {entry.tiedWith.length > 1 ? "s" : ""})
                            </span>
                          )}
                      </p>
                    </div>
                  )}

                  {/* No prize - disqualified */}
                  {isPrizePosition && isDisqualified && (
                    <div className="mt-3 border-t border-red-500/30 pt-2.5">
                      <p className="flex items-center gap-1 text-xs text-red-400">
                        <Ban className="h-3 w-3" />
                        Not eligible for prize - {disqualificationReason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <LeaderboardPager
          page={currentPage}
          pageCount={pageCount}
          total={leaderboard.length}
          onPage={setPage}
        />
      )}

      {/* Profile Card Popup */}
      {selectedUser && (
        <ProfileCard
          show={showProfileCard}
          userId={selectedUser._id}
          username={selectedUser.username}
          stats={{
            rank: selectedUser.currentRank,
            winRate:
              selectedUser.totalTrades > 0
                ? (selectedUser.winningTrades / selectedUser.totalTrades) * 100
                : 0,
            totalTrades: selectedUser.totalTrades,
            totalPnl: selectedUser.pnl,
            userTitle: selectedUser.userTitle,
            userTitleIcon: selectedUser.userTitleIcon,
            userTitleColor: selectedUser.userTitleColor,
          }}
          onClose={() => setShowProfileCard(false)}
        />
      )}
    </div>
  );
}
