"use client";

import { Sparkline } from "@/components/dashboard/wallet/AnalyticsCard";
import { NeonIcon, TrendDelta, accentHex } from "../PerformanceChrome";
import { PERF_METRIC_ICON } from "../performance-assets";
import type { Highlight } from "../performance-model";
import { MobilePerfPlate } from "./mobile-perf-shell";

function pick(highlights: Highlight[], key: Highlight["key"]): Highlight | undefined {
  return highlights.find((h) => h.key === key);
}

/**
 * Hero overall card. Consistency is the headline because it is the one highlight
 * that already answers “how am I doing overall” without mixing game scores.
 */
export default function MobileOverallPerformanceCard({
  highlights,
  spark,
}: {
  highlights: Highlight[];
  spark: number[];
}) {
  const consistency = pick(highlights, "consistency");
  const winRate = pick(highlights, "winRate");
  const comps = pick(highlights, "competitionsWon");
  const duels = pick(highlights, "challengeWins");
  const hex = accentHex("cyan");

  return (
    <MobilePerfPlate accent="cyan" className="min-h-[148px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">
            Overall performance
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-[34px] font-black leading-none tabular-nums" style={{ color: hex }}>
              {consistency?.value ?? "-"}
            </span>
            <TrendDelta value={consistency?.delta ?? null} />
          </div>
          <p className="mt-1.5 text-[11px] text-[#8ea4c5]">{consistency?.hint ?? "Share of days you played"}</p>
        </div>
        <Sparkline points={spark} color={hex} width={92} height={40} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <HeroChip icon={PERF_METRIC_ICON.winRate} label="Win rate" value={winRate?.value ?? "-"} />
        <HeroChip icon={PERF_METRIC_ICON.competitionsWon} label="Comps won" value={comps?.value ?? "-"} />
        <HeroChip icon={PERF_METRIC_ICON.challengeWins} label="1v1 wins" value={duels?.value ?? "-"} />
      </div>
    </MobilePerfPlate>
  );
}

function HeroChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2">
      <div className="flex items-center gap-1">
        <NeonIcon src={icon} size={16} />
        <span className="truncate text-[10px] uppercase tracking-wide text-[#8ea4c5]">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-black tabular-nums text-white">{value}</div>
    </div>
  );
}
