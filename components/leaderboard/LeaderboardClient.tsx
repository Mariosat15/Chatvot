"use client";

import { useState, useEffect, useCallback } from "react";
import LeaderboardContent from "@/components/leaderboard/LeaderboardContent";
import GameLeaderboardTable from "@/components/leaderboard/GameLeaderboardTable";
import GlobalLeaderboardTable, {
  type GlobalBoardRow,
} from "@/components/leaderboard/GlobalLeaderboardTable";
import LeaderboardBoardPicker, {
  type BoardOption,
} from "@/components/leaderboard/LeaderboardBoardPicker";
import LeaderboardPageHeader from "@/components/leaderboard/LeaderboardPageHeader";
import LeaderboardRankCard from "@/components/leaderboard/LeaderboardRankCard";
import RankingsExplainer, {
  type ExplainerWeight,
} from "@/components/leaderboard/RankingsExplainer";
import { useTerms } from "@/contexts/TerminologyContext";
import type { GlobalLeaderboardEntry } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import type { GameLeaderboardEntry } from "@/lib/services/games/game-leaderboard.service";

const PAGE_SIZE = 50;

const GLOBAL_BOARD = "global";
const TRADING_BOARD = "trading";
const GAMES_BOARD = "games";

interface MyPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
}

/**
 * Three boards only: Global, Trading, Games — same layout family throughout.
 *
 * Reason: per-game boards (Circuit Sprint, etc.) duplicated the Games rollup
 * without adding a decision a player needed. The owner asked for three
 * leaderboards that share Trading's chrome so switching boards changes the
 * numbers, not the screen.
 *
 * X8 pass 4: board labels and page chrome read `useTerms()`. Trading stays a
 * literal game name beside `terms.leaderboard` — there is no trading token
 * (chapter 14 boundary 1).
 */
export default function LeaderboardClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const terms = useTerms();
  const [board, setBoard] = useState<string>(GLOBAL_BOARD);
  const [boards, setBoards] = useState<BoardOption[]>(() => [
    { id: GLOBAL_BOARD, label: `Global ${terms.leaderboard}` },
    { id: TRADING_BOARD, label: `Trading ${terms.leaderboard}` },
    { id: GAMES_BOARD, label: `${terms.games} ${terms.leaderboard}` },
  ]);

  const [globalEntries, setGlobalEntries] = useState<GlobalBoardRow[]>([]);
  const [legacyEntries, setLegacyEntries] = useState<GlobalLeaderboardEntry[]>(
    [],
  );
  const [statsEntries, setStatsEntries] = useState<GameLeaderboardEntry[]>([]);
  const [globalWeights, setGlobalWeights] = useState<ExplainerWeight[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [myPosition, setMyPosition] = useState<MyPosition | null>(null);
  const [startsFromCaption, setStartsFromCaption] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const FETCH_TIMEOUT_MS = 35000;

  const fetchPage = useCallback(async (pageNum: number, nextBoard: string) => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        board: nextBoard,
      });
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

      if (Array.isArray(data.boards) && data.boards.length > 0) {
        setBoards(data.boards);
      }
      if (typeof data.startsFromCaption === "string") {
        setStartsFromCaption(data.startsFromCaption);
      }

      setTotalCount(data.totalCount ?? 0);
      setMyPosition(data.myPosition ?? null);
      setPage(data.page ?? 1);

      setGlobalEntries(data.source === "global" ? (data.entries ?? []) : []);
      setLegacyEntries(data.source === "legacy" ? (data.entries ?? []) : []);
      setStatsEntries(data.source === "stats" ? (data.entries ?? []) : []);

      if (data.source === "global") {
        setGlobalWeights(data.weights ?? []);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        setError(
          e.name === "AbortError"
            ? "Request took too long. The server may be busy. Try again."
            : e.message,
        );
      } else {
        setError("Something went wrong");
      }
      setGlobalEntries([]);
      setLegacyEntries([]);
      setStatsEntries([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(1, board);
  }, [fetchPage, board]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > Math.ceil(totalCount / PAGE_SIZE)) return;
      void fetchPage(newPage, board);
    },
    [totalCount, fetchPage, board],
  );

  const handleBoardChange = useCallback((next: string) => {
    // Reason: only the three named boards are offered. An unexpected id from a
    // stale response must not open a per-game view that no longer exists.
    if (
      next === GLOBAL_BOARD ||
      next === TRADING_BOARD ||
      next === GAMES_BOARD
    ) {
      setBoard(next);
    }
  }, []);

  const picker = (
    <LeaderboardBoardPicker
      boards={boards}
      value={board}
      onChange={handleBoardChange}
      disabled={loading}
    />
  );

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void fetchPage(1, board)}
          className="mt-4 text-primary-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (
    loading &&
    globalEntries.length === 0 &&
    legacyEntries.length === 0 &&
    statsEntries.length === 0
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Loading leaderboard…</div>
      </div>
    );
  }

  if (board === TRADING_BOARD) {
    return (
      <LeaderboardContent
        leaderboard={legacyEntries}
        myPosition={myPosition}
        currentUserId={currentUserId}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        loading={loading}
        boardPicker={picker}
      />
    );
  }

  if (board === GAMES_BOARD) {
    return (
      <div className="flex min-h-screen flex-col gap-6">
        <LeaderboardPageHeader
          title={`${terms.games} ${terms.leaderboard}`}
          subtitle={`${terms.players} ranked across every ${terms.game} they play`}
          boardPicker={picker}
        />
        <LeaderboardRankCard
          position={myPosition}
          unitLabel={terms.players}
          unrankedMessage={`Finish a ${terms.game} ${terms.contest} to appear on this board`}
        />
        <GameLeaderboardTable
          entries={statsEntries}
          myPosition={myPosition}
          currentUserId={currentUserId}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          loading={loading}
          showRating={false}
          startsFromCaption={startsFromCaption}
        />
        <RankingsExplainer
          weights={[]}
          intro={`Points you earn for finishing a ${terms.game} ${terms.contest}, added up across every ${terms.game}. This is one of the seven things that decide your place on the Global ${terms.leaderboard}.`}
          notes={[
            `Points come from where you finish and how big the ${terms.contest} was, so a win against more ${terms.players} is worth more.`,
            `A ${terms.game} being switched off does not remove what you earned in it.`,
            `Click a ${terms.player} name to open their card.`,
          ]}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-6">
      <LeaderboardPageHeader
        title={`Global ${terms.leaderboard}`}
        subtitle="Everything you do on ChartVolt, in one standing"
        boardPicker={picker}
      />
      <LeaderboardRankCard
        position={myPosition}
        unitLabel={terms.players}
        unrankedMessage={`Play a ${terms.game} or trade in a ${terms.contest} to appear on this board`}
      />
      <GlobalLeaderboardTable
        entries={globalEntries}
        viewerUserId={currentUserId}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        loading={loading}
      />
      <RankingsExplainer
        weights={globalWeights}
        intro="Your global place is built from seven things. For each one you are ranked against everyone else who does it, and those positions are combined using the shares below."
        notes={[
          `You are never penalised for something you do not do. If you only play ${terms.games}, the share that would have gone to trading is spread across the things you do take part in — a ${terms.games}-only ${terms.player} can reach #1.`,
          "A dash means that part has not counted for you yet.",
          `Trading ${terms.leaderboard} and ${terms.games} ${terms.leaderboard} each show the full figures behind those two shares.`,
          `Click a ${terms.player} name to open their card.`,
        ]}
      />
    </div>
  );
}
