"use client";

import { PLAY_MODE_COPY, type PlayMode } from "@/lib/services/games/play-shape";
import type { CompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";
import { Field, StepPanel, inputClass } from "@/components/gamemaster/provider-contest-wizard-steps";
import AccessFundingFields from "@/components/gamemaster/AccessFundingFields";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";

/**
 * Game Master provider wizard step: who can join, who pays, and how the game is played.
 *
 * `visibilityOptions` is the server's `creatableVisibilities`, so this step never decides what
 * a package allows. With public as the only option it is shown as a fact, not a choice.
 * The access and funding choices are the same `AccessFundingFields` the trading wizard uses.
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
  fundingOffered = false,
  fundingMode,
  onFundingMode,
}: {
  visibilityOptions: readonly CompetitionVisibility[];
  visibility: CompetitionVisibility | undefined;
  onVisibility: (next: CompetitionVisibility) => void;
  canPickMode: boolean;
  playMode: PlayMode;
  supportedPlayModes: PlayMode[];
  onPlayMode: (m: PlayMode) => void;
  disabled: boolean;
  fundingOffered?: boolean;
  fundingMode?: FundingMode;
  onFundingMode?: (m: FundingMode) => void;
}) {
  const modes =
    supportedPlayModes.length > 0 ? supportedPlayModes : ([playMode] as PlayMode[]);
  const copy = PLAY_MODE_COPY.get(playMode);

  return (
    <StepPanel title="Access & Funding" subtitle="Who can join, who pays, and how the game is played">
      <AccessFundingFields
        visibilityOptions={visibilityOptions}
        visibility={visibility}
        onVisibility={onVisibility}
        fundingOffered={fundingOffered}
        fundingMode={fundingMode}
        onFundingMode={onFundingMode}
        disabled={disabled}
      />

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
