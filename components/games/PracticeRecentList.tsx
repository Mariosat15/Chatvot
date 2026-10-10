"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Clock3, Flag, Trash2 } from "lucide-react";
import { formatGameScore, type GameScoreType } from "@/lib/utils/format-game-score";
import type { PracticeRoundView } from "./practice-state";

const STATUS_LABELS = new Map<string, string>([
  ["voided", "Ended"],
  ["completed", "Finished"],
  ["expired", "Time ran out"],
  ["abandoned", "Left early"],
  ["unresolved", "Waiting on result"],
]);

const ROW_STEP = 70;
const VIEWPORT_MAX = 210;

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
 *
 * Reason (8 Oct 2026, owner): no native scrollbar — slide with up/down arrows or by
 * dragging the list with the mouse (or touch).
 */
export function PracticeRecentList({
  rounds,
  scoreType,
  onForget,
  onClearAll,
  busy = false,
}: PracticeRecentListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [offset, setOffset] = useState(0);
  const [maxOffset, setMaxOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(
    null,
  );

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;
    const nextMax = Math.max(0, list.scrollHeight - viewport.clientHeight);
    setMaxOffset(nextMax);
    setOffset((current) => Math.min(current, nextMax));
  }, []);

  useEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(viewport);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [measure, rounds]);

  const clamp = useCallback(
    (value: number) => Math.max(0, Math.min(maxOffset, value)),
    [maxOffset],
  );

  const nudge = useCallback(
    (delta: number) => {
      setOffset((current) => clamp(current + delta));
    },
    [clamp],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!drag.current) return;
      const delta = drag.current.startY - event.clientY;
      if (Math.abs(delta) > 3) drag.current.moved = true;
      setOffset(clamp(drag.current.startOffset + delta));
    };
    const onUp = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clamp]);

  if (rounds.length === 0) return null;

  const clearable = rounds.some((round) => !round.isLive);
  const canScroll = maxOffset > 4;
  const atTop = offset <= 0;
  const atBottom = offset >= maxOffset - 1;

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

      <div className="practice-history__body">
        <button
          type="button"
          className="practice-history__arrow"
          aria-label="Scroll practice history up"
          disabled={!canScroll || atTop}
          onClick={() => nudge(-ROW_STEP)}
        >
          <ChevronUp className="h-5 w-5" aria-hidden />
        </button>

        <div
          ref={viewportRef}
          className={`practice-history__viewport${dragging ? " is-dragging" : ""}`}
          style={{ maxHeight: VIEWPORT_MAX }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            // Reason: leave delete buttons clickable — only drag from the list surface.
            const target = event.target as HTMLElement;
            if (target.closest("button")) return;
            drag.current = {
              startY: event.clientY,
              startOffset: offset,
              moved: false,
            };
            setDragging(true);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onWheel={(event) => {
            if (!canScroll) return;
            event.preventDefault();
            nudge(event.deltaY);
          }}
        >
          <ul
            ref={listRef}
            className="practice-history__list"
            style={{
              transform: `translateY(-${offset}px)`,
              transition: dragging ? "none" : "transform 0.18s ease-out",
            }}
          >
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
        </div>

        <button
          type="button"
          className="practice-history__arrow"
          aria-label="Scroll practice history down"
          disabled={!canScroll || atBottom}
          onClick={() => nudge(ROW_STEP)}
        >
          <ChevronDown className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
