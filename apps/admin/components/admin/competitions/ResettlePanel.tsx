"use client";

/**
 * Operator UI for `POST /api/competitions/[id]/re-settle`.
 *
 * WHY SEPARATE FROM AdjustResultsPanel. Adjust lets an operator type ranks/prizes by hand.
 * Re-settle voids disputed rounds and lets the ranking engine rebuild the board — the
 * path `06` s7.2 describes after a provider confirms an error.
 *
 * ONE MONEY WRITER. This panel only POSTs; wallets move inside the service.
 * NOT MIRRORED. Admin components stay admin-only.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTerms } from "@/contexts/TerminologyContext";

export interface ResettleRoundRow {
  roundId: string;
  userId: string;
  username?: string;
  status: string;
  rawScore?: number | null;
  attemptNumber: number;
}

export default function ResettlePanel({
  competitionId,
  rounds,
}: {
  competitionId: string;
  rounds: ResettleRoundRow[];
}) {
  const terms = useTerms();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [incidentId, setIncidentId] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const voidable = useMemo(
    () =>
      rounds.filter((r) =>
        ["completed", "abandoned", "expired"].includes(r.status),
      ),
    [rounds],
  );

  const selectedIds = useMemo(
    () => voidable.filter((r) => selected[r.roundId]).map((r) => r.roundId),
    [voidable, selected],
  );

  async function submit() {
    if (!incidentId.trim()) {
      toast.error("Paste an incident id — it is the audit trail.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one round to void.");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Write a reason of at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/competitions/${competitionId}/re-settle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidentId: incidentId.trim(),
            roundIds: selectedIds,
            reason: reason.trim(),
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        toast.error(
          typeof body.error === "string"
            ? body.error
            : "Re-settle refused. Nothing was changed.",
        );
        return;
      }
      toast.success(
        `Re-settled: clawed ${body.data?.clawedBack ?? 0}, paid ${body.data?.paidOut ?? 0}.`,
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  if (voidable.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-700/40 rounded-xl p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-400" />
            Re-settle {terms.contest}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Void disputed rounds, rebuild the ranking from remaining scores, then
            reclaim and repay prizes. Use Adjust results only when you need a hand
            edit without voiding a round.
          </p>
        </div>
        <Button
          type="button"
          variant={open ? "secondary" : "outline"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Open"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-950/30 p-3 text-sm text-amber-100">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Platform fees and Game Master earnings from the first settle are not
              reversed. A player who already spent their prize blocks the whole
              re-settle until their balance covers the reclaim.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resettle-incident">Incident id</Label>
            <Input
              id="resettle-incident"
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              placeholder="Paste incident ObjectId"
            />
          </div>

          <div className="space-y-2">
            <Label>Rounds to void</Label>
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {voidable.map((r) => (
                <li
                  key={r.roundId}
                  className="flex items-center gap-3 rounded border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[r.roundId]}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [r.roundId]: e.target.checked,
                      }))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-100 truncate">
                      {r.username || r.userId} · attempt {r.attemptNumber} ·{" "}
                      {r.status}
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate">
                      {r.roundId}
                      {typeof r.rawScore === "number"
                        ? ` · score ${r.rawScore}`
                        : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resettle-reason">Reason</Label>
            <Textarea
              id="resettle-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provider confirmed error on these rounds…"
              rows={3}
            />
          </div>

          <Button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Re-settling…
              </>
            ) : (
              `Void ${selectedIds.length || "…"} and re-settle`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
