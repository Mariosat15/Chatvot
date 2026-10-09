"use client";

import { RefreshCw } from "lucide-react";
import {
  COMPETITIONS_ARENA_BG,
  gameDefinitions,
  getGameDefinition,
  resolveGameDefinition,
  type GameDefinition,
} from "@/lib/competitions/game-definitions";
import { buildCompetitionPresentation } from "@/lib/competitions/build-competition-presentation";
import type { CompetitionListItem } from "@/lib/competitions/types";
import type { TitleLevel } from "@/lib/constants/levels";
import { formatVolts } from "@/lib/utils/format-volts";
import { isRegistrationClosed } from "@/lib/utils/registration-deadline";
import { calculateCompetitionDifficulty } from "@/lib/utils/competition-difficulty";
import { ArenaHeader } from "./ArenaHeader";
import { ArenaKpiCards } from "./ArenaKpiCards";
import { CompetitionToolbar, type ToolbarFilterOption } from "./CompetitionToolbar";
import { ArenaCompetitionCard } from "./ArenaCompetitionCard";
import { ArenaCompetitionListRow } from "./ArenaCompetitionListRow";
import { useUtcClock } from "./useUtcClock";

export function CompetitionsArena({
  competitions,
  upcomingCompetitions,
  otherCompetitions,
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
  totalFilteredCount,
  liveNow,
  startingSoon,
  totalPrizePool,
  isRefreshing,
  onRefresh,
}: {
  competitions: CompetitionListItem[];
  upcomingCompetitions: CompetitionListItem[];
  otherCompetitions: CompetitionListItem[];
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
  totalFilteredCount: number;
  liveNow: number;
  startingSoon: number;
  totalPrizePool: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const clock = useUtcClock();

  const headerGame: GameDefinition =
    selectedGameId && selectedGameId !== "all"
      ? getGameDefinition(selectedGameId)
      : competitions.length === 1
        ? resolveGameDefinition(competitions[0])
        : gameDefinitions.all;

  const toPresentation = (c: CompetitionListItem) => {
    const difficulty = calculateCompetitionDifficulty({
      entryFeeCredits: Number(c.entryFeeCredits ?? c.entryFee ?? 0) || 0,
      startingCapital:
        Number(c.startingCapital ?? c.startingTradingPoints ?? 10000) || 10000,
      leverageAllowed: c.leverage?.max || platformLeverage,
      maxParticipants: c.maxParticipants,
      participantCount: c.currentParticipants,
      durationHours:
        (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) /
        (1000 * 60 * 60),
      rules: c.rules as never,
      levelRequirement: c.levelRequirement as never,
    });

    return buildCompetitionPresentation(c, {
      isRegistered: userInCompetitions.has(String(c._id)),
      userBalance,
      registrationClosed: isRegistrationClosed({
        registrationDeadline: (c as { registrationDeadline?: string })
          .registrationDeadline,
        startTime: c.startTime,
        gameType: c.gameType,
        playWindowEnd: (c as { playWindowEnd?: string }).playWindowEnd,
      }),
      creditSymbol,
      levelLadder,
      difficultyLabel: difficulty.label,
    });
  };

  const upcomingPresentations = upcomingCompetitions.map(toPresentation);
  const otherPresentations = otherCompetitions.map(toPresentation);

  const statusOptions: ToolbarFilterOption[] = [
    { value: "active,upcoming", label: "All Open" },
    { value: "active", label: "Live" },
    { value: "upcoming", label: "Starting Soon" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "active,upcoming,completed,cancelled", label: "All" },
  ];

  const gameOptions: ToolbarFilterOption[] = [
    { value: "all", label: "All Games" },
    { value: "trading", label: "Trading" },
    { value: "circuitSprint", label: "Circuit Sprint" },
    { value: "voltVelocity", label: "Volt Velocity" },
    { value: "voltStack", label: "Volt Stack" },
    { value: "provider", label: "Other Games" },
  ];

  const difficultyOptions: ToolbarFilterOption[] = [
    { value: "", label: "All" },
    { value: "Novice", label: "Novice" },
    { value: "Apprentice", label: "Apprentice" },
    { value: "Skilled", label: "Skilled" },
    { value: "Expert", label: "Expert" },
    { value: "Elite", label: "Elite" },
    { value: "Master", label: "Master" },
  ];

  const sortOptions: ToolbarFilterOption[] = [
    { value: "newest", label: "Featured" },
    { value: "start", label: "Starting Soon" },
    { value: "prize", label: "Prize Pool" },
    { value: "participants", label: "Players" },
    { value: "entry", label: "Entry Fee" },
    { value: "difficulty", label: "Difficulty" },
  ];

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
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:gap-[16px] sm:px-6 sm:pb-8 sm:pt-4">
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

        <p className="text-sm text-white/55">
          Showing{" "}
          <span className="font-bold text-white">{totalFilteredCount}</span>{" "}
          competitions
        </p>

        {upcomingPresentations.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-amber-200">
              Starting Soon
            </h2>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
                  : "flex flex-col gap-3"
              }
            >
              {upcomingPresentations.map((p) =>
                viewMode === "grid" ? (
                  <ArenaCompetitionCard key={p.id} presentation={p} />
                ) : (
                  <ArenaCompetitionListRow key={p.id} presentation={p} />
                ),
              )}
            </div>
          </section>
        ) : null}

        {otherPresentations.length > 0 ? (
          <section className="space-y-3">
            {upcomingPresentations.length > 0 ? (
              <h2 className="text-lg font-extrabold text-cyan-200">
                Live & More
              </h2>
            ) : null}
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
                  : "flex flex-col gap-3"
              }
            >
              {otherPresentations.map((p) =>
                viewMode === "grid" ? (
                  <ArenaCompetitionCard key={p.id} presentation={p} />
                ) : (
                  <ArenaCompetitionListRow key={p.id} presentation={p} />
                ),
              )}
            </div>
          </section>
        ) : null}

        {totalFilteredCount === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-6 py-16 text-center">
            <p className="text-lg font-bold text-white">No competitions found</p>
            <p className="mt-2 text-sm text-white/55">
              Try clearing filters or searching a different keyword.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
