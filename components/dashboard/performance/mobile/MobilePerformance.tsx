"use client";

import { useState } from "react";
import DashboardBackdrop from "@/components/dashboard/DashboardBackdrop";
import type { PerfInput } from "../performance-model";
import { usePerformanceAnalyticsModel } from "../usePerformanceAnalyticsModel";
import type { MarketHolidaysState } from "../useMarketHolidays";
import MobilePerformanceHeader from "./MobilePerformanceHeader";
import MobileOverallPerformanceCard from "./MobileOverallPerformanceCard";
import MobilePerformanceHighlights from "./MobilePerformanceHighlights";
import MobileGamePerformanceCarousel from "./MobileGamePerformanceCarousel";
import MobilePerformanceTrend from "./MobilePerformanceTrend";
import MobilePerformanceModeTabs, { type PerfBreakdownMode } from "./MobilePerformanceModeTabs";
import MobileTradingPerformance from "./MobileTradingPerformance";
import MobilePerformanceSummaryCard from "./MobilePerformanceSummaryCard";
import MobileMarketHolidays from "./MobileMarketHolidays";

/**
 * Dedicated phone Performance Analytics. Same model as desktop; never a shrink
 * of the 8-up highlights / two-up game cards / eight-circle trading row.
 */
export default function MobilePerformance({
  input,
  holidays,
}: {
  input: PerfInput;
  holidays: MarketHolidaysState;
}) {
  const model = usePerformanceAnalyticsModel(input);
  const [mode, setMode] = useState<PerfBreakdownMode>(() =>
    input.showTrading ? "trading" : "challenges",
  );
  const spark = model.trend.points.map((p) => p.overall);
  const breakdown: PerfBreakdownMode =
    mode === "trading" && !model.showTradingSection ? "challenges" : mode;

  return (
    <DashboardBackdrop>
      <div
        className="mx-auto w-full max-w-[430px] space-y-5 px-1"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <MobilePerformanceHeader model={model} />
        <MobileOverallPerformanceCard highlights={model.highlights} spark={spark} />
        <MobilePerformanceHighlights highlights={model.highlights} />
        {model.showGamesSection ? <MobileGamePerformanceCarousel cards={model.gameCards} /> : null}
        <MobilePerformanceTrend model={model} />
        <MobilePerformanceModeTabs
          mode={breakdown}
          onChange={setMode}
          showTrading={model.showTradingSection}
        />
        {breakdown === "trading" && model.showTradingSection ? (
          <MobileTradingPerformance metrics={model.tradingMetrics} />
        ) : null}
        {breakdown === "challenges" ? (
          <MobilePerformanceSummaryCard kind="challenges" summary={model.challengeSummary} />
        ) : null}
        {breakdown === "competitions" ? (
          <MobilePerformanceSummaryCard kind="competitions" summary={model.competitionSummary} />
        ) : null}
        <MobileMarketHolidays state={holidays} />
      </div>
    </DashboardBackdrop>
  );
}
