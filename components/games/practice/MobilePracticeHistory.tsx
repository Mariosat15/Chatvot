"use client";

import { useState } from "react";
import { Clock3, Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { formatGameScore, type GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "../practice-state";

const STATUS_LABELS = new Map<string, string>([
  ["voided", "Ended"],
  ["completed", "Finished"],
  ["expired", "Time ran out"],
  ["abandoned", "Left early"],
  ["unresolved", "Waiting on result"],
]);

const PREVIEW_LIMIT = 3;

interface MobilePracticeHistoryProps {
  rounds: PracticeRoundView[];
  scoreType?: GameScoreType;
  onForget: (roundId: string) => void;
  onClearAll: () => void;
  busy?: boolean;
}

/**
 * Compact mobile history: three rows by default, then "View all rounds".
 * Model-free (R58). Absent score is a dash (R50).
 */
export function MobilePracticeHistory({
  rounds,
  scoreType,
  onForget,
  onClearAll,
  busy = false,
}: MobilePracticeHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (rounds.length === 0) return null;

  const clearable = rounds.some((round) => !round.isLive);
  const visible = expanded ? rounds : rounds.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, rounds.length - PREVIEW_LIMIT);

  return (
    <section className="m-practice-history" aria-label="Your recent practice rounds">
      <div className="m-practice-history__head">
        <h3 className="m-practice-history__title">
          <Clock3 aria-hidden />
          Recent practice rounds
        </h3>
        {clearable ? (
          <div className="m-practice-history__menu">
            <button
              type="button"
              className="m-practice-history__menu-btn"
              aria-label="History options"
              aria-expanded={menuOpen}
              disabled={busy}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal aria-hidden />
            </button>
            {menuOpen ? (
              <button
                type="button"
                className="m-practice-history__clear"
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false);
                  onClearAll();
                }}
              >
                Clear practice history
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="m-practice-history__list">
        {visible.map((round) => {
          const label = round.isLive
            ? "In progress"
            : (STATUS_LABELS.get(round.status) ?? round.status);
          const scoreText = formatGameScore(round.score, scoreType);
          return (
            <li key={round.roundId} className="m-practice-history__row">
              <div className="m-practice-history__meta">
                <Flag aria-hidden />
                <span>{label}</span>
              </div>
              <span className="m-practice-history__score">{scoreText}</span>
              {!round.isLive ? (
                <button
                  type="button"
                  className="m-practice-history__delete"
                  disabled={busy}
                  aria-label="Delete this practice result"
                  onClick={() => onForget(round.roundId)}
                >
                  <Trash2 aria-hidden />
                </button>
              ) : (
                <span className="m-practice-history__delete-spacer" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && !expanded ? (
        <button
          type="button"
          className="m-practice-history__more"
          onClick={() => setExpanded(true)}
        >
          View all rounds ({rounds.length})
        </button>
      ) : null}
      {expanded && rounds.length > PREVIEW_LIMIT ? (
        <button
          type="button"
          className="m-practice-history__more"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      ) : null}
    </section>
  );
}
