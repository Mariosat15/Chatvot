"use client";

import { formatVolts } from "@/lib/utils/format-volts";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { NeonIcon, PerfBar, accentHex } from "../PerformanceChrome";
import { PERF_METRIC_ICON, PERF_SECTION_ICON, type PerfAccent } from "../performance-assets";
import type { SummaryPanelView } from "../performance-model";
import { MobilePerfHeading, MobilePerfPlate } from "./mobile-perf-shell";

const COPY = new Map<
  "challenges" | "competitions",
  { title: string; subtitle: string; icon: string; accent: PerfAccent; empty: string }
>([
  [
    "challenges",
    {
      title: "1v1 Performance",
      subtitle: "Your head-to-head results.",
      icon: PERF_SECTION_ICON.challenges,
      accent: "magenta",
      empty: "No 1v1 challenges yet.",
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

/** One card shape for 1v1 and competitions so the two cannot drift. */
export default function MobilePerformanceSummaryCard({
  kind,
  summary,
}: {
  kind: "challenges" | "competitions";
  summary: SummaryPanelView;
}) {
  const { settings } = useAppSettings();
  const meta = COPY.get(kind);
  if (!meta) return null;
  const hex = accentHex(meta.accent);
  const empty = summary.played === 0;
  const winRate = empty || summary.headline === null ? "-" : `${summary.headline.toFixed(0)}%`;

  return (
    <section data-perf-section={kind}>
      <MobilePerfHeading title={meta.title} subtitle={meta.subtitle} icon={meta.icon} />
      <MobilePerfPlate accent={meta.accent}>
        {empty ? <p className="mb-3 text-sm text-[#8ea4c5]">{meta.empty}</p> : null}
        <div className="mb-3 flex items-center gap-3">
          <NeonIcon src={PERF_METRIC_ICON.crown} size={36} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">Win rate</div>
            <div className="text-[28px] font-black leading-none tabular-nums" style={{ color: hex }}>
              {winRate}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {summary.rows.map((row) => (
            <div key={row.label} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8ea4c5]">{row.label}</dt>
              <dd className="text-lg font-black tabular-nums text-white">{empty ? "-" : row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-3">
          {summary.bars.map((bar) => (
            <div key={bar.label}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-[#8ea4c5]">{bar.label}</span>
                <span className="font-bold tabular-nums text-white">{empty ? "-" : bar.caption}</span>
              </div>
              <PerfBar value={empty ? null : bar.value} accent={meta.accent} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-sm">
          <span className="text-[#8ea4c5]">Volts won</span>
          <span className="text-base font-black tabular-nums text-[#ffc51b]">
            {empty ? "-" : formatVolts(summary.credits, { symbol: settings?.credits?.symbol })}
          </span>
        </div>
      </MobilePerfPlate>
    </section>
  );
}
