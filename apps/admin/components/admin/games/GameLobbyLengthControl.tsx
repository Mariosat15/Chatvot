"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LOBBY_SECONDS,
  MAX_LOBBY_SECONDS,
  MIN_LOBBY_SECONDS,
  resolveLobbySeconds,
  resolveSupportedPlayModes,
} from "@/lib/services/games/play-shape";
import { useTerms } from "@/contexts/TerminologyContext";
import type { ProviderTitleRow } from "./provider-types";

/**
 * How long before the gun a seated player may open a scheduled race (`23` s9 decision 1).
 *
 * Shown only when the title can be run with everyone starting together: on any other title a
 * lobby would be stored and read by nothing, and the service refuses it for that reason.
 *
 * Edited in MINUTES because that is how an operator thinks about a waiting room, and stored in
 * seconds because that is what every clock on the platform reads. The bounds come from
 * `play-shape.ts`, never restated here, so the input cannot offer a value the server refuses.
 *
 * Copied onto each contest when it is created, so the sentence under the input says so - an
 * operator changing it while a race is filling would otherwise expect it to move that race.
 */

interface Props {
  providerKey: string;
  title: ProviderTitleRow;
  onChanged: (next: { lobbySeconds?: number }) => void;
}

const MIN_MINUTES = MIN_LOBBY_SECONDS / 60;
const MAX_MINUTES = MAX_LOBBY_SECONDS / 60;

export default function GameLobbyLengthControl({ providerKey, title, onChanged }: Props) {
  const terms = useTerms();
  const current = resolveLobbySeconds(title.lobbySeconds) / 60;
  const [minutes, setMinutes] = useState(String(current));
  const [saving, setSaving] = useState(false);

  if (!resolveSupportedPlayModes(title).includes("scheduled")) return null;

  const parsed = Number(minutes);
  const valid =
    Number.isInteger(parsed) && parsed >= MIN_MINUTES && parsed <= MAX_MINUTES;

  const save = async (lobbySeconds: number | null) => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/games/providers/${providerKey}/games/play-style`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // `lobbySeconds` alone: the route refuses a body carrying another decision too.
          body: JSON.stringify({ gameCode: title.gameCode, lobbySeconds }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      const stored = (data.lobbySeconds as number | null) ?? undefined;
      onChanged({ lobbySeconds: stored });
      setMinutes(String(resolveLobbySeconds(stored) / 60));
      toast.success(
        `The lobby on ${title.displayName} now opens ${resolveLobbySeconds(stored) / 60} minutes before the start.`,
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/35">
        Lobby opens before the start
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={1}
          value={minutes}
          disabled={saving}
          onChange={(event) => setMinutes(event.target.value)}
          className="h-8 w-20 border-white/15 bg-white/5 text-xs text-white/90"
        />
        <span className="text-xs text-white/50">minutes</span>
        <Button
          size="sm"
          variant="outline"
          disabled={saving || !valid || parsed === current}
          onClick={() => save(parsed * 60)}
          className="h-8 text-xs"
        >
          Save
        </Button>
        {title.lobbySeconds !== undefined && (
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => save(null)}
            className="h-8 text-xs text-white/50"
          >
            Use default ({DEFAULT_LOBBY_SECONDS / 60})
          </Button>
        )}
        {saving && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
      </div>
      <p className="max-w-[260px] text-xs text-white/40">
        {terms.players} who have entered may join the race this long before it starts
        ({MIN_MINUTES}–{MAX_MINUTES} minutes). Applies to {terms.contests} created from now on.
      </p>
    </div>
  );
}
