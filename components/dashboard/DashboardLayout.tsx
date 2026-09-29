"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import TradingAnalytics from "./TradingAnalytics";
import ContestsSidebar from "./ContestsSidebar";
import PerformanceRings from "./PerformanceRings";
import ContestStatsCards from "./ContestStatsCards";
import AccountStatusCard from "./AccountStatusCard";
import CreditBreakdownChart from "./CreditBreakdownChart";
import GettingStartedCard from "./GettingStartedCard";
import GameSuggestionsCard from "./GameSuggestionsCard";
import PlayerGamePerformancePanel from "./PlayerGamePerformancePanel";
import HeroStatsBar from "./HeroStatsBar";
import MarketHolidaysCard from "./MarketHolidaysCard";
import OverviewHero from "./overview/OverviewHero";
import OverviewBackdrop from "./overview/OverviewBackdrop";
import OverviewKpiRow from "./overview/OverviewKpiRow";
import OverviewPlayByGame from "./overview/OverviewPlayByGame";
import OverviewProgress from "./overview/OverviewProgress";
import OverviewActivity from "./overview/OverviewActivity";
import OverviewStreaks from "./overview/OverviewStreaks";
import OverviewCompete from "./overview/OverviewCompete";
import { DASHBOARD_TABS, type DashboardNavTab } from "@/lib/constants";
import { useTerms } from "@/contexts/TerminologyContext";
import { OVERVIEW_RECENT_BADGE_LIMIT } from "@/lib/services/games/overview-types";

const EquityChart = dynamic(() => import("./EquityChart"), { ssr: false });
const DailyCreditFlow = dynamic(() => import("./DailyCreditFlow"), {
  ssr: false,
});
// Reason: Tutorials tab is lazy-loaded — it only fetches videos when the user
// actually opens this tab, so it adds zero cost to the default Overview view.
const TutorialsTab = dynamic(() => import("./TutorialsTab"), { ssr: false });

const TAB_STORAGE_KEY = "chartvolt_dashboard_tab";

function isDashboardTab(value: string | null): value is DashboardNavTab {
  return !!value && (DASHBOARD_TABS as string[]).includes(value);
}

interface DashboardLayoutProps {
  data: ComprehensiveDashboardData;
}

export default function DashboardLayout({ data }: DashboardLayoutProps) {
  const terms = useTerms();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    overview,
    charts,
    competitions,
    challenges,
    player,
    journey,
    accountStatus,
    gamePerformance,
    tradingEnabled,
    overviewStanding,
  } = data;

  // Reason: a games-only player never places a trade; rounds.started/scored complete
  // the play step. Either signal is enough (20 s5 / GettingStarted).
  const hasPlayedGame = gamePerformance.some(
    (row) => row.rounds.started > 0 || row.rounds.scored > 0,
  );
  // Reason (R21): absent, not empty — a games-only player must not see zeroed trading
  // rings. Former traders keep the chrome when trading is later switched off (R29).
  const showTradingChrome = tradingEnabled || overview.totalTrades > 0;

  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<DashboardNavTab>(() =>
    isDashboardTab(urlTab) ? urlTab : "overview",
  );

  // Reason: URL is the addressable source (Header deep links). localStorage is
  // only the fallback when the query is missing — never the other way around.
  useEffect(() => {
    if (isDashboardTab(urlTab)) {
      setActiveTab(urlTab);
      localStorage.setItem(TAB_STORAGE_KEY, urlTab);
      return;
    }
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (isDashboardTab(saved)) {
      setActiveTab(saved);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", saved);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [urlTab, pathname, router, searchParams]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isDashboardTab(value)) return;
      setActiveTab(value);
      localStorage.setItem(TAB_STORAGE_KEY, value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const accountOk =
    !accountStatus.hasActiveRestriction &&
    !accountStatus.isLocked &&
    !accountStatus.hasOpenAlert;

  return (
    <div className="w-full overflow-x-hidden">
      <GettingStartedCard
        tradingEnabled={tradingEnabled}
        hasFundedWallet={overview.totalDeposited > 0}
        hasJoinedCompetition={competitions.stats.total > 0}
        hasPlacedTrade={overview.totalTrades > 0}
        hasPlayedGame={hasPlayedGame}
        hasCompletedMilestone={journey?.completedMilestones > 0}
        hasChallengedUser={challenges.stats.total > 0}
      />

      {/*
        Reason: Header already carries Overview / Wallet / Performance /
        Competitions / Tutorials. A second TabsList would be two navs for one
        fact. Tabs still drive content; chrome is hidden.
      */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
        <TabsContent value="overview" className="mt-0">
          <OverviewBackdrop>
          {(accountStatus.hasActiveRestriction ||
            accountStatus.isLocked ||
            accountStatus.hasOpenAlert ||
            accountStatus.openChargebackCaseId) && (
            <AccountStatusCard accountStatus={accountStatus} />
          )}

          <OverviewHero name={data.user.name} accountActive={accountOk} />

          <OverviewKpiRow
            creditBalance={overview.creditBalance}
            contestWinRate={overviewStanding.contestWinRate}
            roi={overview.roi}
            totalPrizesWon={overview.totalPrizesWon}
            weekDelta={overviewStanding.kpiWeekDelta}
          />

          <OverviewPlayByGame cards={overviewStanding.playCards} />

          {/* Reason: equal-height panels — stretch both columns to the taller rail. */}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <div className="flex lg:col-span-2">
              <OverviewProgress
                globalRank={overviewStanding.globalRank}
                totalUsers={overviewStanding.totalUsers}
                level={player.level}
                currentXP={player.currentXP}
                xpToNextLevel={player.xpToNextLevel}
                progressPercent={player.progressPercent}
                title={player.title}
                journeyMapName={overviewStanding.journeyMapName}
                journeyMilestonesDone={overviewStanding.journeyMilestonesDone}
                journeyMilestonesTotal={overviewStanding.journeyMilestonesTotal}
                missions={overviewStanding.missions}
                recentBadges={(player.recentBadges ?? [])
                  .slice(0, OVERVIEW_RECENT_BADGE_LIMIT)
                  .map((b) => ({
                    id: b.id,
                    name: b.name,
                    icon: b.icon,
                    rarity: b.rarity,
                  }))}
              />
            </div>
            <OverviewActivity items={overviewStanding.recentActivity} />
          </div>

          <OverviewCompete />

          <OverviewStreaks streaks={overviewStanding.streaks} />

          <GameSuggestionsCard />
          </OverviewBackdrop>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DailyCreditFlow data={charts.dailyCreditFlow} />
            <CreditBreakdownChart
              data={charts.dailyCreditBreakdown}
              allTimeTotals={charts.allTimeTotals}
            />
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-4">
          <PlayerGamePerformancePanel games={gamePerformance} />

          {showTradingChrome ? (
            <>
              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
                  Trading performance
                </h3>
                <PerformanceRings
                  winRate={overview.winRate}
                  roi={overview.roi}
                  tradeRoi={overview.totalPnLPercentage}
                  profitFactor={overview.profitFactor}
                  avgWin={overview.averageWin}
                  avgLoss={overview.averageLoss}
                  largestWin={overview.largestWin}
                  largestLoss={overview.largestLoss}
                />
              </div>

              <TradingAnalytics
                winLoss={charts.winLossDistribution}
                tradesBySymbol={charts.tradesBySymbol}
                tradesByHour={charts.tradesByHour}
                totalTrades={overview.totalTrades}
                winningTrades={overview.winningTrades}
                losingTrades={overview.losingTrades}
              />
            </>
          ) : null}

          <ContestStatsCards
            competitionStats={competitions.stats}
            challengeStats={challenges.stats}
          />

          {showTradingChrome ? <MarketHolidaysCard /> : null}
        </TabsContent>

        <TabsContent value="contests" className="mt-4 space-y-4">
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

        <TabsContent value="tutorials" className="mt-4 space-y-4">
          <TutorialsTab />
        </TabsContent>
      </Tabs>

      {/* Keep terminology reference so contests label stays wired for tests */}
      <span className="sr-only">{terms.contests}</span>
    </div>
  );
}
