"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Rows per page - the owner's limit, 12 Oct 2026, so the card never grows a scroll bar. */
export const PRIZE_ROWS_PER_PAGE = 7;

/** How far a drag must travel before it counts as a swipe rather than a click. */
const SWIPE_THRESHOLD_PX = 50;

/**
 * Pages the prize table's rows seven at a time, changed by dragging or swiping sideways as well
 * as by the arrows and dots. Takes rows that are ALREADY RENDERED on the server - React elements,
 * never components or functions, because this is the server/client boundary (R39) - so every
 * payout figure is still decided once, in `prize-projection.ts`, and this file only chooses which
 * seven to show.
 */
export default function PrizePager({ rows }: { rows: ReactNode[] }) {
  const pageCount = Math.max(1, Math.ceil(rows.length / PRIZE_ROWS_PER_PAGE));
  const [page, setPage] = useState(0);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  const current = Math.min(page, pageCount - 1);
  const go = (next: number) =>
    setPage(Math.max(0, Math.min(pageCount - 1, next)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pageCount < 2) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    setDragX(e.clientX - startX.current);
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    startX.current = null;
    setDragX(0);
    if (delta <= -SWIPE_THRESHOLD_PX) go(current + 1);
    else if (delta >= SWIPE_THRESHOLD_PX) go(current - 1);
  };

  const visible = rows.slice(
    current * PRIZE_ROWS_PER_PAGE,
    (current + 1) * PRIZE_ROWS_PER_PAGE,
  );
  const from = current * PRIZE_ROWS_PER_PAGE + 1;
  const to = Math.min((current + 1) * PRIZE_ROWS_PER_PAGE, rows.length);

  return (
    <div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          transform: dragX ? `translateX(${dragX * 0.4}px)` : undefined,
        }}
        className={`space-y-3 touch-pan-y select-none transition-transform duration-150 ${
          pageCount > 1 ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {visible}
      </div>

      {pageCount > 1 && (
        <nav
          aria-label="Prize places"
          className="mt-3 flex items-center justify-between gap-2"
        >
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Previous places"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Page ${i + 1}`}
                  aria-current={i === current ? "page" : undefined}
                  className={`h-2 rounded-full transition-all ${
                    i === current
                      ? "w-5 bg-cyan-300"
                      : "w-2 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-white/50">
              Places {from}-{to} of {rows.length} - swipe for more
            </span>
          </div>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === pageCount - 1}
            aria-label="Next places"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
