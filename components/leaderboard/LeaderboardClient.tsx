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
 * One screen, one dropdown, four kinds of board.
 *
 * Reason: the three tab buttons were three leaderboards standing next to each
 * other with nothing joining them, so a player could not see how trading and
 * games added up to one standing. The board list arrives with every response
 * and is never held here — a per-game board is named by a stored `gameKey`,
 * and a client with its own list stops offering a game the day one is added.
 */
export default function LeaderboardClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [board, setBoard] = useState<string>(GLOBAL_BOARD);
  const [boards, setBoards] = useState<BoardOption[]>([
    { id: GLOBAL_BOARD, label: "Global leaderboard" },
    { id: TRADING_BOARD, label: "Trading performance" },
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
        // The percentages are the ones the server actually used, so an operator
        // changing them in admin changes the explanation too.
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

  const picker = (
    <LeaderboardBoardPicker
      boards={boards}
      value={board}
      onChange={setBoard}
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

  // The trading board brings its own header, because it also owns the
  // table/cards toggle; it is handed the picker to render in the same row.
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

  if (board === GLOBAL_BOARD) {
    return (
      <div className="flex flex-col gap-6">
        <LeaderboardPageHeader
          title="GLOBAL LEADERBOARD"
          subtitle="Everything you do on ChartVolt, in one standing"
          boardPicker={picker}
        />
        <LeaderboardRankCard
          position={myPosition}
          unitLabel="players"
          unrankedMessage="Play a game or trade in a competition to appear on this board"
        />
        <GlobalLeaderboardTable
          entries={globalEntries}
          viewerUserId={currentUserId}
        />
        <RankingsExplainer
          weights={globalWeights}
          intro="Your global place is built from seven things. For each one you are ranked against everyone else who does it, and those positions are combined using the shares below."
          notes={[
            "You are never penalised for something you do not do. If you only play games, the share that would have gone to trading is spread across the things you do take part in — a games-only player can reach #1.",
            "A dash means that part has not counted for you yet.",
            "Trading and Games each have a board of their own. Pick them from the dropdown to see the full figures behind those two shares.",
          ]}
        />
      </div>
    );
  }

  const selected = boards.find((b) => b.id === board);
  const isGamesRollup = board === GAMES_BOARD;
  return (
    <div className="flex flex-col gap-6">
      <LeaderboardPageHeader
        title={(selected?.label ?? "Games performance").toUpperCase()}
        subtitle={
          isGamesRollup
            ? "Players ranked across every game they play"
            : "Players ranked in this game"
        }
        boardPicker={picker}
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
        showRating={!isGamesRollup}
        startsFromCaption={startsFromCaption}
      />
      <RankingsExplainer
        weights={[]}
        intro={
          isGamesRollup
            ? "Points you earn for finishing a game contest, added up across every game. This is one of the seven things that decide your place on the Global leaderboard."
            : "Points you have earned in this game alone. Your rating is your skill level against the other players of this game."
        }
        notes={[
          "Points come from where you finish and how big the contest was, so a win against more players is worth more.",
          "A game being switched off does not remove what you earned in it.",
        ]}
      />
    </div>
  );
}
