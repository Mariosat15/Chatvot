"use client";

import type { IncidentAuditEntry, IncidentActionTaken } from "./types";

export default function ActionHistory({
  actionsTaken,
  auditLog,
}: {
  actionsTaken?: IncidentActionTaken[];
  auditLog?: IncidentAuditEntry[];
}) {
  const actions = actionsTaken ?? [];
  const audit = auditLog ?? [];

  return (
    <div className="space-y-4">
      <section>
        <h4 className="text-sm font-semibold text-gray-200">What was done</h4>
        {actions.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No remedial action yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {actions.map((entry, index) => (
              <li
                key={`${entry.actionId}-${entry.at ?? index}`}
                className="rounded-md border border-gray-700 p-2 text-sm text-gray-200"
              >
                <p>
                  {entry.actionId} · {entry.outcome}
                </p>
                <p className="text-gray-400">{entry.reason}</p>
                {entry.detail ? (
                  <p className="text-gray-300">{entry.detail}</p>
                ) : null}
                <p className="text-xs text-gray-500">
                  {entry.byEmail || entry.by || "unknown"} ·{" "}
                  {entry.at ? new Date(entry.at).toLocaleString() : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h4 className="text-sm font-semibold text-gray-200">Audit</h4>
        {audit.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No audit lines.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-gray-300">
            {audit.map((entry, index) => (
              <li key={`${entry.action}-${entry.timestamp}-${index}`}>
                {entry.action}: {entry.details}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
