"use client";

/**
 * Operator UI for `POST /api/competitions/[id]/adjust-results`.
 *
 * WHY THIS EXISTS. The route has been guarded and money-correct since R76 (14 Sep 2026) and
 * had **no UI caller at all** - recorded as outstanding in `12` s3.2a/b and X6.5. An operator
 * correcting a settled prize had to call the API by hand, which is how money-adjacent routes
 * quietly never get used and then drift.
 *
 * ONE MONEY WRITER. This panel POSTs to that route and never touches wallets itself. Partial
 * success is real: each adjustment returns its own `success`/`error`, so the UI must surface
 * per-row outcomes rather than a single toast.
 *
 * INCIDENT ID IS REQUIRED. The route refuses without one - it is the audit trail. Listing
 * incidents needs the `incidents` grant, which a competitions-only employee may not hold, so
 * the paste field is the primary control and the optional picker is best-effort.
 *
 * NOT MIRRORED. `apps/admin/components/` is admin-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTerms } from "@/contexts/TerminologyContext";
import { formatVolts } from "@/lib/utils/format-volts";

export interface AdjustableSeat {
  participantId: string;
  userId: string;
  username: string;
  currentRank: number | null;
  prizeAmount: number;
  qualificationStatus?: string | null;
}

interface IncidentOption {
  _id: string;
  title?: string;
  status?: string;
}

interface RowDraft {
  selected: boolean;
  newRank: string;
  newPrize: string;
  disqualify: boolean;
  reinstate: boolean;
  reason: string;
}

interface AdjustmentResultRow {
  participantId: string;
  username?: string;
  success: boolean;
  error?: string;
  adjustment?: string;
  prizeChange?: number;
}

function emptyDraft(): RowDraft {
  return {
    selected: false,
    newRank: "",
    newPrize: "",
    disqualify: false,
    reinstate: false,
    reason: "",
  };
}

export default function AdjustResultsPanel({
  competitionId,
  seats,
  creditSymbol,
}: {
  competitionId: string;
  seats: AdjustableSeat[];
  creditSymbol?: string;
}) {
  const terms = useTerms();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [incidentId, setIncidentId] = useState("");
  const [incidents, setIncidents] = useState<IncidentOption[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastResults, setLastResults] = useState<AdjustmentResultRow[] | null>(
    null,
  );

  useEffect(() => {
    const next: Record<string, RowDraft> = {};
    for (const seat of seats) {
      next[seat.participantId] = emptyDraft();
    }
    setDrafts(next);
  }, [seats]);

  // Best-effort incident list. A 403 means the operator lacks the incidents grant - paste
  // still works, which is the load-bearing path.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/incidents?competitionId=${encodeURIComponent(competitionId)}&limit=20`,
        );
        if (!res.ok) {
          if (!cancelled) setIncidents(null);
          return;
        }
        const data = await res.json();
        const list = (data.incidents ?? data.data ?? []) as IncidentOption[];
        if (!cancelled) setIncidents(Array.isArray(list) ? list : null);
      } catch {
        if (!cancelled) setIncidents(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, competitionId]);

  const selectedCount = useMemo(
    () => Object.values(drafts).filter((d) => d.selected).length,
    [drafts],
  );

  const updateDraft = useCallback(
    (participantId: string, patch: Partial<RowDraft>) => {
      setDrafts((prev) => {
        // Reason: participantId is our own seat id from the loaded board, not a
        // request-supplied object key — Map would be cleaner but Record matches the form state.
        // eslint-disable-next-line security/detect-object-injection -- trusted seat id from loaded board
        const current = prev[participantId] ?? emptyDraft();
        return {
          ...prev,
           
          [participantId]: { ...current, ...patch },
        };
      });
    },
    [],
  );

  const handleSubmit = async () => {
    if (!incidentId.trim()) {
      toast.error("An incident id is required for the audit trail");
      return;
    }

    const adjustments: Array<{
      participantId: string;
      newRank?: number;
      newPrize?: number;
      disqualify?: boolean;
      reinstate?: boolean;
      reason: string;
    }> = [];

    for (const seat of seats) {
      const draft = drafts[seat.participantId];
      if (!draft?.selected) continue;

      if (!draft.reason.trim()) {
        toast.error(`Reason required for ${seat.username}`);
        return;
      }

      const hasChange =
        draft.disqualify ||
        draft.reinstate ||
        draft.newRank.trim() !== "" ||
        draft.newPrize.trim() !== "";
      if (!hasChange) {
        toast.error(`No change selected for ${seat.username}`);
        return;
      }

      if (draft.disqualify && draft.reinstate) {
        toast.error(
          `Cannot disqualify and reinstate ${seat.username} in one adjustment`,
        );
        return;
      }

      const row: (typeof adjustments)[number] = {
        participantId: seat.participantId,
        reason: draft.reason.trim(),
      };

      if (draft.disqualify) row.disqualify = true;
      if (draft.reinstate) row.reinstate = true;

      if (draft.newRank.trim() !== "") {
        const rank = Number(draft.newRank);
        if (!Number.isFinite(rank) || rank < 1) {
          toast.error(`Invalid rank for ${seat.username}`);
          return;
        }
        row.newRank = Math.floor(rank);
      }

      if (draft.newPrize.trim() !== "") {
        const prize = Number(draft.newPrize);
        if (!Number.isFinite(prize) || prize < 0) {
          toast.error(`Invalid prize for ${seat.username}`);
          return;
        }
        row.newPrize = prize;
      }

      adjustments.push(row);
    }

    if (adjustments.length === 0) {
      toast.error("Select at least one player to adjust");
      return;
    }

    setSubmitting(true);
    setLastResults(null);
    try {
      // Reason: the path string is asserted by the UI suite - an import of a helper name is
      // not a use. Keep this literal fetch URL so the structural test can pin the call.
      const res = await fetch(
        `/api/competitions/${competitionId}/adjust-results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidentId: incidentId.trim(),
            adjustments,
          }),
        },
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(
          data.error ||
            "Failed to adjust results. Something went wrong. Please contact support.",
        );
        return;
      }

      const results = (data.results ?? []) as AdjustmentResultRow[];
      setLastResults(results);

      const ok = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed === 0) {
        toast.success(
          `Adjusted ${ok} ${ok === 1 ? terms.player : terms.players}`,
        );
      } else if (ok === 0) {
        toast.error(
          `No adjustments applied (${failed} refused). Check the per-row errors.`,
        );
      } else {
        toast.warning(
          `${ok} applied, ${failed} refused. Check the per-row errors.`,
        );
      }

      router.refresh();
    } catch {
      toast.error(
        "Failed to adjust results. Something went wrong. Please contact support.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (seats.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl mt-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-400" />
            Adjust results
          </h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
            Correct ranks or {terms.prizes.toLowerCase()} on a completed{" "}
            {terms.contest.toLowerCase()}. Every change must cite an incident.
            Money moves only through the existing adjust-results route.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Open"}
        </Button>
      </div>

      {open && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Disqualification reclaims the recorded prize. If the player no
              longer holds enough balance, the route refuses rather than half
              applying. Partial success is possible - read every row result.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Incident id</Label>
            {incidents && incidents.length > 0 && (
              <select
                className="w-full rounded-md border border-gray-600 bg-gray-900 text-gray-100 text-sm px-3 py-2 mb-2"
                value={
                  incidents.some((i) => i._id === incidentId) ? incidentId : ""
                }
                onChange={(e) => setIncidentId(e.target.value)}
              >
                <option value="">Select an incident…</option>
                {incidents.map((inc) => (
                  <option key={inc._id} value={inc._id}>
                    {(inc.title || "Untitled").slice(0, 60)} ({inc.status}) —{" "}
                    {inc._id.slice(-6)}
                  </option>
                ))}
              </select>
            )}
            <Input
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              placeholder="Paste incident ObjectId"
              className="bg-gray-900 border-gray-600 text-gray-100"
            />
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto">
            {seats.map((seat) => {
              const draft = drafts[seat.participantId] ?? emptyDraft();
              const wasDq = seat.qualificationStatus === "disqualified";
              return (
                <div
                  key={seat.participantId}
                  className={`rounded-lg border p-3 ${
                    draft.selected
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-gray-700 bg-gray-800/40"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draft.selected}
                      onChange={(e) =>
                        updateDraft(seat.participantId, {
                          selected: e.target.checked,
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-100">
                          {seat.username}
                        </span>
                        <span className="text-xs text-gray-400">
                          Rank {seat.currentRank ?? "—"} ·{" "}
                          {formatVolts(seat.prizeAmount, creditSymbol)}
                        </span>
                        {wasDq && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-semibold">
                            DISQUALIFIED
                          </span>
                        )}
                      </div>

                      {draft.selected && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-gray-400">
                              New rank
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={draft.newRank}
                              onChange={(e) =>
                                updateDraft(seat.participantId, {
                                  newRank: e.target.value,
                                })
                              }
                              className="bg-gray-900 border-gray-600 text-gray-100 h-9"
                              placeholder={
                                seat.currentRank != null
                                  ? String(seat.currentRank)
                                  : ""
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-400">
                              New {terms.prize.toLowerCase()}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={draft.newPrize}
                              onChange={(e) =>
                                updateDraft(seat.participantId, {
                                  newPrize: e.target.value,
                                })
                              }
                              className="bg-gray-900 border-gray-600 text-gray-100 h-9"
                              placeholder={String(seat.prizeAmount)}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={draft.disqualify}
                              onChange={(e) =>
                                updateDraft(seat.participantId, {
                                  disqualify: e.target.checked,
                                  reinstate: e.target.checked
                                    ? false
                                    : draft.reinstate,
                                })
                              }
                            />
                            Disqualify (reclaim prize)
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={draft.reinstate}
                              onChange={(e) =>
                                updateDraft(seat.participantId, {
                                  reinstate: e.target.checked,
                                  disqualify: e.target.checked
                                    ? false
                                    : draft.disqualify,
                                })
                              }
                            />
                            Reinstate
                          </label>
                          <div className="sm:col-span-2">
                            <Label className="text-xs text-gray-400">
                              Reason (required)
                            </Label>
                            <Textarea
                              value={draft.reason}
                              onChange={(e) =>
                                updateDraft(seat.participantId, {
                                  reason: e.target.value,
                                })
                              }
                              rows={2}
                              className="bg-gray-900 border-gray-600 text-gray-100"
                              placeholder="Why this correction?"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedCount === 0}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying…
              </>
            ) : (
              `Apply ${selectedCount} adjustment${selectedCount === 1 ? "" : "s"}`
            )}
          </Button>

          {lastResults && lastResults.length > 0 && (
            <div className="space-y-1 border-t border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Last run
              </p>
              {lastResults.map((r) => (
                <p
                  key={r.participantId}
                  className={`text-xs ${
                    r.success ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {r.username || r.participantId}:{" "}
                  {r.success
                    ? r.adjustment || "ok"
                    : r.error || "refused"}
                  {typeof r.prizeChange === "number" && r.success
                    ? ` (${formatVolts(r.prizeChange, creditSymbol)})`
                    : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
