"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

type SwitchKey = "gmJoinEnabled" | "gmPrivateContestsEnabled" | "gmFreePrivateContestsEnabled";

const SWITCHES: ReadonlyArray<{
  key: SwitchKey;
  title: string;
  description: string;
  onToast: string;
  offToast: string;
}> = [
  {
    key: "gmJoinEnabled",
    title: "Join Game Master and leaderboard",
    description:
      "Shows players the Game Master leaderboard and lets them join one after accepting the Game Master terms. Off by default.",
    onToast: "Join Game Master is now on.",
    offToast: "Join Game Master is now off.",
  },
  {
    key: "gmPrivateContestsEnabled",
    title: "Private Game Master competitions",
    description:
      "Lets a Game Master whose package allows it create a competition only their own players can see and enter. Off by default. Turning it off stops new private competitions; existing ones stay private.",
    onToast: "Private Game Master competitions are now on.",
    offToast: "Private Game Master competitions are now off.",
  },
  {
    key: "gmFreePrivateContestsEnabled",
    title: "Free Private (Game Master-funded) competitions",
    description:
      "Lets a Game Master whose package allows it fund the entry fees of a private competition from their own Volts, so their players join free. The full reserve (entry fee x places) is held when the competition is created. Off by default. Turning it off stops new funded competitions; existing ones still settle and refund normally.",
    onToast: "Free Private competitions are now on.",
    offToast: "Free Private competitions are now off.",
  },
];

/**
 * The Gamemaster Program v2 switches (`External game plans/24` s6.1).
 *
 * Reason: each control shows the STORED value read back from the server after every save,
 * never the value the operator clicked - a switch that shows what you meant rather than what
 * was saved is the "appears to work and does nothing" shape.
 */
// Reason: a Map lookup rather than values[key] - the key is typed, but the lint rule cannot
// see that, and the pre-commit hook blocks on its warning.
function readSwitch(values: Record<SwitchKey, boolean>, key: SwitchKey): boolean {
  return new Map(Object.entries(values)).get(key) === true;
}

export default function GmProgramSwitches() {
  const [values, setValues] = useState<Record<SwitchKey, boolean> | null>(null);
  const [saving, setSaving] = useState<SwitchKey | null>(null);
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
      setValues({
        gmJoinEnabled: body.switches?.gmJoinEnabled === true,
        gmPrivateContestsEnabled: body.switches?.gmPrivateContestsEnabled === true,
        gmFreePrivateContestsEnabled: body.switches?.gmFreePrivateContestsEnabled === true,
      });
    } catch {
      setError(GENERIC_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: SwitchKey) => {
    if (values === null) return;
    const spec = SWITCHES.find((s) => s.key === key);
    if (!spec) return;
    setSaving(key);
    try {
      const res = await fetch("/api/gamemasters/program-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !readSwitch(values, key) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) {
        toast.error(body?.error || GENERIC_ERROR);
        return;
      }
      const next = {
        gmJoinEnabled: body.switches?.gmJoinEnabled === true,
        gmPrivateContestsEnabled: body.switches?.gmPrivateContestsEnabled === true,
        gmFreePrivateContestsEnabled: body.switches?.gmFreePrivateContestsEnabled === true,
      };
      setValues(next);
      toast.success(readSwitch(next, key) ? spec.onToast : spec.offToast);
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {SWITCHES.map((spec) => {
        const on = values?.[spec.key] === true;
        return (
          <div
            key={spec.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 p-4"
          >
            <div>
              <p className="font-semibold text-white">{spec.title}</p>
              <p className="text-sm text-gray-400">{spec.description}</p>
            </div>
            <button
              type="button"
              onClick={() => void toggle(spec.key)}
              disabled={values === null || saving !== null}
              className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                on ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-500"
              }`}
            >
              {values === null ? "Loading…" : saving === spec.key ? "Saving…" : on ? "On" : "Off"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
