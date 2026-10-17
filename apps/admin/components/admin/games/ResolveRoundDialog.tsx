"use client";

/**
 * Ending a round from the Round Inspector.
 *
 * PRACTICE may be ended here. A practice round has no money, no ranking and no settlement
 * hold - the player was meant to leave and the round should have closed with them. When it
 * did not, the operator ends it on this screen without raising an incident.
 *
 * PAID contests (competition / challenge) still go through Incident Management, so the reason
 * and the outcome are recorded on the incident. This dialog withholds those and names the hub.
 *
 * IT CANNOT ENTER A SCORE. Scores enter through exactly one function in the main app.
 */

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import HubWithheldAction from "@/components/admin/incidents/HubWithheldAction";
import {
  MIN_REASON_LENGTH,
  RESOLUTION_ACTIONS,
} from "@/lib/admin/round-resolution-actions";

const ACTIONS = [...RESOLUTION_ACTIONS.entries()].map(([id, meta]) => ({
  id,
  ...meta,
}));

interface ResolveRoundDialogProps {
  roundId: string;
  /** Practice has no money attached - end it here. Paid rounds go to the hub. */
  isPractice: boolean;
  stillUnresolved: number;
  onResolved: () => void | Promise<void>;
  onCancel: () => void;
}

export function ResolveRoundDialog({
  roundId,
  isPractice,
  stillUnresolved,
  onResolved,
  onCancel,
}: ResolveRoundDialogProps) {
  const [action, setAction] = useState<string>("void");
  const [reason, setReason] = useState(
    isPractice ? "Practice round closed by operator from Round Inspector." : "",
  );
  const [pending, setPending] = useState(false);

  if (!isPractice) {
    return (
      <div className="space-y-3">
        <HubWithheldAction
          action="Ending this round"
          detail={`${stillUnresolved} rounds still need a decision. Round ${roundId} is ended from the incident, which records the reason.`}
        />
        <Button type="button" variant="outline" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  const chosen = ACTIONS.find((a) => a.id === action) ?? ACTIONS[0];
  const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;

  const handleSubmit = async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/games/rounds/${roundId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }

      toast.success(`Practice round marked "${data.status}".`);
      await onResolved();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div>
        <p className="text-sm font-semibold text-amber-300">End this practice round</p>
        <p className="mt-1 text-xs text-slate-400">
          Practice keeps no result and pays nothing. Ending it here closes the attempt so it
          stops sitting on this list - no incident is needed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.id}
            size="sm"
            variant={action === a.id ? "default" : "outline"}
            onClick={() => setAction(a.id)}
            disabled={pending}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
        <p className="flex items-start gap-2 text-xs text-slate-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          {chosen.consequence}
        </p>
      </div>

      <div>
        <label
          htmlFor="resolve-reason"
          className="block text-xs font-medium text-slate-300"
        >
          Reason (recorded against your name, minimum {MIN_REASON_LENGTH} characters)
        </label>
        <textarea
          id="resolve-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
          rows={2}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-200"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={pending || reasonTooShort}
          className="bg-amber-600 hover:bg-amber-700"
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
