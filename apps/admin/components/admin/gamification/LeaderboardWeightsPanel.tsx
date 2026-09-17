"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, RotateCcw, Save, Trophy } from "lucide-react";
import { toast } from "sonner";

/**
 * The seven shares that decide a player's place on the Global leaderboard.
 *
 * Reason: the component list, the labels and the default split all come from the
 * server (`lib/services/leaderboard/global-score.ts` through
 * `GET /api/badges-xp/manage`). This screen holds NO copy of them — a second
 * list here is the "one rule, two copies" shape, and the copy that drifts is the
 * one an operator reads while setting a number that decides who is ranked first.
 */

interface WeightRow {
  id: string;
  label: string;
  description: string;
  percent: number;
}

interface ComponentRow {
  id: string;
  label: string;
  description: string;
  defaultWeight: number;
}

/** Whole percentages, rescaled to 100 — what the arithmetic will actually use. */
function preview(entered: Map<string, number>): Map<string, number> {
  let sum = 0;
  for (const value of entered.values()) {
    if (Number.isFinite(value) && value > 0) sum += value;
  }
  const out = new Map<string, number>();
  if (sum <= 0) return out;
  for (const [id, value] of entered) {
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    out.set(id, Math.round((safe / sum) * 100));
  }
  return out;
}

export default function LeaderboardWeightsPanel() {
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [entered, setEntered] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/badges-xp/manage");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");

      const list: ComponentRow[] = Array.isArray(data.leaderboardComponents)
        ? data.leaderboardComponents
        : [];
      const stored: WeightRow[] = Array.isArray(data.leaderboardWeights)
        ? data.leaderboardWeights
        : [];

      setComponents(list);
      setEntered(new Map(stored.map((row) => [row.id, row.percent])));
    } catch (error) {
      console.error("Error loading leaderboard weights:", error);
      toast.error("Could not load the global rank shares");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const total = [...entered.values()].reduce(
      (acc, value) => acc + (Number.isFinite(value) && value > 0 ? value : 0),
      0,
    );
    // Reason: refuse an all-zero set rather than storing it. The reader falls
    // back to the defaults for a set summing to nothing, so saving one looks
    // like it worked and silently changes nothing.
    if (total <= 0) {
      toast.error("At least one share must be above zero");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/badges-xp/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaderboardWeights: Object.fromEntries(entered),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save");
      toast.success("Global rank shares updated");
      await load();
    } catch (error) {
      console.error("Error saving leaderboard weights:", error);
      toast.error("Could not save the global rank shares");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setEntered(new Map(components.map((c) => [c.id, c.defaultWeight])));
  };

  const shown = preview(entered);
  const raw = [...entered.values()].reduce(
    (acc, value) => acc + (Number.isFinite(value) && value > 0 ? value : 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        Loading global rank shares…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Global leaderboard shares
          </h3>
          <p className="text-sm text-muted-foreground">
            How much each part of a player&apos;s record counts towards their
            place on the Global leaderboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to defaults
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save shares"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p>
          Each part is scored by a player&apos;s <strong>position</strong>{" "}
          against everyone else who takes part in it, then the shares below
          decide how much that position is worth.
        </p>
        <p>
          A player is never penalised for something they do not do. The share
          for a part they take no role in is spread across the parts they do, so
          a games-only player can still reach first place.
        </p>
        <p>
          The numbers do not have to add up to 100 — they are rescaled on save,
          so entering 2 and 1 is the same as entering 66 and 33.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {components.map((component) => {
          const value = entered.get(component.id) ?? 0;
          const applied = shown.get(component.id) ?? 0;
          return (
            <div
              key={component.id}
              className="rounded-lg border border-border p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label
                    htmlFor={`weight-${component.id}`}
                    className="text-sm font-semibold"
                  >
                    {component.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {component.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-sm font-bold text-primary">
                  {applied}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={`weight-${component.id}`}
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isFinite(value) ? value : 0}
                  onChange={(event) => {
                    const next = Number.parseFloat(event.target.value);
                    setEntered((current) => {
                      const copy = new Map(current);
                      copy.set(
                        component.id,
                        Number.isFinite(next) && next >= 0 ? next : 0,
                      );
                      return copy;
                    });
                  }}
                  className="h-10"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  default {component.defaultWeight}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Entered total: {raw} · applied as the percentages shown above, which
        always add up to 100.
      </p>
    </div>
  );
}
