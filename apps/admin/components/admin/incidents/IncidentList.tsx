"use client";

import type { IncidentRecord } from "./types";

const STATUS_TONE = new Map<string, string>([
  ["open", "bg-amber-500/15 text-amber-300 border-amber-500/30"],
  ["investigating", "bg-sky-500/15 text-sky-300 border-sky-500/30"],
  ["resolved", "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"],
  ["rejected", "bg-slate-500/15 text-slate-300 border-slate-500/30"],
]);

const SEVERITY_TONE = new Map<string, string>([
  ["critical", "text-red-400"],
  ["high", "text-orange-400"],
  ["medium", "text-amber-300"],
  ["low", "text-slate-400"],
]);

function Badge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

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
    return (
      <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-6 text-center">
        <p className="text-sm text-gray-300">No incidents match these filters.</p>
        <p className="mt-1 text-xs text-gray-500">
          Clear the search or widen the status filter to see more.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
      {incidents.map((incident) => {
        const selected = incident._id === selectedId;
        const statusClass =
          STATUS_TONE.get(incident.status) ??
          "bg-slate-500/15 text-slate-300 border-slate-500/30";
        const severityClass =
          SEVERITY_TONE.get(incident.severity) ?? "text-slate-400";
        const when = incident.createdAt
          ? new Date(incident.createdAt).toLocaleString()
          : null;
        return (
          <li key={incident._id}>
            <button
              type="button"
              onClick={() => onSelect(incident)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-gray-700 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-900/70"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge label={incident.status} className={statusClass} />
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${severityClass}`}>
                  {incident.severity}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {incident.subjectType || "unlabelled"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-white">
                {incident.title}
              </p>
              {when ? (
                <p className="mt-1 text-[11px] text-gray-500">{when}</p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
