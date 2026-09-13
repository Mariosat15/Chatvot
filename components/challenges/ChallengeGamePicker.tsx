"use client";

import type { ReactNode } from "react";
import { Gamepad2, Swords, Trophy } from "lucide-react";
import type { ChallengeableTitle } from "@/lib/services/games/challengeable-titles.service";
import {
  challengeUnavailableReason,
  type ChallengeGameSelection,
} from "@/lib/services/games/challenge-game-copy";

/**
 * The game picker on the "create a challenge" dialog.
 *
 * TRADING IS ALWAYS THE FIRST CARD AND IS NEVER FETCHED - it is not a `ChallengeableTitle`,
 * it needs no provider, no adapter and no content seed, so a network failure fetching the
 * provider list must never remove the one option every existing challenge depends on. If
 * `titles` is empty (no provider enabled, or `externalGamesEnabled` off), this renders only
 * the Trading card and the picker becomes invisible - a challenge behaves exactly as it did
 * before this feature existed.
 *
 * UNSUPPORTED TITLES ARE SHOWN AND DISABLED, WITH THE REASON, RATHER THAN HIDDEN - the same
 * pattern as admin's `StepChooseGame.tsx`. A title a player can see but not pick is more
 * honest than a title that silently never appears.
 */

interface ChallengeGamePickerProps {
  titles: ChallengeableTitle[];
  selection: ChallengeGameSelection;
  onSelect: (selection: ChallengeGameSelection) => void;
  disabled?: boolean;
}

export default function ChallengeGamePicker({
  titles,
  selection,
  onSelect,
  disabled,
}: ChallengeGamePickerProps) {
  if (titles.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
          Choose a game
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <GameCard
          label="Trading"
          icon={<Swords className="h-4 w-4" />}
          selected={selection.type === "trading"}
          disabled={disabled}
          onClick={() => onSelect({ type: "trading" })}
        />
        {titles.map((title) => {
          const reason = challengeUnavailableReason(title);
          const unavailable = Boolean(reason);
          return (
            <GameCard
              key={title.gameKey}
              label={title.displayName}
              icon={<Trophy className="h-4 w-4" />}
              selected={
                selection.type === "provider" && selection.title.gameKey === title.gameKey
              }
              disabled={disabled || unavailable}
              reason={reason}
              onClick={() => onSelect({ type: "provider", title })}
            />
          );
        })}
      </div>
    </div>
  );
}

function GameCard({
  label,
  icon,
  selected,
  disabled,
  reason,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  disabled?: boolean;
  reason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={reason}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        selected
          ? "border-orange-500/60 bg-orange-500/15 text-orange-300"
          : "border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-600 hover:text-white"
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
