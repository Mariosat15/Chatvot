"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import LeaderboardPageHeader from "@/components/leaderboard/LeaderboardPageHeader";
import ActionTermsDialog, { ACTION_TERM_SLUGS } from "@/components/ActionTermsDialog";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  DEFAULT_GM_LEADERBOARD_SORT,
  GM_LEADERBOARD_DEFAULT_PAGE_SIZE,
  GM_LEADERBOARD_SORTS,
  type GmLeaderboardRow,
  type GmLeaderboardSort,
} from "@/lib/services/gamemaster/gm-leaderboard-rules";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

const SORT_LABELS: ReadonlyMap<GmLeaderboardSort, string> = new Map([
  ["activeAffiliates", "Active players"],
  ["affiliates", "All players"],
  ["competitionsCreated", "Competitions created"],
  ["competitionsCompleted", "Competitions completed"],
  ["participants", "Participants"],
  ["entryVolts", "Entry volume"],
]);

// Reason: the tooltip is the reason the control is greyed out (D1). A disabled button
// that names no reason reads as broken; this one says who can change it.
const LOCKED_REASON =
  "You already belong to a Game Master. Only an administrator can move you to another.";

interface BoardResponse {
  rows: GmLeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  asOf: string;
  viewer: { affiliatedGameMasterName?: string; locked: boolean };
}

/**
 * The Game Master leaderboard and the Join GM control (`External game plans/24` s6.1-s6.3).
 *
 * Every row's button state comes from the server (`joinState`), which decides it with the
 * same function the join itself calls - this component never works out who may join whom.
 * Joining is two requests on purpose: the terms dialog records consent against THIS Game
 * Master and returns its id, and the join refuses without it.
 */
export default function GameMasterLeaderboard({ boardPicker }: { boardPicker?: ReactNode }) {
  const { settings } = useAppSettings();
  const [sort, setSort] = useState<GmLeaderboardSort>(DEFAULT_GM_LEADERBOARD_SORT);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<GmLeaderboardRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (nextSort: GmLeaderboardSort, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: nextSort,
        page: String(nextPage),
        limit: String(GM_LEADERBOARD_DEFAULT_PAGE_SIZE),
      });
      const res = await fetch(`/api/gamemasters/leaderboard?${params.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        setError(body?.error || GENERIC_ERROR);
        return;
      }
      setData(body as BoardResponse);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(sort, page);
  }, [load, sort, page]);

  const handleAccepted = async (acceptanceId?: string) => {
    const row = joining;
    setJoining(null);
    if (!row || !acceptanceId) {
      toast.error(GENERIC_ERROR);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/gamemasters/${encodeURIComponent(row.subscriptionId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termsAcceptanceId: acceptanceId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        toast.error(body?.error || GENERIC_ERROR);
      } else {
        toast.success(`You joined ${row.gameMasterName}.`);
      }
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
      void load(sort, page);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex min-h-screen flex-col gap-6">
      <LeaderboardPageHeader
        title="Game Master Leaderboard"
        subtitle="Game Masters ranked by the players they bring and the competitions they run"
        boardPicker={boardPicker}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">
          {data?.viewer.affiliatedGameMasterName
            ? `Your Game Master: ${data.viewer.affiliatedGameMasterName}`
            : "You have not joined a Game Master yet."}
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          Sort by
          {/* Reason: opaque background (R60) - a translucent one paints the browser's own
              option list white on white. */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as GmLeaderboardSort);
              setPage(1);
            }}
            className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-gray-100"
          >
            {GM_LEADERBOARD_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS.get(s) ?? s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="p-8 text-center">
          <p className="text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void load(sort, page)}
            className="mt-4 text-primary-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading && !data ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading leaderboard…</div>
        </div>
      ) : data && data.rows.length === 0 ? (
        <p className="p-8 text-center text-gray-400">No Game Masters are listed yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Game Master</th>
                <th className="px-3 py-2 text-right">Active players</th>
                <th className="px-3 py-2 text-right">All players</th>
                <th className="px-3 py-2 text-right">Created</th>
                <th className="px-3 py-2 text-right">Completed</th>
                <th className="px-3 py-2 text-right">Participants</th>
                <th className="px-3 py-2 text-right">Entry volume</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr key={row.subscriptionId} className="border-t border-gray-800 text-gray-200">
                  <td className="px-3 py-2 tabular-nums">{row.rank}</td>
                  <td className="px-3 py-2 font-medium">{row.gameMasterName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.activeAffiliates}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.affiliates}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.competitionsCreated}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.competitionsCompleted}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.participants}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatVolts(row.entryVolts, { symbol: settings?.credits?.symbol })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <JoinControl row={row} busy={submitting} onJoin={() => setJoining(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {joining && (
        <ActionTermsDialog
          slug={ACTION_TERM_SLUGS.GM_AFFILIATION}
          open
          recordedContext={{ gameMasterId: joining.gameMasterUserId }}
          variables={{ gameMasterName: joining.gameMasterName }}
          onAccept={(id) => void handleAccepted(id)}
          onDecline={() => setJoining(null)}
        />
      )}
    </div>
  );
}

function JoinControl({
  row,
  busy,
  onJoin,
}: {
  row: GmLeaderboardRow;
  busy: boolean;
  onJoin: () => void;
}) {
  switch (row.joinState) {
    case "own":
      return null;
    case "your_gm":
      return (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
          Your Game Master
        </span>
      );
    case "joinable":
      return (
        <button
          type="button"
          disabled={busy}
          onClick={onJoin}
          className="rounded-md bg-primary-500 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-400 disabled:opacity-50"
        >
          Join
        </button>
      );
    default:
      // Reason: "locked" and "unavailable" both render greyed and unclickable. The server
      // refuses either way; the button must not suggest otherwise (owner decision D1).
      return (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={row.joinState === "locked" ? LOCKED_REASON : "Not available to join right now."}
          className="cursor-not-allowed rounded-md bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-400"
        >
          Join
        </button>
      );
  }
}
