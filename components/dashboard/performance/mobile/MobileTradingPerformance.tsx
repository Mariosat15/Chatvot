"use client";

import { TradingMetricTile } from "../TradingPerformanceSection";
import { PERF_SECTION_ICON } from "../performance-assets";
import type { MetricView } from "../performance-model";
import { MobilePerfHeading } from "./mobile-perf-shell";

/** Two-column grid. Not the desktop eight-up row of rings. */
export default function MobileTradingPerformance({ metrics }: { metrics: MetricView[] }) {
  return (
    <section data-perf-section="trading">
      <MobilePerfHeading
        title="Trading Performance"
        subtitle="All-time figures from your trading contests."
        icon={PERF_SECTION_ICON.trading}
      />
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((metric) => (
          <TradingMetricTile key={metric.key} metric={metric} />
        ))}
      </div>
    </section>
  );
}
