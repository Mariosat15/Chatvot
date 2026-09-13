"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MIN_REASON_LENGTH,
  RESOLUTION_ACTIONS,
} from "@/lib/admin/round-resolution-actions";

/**
 * The one control in the round inspector that writes anything.
 *
 * IT CANNOT ENTER A SCORE, and that is a deliberate architectural boundary rather than a
 * feature gap. Scores enter through exactly one function, which lives in the main app; a score
 * box here would be a second door into the money path, in the app with the widest privileges.
 * So the operator's power is to end the round - the player's attempt then scores nothing and
 * settlement stops waiting for it.
 *
 * THE CONSEQUENCE IS SHOWN BEFORE THE BUTTON, not after. Ending a round is a decision about a
 * paying player's contest, not a cleanup task: if it was their only attempt they finish on
 * zero. An operator who has not been told that will use this to tidy a list.
 *
 * The reason is mandatory at 10 characters, matching the manual-deposit and emergency-cancel
 * gates. It is what separates a decision from a mistake when somebody reads the audit log six
 * months later.
 */

// Read from the shared module, never redeclared here. This list used to be duplicated, which is
// the "one rule, two copies" shape that has produced four defects in this codebase; the drift it
// invites is a button offering an id the server has renamed, failing with a 400 that reads like a
// permissions problem.
const ACTIONS = [...RESOLUTION_ACTIONS.entries()].map(([id, meta]) => ({
  id,
  ...meta,
}));

interface ResolveRoundDialogProps {
  roundId: string;
  /** How many rounds still hold this contest, so the copy can be honest about the effect. */
  stillUnresolved: number;
  onResolved: () => void | Promise<void>;
  onCancel: () => void;
}

export function ResolveRoundDialog({
  roundId,
  stillUnresolved,
  onResolved,
  onCancel,
}: ResolveRoundDialogProps) {
  const [action, setAction] = useState<string>("void");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

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

      toast.success(`Round marked "${data.status}".`);
      // Reported by the server rather than guessed here: a contest can be held by several
      // rounds, and telling an operator settlement is unblocked when three others still hold it
      // would stop them looking.
      if (data.unblockedSettlement) {
        toast.success("No rounds are holding this contest now - settlement can proceed.");
      }
      await onResolved();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-amber-300">End this round</p>
        <p className="mt-1 text-xs text-slate-400">
          A score cannot be entered here. Results only ever arrive from the provider, through
          one route, so that every score in the system has the same audit trail.
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
        {stillUnresolved > 1 && (
          <p className="mt-2 text-xs text-slate-400">
            {stillUnresolved - 1} other unresolved round
            {stillUnresolved - 1 === 1 ? "" : "s"} in this contest will still be waiting
            afterwards.
          </p>
        )}
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
          rows={3}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-200"
          placeholder="What did you check, and why is this the right outcome?"
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
