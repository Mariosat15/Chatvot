"use client";

import GamePerformanceSection from "./GamePerformanceSection";
import MarketHolidaysSection from "./MarketHolidaysSection";
import PerformanceHeader from "./PerformanceHeader";
import PerformanceHighlights from "./PerformanceHighlights";
import PerformanceSummaryPanel from "./PerformanceSummaryPanel";
import PerformanceTrendSection from "./PerformanceTrendSection";
import TradingPerformanceSection from "./TradingPerformanceSection";
import DashboardBackdrop from "@/components/dashboard/DashboardBackdrop";
import type { PerfInput } from "./performance-model";
import type { MarketHolidaysState } from "./useMarketHolidays";
import { usePerformanceAnalyticsModel } from "./usePerformanceAnalyticsModel";

/**
 * Desktop order, fixed by the reference: header, highlights, games carousel,
 * trend, trading, then the 1v1 | competition | holidays row. The page ends there.
 */
export default function DesktopPerformance({
  input,
  holidays,
}: {
  input: PerfInput;
  holidays: MarketHolidaysState;
}) {
  const model = usePerformanceAnalyticsModel(input);

  return (
    <DashboardBackdrop>
    <div className="space-y-5 pb-4">
      <PerformanceHeader model={model} />
      <PerformanceHighlights highlights={model.highlights} />
      {model.showGamesSection ? <GamePerformanceSection cards={model.gameCards} /> : null}
      <PerformanceTrendSection model={model} />
      {model.showTradingSection ? (
        <TradingPerformanceSection metrics={model.tradingMetrics} />
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <PerformanceSummaryPanel
          kind="challenges"
          summary={model.challengeSummary}
          filteredOut={model.challengesFilteredOut}
        />
        <PerformanceSummaryPanel kind="competitions" summary={model.competitionSummary} />
        <MarketHolidaysSection state={holidays} />
      </div>
    </div>
    </DashboardBackdrop>
  );
}
