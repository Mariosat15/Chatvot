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
  /** Kept for the rare payload that still has no game label on 1v1s. */
  filteredOut?: boolean;
}) {
  const { settings } = useAppSettings();
  const meta = KIND.get(kind);
  if (!meta) return null;
  const hex = accentHex(meta.accent);
  const empty = filteredOut || summary.played === 0;

  return (
    <PerfSection title={meta.title} subtitle={meta.subtitle} icon={meta.icon} testId={kind}>
      <PerfCard accent={meta.accent} className="h-full min-h-[280px]">
        <div className="flex h-full flex-col gap-4 p-5">
          {empty ? (
            <p className="text-sm text-[#8ea4c5]">
              {filteredOut
                ? "1v1 results are not split by game. Choose All games to see them."
                : meta.empty}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <NeonIcon src={PERF_METRIC_ICON.crown} size={48} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#8ea4c5]">
                Win rate
              </div>
              <div className="text-4xl font-black tabular-nums leading-none" style={{ color: hex }}>
                {empty || summary.headline === null ? "-" : `${summary.headline.toFixed(0)}%`}
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2.5">
            {summary.rows.map((r) => (
              <div key={r.label} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">
                  {r.label}
                </dt>
                <dd className="text-lg font-black tabular-nums text-white">
                  {empty ? "-" : r.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-3">
            {summary.bars.map((b) => (
              <div key={b.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-[#8ea4c5]">{b.label}</span>
                  <span className="font-bold tabular-nums text-white">
                    {empty ? "-" : b.caption}
                  </span>
                </div>
                <PerfBar value={empty ? null : b.value} accent={meta.accent} />
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-white/[0.08] pt-3 text-sm">
            <span className="text-[#8ea4c5]">Credits won</span>
            <span className="text-base font-black tabular-nums text-[#ffc51b]">
              {empty
                ? "-"
                : formatVolts(summary.credits, { symbol: settings?.credits?.symbol })}
            </span>
          </div>
        </div>
      </PerfCard>
    </PerfSection>
  );
}
