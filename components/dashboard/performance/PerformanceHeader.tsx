"use client";

import { ChartRangeSelector } from "@/components/dashboard/wallet/AnalyticsCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyticsPageHeadline } from "@/components/dashboard/AnalyticsPageHeadline";
import { NeonIcon } from "./PerformanceChrome";
import { PERF_SECTION_ICON } from "./performance-assets";
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
      <AnalyticsPageHeadline
        lead="Performance"
        accentWord="Analytics"
        accent="magenta"
        compact={compact}
        subtitle="How you are doing across every game, competition and 1v1."
        icon={<NeonIcon src={PERF_SECTION_ICON.page} size={compact ? 40 : 56} />}
      />

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
