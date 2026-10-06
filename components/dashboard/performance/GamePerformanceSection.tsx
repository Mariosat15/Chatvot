"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GamePerformanceCard } from "./GamePerformanceCard";
import { PerfEmpty, PerfSection } from "./PerformanceChrome";
import { PERF_SECTION_ICON } from "./performance-assets";
import { type GameCardView } from "./performance-game-cards";

function ArrowButton({
  label,
  dir,
  disabled,
  onStep,
  decorative = false,
}: {
  label: string;
  dir: -1 | 1;
  disabled: boolean;
  onStep: (dir: -1 | 1) => void;
  decorative?: boolean;
}) {
  const Icon = dir === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      disabled={disabled}
      onClick={() => onStep(dir)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/50 bg-[#041025]/95 text-cyan-200 shadow-[0_0_12px_rgba(0,217,255,.28)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/**
 * Two compact Image-1 cards at a time. Arrows sit in the header (never under
 * the sidebar) and again on the row. Reason: `overflow-x-clip` plus a
 * negative-translate left control painted the Previous button behind the menu.
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
    const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 16;
    el.scrollBy({ left: dir * (first.offsetWidth + gap), behavior: "smooth" });
  }, []);

  const showArrows = cards.length > 1;

  useEffect(() => {
    syncEdges();
  }, [syncEdges, cards.length]);

  const arrows = showArrows ? (
    <div className="flex items-center gap-2">
      <ArrowButton label="Previous games" dir={-1} disabled={atStart} onStep={step} />
      <ArrowButton label="Next games" dir={1} disabled={atEnd} onStep={step} />
    </div>
  ) : null;

  return (
    <PerfSection
      title="Game Performance"
      subtitle="Every game you have played, including trading — artwork, metrics and trend, two at a time."
      icon={PERF_SECTION_ICON.games}
      testId="games"
      controls={arrows}
    >
      {cards.length === 0 ? (
        <PerfEmpty>No ranked game rounds yet. Play a game contest to see it here.</PerfEmpty>
      ) : (
        <div className="relative min-w-0">
          {showArrows ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden items-center pl-1 sm:flex">
              <div className="pointer-events-auto">
                <ArrowButton
                  label="Previous games"
                  dir={-1}
                  disabled={atStart}
                  onStep={step}
                  decorative
                />
              </div>
            </div>
          ) : null}
          {showArrows ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden items-center pr-1 sm:flex">
              <div className="pointer-events-auto">
                <ArrowButton
                  label="Next games"
                  dir={1}
                  disabled={atEnd}
                  onStep={step}
                  decorative
                />
              </div>
            </div>
          ) : null}
          <ul
            ref={scroller}
            onScroll={syncEdges}
            className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-11 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {cards.map((card) => (
              <li
                key={card.gameKey}
                className="w-full shrink-0 snap-start sm:w-[calc((100%-1rem)/2)]"
              >
                <GamePerformanceCard card={card} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </PerfSection>
  );
}
