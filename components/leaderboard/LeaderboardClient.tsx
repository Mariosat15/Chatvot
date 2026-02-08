"use client";

import { useState, useEffect, useCallback } from "react";
import LeaderboardContent from "@/components/leaderboard/LeaderboardContent";
import LeaderboardPresenceTracker from "@/components/leaderboard/LeaderboardPresenceTracker";
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

  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/leaderboard?page=${pageNum}&limit=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error("Failed to load leaderboard");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotalCount(data.totalCount ?? 0);
      setMyPosition(data.myPosition ?? null);
      setPage(data.page ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
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
      <LeaderboardPresenceTracker />
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
