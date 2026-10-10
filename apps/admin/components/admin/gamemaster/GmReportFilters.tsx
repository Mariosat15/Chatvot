"use client";

import { useEffect, useState } from "react";
import {
  REFERRAL_KIND_LABELS,
  REFERRAL_SURFACE_LABELS,
} from "@/lib/services/gamemaster/referral-kind";
import type { ReportState } from "@/lib/admin/gm-report-query";
import GmExportButton from "./GmExportButton";

export interface GameMasterOption {
  /** Subscription id - what a move targets. */
  id: string;
  /** User id - what the report filters on. */
  userId: string;
  userName?: string;
  userEmail?: string;
  status?: string;
}

// Reason: an opaque background on every native select (R60) - a translucent one composites
// over the browser's own light list surface and the options become white on white.
const FIELD =
  "w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-amber-500 focus:outline-none";

export function gameMasterLabel(gm: GameMasterOption): string {
  const name = gm.userName || gm.userEmail || gm.userId;
  return gm.status && gm.status !== "active" ? `${name} (${gm.status})` : name;
}

/**
 * Horizontal filter bar for the referred-players report (`24` s7 Part 2 redesign).
 *
 * Edits are a DRAFT until Apply, so typing does not fire a query per keystroke, and Apply
 * always resets to page 1. Export sits beside Apply so the file always describes the same
 * filters the screen is showing after the last Apply (never the uncommitted draft).
 */
export default function GmReportFilters({
  state,
  gameMasters,
  canExport,
  onApply,
}: {
  state: ReportState;
  gameMasters: GameMasterOption[];
  canExport: boolean;
  onApply: (next: ReportState) => void;
}) {
  const [draft, setDraft] = useState<ReportState>(state);
  useEffect(() => setDraft(state), [state]);

  const set = (key: keyof ReportState) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-gray-700/80 bg-gray-900/70 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ ...draft, page: undefined });
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs text-gray-400 xl:col-span-2">
          Search
          <input
            className={`${FIELD} mt-1`}
            placeholder="Search players, email or phone..."
            value={draft.search ?? ""}
            maxLength={100}
            onChange={(e) => set("search")(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-400">
          Joined from
          <input
            type="date"
            className={`${FIELD} mt-1`}
            value={draft.joinedFrom ?? ""}
            onChange={(e) => set("joinedFrom")(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-400">
          Joined to
          <input
            type="date"
            className={`${FIELD} mt-1`}
            value={draft.joinedTo ?? ""}
            onChange={(e) => set("joinedTo")(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-400">
          Referral type
          <select
            className={`${FIELD} mt-1`}
            value={draft.kind ?? ""}
            onChange={(e) => set("kind")(e.target.value)}
          >
            <option value="">All types</option>
            {Object.entries(REFERRAL_KIND_LABELS).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Affiliation status
          <select
            className={`${FIELD} mt-1`}
            value={draft.status ?? ""}
            onChange={(e) => set("status")(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="current">Affiliated</option>
            <option value="ended">Not affiliated</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-gray-400 xl:col-span-2">
          Game Master
          <select
            className={`${FIELD} mt-1`}
            value={draft.gameMasterId ?? ""}
            onChange={(e) => set("gameMasterId")(e.target.value)}
          >
            <option value="">All Game Masters</option>
            {gameMasters.map((gm) => (
              <option key={gm.id} value={gm.userId}>
                {gameMasterLabel(gm)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Joined through
          <select
            className={`${FIELD} mt-1`}
            value={draft.surface ?? ""}
            onChange={(e) => set("surface")(e.target.value)}
          >
            <option value="">Any surface</option>
            {Object.entries(REFERRAL_SURFACE_LABELS).map(([surface, label]) => (
              <option key={surface} value={surface}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Recent play
          <select
            className={`${FIELD} mt-1`}
            value={draft.activity ?? ""}
            onChange={(e) => set("activity")(e.target.value)}
          >
            <option value="">Any</option>
            <option value="active">Played in last 30 days</option>
            <option value="inactive">No contest in 30 days</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400"
        >
          Apply filters
        </button>
        <button
          type="button"
          className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          onClick={() => onApply({})}
        >
          Reset
        </button>
        <div className="ml-auto">
          <GmExportButton state={state} canExport={canExport} />
        </div>
      </div>
    </form>
  );
}
