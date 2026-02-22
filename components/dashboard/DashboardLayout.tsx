"use client";

import dynamic from "next/dynamic";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import HeroStatsBar from "./HeroStatsBar";
import PlayerProfileCard from "./PlayerProfileCard";
import PerformanceRings from "./PerformanceRings";
import DailyPnLBars from "./DailyPnLBars";
import TradingAnalytics from "./TradingAnalytics";
import ContestsSidebar from "./ContestsSidebar";
import RecentTradesFeed from "./RecentTradesFeed";
import StreaksShowcase from "./StreaksShowcase";
import MarketHolidaysCard from "./MarketHolidaysCard";

// Reason: EquityChart uses Lightweight Charts (browser-only) so must load client-side only
const EquityChart = dynamic(() => import("./EquityChart"), { ssr: false });

interface DashboardLayoutProps {
  data: ComprehensiveDashboardData;
}

export default function DashboardLayout({ data }: DashboardLayoutProps) {
  const { overview, charts, competitions, challenges, recentActivity, streaks, player } = data;

  return (
    <div className="w-full space-y-4 p-3 sm:p-4 lg:p-6">
      {/* Row 1: Hero Stats */}
      <HeroStatsBar
        totalCapital={overview.totalCapital}
        totalPnL={overview.totalPnL}
        totalPnLPercentage={overview.totalPnLPercentage}
        winRate={overview.winRate}
        activeContests={overview.activeContests}
        totalTrades={overview.totalTrades}
      />

      {/* Row 2: Player Profile + Market Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PlayerProfileCard
            name={data.user.name}
            level={player.level}
            currentXP={player.currentXP}
            xpToNextLevel={player.xpToNextLevel}
            progressPercent={player.progressPercent}
            title={player.title}
            titleColor={player.titleColor}
            titleIcon={player.titleIcon}
            globalRank={player.globalRank}
            totalUsers={player.totalUsers}
            recentBadges={player.recentBadges}
            totalBadges={player.totalBadges}
          />
        </div>
        <div>
          <MarketHolidaysCard />
        </div>
      </div>

      {/* Row 3: Performance Rings */}
      <PerformanceRings
        winRate={overview.winRate}
        profitFactor={overview.profitFactor}
        avgWin={overview.averageWin}
        avgLoss={overview.averageLoss}
        largestWin={overview.largestWin}
        largestLoss={overview.largestLoss}
      />

      {/* Row 4: Charts + Contests Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Equity Chart + Daily P&L (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <EquityChart data={charts.walletBalanceHistory} />
          <DailyPnLBars data={charts.dailyPnL} />
        </div>

        {/* Right: Contests sidebar (1/3 width) */}
        <div>
          <ContestsSidebar
            competitions={{
              active: competitions.active,
              upcoming: competitions.upcoming,
              stats: competitions.stats,
            }}
            challenges={{
              active: challenges.active,
              pending: challenges.pending,
              stats: challenges.stats,
            }}
          />
        </div>
      </div>

      {/* Row 5: Trading Analytics */}
      <TradingAnalytics
        winLoss={charts.winLossDistribution}
        tradesBySymbol={charts.tradesBySymbol}
        tradesByHour={charts.tradesByHour}
        totalTrades={overview.totalTrades}
        winningTrades={overview.winningTrades}
        losingTrades={overview.losingTrades}
      />

      {/* Row 6: Recent Activity + Streaks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentTradesFeed
          trades={recentActivity.trades}
          positions={recentActivity.positions}
        />
        <StreaksShowcase
          currentWinStreak={streaks.currentWinStreak}
          currentLossStreak={streaks.currentLossStreak}
          longestWinStreak={streaks.longestWinStreak}
          longestLossStreak={streaks.longestLossStreak}
          tradingDaysThisMonth={streaks.tradingDaysThisMonth}
          consecutiveProfitableDays={streaks.consecutiveProfitableDays}
        />
      </div>

    </div>
  );
}
