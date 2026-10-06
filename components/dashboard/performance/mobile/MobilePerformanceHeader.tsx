"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Filter, UserRound, X } from "lucide-react";
import { AnalyticsPageHeadline } from "@/components/dashboard/AnalyticsPageHeadline";
import { ChartRangeSelector } from "@/components/dashboard/wallet/AnalyticsCard";
import { NeonIcon } from "../PerformanceChrome";
import { PERF_SECTION_ICON } from "../performance-assets";
import type { PerformanceAnalyticsModel } from "../usePerformanceAnalyticsModel";
import type { WalletRange } from "@/components/dashboard/wallet/wallet-tokens";
import { perfRangeLabel } from "./mobile-perf-shell";

/**
 * Compact phone header. Filters live in a sheet so they do not eat the page.
 */
export default function MobilePerformanceHeader({ model }: { model: PerformanceAnalyticsModel }) {
  const [open, setOpen] = useState(false);
  const gameLabel = model.gameOptions.find((o) => o.value === model.gameKey)?.label ?? "All games";

  return (
    <>
      <header className="flex min-h-[64px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <NeonIcon src={PERF_SECTION_ICON.page} size={36} />
          <div className="min-w-0">
            <AnalyticsPageHeadline
              lead="Performance"
              accentWord="Analytics"
              accent="magenta"
              compact
              tag="h1"
            />
            <p className="truncate text-[11px] text-slate-400">{perfRangeLabel(model.range)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-slate-200 active:scale-95"
            aria-label="Open performance filters"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {model.range === "all" ? "ALL" : model.range.toUpperCase()}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 active:scale-95"
            aria-label={`Filter by game, currently ${gameLabel}`}
          >
            <Filter className="h-5 w-5" aria-hidden />
          </button>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 active:scale-95"
          >
            <Bell className="h-5 w-5" aria-hidden />
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 active:scale-95"
          >
            <UserRound className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Performance filters"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[430px] rounded-t-[20px] border border-cyan-400/25 bg-[#07172c] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-slate-200"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">
              Date range
            </p>
            <ChartRangeSelector
              value={model.range as WalletRange}
              onChange={(next) => model.setRange(next)}
            />
            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">
              Game
            </p>
            <div className="flex flex-col gap-1.5">
              {model.gameOptions.map((option) => {
                const on = option.value === model.gameKey;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      model.setGameKey(option.value);
                      setOpen(false);
                    }}
                    className={`min-h-[48px] rounded-xl border px-3 text-left text-sm font-semibold ${
                      on
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-50"
                        : "border-white/10 bg-white/[0.04] text-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
