"use client";

import { useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import {
  contestAboutFallback,
  type ContestLobbyKind,
} from "@/components/competitions/lobby/contest-lobby-copy";
import { TradingOverview } from "@/components/competitions/detail/TradingOverview";
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
 * `buildTradingOverviewCopy`, which writes the About tiles and the Battle plan steps from the
 * ranking method, the assets, the capital, the leverage, the minimum trades, the seats and the
 * pot. `TradingOverview` draws them as two cards side by side (owner reference, 12 Oct 2026).
 *
 * ARROWS either side of the strip step to the previous and next tab (owner, 12 Oct 2026), and
 * Prizes is no longer a tab - the sidebar's prize distribution already says all of it.
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
    if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current)
      return;
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
  kind = "trading",
}: {
  description?: string | null;
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
  /**
   * About-fallback voice only. Game lobbies reuse this strip so the chrome stays
   * identical; `kind="game"` picks the game about sentence when description is empty.
   */
  kind?: ContestLobbyKind;
}) {
  const [tab, setTab] = useState<string>(OVERVIEW_ID);
  const dragScroll = useDragScroll();
  const about =
    typeof description === "string" && description.trim()
      ? description.trim()
      : contestAboutFallback(kind);
  const active = sections.find((s) => s.id === tab);

  /*
   * The arrows step through the tabs in strip order and bring the chosen one into view, so a
   * tab hidden past the edge of a narrow strip is reachable without dragging (owner request).
   */
  const order = [OVERVIEW_ID, ...sections.map((s) => s.id)];
  const at = Math.max(0, order.indexOf(tab));
  const go = (step: -1 | 1) => {
    const next = order[at + step];
    if (!next) return;
    setTab(next);
    dragScroll.ref.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${next}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
  };

  return (
    <NeonPanel accent="players" size="lg" className="!p-0 overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-[#1B2540] bg-[#080C18]/70 p-2">
        <ArrowButton
          direction="previous"
          disabled={at === 0}
          onClick={() => go(-1)}
        />
        <div
          role="tablist"
          {...dragScroll}
          className="flex min-w-0 flex-1 cursor-grab select-none gap-1.5 overflow-x-auto [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        >
          <TabButton
            id={OVERVIEW_ID}
            active={tab === OVERVIEW_ID}
            onClick={() => setTab(OVERVIEW_ID)}
            icon={
              // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
              <img
                src={NEON_ICON("lightbulb")}
                alt=""
                draggable={false}
                className="h-5 w-5 shrink-0 object-contain"
              />
            }
            label="Overview"
          />
          {sections.map((section) => (
            <TabButton
              key={section.id}
              id={section.id}
              active={tab === section.id}
              onClick={() => setTab(section.id)}
              icon={section.icon}
              label={section.title}
            />
          ))}
        </div>
        <ArrowButton
          direction="next"
          disabled={at === order.length - 1}
          onClick={() => go(1)}
        />
      </div>

      <div className="p-5 sm:p-6" role="tabpanel">
        {active ? (
          /* The rule cards carry their own icon and heading, so the panel adds none. */
          active.content
        ) : (
          <TradingOverview about={about} overview={overview} />
        )}
      </div>
    </NeonPanel>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous tab" : "Next tab"}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-400/40 bg-sky-500/10 text-sky-200 transition hover:bg-sky-500/20 hover:shadow-[0_0_14px_rgba(56,189,248,0.35)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-sky-500/10 disabled:hover:shadow-none"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function TabButton({
  id,
  active,
  onClick,
  icon,
  label,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      data-tab-id={id}
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
