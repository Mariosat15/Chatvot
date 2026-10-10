"use client";

import { RefreshCw } from "lucide-react";
import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";
import type { CompetitionListItem } from "@/lib/competitions/types";
import type { TitleLevel } from "@/lib/constants/levels";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  ARENA_DIFFICULTY_OPTIONS,
  ARENA_GAME_OPTIONS,
  ARENA_SORT_OPTIONS,
  ARENA_STATUS_OPTIONS,
  buildArenaPresentations,
  resolveArenaHeaderGame,
} from "./arena-shared";
import { ArenaHeader } from "./ArenaHeader";
import { ArenaKpiCards } from "./ArenaKpiCards";
import { CompetitionToolbar, type ToolbarFilterOption } from "./CompetitionToolbar";
import { ArenaCompetitionCard } from "./ArenaCompetitionCard";
import { ArenaCompetitionListRow } from "./ArenaCompetitionListRow";
import { ArenaCompetitionSkeletonGrid } from "./ArenaCompetitionSkeleton";
import { ArenaPagination } from "./ArenaPagination";
import { useUtcClock } from "./useUtcClock";

export function CompetitionsArena({
  competitions,
  userBalance,
  userInCompetitions,
  creditSymbol,
  levelLadder,
  platformLeverage,
  selectedGameId,
  searchQuery,
  onSearchChange,
  statusValue,
  onStatusChange,
  gameValue,
  onGameChange,
  assetValue,
  onAssetChange,
  showAssets,
  assetOptions,
  difficultyValue,
  onDifficultyChange,
  sortValue,
  onSortChange,
  hasActiveFilters,
  onClear,
  viewMode,
  onViewModeChange,
  page,
  pageSize,
  totalItems,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  liveNow,
  startingSoon,
  totalPrizePool,
  isLoading,
  isRefreshing,
  onRefresh,
}: {
  competitions: CompetitionListItem[];
  userBalance: number;
  userInCompetitions: Set<string>;
  creditSymbol?: string;
  levelLadder: TitleLevel[];
  platformLeverage: number;
  selectedGameId: string;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusValue: string;
  onStatusChange: (v: string) => void;
  gameValue: string;
  onGameChange: (v: string) => void;
  assetValue: string;
  onAssetChange: (v: string) => void;
  showAssets: boolean;
  assetOptions: ToolbarFilterOption[];
  difficultyValue: string;
  onDifficultyChange: (v: string) => void;
  sortValue: string;
  onSortChange: (v: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  liveNow: number;
  startingSoon: number;
  totalPrizePool: number;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const clock = useUtcClock();

  const headerGame = resolveArenaHeaderGame(selectedGameId, competitions);
  const presentations = buildArenaPresentations(competitions, {
    userInCompetitions,
    userBalance,
    creditSymbol,
    levelLadder,
    platformLeverage,
  });

  const statusOptions = ARENA_STATUS_OPTIONS;
  const gameOptions = ARENA_GAME_OPTIONS;
  const difficultyOptions = ARENA_DIFFICULTY_OPTIONS;
  const sortOptions = ARENA_SORT_OPTIONS;

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.28), rgba(1,7,20,.50)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:pb-10 sm:pt-5">
        <div className="flex items-center justify-end sm:hidden">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-black/40 text-cyan-200"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <ArenaHeader
          game={headerGame}
          balance={userBalance}
          creditSymbol={creditSymbol}
          serverTime={clock.time}
          serverDate={clock.dateLabel}
        />

        <ArenaKpiCards
          values={{
            liveNow,
            startingSoon,
            prizePoolLabel: formatVolts(totalPrizePool, {
              symbol: creditSymbol,
            }),
          }}
          onSelect={(key) => {
            if (key === "live") onStatusChange("active");
            if (key === "soon") onStatusChange("upcoming");
          }}
        />

        <CompetitionToolbar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          statusOptions={statusOptions}
          statusValue={statusValue}
          onStatusChange={onStatusChange}
          gameOptions={gameOptions}
          gameValue={gameValue}
          onGameChange={onGameChange}
          assetOptions={[{ value: "", label: "All" }, ...assetOptions]}
          assetValue={assetValue}
          onAssetChange={onAssetChange}
          showAssets={showAssets}
          difficultyOptions={difficultyOptions}
          difficultyValue={difficultyValue}
          onDifficultyChange={onDifficultyChange}
          sortOptions={sortOptions}
          sortValue={sortValue}
          onSortChange={onSortChange}
          hasActiveFilters={hasActiveFilters}
          onClear={onClear}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />

        {isLoading ? (
          <ArenaCompetitionSkeletonGrid count={4} />
        ) : presentations.length > 0 ? (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-[14px] lg:grid-cols-2"
                : "flex flex-col gap-3"
            }
          >
            {presentations.map((p) =>
              viewMode === "grid" ? (
                <ArenaCompetitionCard key={p.id} presentation={p} />
              ) : (
                <ArenaCompetitionListRow key={p.id} presentation={p} />
              ),
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-6 py-16 text-center">
            <p className="text-lg font-bold text-white">No competitions found</p>
            <p className="mt-2 text-sm text-white/55">
              Try clearing filters or searching a different keyword.
            </p>
          </div>
        )}

        <ArenaPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
