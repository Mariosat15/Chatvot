"use client";

import { useState, useEffect, useCallback } from "react";
import LeaderboardContent from "@/components/leaderboard/LeaderboardContent";
import type { GlobalLeaderboardEntry } from "@/lib/actions/leaderboard/global-leaderboard.actions";

const PAGE_SIZE = 50;

interface MyPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

interface LeaderboardClientProps {
  currentUserId: string;
}

export default function LeaderboardClient({
  currentUserId,
}: LeaderboardClientProps) {
  const [entries, setEntries] = useState<GlobalLeaderboardEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [myPosition, setMyPosition] = useState<MyPosition | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const FETCH_TIMEOUT_MS = 35000;

  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(
        `/api/leaderboard?page=${pageNum}&limit=${PAGE_SIZE}`,
        { signal: controller.signal }
      );
      const data = await res.json().catch(() => ({}));
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(
          data.message || data.error || "Failed to load leaderboard"
        );
      }
      setEntries(data.entries ?? []);
      setTotalCount(data.totalCount ?? 0);
      setMyPosition(data.myPosition ?? null);
      setPage(data.page ?? 1);
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === "AbortError") {
          setError("Request took too long. The server may be busy. Try again.");
        } else {
          setError(e.message);
        }
      } else {
        setError("Something went wrong");
      }
      setEntries([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > Math.ceil(totalCount / PAGE_SIZE))
        return;
      fetchPage(newPage);
    },
    [totalCount, fetchPage]
  );

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => fetchPage(1)}
          className="mt-4 text-primary-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Loading leaderboard…</div>
      </div>
    );
  }

  return (
    <>
      <LeaderboardContent
        leaderboard={entries}
        myPosition={myPosition}
        currentUserId={currentUserId}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </>
  );
}
