"use client";

import ActionHistory from "./ActionHistory";
import type { IncidentRecord } from "./types";

/** Same answers as `isIncidentClosed` — inlined so this client file stays model-free. */
function isClosed(status: string): boolean {
  return status === "resolved" || status === "rejected";
}

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
  // Reason: Refund was already gated; Apply a solution was not, so a resolved
  // incident still offered a second cancel/refund (owner report, 21 Sep 2026).
  const closed = isClosed(incident.status);

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
      {closed ? (
        <p className="text-sm text-gray-400">
          This incident is closed. Raise a new one if further action is needed.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRemediate}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-gray-950"
          >
            Apply a solution
          </button>
          {incident.competitionId ? (
            <button
              type="button"
              onClick={onRefund}
              className="rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-100"
            >
              Refund entry fees
            </button>
          ) : null}
        </div>
      )}
      <ActionHistory
        actionsTaken={incident.actionsTaken}
        auditLog={incident.auditLog}
      />
    </div>
  );
}
