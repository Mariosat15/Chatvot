"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { LiveSubject } from "./types";

const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "round", label: "Rounds" },
  { id: "competition", label: "Contests" },
  { id: "challenge", label: "Challenges" },
] as const;

function groupHeading(subject: LiveSubject): string {
  if (subject.kind === "round") return "Rounds needing a decision";
  if (subject.kind === "challenge") return "Challenges";
  return subject.isProviderGame ? "Game contests" : "Trading contests";
}

export default function LiveOperationsBoard({
  subjects,
  loading,
  onRaise,
}: {
  subjects: LiveSubject[];
  loading: boolean;
  onRaise: (subject: LiveSubject) => void;
}) {
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subjects.filter((subject) => {
      if (kind !== "all" && subject.kind !== kind) return false;
      if (!needle) return true;
      const haystack = [
        subject.name,
        subject.problem,
        subject.status,
        subject.badge,
        subject.gameKey,
        subject.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [subjects, kind, query]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading what is live…</p>;
  }

  const groups = new Map<string, LiveSubject[]>();
  for (const subject of filtered) {
    const key = groupHeading(subject);
    const list = groups.get(key) ?? [];
    list.push(subject);
    groups.set(key, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setKind(filter.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                kind === filter.id
                  ? "bg-amber-500 text-gray-950"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {filter.label}
              {filter.id === "all" ? ` (${subjects.length})` : ""}
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, id, game…"
            className="w-full rounded-md border border-gray-700 bg-gray-950 py-1.5 pl-8 pr-3 text-sm text-gray-100 placeholder:text-gray-500"
          />
        </label>
      </div>

      {subjects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-6 text-sm text-gray-400">
          Nothing is live, upcoming, or waiting on a decision.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-6 text-sm text-gray-400">
          No live subjects match these filters.
        </p>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([heading, rows]) => (
            <section key={heading} className="space-y-2">
              <h3 className="flex items-center justify-between text-sm font-semibold text-gray-200">
                <span>{heading}</span>
                <span className="text-xs font-normal text-gray-500">{rows.length}</span>
              </h3>
              <ul className="divide-y divide-gray-800 overflow-hidden rounded-lg border border-gray-700 bg-gray-900/60">
                {rows.map((row) => (
                  <li
                    key={`${row.kind}:${row.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
                        {row.badge}
                      </p>
                      <p className="text-sm font-medium text-white">{row.name}</p>
                      <p className="text-sm text-gray-300">{row.problem}</p>
                      <p className="font-mono text-[11px] text-gray-500">
                        {row.status}
                        {row.isPaused ? " · paused" : ""}
                        {row.gameKey ? ` · ${row.gameKey}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRaise(row)}
                      className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-gray-950 hover:bg-amber-400"
                    >
                      Raise incident
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
