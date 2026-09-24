"use client";

import { Trash2 } from "lucide-react";

export interface RetentionSettings {
  autoDeleteEnabled: boolean;
  retentionDays: number;
}

export function CommandAlertsRetentionCard({
  settings,
  retentionOptions,
  saving,
  onChange,
  onSave,
}: {
  settings: RetentionSettings;
  retentionOptions: number[];
  saving: boolean;
  onChange: (next: RetentionSettings) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
        <Trash2 className="h-4 w-4 text-lime-400" />
        Auto-delete old alerts
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoDeleteEnabled}
            onChange={(e) =>
              onChange({
                ...settings,
                autoDeleteEnabled: e.target.checked,
              })
            }
            className="rounded border-gray-600"
          />
          Enable
        </label>
        <select
          value={settings.retentionDays}
          onChange={(e) =>
            onChange({
              ...settings,
              retentionDays: Number(e.target.value),
            })
          }
          disabled={!settings.autoDeleteEnabled}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {retentionOptions.map((d) => (
            <option key={d} value={d}>
              After {d} day{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-lime-600/20 text-lime-300 border border-lime-500/40 text-sm hover:bg-lime-600/30 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span className="text-xs text-gray-500">
          Worker runs a cheap daily purge when enabled.
        </span>
      </div>
    </div>
  );
}
