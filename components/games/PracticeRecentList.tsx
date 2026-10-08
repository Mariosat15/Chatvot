"use client";

import { Clock3, Flag, Trash2 } from "lucide-react";
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
 * Last practice rounds for one game, HUD-framed.
 * Model-free (R58). An absent score is a dash, never zero (R50).
 * Cap the visible height so history cannot stretch the lobby forever.
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
    <section className="practice-hud practice-history" aria-label="Your recent practice rounds">
      <div className="practice-hud__glow" aria-hidden />
      <div className="practice-history__head">
        <h3 className="practice-history__title">
          <Clock3 className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
          Your recent practice rounds
        </h3>
        <div className="flex items-center gap-3">
          {clearable ? (
            <button
              type="button"
              disabled={busy}
              onClick={onClearAll}
              className="practice-history__clear"
            >
              Clear all
            </button>
          ) : null}
          <span className="practice-history__marks" aria-hidden>
            ///
          </span>
        </div>
      </div>
      <ul className="practice-history__list">
        {rounds.map((round) => {
          const label = round.isLive
            ? "In progress"
            : (STATUS_LABELS.get(round.status) ?? round.status);
          const scoreText = formatGameScore(round.score, scoreType);
          return (
            <li key={round.roundId} className="practice-history__row">
              <div className="practice-history__meta">
                <Flag className="h-3.5 w-3.5 shrink-0 text-cyan-300/80" aria-hidden />
                <span className="truncate">{label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="practice-history__score">{scoreText}</span>
                {!round.isLive ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Delete this practice result"
                    onClick={() => onForget(round.roundId)}
                    className="practice-history__delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
