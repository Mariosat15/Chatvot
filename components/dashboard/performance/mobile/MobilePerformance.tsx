"use client";

import GamePerformanceSection from "../GamePerformanceSection";
import MarketHolidaysSection from "../MarketHolidaysSection";
import PerformanceHeader from "../PerformanceHeader";
import { HighlightMetricCard } from "../PerformanceHighlights";
import PerformanceSummaryPanel from "../PerformanceSummaryPanel";
import PerformanceTrendSection from "../PerformanceTrendSection";
import { TradingMetricTile } from "../TradingPerformanceSection";
import { PerfSection } from "../PerformanceChrome";
import { PERF_SECTION_ICON } from "../performance-assets";
import type { PerfInput } from "../performance-model";
import type { MarketHolidaysState } from "../useMarketHolidays";
import { usePerformanceAnalyticsModel } from "../usePerformanceAnalyticsModel";
import DashboardBackdrop from "@/components/dashboard/DashboardBackdrop";

/**
 * Phone arrangement over the same model as desktop. Rows that would wrap into
 * four lines of tiny cards become swipeable snap rows instead, and the bottom
 * row stacks.
 */
export default function MobilePerformance({
  input,
  holidays,
}: {
  input: PerfInput;
  holidays: MarketHolidaysState;
}) {
  const model = usePerformanceAnalyticsModel(input);

  return (
    <DashboardBackdrop>
    <div className="space-y-4">
      <PerformanceHeader model={model} compact />

      <PerfSection
        title="Highlights"
        icon={PERF_SECTION_ICON.highlights}
        testId="highlights"
      >
        <div
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1"
          aria-label="Performance highlights"
        >
          {model.highlights.map((h) => (
            <HighlightMetricCard
              key={h.key}
              highlight={h}
              className="w-[46%] min-w-[150px] shrink-0 snap-start"
            />
          ))}
        </div>
      </PerfSection>

      {model.showGamesSection ? <GamePerformanceSection cards={model.gameCards} /> : null}

      <PerformanceTrendSection model={model} height={220} />

      {model.showTradingSection ? (
        <PerfSection title="Trading Performance" icon={PERF_SECTION_ICON.trading} testId="trading">
          <div
            className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1"
            aria-label="Trading metrics"
          >
            {model.tradingMetrics.map((m) => (
              <div key={m.key} className="w-[46%] min-w-[150px] shrink-0 snap-start">
                <TradingMetricTile metric={m} />
              </div>
            ))}
          </div>
        </PerfSection>
      ) : null}

      <PerformanceSummaryPanel
        kind="challenges"
        summary={model.challengeSummary}
        filteredOut={model.challengesFilteredOut}
      />
      <PerformanceSummaryPanel kind="competitions" summary={model.competitionSummary} />
      <MarketHolidaysSection state={holidays} />
    </div>
    </DashboardBackdrop>
  );
}
