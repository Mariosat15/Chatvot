"use client";

import ActionHistory from "./ActionHistory";
import type { IncidentRecord } from "./types";

export default function IncidentDetailPanel({
  incident,
  onRemediate,
  onRefund,
}: {
  incident: IncidentRecord;
  onRemediate: () => void;
  onRefund: () => void;
}) {
  const subject =
    incident.roundId ||
    incident.challengeId ||
    incident.competitionId ||
    "No subject attached";

  return (
    <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-900/50 p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {incident.subjectType || "unlabelled"}
          {incident.gameKey ? ` · ${incident.gameKey}` : ""}
        </p>
        <h3 className="text-lg font-semibold text-white">{incident.title}</h3>
        <p className="mt-2 text-sm text-gray-300">{incident.description}</p>
        <p className="mt-2 text-xs text-gray-500">
          {incident.severity} · {incident.status} · {subject}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRemediate}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-gray-950"
        >
          Apply a solution
        </button>
        {incident.competitionId && incident.status !== "resolved" ? (
          <button
            type="button"
            onClick={onRefund}
            className="rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-100"
          >
            Refund entry fees
          </button>
        ) : null}
      </div>
      <ActionHistory
        actionsTaken={incident.actionsTaken}
        auditLog={incident.auditLog}
      />
    </div>
  );
}
