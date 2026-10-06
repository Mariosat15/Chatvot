"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GamePerformanceCard } from "./GamePerformanceCard";
import { PerfEmpty, PerfSection } from "./PerformanceChrome";
import { PERF_SECTION_ICON } from "./performance-assets";
import { type GameCardView } from "./performance-game-cards";

/**
 * Game Performance — two large Image-1 cards at a time, extra titles via
 * carousel. Do not stack every game in a vertical grid (image 2).
 */
export default function GamePerformanceSection({ cards }: { cards: GameCardView[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  const step = useCallback((dir: -1 | 1) => {
    const el = scroller.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 20;
    el.scrollBy({ left: dir * (first.offsetWidth + gap), behavior: "smooth" });
  }, []);

  const showArrows = cards.length > 1;

  useEffect(() => {
    syncEdges();
  }, [syncEdges, cards.length]);

  return (
    <PerfSection
      title="Game Performance"
      subtitle="Every game you have played, including trading — artwork, metrics and trend, two at a time."
      icon={PERF_SECTION_ICON.games}
      testId="games"
    >
      {cards.length === 0 ? (
        <PerfEmpty>No ranked game rounds yet. Play a game contest to see it here.</PerfEmpty>
      ) : (
        <div className="relative">
          {showArrows ? (
            <button
              type="button"
              aria-label="Previous games"
              disabled={atStart}
              onClick={() => step(-1)}
              className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/50 bg-[#041025]/90 text-cyan-200 shadow-[0_0_16px_rgba(0,217,255,.28)] disabled:opacity-30 sm:flex"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
          ) : null}
          {showArrows ? (
            <button
              type="button"
              aria-label="Next games"
              disabled={atEnd}
              onClick={() => step(1)}
              className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/50 bg-[#041025]/90 text-cyan-200 shadow-[0_0_16px_rgba(0,217,255,.28)] disabled:opacity-30 sm:flex"
            >
              <ChevronRight className="h-6 w-6" aria-hidden />
            </button>
          ) : null}
          <ul
            ref={scroller}
            onScroll={syncEdges}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {cards.map((card) => (
              <li
                key={card.gameKey}
                className="w-full shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)]"
              >
                <GamePerformanceCard card={card} />
              </li>
            ))}
          </ul>
          {showArrows ? (
            <div className="mt-3 flex justify-center gap-3 sm:hidden">
              <button
                type="button"
                aria-label="Previous games"
                disabled={atStart}
                onClick={() => step(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/50 bg-[#041025] text-cyan-200 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next games"
                disabled={atEnd}
                onClick={() => step(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/50 bg-[#041025] text-cyan-200 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </PerfSection>
  );
}
