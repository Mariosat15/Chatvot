"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTerms } from "@/contexts/TerminologyContext";
import type { ProviderTitleRow } from "./provider-types";

/**
 * How many computer pilots join a player's FREE practice round of this title.
 *
 * Practice only, by construction: the platform forwards the count from the practice launcher
 * and nowhere else, and the game service refuses it on a ranked round. So it lets a player race
 * a full grid when nobody else is online - and lets an operator test a 16-car race alone -
 * without a computer pilot ever appearing in a paid contest.
 *
 * Shown only on a title that offers practice; the service refuses it on any other.
 */

const MAX_AI = 15;

interface Props {
  providerKey: string;
  title: ProviderTitleRow;
  onChanged: (next: { practiceAiPilots?: number }) => void;
}

export default function GamePracticeAiControl({ providerKey, title, onChanged }: Props) {
  const terms = useTerms();
  const current = title.practiceAiPilots ?? 0;
  const [count, setCount] = useState(String(current));
  const [saving, setSaving] = useState(false);

  if (!title.supportsPractice) return null;

  const parsed = Number(count);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_AI;

  const save = async (practiceAiPilots: number | null) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/games/providers/${providerKey}/games/play-style`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // `practiceAiPilots` alone: the route refuses a body carrying another decision too.
        body: JSON.stringify({ gameCode: title.gameCode, practiceAiPilots }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      const stored = (data.practiceAiPilots as number | null) ?? undefined;
      onChanged({ practiceAiPilots: stored });
      setCount(String(stored ?? 0));
      toast.success(
        stored
          ? `${terms.practice} on ${title.displayName} now seats ${stored} computer pilot${stored === 1 ? "" : "s"}.`
          : `${terms.practice} on ${title.displayName} no longer seats computer pilots.`,
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/35">
        <Bot className="h-3.5 w-3.5" />
        Computer pilots in {terms.practice}
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={MAX_AI}
          step={1}
          value={count}
          disabled={saving}
          onChange={(event) => setCount(event.target.value)}
          className="h-8 w-20 border-white/15 bg-white/5 text-xs text-white/90"
        />
        <span className="text-xs text-white/50">pilots</span>
        <Button
          size="sm"
          variant="outline"
          disabled={saving || !valid || parsed === current}
          onClick={() => save(parsed === 0 ? null : parsed)}
          className="h-8 text-xs"
        >
          Save
        </Button>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
      </div>
      <p className="max-w-[320px] text-xs text-white/40">
        0–{MAX_AI}. Each {terms.practice} {terms.round} seats this many computer pilots beside
        the {terms.player}, each with its own driving style. {terms.practice} only - never in a
        paid {terms.contest} or {terms.challenge}.
      </p>
    </div>
  );
}
