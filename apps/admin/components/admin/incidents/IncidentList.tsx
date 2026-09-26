"use client";

import type { IncidentRecord } from "./types";

export default function IncidentList({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: IncidentRecord[];
  selectedId?: string;
  onSelect: (incident: IncidentRecord) => void;
}) {
  if (incidents.length === 0) {
    return <p className="text-sm text-gray-400">No incidents recorded.</p>;
  }

  return (
    <ul className="space-y-2">
      {incidents.map((incident) => {
        const selected = incident._id === selectedId;
        return (
          <li key={incident._id}>
            <button
              type="button"
              onClick={() => onSelect(incident)}
              className={`w-full rounded-lg border p-3 text-left ${
                selected
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-gray-700 bg-gray-900/40"
              }`}
            >
              <p className="text-sm font-medium text-white">{incident.title}</p>
              <p className="mt-1 text-xs text-gray-400">
                {incident.subjectType || "unlabelled"} · {incident.severity} ·{" "}
                {incident.status}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
