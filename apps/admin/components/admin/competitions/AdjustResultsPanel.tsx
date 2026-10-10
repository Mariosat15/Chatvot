"use client";

/**
 * Settled ranks and prizes are corrected from Incident Management.
 *
 * The money writer is still `POST /api/competitions/[id]/adjust-results`. This
 * panel no longer calls it. An in-place form would be a second place an operator
 * could move a prize without the incident record.
 *
 * NOT MIRRORED. Admin components stay admin-only.
 */

import HubWithheldAction from "@/components/admin/incidents/HubWithheldAction";

export interface AdjustableSeat {
  participantId: string;
  userId: string;
  username: string;
  currentRank: number | null;
  prizeAmount: number;
  qualificationStatus?: string | null;
}

export default function AdjustResultsPanel({
  competitionId,
  seats,
}: {
  competitionId: string;
  seats: AdjustableSeat[];
  creditSymbol?: string;
}) {
  return (
    <HubWithheldAction
      action="Adjusting settled results"
      detail={`${seats.length} seats on contest ${competitionId} are corrected from the incident, with the reason stored on it.`}
    />
  );
}
