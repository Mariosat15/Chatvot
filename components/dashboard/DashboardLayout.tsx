"use client";

import dynamic from "next/dynamic";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import HeroStatsBar from "./HeroStatsBar";
import PlayerProfileCard from "./PlayerProfileCard";
import PerformanceRings from "./PerformanceRings";
import TradingAnalytics from "./TradingAnalytics";
import ContestsSidebar from "./ContestsSidebar";
import RecentTradesFeed from "./RecentTradesFeed";
import StreaksShowcase from "./StreaksShowcase";
import MarketHolidaysCard from "./MarketHolidaysCard";
import AccountStatusCard from "./AccountStatusCard";
import CreditBreakdownChart from "./CreditBreakdownChart";
import GettingStartedCard from "./GettingStartedCard";

// Reason: These charts use Lightweight Charts (browser-only) so must load client-side only
const EquityChart = dynamic(() => import("./EquityChart"), { ssr: false });
const DailyCreditFlow = dynamic(() => import("./DailyCreditFlow"), {
  ssr: false,
});

interface DashboardLayoutProps {
  data: ComprehensiveDashboardData;
}

export default function DashboardLayout({ data }: DashboardLayoutProps) {
  const { overview, charts, competitions, challenges, recentActivity, streaks, player, journey, accountStatus } = data;

  return (
    <div className="w-full space-y-4 p-3 sm:p-4 lg:p-6">
      {/* Onboarding — shows only for users who haven't completed all steps */}
      <GettingStartedCard
        hasFundedWallet={overview.totalDeposited > 0}
        hasJoinedCompetition={competitions.stats.total > 0}
        hasPlacedTrade={overview.totalTrades > 0}
        hasCompletedMilestone={journey?.completedMilestones > 0}
        hasChallengedUser={challenges.stats.total > 0}
      />

      {/* Row 1: Hero Stats */}
      <HeroStatsBar
        creditBalance={overview.creditBalance}
        totalSpent={overview.totalSpent}
        winRate={overview.winRate}
        roi={overview.roi}
        gmEarnings={overview.gmEarnings}
        totalPrizesWon={overview.totalPrizesWon}
      />

      {/* Row 2: Account Status (restrictions, alerts, investigations) */}
      <AccountStatusCard accountStatus={accountStatus} />

      {/* Row 3: Player Profile + Market Holidays */}
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
            journey={journey}
          />
        </div>
        <div>
          <MarketHolidaysCard />
        </div>
      </div>

      {/* Row 4: Performance Rings */}
      <PerformanceRings
        winRate={overview.winRate}
        profitFactor={overview.profitFactor}
        avgWin={overview.averageWin}
        avgLoss={overview.averageLoss}
        largestWin={overview.largestWin}
        largestLoss={overview.largestLoss}
      />

      {/* Row 5: Charts + Contests Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Wallet Balance + Daily Credit Flow (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <EquityChart data={charts.walletBalanceHistory} />
          <DailyCreditFlow data={charts.dailyCreditFlow} />
          <CreditBreakdownChart data={charts.dailyCreditBreakdown} allTimeTotals={charts.allTimeTotals} />
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

      {/* Row 6: Trading Analytics */}
      <TradingAnalytics
        winLoss={charts.winLossDistribution}
        tradesBySymbol={charts.tradesBySymbol}
        tradesByHour={charts.tradesByHour}
        totalTrades={overview.totalTrades}
        winningTrades={overview.winningTrades}
        losingTrades={overview.losingTrades}
      />

      {/* Row 7: Recent Activity + Streaks */}
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
