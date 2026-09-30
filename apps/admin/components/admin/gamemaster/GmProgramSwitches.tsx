"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * The Gamemaster Program v2 master switch (`External game plans/24` s6.1). While it is off,
 * players see no Game Master leaderboard and no Join button, and both player routes refuse.
 *
 * Reason: the control shows the STORED value read back from the server after every save,
 * never the value the operator clicked - a switch that shows what you meant rather than what
 * was saved is the "appears to work and does nothing" shape.
 */
export default function GmProgramSwitches() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/gamemasters/program-settings");
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        setError(body?.error || GENERIC_ERROR);
        return;
      }
      setEnabled(body.switches?.gmJoinEnabled === true);
    } catch {
      setError(GENERIC_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    if (enabled === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/gamemasters/program-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmJoinEnabled: !enabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        toast.error(body?.error || GENERIC_ERROR);
        return;
      }
      const stored = body.switches?.gmJoinEnabled === true;
      setEnabled(stored);
      toast.success(stored ? "Join Game Master is now on." : "Join Game Master is now off.");
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div>
        <p className="font-semibold text-white">Join Game Master and leaderboard</p>
        <p className="text-sm text-gray-400">
          Shows players the Game Master leaderboard and lets them join one after accepting the
          Game Master terms. Off by default.
        </p>
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={enabled === null || saving}
        className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
          enabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-500"
        }`}
      >
        {enabled === null ? "Loading…" : enabled ? "On" : "Off"}
      </button>
    </div>
  );
}
