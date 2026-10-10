"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PERF_SECTION_ICON } from "../performance-assets";
import {
  upcomingHolidays,
  type MarketHoliday,
  type MarketHolidaysState,
} from "../useMarketHolidays";
import { MobilePerfHeading, MobilePerfPlate } from "./mobile-perf-shell";

const PREVIEW = 3;

function whenLabel(daysUntil: number | undefined): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return typeof daysUntil === "number" ? `In ${daysUntil} days` : "-";
}

function DateTile({ date }: { date: string }) {
  const d = new Date(date);
  const valid = !Number.isNaN(d.getTime());
  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-[#ffc51b]/30 bg-[#ffc51b]/[0.06]">
      <span className="text-[9px] font-bold uppercase text-[#ffc51b]">
        {valid ? d.toLocaleDateString(undefined, { month: "short" }) : "-"}
      </span>
      <span className="text-base font-black leading-none text-white">{valid ? d.getDate() : "-"}</span>
    </div>
  );
}

function HolidayRow({ holiday }: { holiday: MarketHoliday }) {
  return (
    <li className="flex min-h-[48px] items-center gap-3 rounded-lg bg-white/[0.03] px-2 py-2" data-holiday>
      <DateTile date={holiday.date} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{holiday.name}</div>
        <div className="truncate text-[11px] text-[#8ea4c5]">{holiday.exchange || "Forex markets"}</div>
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-[#8ea4c5]">{whenLabel(holiday.daysUntil)}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#8ea4c5]" aria-hidden />
    </li>
  );
}

/** Next three holidays. Expand for the rest — no desktop-length list. */
export default function MobileMarketHolidays({ state }: { state: MarketHolidaysState }) {
  const [expanded, setExpanded] = useState(false);
  const list = upcomingHolidays(state.holidays, "all");
  const visible = expanded ? list : list.slice(0, PREVIEW);

  return (
    <section data-perf-section="holidays">
      <MobilePerfHeading
        title="Market Holidays"
        subtitle="Upcoming market closures."
        icon={PERF_SECTION_ICON.holidays}
        controls={
          list.length > PREVIEW ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="min-h-[44px] rounded-lg px-2 text-xs font-semibold text-cyan-200"
            >
              {expanded ? "Show less" : "View all"}
            </button>
          ) : null
        }
      />
      <MobilePerfPlate accent="gold">
        {state.error ? (
          <p className="text-sm text-[#8ea4c5]">We couldn&apos;t load market holidays.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-[#8ea4c5]">No upcoming market holidays.</p>
        ) : (
          <ul className="space-y-2">{visible.map((h) => <HolidayRow key={`${h.date}-${h.name}`} holiday={h} />)}</ul>
        )}
      </MobilePerfPlate>
    </section>
  );
}
