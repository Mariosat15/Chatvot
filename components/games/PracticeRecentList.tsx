"use client";

import { Clock3, Flag, Trash2 } from "lucide-react";
import { NEON_PANEL_LIT } from "@/components/neon/tokens";
import { formatGameScore, type GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "./practice-state";

const STATUS_LABELS = new Map<string, string>([
  ["voided", "Ended"],
  ["completed", "Finished"],
  ["expired", "Time ran out"],
  ["abandoned", "Left early"],
  ["unresolved", "Waiting on result"],
]);

interface PracticeRecentListProps {
  rounds: PracticeRoundView[];
  scoreType?: GameScoreType;
  onForget: (roundId: string) => void;
  onClearAll: () => void;
  busy?: boolean;
}

/**
 * Last five practice rounds for one game, with per-row delete and clear-all.
 * Model-free (R58). An absent score is a dash, never zero (R50).
 */
export function PracticeRecentList({
  rounds,
  scoreType,
  onForget,
  onClearAll,
  busy = false,
}: PracticeRecentListProps) {
  if (rounds.length === 0) return null;

  const clearable = rounds.some((round) => !round.isLive);

  return (
    <div className={`${NEON_PANEL_LIT} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-200/80">
          <Clock3 className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
          Your recent practice rounds
        </h3>
        {clearable ? (
          <button
            type="button"
            disabled={busy}
            onClick={onClearAll}
            className="text-xs font-semibold uppercase tracking-wider text-rose-300/80 transition-colors hover:text-rose-200 disabled:opacity-50"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-white/5">
        {rounds.map((round) => {
          const label = round.isLive
            ? "In progress"
            : (STATUS_LABELS.get(round.status) ?? round.status);
          const scoreText = formatGameScore(round.score, scoreType);
          return (
            <li
              key={round.roundId}
              className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Flag className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" aria-hidden />
                <span className="truncate text-gray-200">{label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-semibold tabular-nums text-white">{scoreText}</span>
                {!round.isLive ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Delete this practice result"
                    onClick={() => onForget(round.roundId)}
                    className="rounded-md border border-white/10 p-1.5 text-gray-400 transition-colors hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
