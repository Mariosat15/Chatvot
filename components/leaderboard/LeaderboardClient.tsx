"use client";

import { useState, useEffect, useCallback } from "react";
import LeaderboardContent from "@/components/leaderboard/LeaderboardContent";
import GameLeaderboardTable from "@/components/leaderboard/GameLeaderboardTable";
import type { GlobalLeaderboardEntry } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import type {
  GameLeaderboardEntry,
  LeaderboardTab,
} from "@/lib/services/games/game-leaderboard.service";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
// Reason: must not import the Mongoose model into a client component (R58).
// Keep this literal identical to OVERALL_GAME_KEY on the model.
const OVERALL_GAME_KEY = "_overall";

interface MyPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

type BoardSource = "legacy" | "stats";

interface LeaderboardClientProps {
  currentUserId: string;
}

export default function LeaderboardClient({
  currentUserId,
}: LeaderboardClientProps) {
  // Reason: R14 — default stays legacy until the top-100 parallel diff is
  // accepted; stats is reachable via the Cross-game tabs immediately.
  const [source, setSource] = useState<BoardSource>("legacy");
  const [gameKey, setGameKey] = useState<string>(OVERALL_GAME_KEY);
  const [tabs, setTabs] = useState<LeaderboardTab[]>([]);

  const [legacyEntries, setLegacyEntries] = useState<GlobalLeaderboardEntry[]>(
    [],
  );
  const [statsEntries, setStatsEntries] = useState<GameLeaderboardEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [myPosition, setMyPosition] = useState<MyPosition | null>(null);
  const [startsFromCaption, setStartsFromCaption] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const FETCH_TIMEOUT_MS = 35000;

  const fetchPage = useCallback(
    async (pageNum: number, nextSource: BoardSource, nextGameKey: string) => {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
          source: nextSource,
        });
        if (nextSource === "stats") {
          params.set("gameKey", nextGameKey);
        }
        const res = await fetch(`/api/leaderboard?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(
            data.message || data.error || "Failed to load leaderboard",
          );
        }

        if (Array.isArray(data.tabs)) {
          setTabs(data.tabs);
        }
        if (typeof data.startsFromCaption === "string") {
          setStartsFromCaption(data.startsFromCaption);
        }

        setTotalCount(data.totalCount ?? 0);
        setMyPosition(data.myPosition ?? null);
        setPage(data.page ?? 1);

        if (nextSource === "stats") {
          setStatsEntries(data.entries ?? []);
          setLegacyEntries([]);
        } else {
          setLegacyEntries(data.entries ?? []);
          setStatsEntries([]);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error) {
          if (e.name === "AbortError") {
            setError(
              "Request took too long. The server may be busy. Try again.",
            );
          } else {
            setError(e.message);
          }
        } else {
          setError("Something went wrong");
        }
        setLegacyEntries([]);
        setStatsEntries([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPage(1, source, gameKey);
  }, [fetchPage, source, gameKey]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > Math.ceil(totalCount / PAGE_SIZE)) return;
      void fetchPage(newPage, source, gameKey);
    },
    [totalCount, fetchPage, source, gameKey],
  );

  const selectLegacy = () => {
    setSource("legacy");
    setGameKey(OVERALL_GAME_KEY);
  };

  const selectStatsTab = (key: string) => {
    setSource("stats");
    setGameKey(key);
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void fetchPage(1, source, gameKey)}
          className="mt-4 text-primary-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && legacyEntries.length === 0 && statsEntries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Loading leaderboard…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 px-1">
        <button
          type="button"
          onClick={selectLegacy}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm border transition-colors",
            source === "legacy"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          Trading (current)
        </button>
        {(tabs.length > 0
          ? tabs
          : [
              {
                gameKey: OVERALL_GAME_KEY,
                label: "Overall",
                isOverall: true,
              },
            ]
        ).map((tab) => (
          <button
            key={tab.gameKey}
            type="button"
            onClick={() => selectStatsTab(tab.gameKey)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm border transition-colors",
              source === "stats" && gameKey === tab.gameKey
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {source === "legacy" ? (
        <LeaderboardContent
          leaderboard={legacyEntries}
          myPosition={myPosition}
          currentUserId={currentUserId}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          loading={loading}
        />
      ) : (
        <GameLeaderboardTable
          entries={statsEntries}
          myPosition={myPosition}
          currentUserId={currentUserId}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          loading={loading}
          showRating={gameKey !== OVERALL_GAME_KEY}
          startsFromCaption={startsFromCaption}
        />
      )}
    </div>
  );
}
