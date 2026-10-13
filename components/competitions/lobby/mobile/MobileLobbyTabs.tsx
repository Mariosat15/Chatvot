"use client";

import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { MobileLobbyOverview } from "./MobileLobbyOverview";
import { MobileLobbyBattlePlan } from "./MobileLobbyBattlePlan";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";

/**
 * Touch-scroll tab strip — only the selected body is visible (Complobyymobile §9).
 * Overview stacks About + Battle Plan as separate full-width cards.
 */

const OVERVIEW_ID = "overview";
const DRAG_THRESHOLD_PX = 5;

export function MobileLobbyTabs({
  about,
  overview,
  sections,
}: {
  about: string;
  overview: TradingOverviewCopy;
  sections: NeonAccordionSection[];
}) {
  const tabs = [
    { id: OVERVIEW_ID, title: "Overview" },
    ...sections.map((s) => ({ id: s.id, title: s.title })),
  ];
  const [active, setActive] = useState(OVERVIEW_ID);
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(tabs.length - 1, next));
    const tab = tabs.at(clamped);
    if (tab) setActive(tab.id);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !stripRef.current)
      return;
    drag.current = {
      down: true,
      moved: false,
      startX: event.clientX,
      startScroll: stripRef.current.scrollLeft,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const el = stripRef.current;
    if (!state.down || !el) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    if (!state.moved) {
      state.moved = true;
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = state.startScroll - dx;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    drag.current.down = false;
    if (stripRef.current?.hasPointerCapture(event.pointerId)) {
      stripRef.current.releasePointerCapture(event.pointerId);
    }
  };

  let body: ReactNode = null;
  if (active === OVERVIEW_ID) {
    body = (
      <div className="space-y-4">
        <MobileLobbyOverview about={about} overview={overview} />
        <MobileLobbyBattlePlan overview={overview} />
      </div>
    );
  } else {
    const section = sections.find((s) => s.id === active);
    body = section ? (
      <div className="min-w-0 text-[14px] leading-relaxed text-gray-200 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_p]:break-words">
        {section.content}
      </div>
    ) : null;
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous tab"
          disabled={activeIndex <= 0}
          onClick={() => go(activeIndex - 1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#1B2540] bg-[#0A0F1F] text-cyan-300 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Competition information"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => {
            if (drag.current.moved) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`lobby-tab-${tab.id}`}
                onClick={() => setActive(tab.id)}
                className={`shrink-0 snap-start rounded-xl px-3.5 py-2.5 text-sm font-semibold min-h-11 ${
                  selected
                    ? "border border-cyan-400/50 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                    : "border border-transparent text-gray-400"
                }`}
              >
                {tab.title}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Next tab"
          disabled={activeIndex >= tabs.length - 1}
          onClick={() => go(activeIndex + 1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#1B2540] bg-[#0A0F1F] text-cyan-300 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`lobby-tab-${active}`}
        className="min-w-0"
      >
        {body}
      </div>
    </div>
  );
}
