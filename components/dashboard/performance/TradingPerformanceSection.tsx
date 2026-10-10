"use client";

import { NeonIcon, PerfCard, PerfSection } from "./PerformanceChrome";
import { PERF_METRIC_ICON, PERF_SECTION_ICON } from "./performance-assets";
import type { MetricView } from "./performance-model";

const METRIC_ICON = new Map<string, string>([
  ["tradeWinRate", PERF_METRIC_ICON.tradeWinRate],
  ["tradeRoi", PERF_METRIC_ICON.tradeRoi],
  ["profitFactor", PERF_METRIC_ICON.profitFactor],
  ["totalTrades", PERF_METRIC_ICON.totalTrades],
  ["avgWin", PERF_METRIC_ICON.avgWin],
  ["avgLoss", PERF_METRIC_ICON.avgLoss],
  ["largestWin", PERF_METRIC_ICON.largestWin],
  ["largestLoss", PERF_METRIC_ICON.largestLoss],
]);

const TONE_CLASS = new Map<MetricView["tone"], string>([
  ["positive", "text-[#00e6a3]"],
  ["negative", "text-[#ff4b67]"],
  ["neutral", "text-white"],
]);

export function TradingMetricTile({ metric }: { metric: MetricView }) {
  return (
    <PerfCard accent="green" className="h-full">
      <div className="flex items-center gap-2.5 p-3" data-trading-metric={metric.key}>
        <NeonIcon src={METRIC_ICON.get(metric.key) ?? PERF_METRIC_ICON.totalTrades} size={30} />
        <div className="min-w-0">
          <div className="truncate text-[10px] uppercase tracking-wide text-[#8ea4c5]">
            {metric.label}
          </div>
          <div
            className={`truncate text-base font-black tabular-nums ${TONE_CLASS.get(metric.tone) ?? "text-white"}`}
          >
            {metric.value}
          </div>
        </div>
      </div>
    </PerfCard>
  );
}

/**
 * Trading's own figures, all time. Rendered only behind `showTradingChrome`
 * (R21): a games-only player must not see a row of zeroed trading metrics.
 * Amounts are simulated trading money, hence `$`, never credits.
 */
export default function TradingPerformanceSection({ metrics }: { metrics: MetricView[] }) {
  return (
    <PerfSection
      title="Trading Performance"
      subtitle="All-time figures from your trading competitions and 1v1s."
      icon={PERF_SECTION_ICON.trading}
      testId="trading"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8">
        {metrics.map((m) => (
          <TradingMetricTile key={m.key} metric={m} />
        ))}
      </div>
    </PerfSection>
  );
}
