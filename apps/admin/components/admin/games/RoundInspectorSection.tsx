"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Loader2,
  PauseCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResolveRoundDialog } from "./ResolveRoundDialog";
import { RoundDetailPanel, type RoundDetail } from "./RoundDetailPanel";

/**
 * The round inspector (X6, chapter 12 section 4).
 *
 * WHAT IT IS FOR. The reconciliation net handles a missing result on its own - poll, final
 * sweep, then the contest's unresolved policy. But three of its outcomes need a person: a
 * contest on `hold_and_alert` waits indefinitely by design, a round that reached the give-up
 * stage means all three automatic stages failed, and a signature or range rejection is a
 * provider problem nobody will notice from the outside. Before this screen the only way to see
 * any of that was a database query.
 *
 * WHY IT LISTS ONLY ROUNDS NEEDING A DECISION. A list including completed rounds buries the
 * handful that matter. Completed rounds are reachable by id when a dispute needs one.
 *
 * WHAT IT CANNOT DO: enter a score. See `ResolveRoundDialog`.
 */

interface StuckRound {
  roundId: string;
  providerKey: string;
  gameKey: string;
  userId: string;
  status: string;
  contestType: string;
  contestId?: string;
  contestName?: string;
  attemptNumber: number;
  expiresAt?: string;
  pollAttempts?: number;
  createdAt?: string;
  integrityFlags?: string[];
  holdingSettlement: boolean;
}

function statusColour(status: string) {
  switch (status) {
    case "unresolved":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    case "launched":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "pending":
      return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    default:
      // Reason for naming the fallback rather than reusing a neutral grey: a status arriving
      // here that the switch does not know is the shape of bug that made a provider DRAFT
      // render in the same grey as a completed contest. Purple is deliberately odd-looking.
      return "bg-purple-500/10 text-purple-300 border-purple-500/30";
  }
}

export default function RoundInspectorSection() {
  const [rounds, setRounds] = useState<StuckRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoundDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  const loadRounds = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/games/rounds");
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      setRounds(data.rounds ?? []);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (roundId: string) => {
    setDetailLoading(true);
    setResolving(false);
    try {
      const response = await fetch(`/api/games/rounds/${roundId}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      setDetail(data);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  const heldCount = rounds.filter((r) => r.holdingSettlement).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Search className="h-5 w-5 text-violet-400" />
            Round Inspector
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Rounds waiting on a result, and the ones the automatic recovery could not finish.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadRounds} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Reason this is its own banner rather than a column: a held contest is the only state
          on this screen where players are waiting on money, so it must be visible without
          reading any row. */}
      {heldCount > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <PauseCircle className="h-4 w-4" />
            {heldCount} round{heldCount === 1 ? "" : "s"} are holding a contest from settling
          </p>
          <p className="mt-1 text-xs text-red-300/80">
            These contests are set to wait for a person rather than settle without the missing
            result. Nobody is paid until each is resolved.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rounds…
        </div>
      ) : rounds.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-300">No rounds need attention.</p>
          <p className="mt-1 text-xs text-slate-500">
            Every round has either finished or is still inside its play window.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rounds.map((round) => {
            const isOpen = selected === round.roundId;
            return (
              <div
                key={round.roundId}
                className="rounded-lg border border-slate-700 bg-slate-900/50"
              >
                <button
                  type="button"
                  onClick={() => setSelected(isOpen ? null : round.roundId)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs ${statusColour(round.status)}`}
                      >
                        {round.status}
                      </span>
                      {round.holdingSettlement && (
                        <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                          holding settlement
                        </span>
                      )}
                      {round.integrityFlags && round.integrityFlags.length > 0 && (
                        <span className="flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400">
                          <AlertTriangle className="h-3 w-3" />
                          {round.integrityFlags.length} flag
                          {round.integrityFlags.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-200">
                      {round.contestName ?? `${round.contestType} round`}
                      <span className="text-slate-500"> · attempt {round.attemptNumber}</span>
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">
                      {round.roundId}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400">
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {round.expiresAt
                        ? new Date(round.expiresAt).toLocaleString()
                        : "no expiry"}
                    </p>
                    <p className="mt-1 text-slate-500">{round.gameKey}</p>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-slate-700 p-4">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading detail…
                      </div>
                    ) : detail ? (
                      <>
                        <RoundDetailPanel detail={detail} />

                        {resolving ? (
                          <ResolveRoundDialog
                            roundId={round.roundId}
                            stillUnresolved={detail.stillUnresolved ?? 0}
                            onResolved={async () => {
                              setResolving(false);
                              setSelected(null);
                              await loadRounds();
                            }}
                            onCancel={() => setResolving(false)}
                          />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResolving(true)}
                            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                          >
                            End this round…
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
