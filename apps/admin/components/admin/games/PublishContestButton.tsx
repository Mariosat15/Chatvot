"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The control that makes a draft provider contest visible to players.
 *
 * WHY IT IS ITS OWN COMPONENT rather than a few lines inside `CompetitionsListSection`:
 * that file is already 617 lines, over the 500-line limit, and this button carries real
 * behaviour - an accumulating refusal list, warnings on success, and a pending state that
 * has to survive a refetch. Inlining it would have buried all three.
 *
 * THE REFUSAL LIST IS THE WHOLE POINT OF THE UI, and it is why a `toast.error` alone will
 * not do. `runPreflight` deliberately **accumulates** its hard refusals rather than stopping
 * at the first, precisely so an operator is not made to fix one problem per submission and
 * give up. A UI that shows only `error` throws that away and reintroduces the behaviour the
 * checklist was written to avoid.
 *
 * There is deliberately no unpublish, so nothing here toggles. Once a contest is visible a
 * player can pay to enter it, and hiding it again would strand paid entrants. Cancelling is
 * the reversible operation and it refunds.
 */

interface PublishContestButtonProps {
  competitionId: string;
  competitionName: string;
  /** Called after a successful publish so the caller can refetch its list. */
  onPublished: () => void | Promise<void>;
}

export function PublishContestButton({
  competitionId,
  competitionName,
  onPublished,
}: PublishContestButtonProps) {
  const [pending, setPending] = useState(false);
  const [refusals, setRefusals] = useState<string[]>([]);

  const handlePublish = async () => {
    setPending(true);
    // Reason: clear the previous refusals before re-asking. Leaving them on screen beside a
    // spinner reads as though the new attempt has already failed the same way.
    setRefusals([]);

    try {
      const response = await fetch(
        `/api/games/contests/${competitionId}/publish`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        // The checklist's refusals are actionable and specific, so they are shown rather
        // than replaced with a generic message. `errors` is the accumulated list; `error` is
        // the one-line summary that introduces it.
        const list: string[] = Array.isArray(data.errors) ? data.errors : [];
        setRefusals(list);
        toast.error(
          data.error ?? "Something went wrong. Please contact support.",
        );
        return;
      }

      const warnings: string[] = Array.isArray(data.warnings)
        ? data.warnings
        : [];

      toast.success(
        `"${competitionName}" is now visible to players and can be entered.`,
      );

      // Warnings are advisory by design - a platform switch that is still off, a stale
      // sandbox round. They are surfaced separately so they are not mistaken for failures,
      // and after the success message so publishing does not look like it went wrong.
      for (const warning of warnings) {
        toast.warning(warning);
      }

      await onPublished();
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handlePublish}
        disabled={pending}
        className="w-full border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Megaphone className="h-4 w-4 mr-2" />
        )}
        {pending ? "Publishing…" : "Publish"}
      </Button>

      {refusals.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Cannot publish yet
          </p>
          <ul className="mt-2 space-y-1">
            {refusals.map((refusal) => (
              <li key={refusal} className="text-xs text-red-300/90">
                • {refusal}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
