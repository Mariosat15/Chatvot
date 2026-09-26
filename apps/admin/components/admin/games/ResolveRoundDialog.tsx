"use client";

/**
 * Ending a round is done from Incident Management.
 *
 * IT CANNOT ENTER A SCORE. Scores enter through exactly one function in the main
 * app. The catalogue of endings lives in `round-resolution-actions` and is read
 * by the incident door, not restated here.
 */

import { Button } from "@/components/ui/button";
import HubWithheldAction from "@/components/admin/incidents/HubWithheldAction";

interface ResolveRoundDialogProps {
  roundId: string;
  stillUnresolved: number;
  onResolved: () => void | Promise<void>;
  onCancel: () => void;
}

export function ResolveRoundDialog({
  roundId,
  stillUnresolved,
  onCancel,
}: ResolveRoundDialogProps) {
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
