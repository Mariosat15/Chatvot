"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import type { DifficultyLevel } from "@/lib/utils/competition-difficulty";
import type { TitleLevel } from "@/lib/constants/levels";
import type { CompetitionListItem } from "@/lib/competitions/types";
import {
  COMPETITIONS_PAGE_SIZE,
  type BrowseCompetitionsResult,
} from "@/lib/competitions/browse-types";
import { CompetitionsArena } from "@/components/competitions/arena/CompetitionsArena";

const SEARCH_DEBOUNCE_MS = 350;

interface Competition extends CompetitionListItem {
  riskLimits?: {
    enabled?: boolean;
    maxDrawdownPercent?: number;
    dailyLossLimitPercent?: number;
  };
  createdAt?: string;
  registrationDeadline?: string;
  playWindowEnd?: string;
  bannerUrl?: string;
}

interface CompetitionsPageContentProps {
  initialBrowse: BrowseCompetitionsResult;
  initialBalance: number;
  levelLadder: TitleLevel[];
}

const FILTER_STORAGE_KEY = "competition-filters-v2";

interface SavedFilters {
  viewMode: "grid" | "list";
  statusFilter: string;
  assetFilter: string;
  difficultyFilter: string;
  sortBy: string;
  gameFilter: string;
}

function loadSavedFilters(): Partial<SavedFilters> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveFilters(filters: SavedFilters) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function buildQuery(params: {
  page: number;
  status: string;
  game: string;
  asset: string;
  q: string;
  sort: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(COMPETITIONS_PAGE_SIZE));
  sp.set("status", params.status || "active,upcoming");
  sp.set("game", params.game || "all");
  sp.set("sort", params.sort || "featured");
  if (params.asset) sp.set("asset", params.asset);
  if (params.q.trim()) sp.set("q", params.q.trim());
  return sp.toString();
}

export default function CompetitionsPageContent({
  initialBrowse,
  initialBalance,
  levelLadder,
}: CompetitionsPageContentProps) {
  const { settings } = useAppSettings();

  const [items, setItems] = useState<Competition[]>(
    (initialBrowse.items as Competition[]) || [],
  );
  const [userBalance, setUserBalance] = useState(initialBalance);
  const [userInCompetitionIdsState, setUserInCompetitionIdsState] = useState<
    string[]
  >(initialBrowse.userInCompetitionIds || []);
  const userInCompetitions = useMemo(
    () => new Set(userInCompetitionIdsState.map(String)),
    [userInCompetitionIdsState],
  );

  const [page, setPage] = useState(initialBrowse.page || 1);
  const [pageSize] = useState(initialBrowse.pageSize || COMPETITIONS_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(initialBrowse.totalItems || 0);
  const [totalPages, setTotalPages] = useState(initialBrowse.totalPages || 1);
  const [hasNextPage, setHasNextPage] = useState(
    initialBrowse.hasNextPage || false,
  );
  const [hasPreviousPage, setHasPreviousPage] = useState(
    initialBrowse.hasPreviousPage || false,
  );
  const [kpis, setKpis] = useState(initialBrowse.kpis);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState("active,upcoming");
  const [assetFilter, setAssetFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [platformLeverage, setPlatformLeverage] = useState(100);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);

  const prefetchCache = useRef(new Map<string, BrowseCompetitionsResult>());
  const skipNextFetch = useRef(true);

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
        // default
      }
    };
    fetchRiskSettings();
  }, []);

  useEffect(() => {
    const saved = loadSavedFilters();
    if (saved.viewMode === "list" || saved.viewMode === "grid") {
      setViewMode(saved.viewMode);
    }
    if (saved.statusFilter) setStatusFilter(saved.statusFilter);
    if (typeof saved.assetFilter === "string") setAssetFilter(saved.assetFilter);
    if (typeof saved.difficultyFilter === "string") {
      setDifficultyFilter(saved.difficultyFilter);
    }
    if (saved.sortBy) setSortBy(saved.sortBy);
    if (saved.gameFilter) setGameFilter(saved.gameFilter);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveFilters({
      viewMode,
      statusFilter,
      assetFilter,
      difficultyFilter,
      sortBy,
      gameFilter,
    });
  }, [
    viewMode,
    statusFilter,
    assetFilter,
    difficultyFilter,
    sortBy,
    gameFilter,
    isHydrated,
  ]);

  const applyBrowseResult = useCallback((data: BrowseCompetitionsResult) => {
    setItems((data.items as Competition[]) || []);
    setUserInCompetitionIdsState(data.userInCompetitionIds || []);
    setPage(data.page);
    setTotalItems(data.totalItems);
    setTotalPages(data.totalPages);
    setHasNextPage(data.hasNextPage);
    setHasPreviousPage(data.hasPreviousPage);
    setKpis(data.kpis);
    const assets = new Set<string>();
    for (const c of data.items as Competition[]) {
      for (const a of c.assetClasses || []) {
        if (a) assets.add(a);
      }
    }
    if (assets.size > 0) {
      setAvailableAssets(Array.from(assets).sort());
    }
  }, []);

  const fetchPage = useCallback(
    async (
      nextPage: number,
      opts?: { showSkeleton?: boolean; spinner?: boolean },
    ) => {
      const query = buildQuery({
        page: nextPage,
        status: statusFilter,
        game: gameFilter,
        asset: assetFilter,
        q: debouncedSearch,
        sort: sortBy,
      });
      const cached = prefetchCache.current.get(query);
      if (cached) {
        applyBrowseResult(cached);
        prefetchCache.current.delete(query);
        return;
      }

      if (opts?.showSkeleton) setIsLoading(true);
      if (opts?.spinner) setIsRefreshing(true);
      try {
        const [competitionsRes, walletRes] = await Promise.all([
          fetch(`/api/competitions?${query}`),
          fetch("/api/wallet/balance"),
        ]);

        if (competitionsRes.ok) {
          const data = (await competitionsRes.json()) as BrowseCompetitionsResult;
          applyBrowseResult(data);
        }

        if (walletRes.ok) {
          const walletData = await walletRes.json();
          setUserBalance(walletData.balance ?? initialBalance);
        }
      } catch (error) {
        console.error("Error refreshing competitions:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      statusFilter,
      gameFilter,
      assetFilter,
      debouncedSearch,
      sortBy,
      applyBrowseResult,
      initialBalance,
    ],
  );

  // Prefetch next page after a successful load
  useEffect(() => {
    if (!hasNextPage || isLoading) return;
    const next = page + 1;
    const query = buildQuery({
      page: next,
      status: statusFilter,
      game: gameFilter,
      asset: assetFilter,
      q: debouncedSearch,
      sort: sortBy,
    });
    if (prefetchCache.current.has(query)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/competitions?${query}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as BrowseCompetitionsResult;
        if (!cancelled) prefetchCache.current.set(query, data);
      } catch {
        // prefetch is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    page,
    hasNextPage,
    isLoading,
    statusFilter,
    gameFilter,
    assetFilter,
    debouncedSearch,
    sortBy,
  ]);

  // Refetch when filters / debounced search / page change (skip first hydrate with SSR data)
  useEffect(() => {
    if (!isHydrated) return;
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      // Reason: localStorage may restore filters that diverge from the SSR seed.
      const diverged =
        statusFilter !== "active,upcoming" ||
        gameFilter !== "all" ||
        sortBy !== "featured" ||
        Boolean(assetFilter) ||
        Boolean(debouncedSearch.trim());
      if (!diverged) return;
    }
    prefetchCache.current.clear();
    void fetchPage(page, { showSkeleton: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isHydrated,
    page,
    statusFilter,
    gameFilter,
    assetFilter,
    debouncedSearch,
    sortBy,
  ]);

  // Soft poll current page
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      await fetchPage(page, { showSkeleton: false });
      if (cancelled) return;
      timer = setTimeout(poll, 20_000);
    };
    timer = setTimeout(poll, 20_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchPage, page]);

  const resetToPage1 = useCallback(() => {
    setPage(1);
  }, []);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("active,upcoming");
    setAssetFilter("");
    setDifficultyFilter("");
    setGameFilter("all");
    setSortBy("featured");
    resetToPage1();
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
      assetFilter ||
      difficultyFilter ||
      (gameFilter && gameFilter !== "all") ||
      statusFilter !== "active,upcoming" ||
      sortBy !== "featured",
  );

  const showAssets =
    gameFilter === "trading" || gameFilter === "all";

  return (
    <CompetitionsArena
      competitions={items}
      userBalance={userBalance}
      userInCompetitions={userInCompetitions}
      creditSymbol={settings?.credits?.symbol}
      levelLadder={levelLadder}
      platformLeverage={platformLeverage}
      selectedGameId={gameFilter}
      searchQuery={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      statusValue={statusFilter}
      onStatusChange={(v) => {
        setStatusFilter(v);
        setPage(1);
      }}
      gameValue={gameFilter}
      onGameChange={(v) => {
        setGameFilter(v);
        setPage(1);
      }}
      assetValue={assetFilter}
      onAssetChange={(v) => {
        setAssetFilter(v);
        setPage(1);
      }}
      showAssets={showAssets}
      assetOptions={availableAssets.map((a) => ({
        value: a,
        label: a.toUpperCase(),
      }))}
      difficultyValue={difficultyFilter}
      onDifficultyChange={(v) =>
        setDifficultyFilter(v as DifficultyLevel | "")
      }
      sortValue={sortBy}
      onSortChange={(v) => {
        setSortBy(v);
        setPage(1);
      }}
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      page={page}
      pageSize={pageSize}
      totalItems={totalItems}
      totalPages={totalPages}
      hasNextPage={hasNextPage}
      hasPreviousPage={hasPreviousPage}
      onPageChange={setPage}
      liveNow={kpis.liveNow}
      startingSoon={kpis.startingSoon}
      totalPrizePool={kpis.totalPrizePool}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      onRefresh={() => fetchPage(page, { spinner: true })}
    />
  );
}
