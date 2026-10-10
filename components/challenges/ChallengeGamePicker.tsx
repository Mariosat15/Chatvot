"use client";

import type { ReactNode } from "react";
import { Check, Gamepad2, Swords, Trophy } from "lucide-react";
import type { ChallengeableTitle } from "@/lib/services/games/challengeable-titles.service";
import {
  challengeTitleFacts,
  challengeUnavailableReason,
  type ChallengeGameSelection,
} from "@/lib/services/games/challenge-game-copy";

/**
 * The game picker on the "create a challenge" dialog.
 *
 * A SCROLLING VERTICAL LIST SINCE 13 SEPTEMBER 2026, on the owner's report - "the selection of
 * games must be a list as the games will be many". It was a horizontal strip of name-only
 * chips, which is the shape that works for the two options that exist today and fails quietly
 * at ten: the later titles sit off the right-hand edge of a dialog nobody expects to scroll
 * sideways, so a player concludes the platform has two games. A vertical list has room for the
 * facts a player picks on as well, which the chips had nowhere to put.
 *
 * TRADING IS ALWAYS THE FIRST ROW AND IS NEVER FETCHED - it is not a `ChallengeableTitle`,
 * it needs no provider, no adapter and no content seed, so a network failure fetching the
 * provider list must never remove the one option every existing challenge depends on. If
 * `titles` is empty (no provider enabled, or `externalGamesEnabled` off), this renders only
 * the Trading row and the picker becomes invisible - a challenge behaves exactly as it did
 * before this feature existed.
 *
 * UNSUPPORTED TITLES ARE SHOWN AND DISABLED, WITH THE REASON, RATHER THAN HIDDEN - the same
 * pattern as admin's `StepChooseGame.tsx`. A title a player can see but not pick is more
 * honest than a title that silently never appears. The reason is rendered as text rather than
 * left in a `title` attribute, because a disabled control cannot be hovered on a phone.
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
        <span className="text-[11px] text-gray-500">
          {titles.length + 1} available
        </span>
      </div>

      {/*
        A CAPPED HEIGHT WITH ITS OWN SCROLLBAR, not `overflow-visible` inside the dialog's
        scroller. The dialog body already scrolls, so an uncapped list of twenty games pushes
        the entry fee, the prize summary and the Send button below the fold and the screen reads
        as a game menu rather than as a challenge form. The cap is in `rem` rather than a row
        count so a title whose facts wrap does not change how many rows are visible.
      */}
      <div className="max-h-[13.5rem] space-y-1.5 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/40 p-1.5">
        <GameRow
          label="Trading"
          icon={<Swords className="h-4 w-4" />}
          facts={["Live forex market", "Highest P&L wins"]}
          selected={selection.type === "trading"}
          disabled={disabled}
          onClick={() => onSelect({ type: "trading" })}
        />
        {titles.map((title) => {
          const reason = challengeUnavailableReason(title);
          return (
            <GameRow
              key={title.gameKey}
              label={title.displayName}
              icon={<Trophy className="h-4 w-4" />}
              facts={challengeTitleFacts(title)}
              selected={
                selection.type === "provider" &&
                selection.title.gameKey === title.gameKey
              }
              disabled={disabled || Boolean(reason)}
              reason={reason}
              onClick={() => onSelect({ type: "provider", title })}
            />
          );
        })}
      </div>
    </div>
  );
}

function GameRow({
  label,
  icon,
  facts,
  selected,
  disabled,
  reason,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  facts: string[];
  selected: boolean;
  disabled?: boolean;
  reason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "border-orange-500/60 bg-orange-500/15"
          : "border-gray-700/70 bg-gray-800/50 hover:border-gray-600 enabled:hover:bg-gray-800"
      }`}
    >
      <span
        className={`shrink-0 ${selected ? "text-orange-300" : "text-gray-400"}`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            selected ? "text-orange-200" : "text-gray-200"
          }`}
        >
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-gray-500">
          {reason ?? facts.join(" · ")}
        </span>
      </span>

      {selected && <Check className="h-4 w-4 shrink-0 text-orange-400" />}
    </button>
  );
}
