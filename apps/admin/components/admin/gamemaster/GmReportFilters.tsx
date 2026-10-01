"use client";

import { useEffect, useState } from "react";
import {
  REFERRAL_KIND_LABELS,
  REFERRAL_SURFACE_LABELS,
} from "@/lib/services/gamemaster/referral-kind";
import type { ReportState } from "@/lib/admin/gm-report-query";

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
  "w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500 focus:outline-none";

export function gameMasterLabel(gm: GameMasterOption): string {
  const name = gm.userName || gm.userEmail || gm.userId;
  return gm.status && gm.status !== "active" ? `${name} (${gm.status})` : name;
}

/**
 * The report's filters. Edits are a DRAFT until Apply, so typing a search does not fire a
 * query per keystroke, and Apply always resets to page 1 - a filter that keeps the old page
 * number shows an empty page and reads as "no results".
 */
export default function GmReportFilters({
  state,
  gameMasters,
  onApply,
}: {
  state: ReportState;
  gameMasters: GameMasterOption[];
  onApply: (next: ReportState) => void;
}) {
  const [draft, setDraft] = useState<ReportState>(state);
  useEffect(() => setDraft(state), [state]);

  const set = (key: keyof ReportState) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-lg border border-gray-700 bg-gray-800/60 p-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ ...draft, page: undefined });
      }}
    >
      <label className="text-xs text-gray-400 md:col-span-2">
        Search player name or email
        <input
          className={FIELD}
          value={draft.search ?? ""}
          maxLength={100}
          onChange={(e) => set("search")(e.target.value)}
        />
      </label>
      <label className="text-xs text-gray-400 md:col-span-2">
        Game Master
        <select
          className={FIELD}
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
        Own or external
        <select className={FIELD} value={draft.kind ?? ""} onChange={(e) => set("kind")(e.target.value)}>
          <option value="">Any</option>
          {Object.entries(REFERRAL_KIND_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-gray-400">
        Joined through
        <select
          className={FIELD}
          value={draft.surface ?? ""}
          onChange={(e) => set("surface")(e.target.value)}
        >
          <option value="">Any</option>
          {Object.entries(REFERRAL_SURFACE_LABELS).map(([surface, label]) => (
            <option key={surface} value={surface}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-gray-400">
        Affiliation
        <select
          className={FIELD}
          value={draft.status ?? ""}
          onChange={(e) => set("status")(e.target.value)}
        >
          <option value="">Current and ended</option>
          <option value="current">Current</option>
          <option value="ended">Ended</option>
        </select>
      </label>
      <label className="text-xs text-gray-400">
        Activity (last 30 days)
        <select
          className={FIELD}
          value={draft.activity ?? ""}
          onChange={(e) => set("activity")(e.target.value)}
        >
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="text-xs text-gray-400">
        Joined from
        <input
          type="date"
          className={FIELD}
          value={draft.joinedFrom ?? ""}
          onChange={(e) => set("joinedFrom")(e.target.value)}
        />
      </label>
      <label className="text-xs text-gray-400">
        Joined to
        <input
          type="date"
          className={FIELD}
          value={draft.joinedTo ?? ""}
          onChange={(e) => set("joinedTo")(e.target.value)}
        />
      </label>
      <div className="flex items-end gap-2 md:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-yellow-400"
        >
          Apply filters
        </button>
        <button
          type="button"
          className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
          onClick={() => onApply({})}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
