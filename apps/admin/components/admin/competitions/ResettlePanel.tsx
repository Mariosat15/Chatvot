"use client";

/**
 * Re-settling a completed game contest is done from Incident Management.
 *
 * The money writer is still `resettleProviderCompetition`. This panel stays
 * mounted so the contest view can say the action exists, and it refuses to
 * run it here.
 *
 * NOT MIRRORED. Admin components stay admin-only.
 */

import HubWithheldAction from "@/components/admin/incidents/HubWithheldAction";

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
  return (
    <HubWithheldAction
      action="Re-settling this contest"
      detail={`${rounds.length} rounds on contest ${competitionId} can be voided and re-ranked from the incident.`}
    />
  );
}
