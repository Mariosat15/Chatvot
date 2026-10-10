"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Lock, RotateCcw, Save, SlidersHorizontal, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  COMPETITION_DEFAULT_OPTIONS,
  type CompetitionDefaultOption,
  type ResolvedCompetitionDefault,
} from "@/lib/services/gamemaster/competition-defaults";
import { checkOptionValue } from "@/lib/services/gamemaster/competition-defaults-apply";
import CompetitionDefaultValueEditor from "./CompetitionDefaultValueEditor";

const FALLBACK_ERROR = "Something went wrong. Please contact support.";
const GROUP_ORDER: readonly CompetitionDefaultOption["group"][] = [
  "General",
  "Entry",
  "Prizes",
  "Ranking",
  "Games",
  "Trading",
  "Risk",
];

interface Draft {
  value: unknown;
  gmMayChange: boolean;
}

function toDrafts(list: ResolvedCompetitionDefault[]): Map<string, Draft> {
  return new Map(list.map((entry) => [entry.key, { value: entry.value, gmMayChange: entry.gmMayChange }]));
}

function gameLabel(option: CompetitionDefaultOption): string {
  if (option.games.length > 1) return "Trading and games";
  return option.games[0] === "trading" ? "Trading only" : "Games only";
}

/**
 * Admin screen: the default for every competition option a Game Master can set, and whether
 * the Game Master may change it. Locked options are hidden from the Game Master's form and the
 * server writes the value chosen here.
 */
export default function GameMasterCompetitionDefaultsSection() {
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [saved, setSaved] = useState<Map<string, Draft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gamemaster-competition-defaults");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || FALLBACK_ERROR);
      const next = toDrafts(data.options as ResolvedCompetitionDefault[]);
      setDrafts(next);
      setSaved(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FALLBACK_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reason: the same check the server runs, so a bad value is named beside its input
  // before Save rather than only in a toast after it.
  const errors = useMemo(() => {
    const out = new Map<string, string>();
    for (const option of COMPETITION_DEFAULT_OPTIONS) {
      const draft = drafts.get(option.key);
      if (!draft) continue;
      const check = checkOptionValue(option, draft.value);
      if (!check.ok) out.set(option.key, check.error);
    }
    return out;
  }, [drafts]);

  const dirty = useMemo(
    () => JSON.stringify([...drafts]) !== JSON.stringify([...saved]),
    [drafts, saved],
  );

  const update = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const current = prev.get(key);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(key, { ...current, ...patch });
      return next;
    });
  };

  const save = async () => {
    if (errors.size > 0) {
      toast.error("Fix the highlighted options before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/gamemaster-competition-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: [...drafts].map(([key, draft]) => ({ key, ...draft })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || FALLBACK_ERROR);
      const next = toDrafts(data.options as ResolvedCompetitionDefault[]);
      setDrafts(next);
      setSaved(next);
      toast.success("Game Master competition defaults saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FALLBACK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading defaults...
      </div>
    );
  }

  const lockedCount = [...drafts.values()].filter((d) => !d.gmMayChange).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <SlidersHorizontal className="h-6 w-6 text-amber-400" />
            Game Master Competition Defaults
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">
            Choose the starting value for every option on a Game Master&apos;s competition form.
            Turn &quot;Game Master can change this&quot; off to lock an option: the Game Master will not
            see it, and the value you choose here is used for every competition they create. When
            it is on, whatever the Game Master enters is still checked against the same limits.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {lockedCount} of {drafts.size} options locked
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDrafts(saved)} disabled={!dirty || saving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Undo changes
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {GROUP_ORDER.map((group) => {
        const options = COMPETITION_DEFAULT_OPTIONS.filter((option) => option.group === group);
        if (options.length === 0) return null;
        return (
          <section key={group} className="rounded-xl border border-gray-700 bg-gray-800/60 p-5">
            <h3 className="mb-4 text-lg font-semibold text-white">{group}</h3>
            <div className="divide-y divide-gray-700">
              {options.map((option) => {
                const draft = drafts.get(option.key);
                if (!draft) return null;
                const error = errors.get(option.key);
                return (
                  <div key={option.key} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{option.label}</span>
                        <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                          {gameLabel(option)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{option.description}</p>
                    </div>
                    <div>
                      <CompetitionDefaultValueEditor
                        option={option}
                        value={draft.value}
                        onChange={(value) => update(option.key, { value })}
                      />
                      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
                    </div>
                    <label className="flex items-center gap-2 self-start text-sm text-gray-300">
                      <Switch
                        checked={draft.gmMayChange}
                        onCheckedChange={(checked) => update(option.key, { gmMayChange: checked })}
                      />
                      {draft.gmMayChange ? (
                        <Unlock className="h-4 w-4 text-green-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-amber-400" />
                      )}
                      Game Master can change this
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
