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
import { PERF, PERF_SECTION_ICON } from "./performance-assets";
import type { PerformanceAnalyticsModel } from "./usePerformanceAnalyticsModel";

/**
 * Same glass plate as Wallet Analytics, magenta instead of cyan.
 *
 * Reason: owner 6 Oct 2026 — Performance sat as bare type on the mountain
 * wash while Wallet had a bordered banner. Colour is the only difference.
 */
export default function PerformanceHeader({
  model,
  compact = false,
}: {
  model: PerformanceAnalyticsModel;
  compact?: boolean;
}) {
  const glow = PERF.magenta;
  return (
    <header
      className="relative overflow-hidden rounded-[16px] border border-[#ff36ca]/30 bg-[linear-gradient(135deg,rgba(9,22,45,0.65)_0%,rgba(3,10,25,0.72)_100%)] shadow-[0_0_28px_rgba(255,54,202,0.12)] backdrop-blur-md"
      data-perf-section="header"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
        style={{
          backgroundImage: [
            `radial-gradient(ellipse 80% 120% at 88% 20%, ${glow}33 0%, transparent 55%)`,
            `linear-gradient(115deg, transparent 40%, ${glow}1a 50%, transparent 60%)`,
          ].join(", "),
        }}
      />
      <div
        className={`relative flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 ${compact ? "" : "sm:min-h-[100px]"}`}
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
      </div>
    </header>
  );
}
