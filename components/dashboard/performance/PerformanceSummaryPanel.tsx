"use client";

import { formatVolts } from "@/lib/utils/format-volts";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { NeonIcon, PerfBar, PerfCard, PerfSection, accentHex } from "./PerformanceChrome";
import { PERF_METRIC_ICON, PERF_SECTION_ICON, type PerfAccent } from "./performance-assets";
import type { SummaryPanelView } from "./performance-model";

const KIND = new Map<
  "challenges" | "competitions",
  { title: string; subtitle: string; icon: string; accent: PerfAccent; empty: string }
>([
  [
    "challenges",
    {
      title: "1v1 Performance",
      subtitle: "Finished 1v1 challenges in this period.",
      icon: PERF_SECTION_ICON.challenges,
      accent: "magenta",
      empty: "No finished 1v1s in this period.",
    },
  ],
  [
    "competitions",
    {
      title: "Competition Performance",
      subtitle: "Finished competitions in this period.",
      icon: PERF_SECTION_ICON.competitions,
      accent: "purple",
      empty: "No finished competitions in this period.",
    },
  ],
]);

/** One panel shape for 1v1 and competitions, so the two never drift apart. */
export default function PerformanceSummaryPanel({
  kind,
  summary,
  filteredOut = false,
}: {
  kind: "challenges" | "competitions";
  summary: SummaryPanelView;
  /** 1v1 rows carry no game label, so a single-game filter cannot split them. */
  filteredOut?: boolean;
}) {
  const { settings } = useAppSettings();
  const meta = KIND.get(kind);
  if (!meta) return null;
  const hex = accentHex(meta.accent);

  return (
    <PerfSection title={meta.title} subtitle={meta.subtitle} icon={meta.icon} testId={kind}>
      <PerfCard accent={meta.accent} className="h-full">
        <div className="flex h-full flex-col gap-3 p-4">
          {filteredOut ? (
            <p className="text-xs text-[#8ea4c5]">
              1v1 results are not split by game. Choose All games to see them.
            </p>
          ) : summary.played === 0 ? (
            <p className="text-xs text-[#8ea4c5]">{meta.empty}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <NeonIcon src={PERF_METRIC_ICON.crown} size={40} />
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[#8ea4c5]">Win rate</div>
                  <div className="text-3xl font-black tabular-nums" style={{ color: hex }}>
                    {summary.headline === null ? "-" : `${summary.headline.toFixed(0)}%`}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                {summary.rows.map((r) => (
                  <div key={r.label} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-[#8ea4c5]">{r.label}</dt>
                    <dd className="text-sm font-bold tabular-nums text-white">{r.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-2">
                {summary.bars.map((b) => (
                  <div key={b.label}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-[#8ea4c5]">{b.label}</span>
                      <span className="font-semibold tabular-nums text-white">{b.caption}</span>
                    </div>
                    <PerfBar value={b.value} accent={meta.accent} />
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-2 text-xs">
                <span className="text-[#8ea4c5]">Credits won</span>
                <span className="font-bold tabular-nums text-[#ffc51b]">
                  {formatVolts(summary.credits, { symbol: settings?.credits?.symbol })}
                </span>
              </div>
            </>
          )}
        </div>
      </PerfCard>
    </PerfSection>
  );
}
