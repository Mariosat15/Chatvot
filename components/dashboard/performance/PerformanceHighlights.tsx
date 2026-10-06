"use client";

import { NeonIcon, PerfCard, PerfSection, TrendDelta, accentHex } from "./PerformanceChrome";
import { PERF_METRIC_ICON, PERF_SECTION_ICON, type PerfAccent } from "./performance-assets";
import type { Highlight, HighlightKey } from "./performance-model";

const HIGHLIGHT_STYLE = new Map<HighlightKey, { icon: string; accent: PerfAccent }>([
  ["winRate", { icon: PERF_METRIC_ICON.winRate, accent: "purple" }],
  ["roi", { icon: PERF_METRIC_ICON.roi, accent: "orange" }],
  ["playTime", { icon: PERF_METRIC_ICON.playTime, accent: "cyan" }],
  ["activeDays", { icon: PERF_METRIC_ICON.activeDays, accent: "blue" }],
  ["bestScore", { icon: PERF_METRIC_ICON.bestScore, accent: "gold" }],
  ["competitionsWon", { icon: PERF_METRIC_ICON.competitionsWon, accent: "green" }],
  ["challengeWins", { icon: PERF_METRIC_ICON.challengeWins, accent: "magenta" }],
  ["consistency", { icon: PERF_METRIC_ICON.consistency, accent: "red" }],
]);

export function HighlightMetricCard({
  highlight,
  className,
}: {
  highlight: Highlight;
  className?: string;
}) {
  const style = HIGHLIGHT_STYLE.get(highlight.key) ?? {
    icon: PERF_METRIC_ICON.bestScore,
    accent: "cyan" as PerfAccent,
  };
  return (
    <PerfCard accent={style.accent} className={className}>
      <div className="flex h-full flex-col gap-2 p-3" data-highlight={highlight.key}>
        <div className="flex items-center gap-2">
          <NeonIcon src={style.icon} size={30} />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">
            {highlight.label}
          </span>
        </div>
        <div
          className="truncate text-2xl font-black tabular-nums leading-none"
          style={{ color: accentHex(style.accent) }}
        >
          {highlight.value}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-[#8ea4c5]">{highlight.hint}</span>
          <TrendDelta value={highlight.delta} />
        </div>
      </div>
    </PerfCard>
  );
}

export default function PerformanceHighlights({ highlights }: { highlights: Highlight[] }) {
  return (
    <PerfSection
      title="Performance Highlights"
      subtitle="Change is against the previous period of the same length."
      icon={PERF_SECTION_ICON.highlights}
      testId="highlights"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8">
        {highlights.map((h) => (
          <HighlightMetricCard key={h.key} highlight={h} />
        ))}
      </div>
    </PerfSection>
  );
}
