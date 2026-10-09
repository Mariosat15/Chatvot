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
} from "../arena-shared";
import type { ToolbarFilterOption } from "../CompetitionToolbar";
import { useUtcClock } from "../useUtcClock";
import { MobileArenaFilters } from "./MobileArenaFilters";
import { MobileArenaHeader } from "./MobileArenaHeader";
import { MobileArenaInfiniteList } from "./MobileArenaInfiniteList";
import { MobileArenaKpis } from "./MobileArenaKpis";

/**
 * Phone arena (below `md`). Same data, filters and presentation builder as the
 * desktop arena; its own layout, one card per row and infinite scroll instead
 * of numbered pages.
 */
export function MobileCompetitionsArena({
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
  liveNow,
  startingSoon,
  totalPrizePool,
  totalItems,
  isLoading,
  isRefreshing,
  onRefresh,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  loadError,
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
  liveNow: number;
  startingSoon: number;
  totalPrizePool: number;
  totalItems: number;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: boolean;
  onLoadMore: () => void;
  loadError: boolean;
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

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.35), rgba(1,7,20,.6)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-3"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          paddingBottom: "max(28px, env(safe-area-inset-bottom))",
          paddingLeft: "max(12px, env(safe-area-inset-left))",
          paddingRight: "max(12px, env(safe-area-inset-right))",
        }}
      >
        <MobileArenaHeader
          game={headerGame}
          balance={userBalance}
          creditSymbol={creditSymbol}
          serverTime={clock.time}
          serverDate={clock.dateLabel}
        />

        <MobileArenaKpis
          liveNow={liveNow}
          startingSoon={startingSoon}
          prizePoolLabel={formatVolts(totalPrizePool, { symbol: creditSymbol })}
          onSelect={(key) => {
            if (key === "live") onStatusChange("active");
            if (key === "soon") onStatusChange("upcoming");
          }}
        />

        <MobileArenaFilters
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          statusOptions={ARENA_STATUS_OPTIONS}
          statusValue={statusValue}
          onStatusChange={onStatusChange}
          gameOptions={ARENA_GAME_OPTIONS}
          gameValue={gameValue}
          onGameChange={onGameChange}
          assetOptions={assetOptions}
          assetValue={assetValue}
          onAssetChange={onAssetChange}
          showAssets={showAssets}
          difficultyOptions={ARENA_DIFFICULTY_OPTIONS}
          difficultyValue={difficultyValue}
          onDifficultyChange={onDifficultyChange}
          sortOptions={ARENA_SORT_OPTIONS}
          sortValue={sortValue}
          onSortChange={onSortChange}
          hasActiveFilters={hasActiveFilters}
          onClear={onClear}
        />

        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-white/60">
            {totalItems} competition{totalItems === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-black/40 text-cyan-200"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <MobileArenaInfiniteList
          presentations={presentations}
          isLoading={isLoading}
          loadError={loadError}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          loadMoreError={loadMoreError}
          onLoadMore={onLoadMore}
          onRetry={onRefresh}
          hasActiveFilters={hasActiveFilters}
          onClear={onClear}
        />
      </div>
    </div>
  );
}
