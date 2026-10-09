"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  calculateCompetitionDifficulty,
  DifficultyLevel,
} from "@/lib/utils/competition-difficulty";
import type { TitleLevel } from "@/lib/constants/levels";
import { resolveGameDefinition } from "@/lib/competitions/game-definitions";
import type { CompetitionListItem } from "@/lib/competitions/types";
import { CompetitionsArena } from "@/components/competitions/arena/CompetitionsArena";

const POLL_FAST = 5_000;
const POLL_NORMAL = 15_000;
const POLL_SLOW = 30_000;

interface Competition extends CompetitionListItem {
  riskLimits?: {
    enabled?: boolean;
    maxDrawdownPercent?: number;
    dailyLossLimitPercent?: number;
  };
  createdAt?: string;
  registrationDeadline?: string;
  playWindowEnd?: string;
}

interface CompetitionsPageContentProps {
  initialCompetitions: Competition[];
  initialBalance: number;
  userInCompetitionIds: string[];
  levelLadder: TitleLevel[];
}

const FILTER_STORAGE_KEY = "competition-filters";

interface SavedFilters {
  viewMode: "card" | "list" | "grid";
  statusFilter: string[];
  rankingFilter: string[];
  assetFilter: string[];
  difficultyFilter: DifficultyLevel[];
  levelFilter: number[];
  sortBy:
    | "newest"
    | "prize"
    | "start"
    | "participants"
    | "entry"
    | "difficulty";
  gameFilter?: string;
}

const loadSavedFilters = (): Partial<SavedFilters> => {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveFilters = (filters: SavedFilters) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
};

function matchesGameFilter(c: Competition, gameFilter: string): boolean {
  if (!gameFilter || gameFilter === "all") return true;
  const def = resolveGameDefinition(c);
  if (gameFilter === "provider") {
    return def.id === "provider" || c.gameType === "provider";
  }
  return def.id === gameFilter;
}

export default function CompetitionsPageContent({
  initialCompetitions,
  initialBalance,
  userInCompetitionIds,
  levelLadder,
}: CompetitionsPageContentProps) {
  const { settings } = useAppSettings();

  const [competitions, setCompetitions] =
    useState<Competition[]>(initialCompetitions);
  const [userBalance, setUserBalance] = useState(initialBalance);
  const [userInCompetitionIdsState, setUserInCompetitionIdsState] =
    useState<string[]>(userInCompetitionIds);
  const userInCompetitions = useMemo(
    () => new Set(userInCompetitionIdsState.map(String)),
    [userInCompetitionIdsState],
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [_lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isHydrated, setIsHydrated] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([
    "active",
    "upcoming",
  ]);
  const [rankingFilter, setRankingFilter] = useState<string[]>([]);
  const [assetFilter, setAssetFilter] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel[]>(
    [],
  );
  const [levelFilter, setLevelFilter] = useState<number[]>([]);
  const [gameFilter, setGameFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "newest" | "prize" | "start" | "participants" | "entry" | "difficulty"
  >("newest");
  const [platformLeverage, setPlatformLeverage] = useState<number>(100);

  useEffect(() => {
    const fetchRiskSettings = async () => {
      try {
        const res = await fetch("/api/trading/risk-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.maxLeverage) {
            setPlatformLeverage(data.settings.maxLeverage);
          }
        }
      } catch {
        // Use default
      }
    };
    fetchRiskSettings();
  }, []);

  const getAdaptivePollInterval = useCallback((comps: Competition[]) => {
    const now = Date.now();
    let soonest = Infinity;
    for (const c of comps) {
      if (c.status === "upcoming") {
        const ms = new Date(c.startTime).getTime() - now;
        if (ms < soonest) soonest = ms;
      }
    }
    if (soonest <= 0) return POLL_FAST;
    if (soonest <= 2 * 60 * 1000) return POLL_FAST;
    if (soonest <= 10 * 60 * 1000) return POLL_NORMAL;
    return POLL_SLOW;
  }, []);

  const triggerStaleTransitions = useCallback(async (comps: Competition[]) => {
    const now = Date.now();
    const stale = comps.filter(
      (c) =>
        c.status === "upcoming" && new Date(c.startTime).getTime() <= now,
    );
    if (stale.length === 0) return false;
    await Promise.allSettled(
      stale.slice(0, 3).map((c) => fetch(`/api/competitions/${c._id}/status`)),
    );
    return true;
  }, []);

  const refreshData = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setIsRefreshing(true);
      try {
        const [competitionsRes, walletRes] = await Promise.all([
          fetch("/api/competitions"),
          fetch("/api/wallet/balance"),
        ]);

        if (competitionsRes.ok) {
          const data = await competitionsRes.json();
          const freshComps: Competition[] = data.competitions || [];
          setCompetitions(freshComps);
          setUserInCompetitionIdsState(data.userInCompetitionIds || []);

          const hadStale = await triggerStaleTransitions(freshComps);
          if (hadStale) {
            await new Promise((r) => setTimeout(r, 2000));
            const retryRes = await fetch("/api/competitions");
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              setCompetitions(retryData.competitions || []);
              setUserInCompetitionIdsState(
                retryData.userInCompetitionIds || [],
              );
            }
          }
        }

        if (walletRes.ok) {
          const walletData = await walletRes.json();
          setUserBalance(walletData.balance ?? initialBalance);
        }

        setLastRefresh(new Date());
      } catch (error) {
        console.error("Error refreshing competitions:", error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [initialBalance, triggerStaleTransitions],
  );

  useEffect(() => {
    const saved = loadSavedFilters();
    if (saved.viewMode === "list") setViewMode("list");
    else if (saved.viewMode === "card" || saved.viewMode === "grid") {
      setViewMode("grid");
    }
    if (saved.statusFilter) setStatusFilter(saved.statusFilter);
    if (saved.rankingFilter) setRankingFilter(saved.rankingFilter);
    if (saved.assetFilter) setAssetFilter(saved.assetFilter);
    if (saved.difficultyFilter) setDifficultyFilter(saved.difficultyFilter);
    if (saved.levelFilter) setLevelFilter(saved.levelFilter);
    if (saved.sortBy) setSortBy(saved.sortBy);
    if (saved.gameFilter) setGameFilter(saved.gameFilter);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      await refreshData(false);
      if (cancelled) return;
      const interval = getAdaptivePollInterval(competitions);
      timer = setTimeout(poll, interval);
    };

    const interval = getAdaptivePollInterval(competitions);
    timer = setTimeout(poll, interval);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshData, getAdaptivePollInterval]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshData(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshData]);

  useEffect(() => {
    if (!isHydrated) return;
    saveFilters({
      viewMode,
      statusFilter,
      rankingFilter,
      assetFilter,
      difficultyFilter,
      levelFilter,
      sortBy,
      gameFilter,
    });
  }, [
    viewMode,
    statusFilter,
    rankingFilter,
    assetFilter,
    difficultyFilter,
    levelFilter,
    sortBy,
    gameFilter,
    isHydrated,
  ]);

  const getCompetitionDifficulty = useCallback(
    (c: Competition) => {
      const start = new Date(c.startTime);
      const end = new Date(c.endTime);
      const durationHours =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      return calculateCompetitionDifficulty({
        entryFeeCredits: c.entryFee || c.entryFeeCredits || 0,
        startingCapital: c.startingCapital || c.startingTradingPoints || 10000,
        leverageAllowed: c.leverage?.max || platformLeverage,
        maxParticipants: c.maxParticipants,
        participantCount: c.currentParticipants,
        durationHours,
        rules: c.rules as never,
        riskLimits: c.riskLimits,
        levelRequirement: c.levelRequirement as never,
      });
    },
    [platformLeverage],
  );

  const applyFilters = useCallback(
    (comps: Competition[]) => {
      let result = [...comps];

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter((c) => {
          const def = resolveGameDefinition(c);
          const hay = [
            c.name,
            c.description,
            def.label,
            c.gameKey,
            c.gameCode,
            c.createdByName,
            c.gameMasterName,
            c.privateGameMasterName,
            c.playMode,
            c.attemptsPolicy,
            ...(c.assetClasses || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(query);
        });
      }

      if (gameFilter && gameFilter !== "all") {
        result = result.filter((c) => matchesGameFilter(c, gameFilter));
      }

      if (rankingFilter.length > 0) {
        result = result.filter((c) =>
          rankingFilter.includes(c.rules?.rankingMethod || ""),
        );
      }

      if (assetFilter.length > 0) {
        result = result.filter((c) =>
          c.assetClasses?.some((asset) => assetFilter.includes(asset)),
        );
      }

      if (difficultyFilter.length > 0) {
        result = result.filter((c) => {
          const difficulty = getCompetitionDifficulty(c);
          return difficultyFilter.includes(difficulty.level);
        });
      }

      if (levelFilter.length > 0) {
        result = result.filter((c) => {
          if (
            levelFilter.includes(0) &&
            (!c.levelRequirement?.enabled || !c.levelRequirement?.minLevel)
          ) {
            return true;
          }
          if (c.levelRequirement?.enabled && c.levelRequirement?.minLevel) {
            return levelFilter.includes(c.levelRequirement.minLevel);
          }
          return false;
        });
      }

      result.sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return (
              new Date(b.createdAt || b.startTime).getTime() -
              new Date(a.createdAt || a.startTime).getTime()
            );
          case "prize":
            return (
              (b.prizePool || b.prizePoolCredits || 0) -
              (a.prizePool || a.prizePoolCredits || 0)
            );
          case "start":
            return (
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            );
          case "participants":
            return (
              (b.currentParticipants || 0) - (a.currentParticipants || 0)
            );
          case "entry":
            return (
              (a.entryFee || a.entryFeeCredits || 0) -
              (b.entryFee || b.entryFeeCredits || 0)
            );
          case "difficulty":
            return (
              getCompetitionDifficulty(a).score -
              getCompetitionDifficulty(b).score
            );
          default:
            return 0;
        }
      });

      return result;
    },
    [
      searchQuery,
      gameFilter,
      rankingFilter,
      assetFilter,
      difficultyFilter,
      levelFilter,
      sortBy,
      getCompetitionDifficulty,
    ],
  );

  const upcomingCompetitions = useMemo(() => {
    if (!statusFilter.includes("upcoming")) return [];
    return applyFilters(competitions.filter((c) => c.status === "upcoming"));
  }, [competitions, applyFilters, statusFilter]);

  const otherCompetitions = useMemo(() => {
    const otherStatuses = statusFilter.filter((s) => s !== "upcoming");
    if (otherStatuses.length === 0) return [];
    return applyFilters(
      competitions.filter((c) => otherStatuses.includes(c.status)),
    );
  }, [competitions, applyFilters, statusFilter]);

  const totalFilteredCount =
    upcomingCompetitions.length + otherCompetitions.length;

  const activeCount = competitions.filter((c) => c.status === "active").length;
  const upcomingCount = competitions.filter(
    (c) => c.status === "upcoming",
  ).length;
  const totalPrizePool = competitions
    .filter((c) => ["active", "upcoming"].includes(c.status))
    .reduce((sum, c) => sum + (c.prizePool || c.prizePoolCredits || 0), 0);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(["active", "upcoming"]);
    setRankingFilter([]);
    setAssetFilter([]);
    setDifficultyFilter([]);
    setLevelFilter([]);
    setGameFilter("all");
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
      rankingFilter.length > 0 ||
      assetFilter.length > 0 ||
      difficultyFilter.length > 0 ||
      levelFilter.length > 0 ||
      (gameFilter && gameFilter !== "all") ||
      statusFilter.length !== 2 ||
      !statusFilter.includes("active") ||
      !statusFilter.includes("upcoming"),
  );

  const availableAssets = useMemo(() => {
    const assets = new Set(competitions.flatMap((c) => c.assetClasses || []));
    return Array.from(assets);
  }, [competitions]);

  // Assets filter only when browsing trading (or all with trading present)
  const showAssets =
    gameFilter === "trading" ||
    gameFilter === "all" ||
    resolveGameDefinition({ gameType: "trading" }).filters.includes("assets");

  const statusValue = statusFilter.join(",") || "active,upcoming";

  return (
    <CompetitionsArena
      competitions={competitions}
      upcomingCompetitions={upcomingCompetitions}
      otherCompetitions={otherCompetitions}
      userBalance={userBalance}
      userInCompetitions={userInCompetitions}
      creditSymbol={settings?.credits?.symbol}
      levelLadder={levelLadder}
      platformLeverage={platformLeverage}
      selectedGameId={gameFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      statusValue={statusValue}
      onStatusChange={(v) =>
        setStatusFilter(v.split(",").map((s) => s.trim()).filter(Boolean))
      }
      gameValue={gameFilter}
      onGameChange={setGameFilter}
      assetValue={assetFilter[0] || ""}
      onAssetChange={(v) => setAssetFilter(v ? [v] : [])}
      showAssets={showAssets}
      assetOptions={availableAssets.map((a) => ({
        value: a,
        label: a.toUpperCase(),
      }))}
      difficultyValue={difficultyFilter[0] || ""}
      onDifficultyChange={(v) =>
        setDifficultyFilter(v ? [v as DifficultyLevel] : [])
      }
      sortValue={sortBy}
      onSortChange={(v) => setSortBy(v as typeof sortBy)}
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      totalFilteredCount={totalFilteredCount}
      liveNow={activeCount}
      startingSoon={upcomingCount}
      totalPrizePool={totalPrizePool}
      isRefreshing={isRefreshing}
      onRefresh={() => refreshData(true)}
    />
  );
}
