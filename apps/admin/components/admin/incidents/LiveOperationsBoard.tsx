"use client";

import type { LiveSubject } from "./types";

export default function LiveOperationsBoard({
  subjects,
  loading,
  onRaise,
}: {
  subjects: LiveSubject[];
  loading: boolean;
  onRaise: (subject: LiveSubject) => void;
}) {
  if (loading) {
    return <p className="text-sm text-gray-400">Loading what is live…</p>;
  }
  if (subjects.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Nothing is live, upcoming, or waiting on a decision.
      </p>
    );
  }

  const groups = new Map<string, LiveSubject[]>();
  for (const subject of subjects) {
    const key =
      subject.kind === "round"
        ? "Rounds needing a decision"
        : subject.kind === "challenge"
          ? "Challenges"
          : subject.isProviderGame
            ? "Game contests"
            : "Trading contests";
    const list = groups.get(key) ?? [];
    list.push(subject);
    groups.set(key, list);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([heading, rows]) => (
        <section key={heading} className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-200">{heading}</h3>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={`${row.kind}:${row.id}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-700 bg-gray-900/60 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    {row.badge}
                  </p>
                  <p className="text-sm font-medium text-white">{row.name}</p>
                  <p className="text-sm text-gray-300">{row.problem}</p>
                  <p className="text-xs text-gray-500">
                    {row.status}
                    {row.isPaused ? " · paused" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRaise(row)}
                  className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-gray-950"
                >
                  Raise incident
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
