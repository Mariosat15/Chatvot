"use client";

import { useMemo } from "react";
import type { ComprehensiveDashboardData } from "@/lib/actions/dashboard/types";
import DesktopPerformance from "./DesktopPerformance";
import MobilePerformance from "./mobile/MobilePerformance";
import type { PerfInput } from "./performance-model";
import { useMarketHolidays } from "./useMarketHolidays";

type Props = Pick<
  ComprehensiveDashboardData,
  | "overview"
  | "charts"
  | "gamePerformance"
  | "gameActivity"
  | "competitions"
  | "challenges"
  | "overviewStanding"
> & {
  /** R21: `tradingEnabled || overview.totalTrades > 0`, decided by the dashboard. */
  showTradingChrome: boolean;
};

/**
 * Performance Analytics shell — desktop and mobile are separate trees over one
 * pure model (`performance-model.ts`), the Wallet Analytics pattern. Holidays are
 * fetched here once and passed to both trees.
 */
export default function PerformanceAnalytics({
  overview,
  charts,
  gamePerformance,
  gameActivity,
  competitions,
  challenges,
  overviewStanding,
  showTradingChrome,
}: Props) {
  const input = useMemo<PerfInput>(
    () => ({
      overview,
      charts,
      gamePerformance,
      gameActivity: gameActivity ?? [],
      competitions,
      challenges,
      overviewStanding,
      showTrading: showTradingChrome,
    }),
    [
      overview,
      charts,
      gamePerformance,
      gameActivity,
      competitions,
      challenges,
      overviewStanding,
      showTradingChrome,
    ],
  );
  const holidays = useMarketHolidays();

  return (
    <div data-testid="performance-analytics">
      <div className="hidden md:block">
        <DesktopPerformance input={input} holidays={holidays} />
      </div>
      <div className="block md:hidden">
        <MobilePerformance input={input} holidays={holidays} />
      </div>
    </div>
  );
}
