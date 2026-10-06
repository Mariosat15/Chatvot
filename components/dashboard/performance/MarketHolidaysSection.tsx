"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { NeonIcon, PerfCard, PerfSection } from "./PerformanceChrome";
import { PERF_SECTION_ICON } from "./performance-assets";
import {
  upcomingHolidays,
  type HolidayWindow,
  type MarketHoliday,
  type MarketHolidaysState,
} from "./useMarketHolidays";

const WINDOWS: { value: HolidayWindow; label: string }[] = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

const VISIBLE_LIMIT = 5;

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
      <span className="text-base font-black leading-none text-white">
        {valid ? d.getDate() : "-"}
      </span>
    </div>
  );
}

function HolidayRow({ holiday }: { holiday: MarketHoliday }) {
  const soon = typeof holiday.daysUntil === "number" && holiday.daysUntil <= 2;
  return (
    <li className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-2.5 py-2" data-holiday>
      <DateTile date={holiday.date} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{holiday.name}</div>
        <div className="truncate text-[11px] text-[#8ea4c5]">{holiday.exchange || "Forex markets"}</div>
      </div>
      <span
        className={`shrink-0 text-[11px] font-semibold ${soon ? "text-[#ffc51b]" : "text-[#8ea4c5]"}`}
      >
        {whenLabel(holiday.daysUntil)}
      </span>
    </li>
  );
}

/**
 * Upcoming market closures. Always rendered — unlike the old card, which returned
 * null when empty and left a hole in the bottom row.
 */
export default function MarketHolidaysSection({ state }: { state: MarketHolidaysState }) {
  const [lookAhead, setLookAhead] = useState<HolidayWindow>("90d");
  const list = upcomingHolidays(state.holidays, lookAhead);

  const controls = (
    <div className="flex items-center gap-1.5">
      <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Holiday window">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            aria-pressed={lookAhead === w.value}
            onClick={() => setLookAhead(w.value)}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              lookAhead === w.value ? "bg-[#ffc51b]/15 text-[#ffc51b]" : "text-[#8ea4c5]"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={state.refresh}
        aria-label="Refresh holidays"
        className="rounded-lg border border-white/10 p-1.5 text-[#8ea4c5] hover:text-white"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  return (
    <PerfSection
      title="Market Holidays"
      subtitle="Days the forex market is closed and trading pauses."
      icon={PERF_SECTION_ICON.holidays}
      controls={controls}
      testId="holidays"
    >
      <PerfCard accent="gold" className="h-full">
        <div className="flex h-full flex-col gap-2 p-4">
          {state.live ? (
            <span className="self-start rounded-md bg-[#00e6a3]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#00e6a3]">
              Live calendar
            </span>
          ) : null}
          {state.loading && state.holidays.length === 0 ? (
            <p className="text-xs text-[#8ea4c5]">Loading holidays…</p>
          ) : state.error ? (
            <p className="text-xs text-[#ff4b67]">{state.error}</p>
          ) : list.length === 0 ? (
            <div className="flex items-center gap-3">
              <NeonIcon src={PERF_SECTION_ICON.holidays} size={32} />
              <p className="text-xs text-[#8ea4c5]">No market holidays in this window.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.slice(0, VISIBLE_LIMIT).map((h) => (
                <HolidayRow key={h.id} holiday={h} />
              ))}
            </ul>
          )}
          {list.length > VISIBLE_LIMIT ? (
            <p className="text-[11px] text-[#8ea4c5]">+{list.length - VISIBLE_LIMIT} more</p>
          ) : null}
        </div>
      </PerfCard>
    </PerfSection>
  );
}
