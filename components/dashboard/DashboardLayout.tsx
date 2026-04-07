"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  Trophy,
} from "lucide-react";
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

const EquityChart = dynamic(() => import("./EquityChart"), { ssr: false });
const DailyCreditFlow = dynamic(() => import("./DailyCreditFlow"), {
  ssr: false,
});

const TAB_STORAGE_KEY = "chartvolt_dashboard_tab";

interface DashboardLayoutProps {
  data: ComprehensiveDashboardData;
}

export default function DashboardLayout({ data }: DashboardLayoutProps) {
  const { overview, charts, competitions, challenges, recentActivity, streaks, player, journey, accountStatus } = data;

  // Reason: Persist the selected tab across page refreshes so users return
  // to the section they were last viewing.
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved && ["overview", "wallet", "performance", "contests"].includes(saved)) {
      setActiveTab(saved);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(TAB_STORAGE_KEY, value);
  };

  return (
    <div className="w-full p-3 sm:p-4 lg:p-6">
      {/* Onboarding — always visible above tabs */}
      <GettingStartedCard
        hasFundedWallet={overview.totalDeposited > 0}
        hasJoinedCompetition={competitions.stats.total > 0}
        hasPlacedTrade={overview.totalTrades > 0}
        hasCompletedMilestone={journey?.completedMilestones > 0}
        hasChallengedUser={challenges.stats.total > 0}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
        <TabsList className="w-full grid grid-cols-4 h-11 bg-gray-800/60 border border-gray-700/50">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <LayoutDashboard className="w-4 h-4 hidden sm:block" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1.5 text-xs sm:text-sm">
            <Wallet className="w-4 h-4 hidden sm:block" />
            Wallet
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4 hidden sm:block" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="contests" className="gap-1.5 text-xs sm:text-sm">
            <Trophy className="w-4 h-4 hidden sm:block" />
            Contests
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <AccountStatusCard accountStatus={accountStatus} />

          <HeroStatsBar
            creditBalance={overview.creditBalance}
            totalSpent={overview.totalSpent}
            winRate={overview.winRate}
            roi={overview.roi}
            gmEarnings={overview.gmEarnings}
            totalPrizesWon={overview.totalPrizesWon}
            variant="compact"
          />

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
              <RecentTradesFeed
                trades={recentActivity.trades}
                positions={recentActivity.positions}
              />
            </div>
          </div>

          <StreaksShowcase
            currentWinStreak={streaks.currentWinStreak}
            currentLossStreak={streaks.currentLossStreak}
            longestWinStreak={streaks.longestWinStreak}
            longestLossStreak={streaks.longestLossStreak}
            tradingDaysThisMonth={streaks.tradingDaysThisMonth}
            consecutiveProfitableDays={streaks.consecutiveProfitableDays}
          />
        </TabsContent>

        {/* ── Tab 2: Wallet & Credits ── */}
        <TabsContent value="wallet" className="space-y-4 mt-4">
          <HeroStatsBar
            creditBalance={overview.creditBalance}
            totalSpent={overview.totalSpent}
            winRate={overview.winRate}
            roi={overview.roi}
            gmEarnings={overview.gmEarnings}
            totalPrizesWon={overview.totalPrizesWon}
            variant="wallet"
          />

          <EquityChart data={charts.walletBalanceHistory} />
          <DailyCreditFlow data={charts.dailyCreditFlow} />
          <CreditBreakdownChart data={charts.dailyCreditBreakdown} allTimeTotals={charts.allTimeTotals} />
        </TabsContent>

        {/* ── Tab 3: Trading Performance ── */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <PerformanceRings
            winRate={overview.winRate}
            profitFactor={overview.profitFactor}
            avgWin={overview.averageWin}
            avgLoss={overview.averageLoss}
            largestWin={overview.largestWin}
            largestLoss={overview.largestLoss}
          />

          <TradingAnalytics
            winLoss={charts.winLossDistribution}
            tradesBySymbol={charts.tradesBySymbol}
            tradesByHour={charts.tradesByHour}
            totalTrades={overview.totalTrades}
            winningTrades={overview.winningTrades}
            losingTrades={overview.losingTrades}
          />

          <MarketHolidaysCard />
        </TabsContent>

        {/* ── Tab 4: Contests ── */}
        <TabsContent value="contests" className="space-y-4 mt-4">
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
            fullWidth
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
