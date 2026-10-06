"use client";

import { ChartRangeSelector } from "@/components/dashboard/wallet/AnalyticsCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NeonIcon } from "./PerformanceChrome";
import { PERF, PERF_SECTION_ICON } from "./performance-assets";
import type { PerformanceAnalyticsModel } from "./usePerformanceAnalyticsModel";

/**
 * Page title and the two filters every section below reads.
 *
 * The game list is the shared Radix `Select`, never a native one: a native
 * `<select>` on a translucent background paints its options white on white (R60).
 */
export default function PerformanceHeader({
  model,
  compact = false,
}: {
  model: PerformanceAnalyticsModel;
  compact?: boolean;
}) {
  return (
    <header
      className={`flex gap-4 ${compact ? "flex-col" : "flex-col lg:flex-row lg:items-end lg:justify-between"}`}
      data-perf-section="header"
    >
      <div className="flex items-center gap-3">
        <NeonIcon src={PERF_SECTION_ICON.page} size={compact ? 40 : 52} />
        <div className="min-w-0">
          <h2
            className={`font-black uppercase tracking-tight ${compact ? "text-2xl" : "text-3xl lg:text-4xl"}`}
          >
            <span style={{ color: PERF.text }}>Performance </span>
            <span style={{ color: PERF.magenta }}>Analytics</span>
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: PERF.muted }}>
            How you are doing across every game, competition and 1v1.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChartRangeSelector value={model.range} onChange={model.setRange} />
        <Select value={model.gameKey} onValueChange={model.setGameKey}>
          <SelectTrigger
            aria-label="Filter by game"
            className="h-9 w-[180px] border-cyan-500/25 bg-black/35 text-sm text-white"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {model.gameOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
