"use client";

import { useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { Info, Sparkles } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { ContestHowItWorks } from "@/components/competitions/lobby/ContestHowItWorks";
import { contestAboutFallback } from "@/components/competitions/lobby/contest-lobby-copy";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";

/**
 * The trading main column's tab bar, at the TOP of the main column directly under the summary
 * cards (owner, 12 Oct 2026: "move the section on the top").
 *
 * Overview is the intro + How It Works; every other tab is one of the reference sections built
 * on the server by `buildTradingLobbySections` and handed in already rendered, so every value,
 * fallback and "omit when empty" condition stays in that one builder.
 *
 * THE OVERVIEW IS THIS CONTEST'S FACTS, not generic copy: `overview` comes from
 * `buildTradingOverviewCopy`, which writes the feature tiles and the four steps from the ranking
 * method, the assets, the capital, the leverage, the minimum trades and the prize pot.
 *
 * NO VISIBLE SCROLLBAR (owner, same day): the strip scrolls by dragging, by the wheel and by
 * touch. The pointer is captured only after the drag threshold - capturing on pointer-down
 * retargets the click to the strip and no tab can ever be selected.
 *
 * `sections` and `overview` must stay serialisable data + rendered output (R39): this is a
 * client component and a lucide component passed from the server page cannot cross the boundary.
 */

const OVERVIEW_ID = "overview";
/** Pixels a press must travel before it is a drag rather than a click on a tab. */
const DRAG_THRESHOLD_PX = 5;

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return;
    drag.current = {
      down: true,
      moved: false,
      startX: event.clientX,
      startScroll: ref.current.scrollLeft,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const el = ref.current;
    if (!state.down || !el) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    if (!state.moved) {
      state.moved = true;
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = state.startScroll - dx;
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    drag.current.down = false;
    if (ref.current?.hasPointerCapture(event.pointerId)) {
      ref.current.releasePointerCapture(event.pointerId);
    }
  };

  /** Swallow the click that ends a drag, so releasing over a tab does not select it. */
  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      drag.current.moved = false;
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      el.scrollLeft += event.deltaY;
    }
  };

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture,
    onWheel,
  };
}

export function TradingDetailTabs({
  description,
  sections,
  overview,
}: {
  description?: string | null;
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
}) {
  const [tab, setTab] = useState<string>(OVERVIEW_ID);
  const dragScroll = useDragScroll();
  const about =
    typeof description === "string" && description.trim()
      ? description.trim()
      : contestAboutFallback("trading");
  const active = sections.find((s) => s.id === tab);

  return (
    <NeonPanel accent="players" size="lg" className="!p-0 overflow-hidden">
      <div
        role="tablist"
        {...dragScroll}
        className="flex cursor-grab select-none gap-1.5 overflow-x-auto border-b border-[#1B2540] bg-[#080C18]/70 p-2 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      >
        <TabButton
          active={tab === OVERVIEW_ID}
          onClick={() => setTab(OVERVIEW_ID)}
          icon={<Sparkles className="h-4 w-4 shrink-0 text-sky-300" />}
          label="Overview"
        />
        {sections.map((section) => (
          <TabButton
            key={section.id}
            active={tab === section.id}
            onClick={() => setTab(section.id)}
            icon={section.icon}
            label={section.title}
          />
        ))}
      </div>

      <div className="p-5 sm:p-6" role="tabpanel">
        {active ? (
          <div className="max-w-3xl text-base [&_p]:text-[15px]">
            <h3 className="mb-4 flex items-center gap-2.5 text-xl font-bold text-gray-100">
              {active.icon}
              {active.title}
            </h3>
            {active.content}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div>
              <h3 className="flex items-center gap-2.5 text-xl font-bold text-gray-100">
                <Info className="h-5 w-5 text-sky-300" />
                About this competition
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray-300">
                {about}
              </p>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {overview.features.map((feature) => (
                  <li
                    key={feature.iconSrc}
                    className="flex flex-col items-center rounded-xl border border-[#1B2540] bg-[#080C18]/60 px-3 py-4 text-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
                    <img
                      src={feature.iconSrc}
                      alt=""
                      className="h-11 w-11 object-contain"
                      draggable={false}
                    />
                    <p className="mt-2 text-sm font-semibold text-gray-100">
                      {feature.title}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-gray-400">
                      {feature.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <ContestHowItWorks
              kind="trading"
              embedded
              layout="timeline"
              steps={overview.steps}
            />
          </div>
        )}
      </div>
    </NeonPanel>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      draggable={false}
      className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-sky-400/70 bg-sky-500/15 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.25)]"
          : "border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
