"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, SearchX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DIALOG_WIDTH_WIDE } from "@/lib/admin/dialog-widths";
import { formatVolts } from "@/lib/utils/format-volts";
// Type-only: the service reaches the database driver and must not enter the client bundle (R58).
import type { StuckCompetition } from "@/lib/services/competitions/stuck-competitions.service";

const REASON_LABEL: Record<StuckCompetition["reason"], string> = {
  under_minimum_past_start: "Start time passed without enough players",
  cancelled_unrefunded: "Cancelled but not everyone was refunded",
};

const DEFAULT_REASON = "Did not reach the minimum number of players by the start time";

interface Outcome {
  id: string;
  name?: string;
  ok: boolean;
  error?: string;
  refundedCount?: number;
  totalRefunded?: number;
}

/**
 * "Find stuck competitions": scans for contests that are definitely stuck, shows exactly who
 * each refund pays, and cancels + refunds the selected ones. The server re-checks every id
 * before acting, so this screen only proposes.
 */
export default function StuckCompetitionsPanel({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [items, setItems] = useState<StuckCompetition[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);

  const refundable = items.filter((c) => c.refundable);
  const chosen = refundable.filter((c) => selected.has(c.id));
  const totalPlayers = chosen.reduce((a, c) => a + c.totalToPlayers, 0);
  const totalGm = chosen.reduce((a, c) => a + c.totalToGameMaster, 0);

  async function scan() {
    setScanning(true);
    setOutcomes(null);
    setConfirming(false);
    try {
      const res = await fetch("/api/competitions/stuck");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setItems(data.competitions);
      setSelected(new Set());
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please contact support.");
    } finally {
      setScanning(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChosen = refundable.length > 0 && chosen.length === refundable.length;
  function toggleAll() {
    setSelected(allChosen ? new Set() : new Set(refundable.map((c) => c.id)));
  }

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/competitions/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chosen.map((c) => c.id), reason: reason.trim(), confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancel failed");
      const results: Outcome[] = data.results;
      setOutcomes(results);
      const ok = results.filter((r) => r.ok).length;
      if (ok === results.length) toast.success(`${ok} competition(s) cancelled and refunded`);
      else toast.warning(`${ok} of ${results.length} cancelled - see the results`);
      setConfirming(false);
      setSelected(new Set());
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please contact support.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={scan}
        disabled={scanning}
        className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
      >
        {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SearchX className="h-4 w-4 mr-2" />}
        Find stuck competitions
      </Button>

      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className={`${DIALOG_WIDTH_WIDE} max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700`}>
          <DialogHeader>
            <DialogTitle className="text-gray-100">Stuck competitions</DialogTitle>
            <DialogDescription className="text-gray-400">
              Only competitions that are definitely stuck are listed. Every seat is checked against
              the wallet ledger; a competition that does not check out is shown but cannot be refunded here.
            </DialogDescription>
          </DialogHeader>

          {outcomes && (
            <div className="space-y-1 rounded-lg border border-gray-700 p-3">
              {outcomes.map((o) => (
                <div key={o.id} className="flex items-start gap-2 text-sm">
                  {o.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <span className="text-gray-200">{o.name ?? o.id}</span>
                  <span className="text-gray-400">
                    {o.ok ? `${o.refundedCount ?? 0} refunded, ${formatVolts(o.totalRefunded ?? 0)}` : o.error}
                  </span>
                </div>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <p className="py-8 text-center text-gray-400">No stuck competitions found.</p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <Checkbox checked={allChosen} onCheckedChange={toggleAll} disabled={refundable.length === 0} />
                Select all refundable ({refundable.length})
              </label>
              {items.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      disabled={!c.refundable}
                      aria-label={`Select ${c.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-100 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">
                        {REASON_LABEL[c.reason]} · started {new Date(c.startTime).toLocaleString()} ·{" "}
                        {c.seatCount}/{c.minParticipants} players · status {c.status}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-300">
                      <p>To players: {formatVolts(c.totalToPlayers)}</p>
                      {c.funded && <p>To Game Master: {formatVolts(c.totalToGameMaster)} + unused reserve</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-300"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    >
                      {expanded === c.id ? "Hide" : "Who gets what"}
                    </Button>
                  </div>
                  {[...c.issues, ...c.warnings].map((msg, i) => (
                    <p
                      key={i}
                      className={`mt-2 flex items-start gap-1 text-xs ${i < c.issues.length ? "text-red-400" : "text-amber-300"}`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {msg}
                    </p>
                  ))}
                  {expanded === c.id && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-gray-400">
                          <tr>
                            <th className="text-left p-1">Player</th>
                            <th className="text-right p-1">Paid (ledger)</th>
                            <th className="text-right p-1">Refund to player</th>
                            <th className="text-right p-1">Refund to Game Master</th>
                            <th className="text-left p-1">Check</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-200">
                          {c.seats.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-1 text-gray-400">No players joined - nothing to refund.</td>
                            </tr>
                          )}
                          {c.seats.map((s) => (
                            <tr key={s.userId} className="border-t border-gray-700/60">
                              <td className="p-1">{s.username}</td>
                              <td className="p-1 text-right">{formatVolts(s.paid)}</td>
                              <td className="p-1 text-right">{formatVolts(s.refundToPlayer)}</td>
                              <td className="p-1 text-right">{formatVolts(s.refundToGameMaster)}</td>
                              <td className={`p-1 ${s.issue ? "text-red-400" : "text-green-400"}`}>
                                {s.alreadyRefunded ? "Already refunded" : s.issue ?? "OK"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {chosen.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="stuck-reason" className="text-gray-300">Reason shown to players</Label>
              <Textarea
                id="stuck-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={scan} disabled={scanning || running}>
              Scan again
            </Button>
            {confirming ? (
              <Button
                onClick={run}
                disabled={running || reason.trim().length < 5}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm: cancel {chosen.length} and refund {formatVolts(totalPlayers + totalGm)}
              </Button>
            ) : (
              <Button
                onClick={() => setConfirming(true)}
                disabled={chosen.length === 0 || reason.trim().length < 5}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel and refund selected ({chosen.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
