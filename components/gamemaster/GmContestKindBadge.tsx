"use client";

import {
  GM_CONTEST_KINDS,
  GM_CONTEST_KIND_LABELS,
  type GmContestKind,
} from "@/lib/utils/gm-contest-kind";

export type GmContestKindFilterValue = "all" | GmContestKind;

const KIND_TONE: ReadonlyMap<GmContestKind, string> = new Map([
  ["normal", "bg-gray-700/60 text-gray-200 border-gray-600"],
  ["private", "bg-indigo-900/50 text-indigo-300 border-indigo-700/60"],
  ["funded", "bg-emerald-900/50 text-emerald-300 border-emerald-700/60"],
]);

/** Normal / Private / Funded pill. Renders nothing when the row has no contest kind (a challenge). */
export function GmContestKindBadge({ kind }: { kind?: GmContestKind | null }) {
  if (!kind) return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${KIND_TONE.get(kind) ?? ""}`}
    >
      {GM_CONTEST_KIND_LABELS.get(kind) ?? kind}
    </span>
  );
}

/** All / Normal / Private / Funded filter pills, matching the status filter beside it. */
export function GmContestKindFilter({
  value,
  onChange,
}: {
  value: GmContestKindFilterValue;
  onChange: (v: GmContestKindFilterValue) => void;
}) {
  const options: GmContestKindFilterValue[] = ["all", ...GM_CONTEST_KINDS];
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Competition type">
      <span className="text-xs text-gray-500">Type:</span>
      {options.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${value === k ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
        >
          {k === "all" ? "All types" : GM_CONTEST_KIND_LABELS.get(k)}
        </button>
      ))}
    </div>
  );
}

/** Keep the rows of one kind; `"all"` keeps everything. */
export function filterByContestKind<T extends { kind?: GmContestKind | null }>(
  rows: readonly T[],
  value: GmContestKindFilterValue,
): T[] {
  return value === "all" ? [...rows] : rows.filter((r) => r.kind === value);
}
