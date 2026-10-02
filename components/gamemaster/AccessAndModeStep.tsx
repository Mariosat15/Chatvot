"use client";

import { cn } from "@/lib/utils";
import { PLAY_MODE_COPY, type PlayMode } from "@/lib/services/games/play-shape";
import type { CompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";
import { VISIBILITY_OPTION_COPY } from "@/components/gamemaster/ContestVisibilityPicker";
import { Field, StepPanel, inputClass } from "@/components/gamemaster/provider-contest-wizard-steps";

/**
 * Game Master provider wizard step: who can join, and how the game is played.
 *
 * `visibilityOptions` is the server's `creatableVisibilities`, so this step never decides what
 * a package allows. With public as the only option it is shown as a fact, not a choice.
 */
export function AccessAndModeStep({
  visibilityOptions,
  visibility,
  onVisibility,
  canPickMode,
  playMode,
  supportedPlayModes,
  onPlayMode,
  disabled,
}: {
  visibilityOptions: readonly CompetitionVisibility[];
  visibility: CompetitionVisibility | undefined;
  onVisibility: (next: CompetitionVisibility) => void;
  canPickMode: boolean;
  playMode: PlayMode;
  supportedPlayModes: PlayMode[];
  onPlayMode: (m: PlayMode) => void;
  disabled: boolean;
}) {
  const modes =
    supportedPlayModes.length > 0 ? supportedPlayModes : ([playMode] as PlayMode[]);
  const copy = PLAY_MODE_COPY.get(playMode);
  const canPickVisibility = visibilityOptions.length > 1;

  return (
    <StepPanel title="Access & Mode" subtitle="Who can join and how the game is played">
      <div className="space-y-1.5">
        <span className="text-sm text-gray-300">Who can join</span>
        {visibilityOptions.length === 0 ? (
          <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            Your package does not allow creating a competition. Please contact support.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibilityOptions.map((id) => {
              const option = VISIBILITY_OPTION_COPY.get(id);
              if (!option) return null;
              const Icon = option.icon;
              const selected = visibility === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled || !canPickVisibility}
                  onClick={() => onVisibility(id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                    selected
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-gray-700 bg-gray-900/50 hover:border-gray-500",
                    !canPickVisibility && "cursor-default",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      selected ? "text-cyan-300" : "text-gray-400",
                    )}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="block text-xs text-gray-400">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/*
        Always surface play style. When the title supports more than one mode the GM picks;
        when it supports only one we still explain what that means so the schedule step is
        not a surprise. Labels come from PLAY_MODE_COPY so they cannot drift from the
        admin ContestPlayModeField / create service.
      */}
      <Field label="How players join">
        {canPickMode ? (
          <select
            className={inputClass}
            value={playMode}
            onChange={(e) => onPlayMode(e.target.value as PlayMode)}
            disabled={disabled}
          >
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {PLAY_MODE_COPY.get(mode)?.label ?? mode}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-200">
            {copy?.label ?? playMode}
          </div>
        )}
        {copy?.detail && <p className="mt-2 text-xs text-gray-400">{copy.detail}</p>}
        {playMode === "scheduled" && (
          <p className="mt-2 text-xs text-amber-200/90">
            Everyone starts together and each player gets one attempt. Players
            who join late still get in and play whatever time is left.
          </p>
        )}
      </Field>
    </StepPanel>
  );
}
