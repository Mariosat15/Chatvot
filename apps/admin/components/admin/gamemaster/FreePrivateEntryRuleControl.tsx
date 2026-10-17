"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  describeFreePrivateEntryRule,
  type FreePrivateEntryPolicy,
  type FreePrivateEntryRule,
} from "@/lib/utils/free-private-entry-rule";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

const POLICY_OPTIONS: ReadonlyArray<{ value: FreePrivateEntryPolicy; label: string }> = [
  { value: "open", label: "Anyone can join free" },
  { value: "min_balance", label: "Players must hold a minimum balance" },
];

/**
 * Who may take a Game Master-funded (free) seat.
 *
 * Reason: like the switches above it, this shows the rule read BACK from the server after
 * every save, which is the resolved rule the entry guard runs - never the value typed.
 */
export default function FreePrivateEntryRuleControl() {
  const [rule, setRule] = useState<FreePrivateEntryRule | null>(null);
  const [policy, setPolicy] = useState<FreePrivateEntryPolicy>("min_balance");
  const [amount, setAmount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (next: FreePrivateEntryRule) => {
    setRule(next);
    setPolicy(next.policy);
    setAmount(String(next.minBalance));
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/gamemasters/program-settings");
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success || !body.freePrivateEntry) {
        setError(body?.error || GENERIC_ERROR);
        return;
      }
      apply(body.freePrivateEntry);
    } catch {
      setError(GENERIC_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const minBalance = Number(amount);
    if (policy === "min_balance" && (!Number.isFinite(minBalance) || minBalance < 0)) {
      toast.error("Enter a minimum balance of 0 or more.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/gamemasters/program-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          policy === "open"
            ? { freePrivateEntryPolicy: "open" }
            : { freePrivateEntryPolicy: "min_balance", freePrivateMinEntryBalance: minBalance },
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success || !body.freePrivateEntry) {
        toast.error(body?.error || GENERIC_ERROR);
        return;
      }
      apply(body.freePrivateEntry);
      toast.success("Free competition entry rule saved.");
    } catch {
      toast.error(GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3">
      <div>
        <p className="font-semibold text-white">Who can join a free (Game Master-funded) competition</p>
        <p className="text-sm text-gray-400">
          A funded seat costs the player nothing. Choose whether anyone may take one, or only
          players who already hold credits. The credits are only checked, never taken.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {POLICY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPolicy(option.value)}
            disabled={rule === null || saving}
            className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-50 ${
              policy === option.value
                ? "bg-emerald-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {policy === "min_balance" && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
          Minimum credits in the wallet
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={rule === null || saving}
            className="w-32 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-white"
          />
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {rule ? `Now: ${describeFreePrivateEntryRule(rule)}` : "Loading…"}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={rule === null || saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
