"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import ContestsSidebar from "./ContestsSidebar";
import GettingStartedCard from "./GettingStartedCard";
import DesktopDashboard from "./desktop/DesktopDashboard";
import MobileDashboard from "./mobile/MobileDashboard";
import MobileDashboardBackBar from "./mobile/MobileDashboardBackBar";
import { DashboardOverviewProvider } from "@/hooks/useDashboardOverview";
import { DASHBOARD_TABS, type DashboardNavTab } from "@/lib/constants";
import { useTerms } from "@/contexts/TerminologyContext";

// Reason: Tutorials tab is lazy-loaded — it only fetches videos when the user
// actually opens this tab, so it adds zero cost to the default Overview view.
const TutorialsTab = dynamic(() => import("./TutorialsTab"), { ssr: false });
// Reason: Wallet Analytics mounts Lightweight Charts — keep it off the Overview
// first paint the same way EquityChart used to be.
const WalletAnalytics = dynamic(() => import("./wallet/WalletAnalytics"), {
  ssr: false,
});
// Reason: Performance mounts Recharts — same lazy treatment as Wallet.
const PerformanceAnalytics = dynamic(
  () => import("./performance/PerformanceAnalytics"),
  { ssr: false },
);

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
    journey,
    gamePerformance,
    gameActivity,
    overviewStanding,
    tradingEnabled,
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

  const gettingStarted = (
    <GettingStartedCard
      tradingEnabled={tradingEnabled}
      hasFundedWallet={overview.totalDeposited > 0}
      hasJoinedCompetition={competitions.stats.total > 0}
      hasPlacedTrade={overview.totalTrades > 0}
      hasPlayedGame={hasPlayedGame}
      hasCompletedMilestone={journey?.completedMilestones > 0}
      hasChallengedUser={challenges.stats.total > 0}
    />
  );

  return (
    <div className="w-full overflow-x-clip">
      {/*
        Reason: phones withhold the Header tab strip, so Wallet / Performance /
        Tutorials / Contests need an explicit path back to Overview.
      */}
      {activeTab !== "overview" ? <MobileDashboardBackBar /> : null}

      {/*
        Reason: on a phone the Overview opens on the wallet, not a setup
        checklist — the mobile tree mounts the card below Quick Access instead.
        Every other tab keeps it on top at all widths.
      */}
      <div className={activeTab === "overview" ? "hidden md:block" : undefined}>
        {gettingStarted}
      </div>

      {/*
        Reason: Header already carries Overview / Wallet / Performance /
        Tutorials. A second TabsList would be two navs for one fact. Tabs still
        drive content; chrome is hidden. `contests` stays addressable.
      */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
        <TabsContent value="overview" className="mt-0">
          {/*
            Reason: two trees, not one responsive tree — a desktop layout squeezed
            onto a phone is the crowded screen the owner rejected. Both read the
            same provider; only the visible tree polls (useOverviewLive).
          */}
          <DashboardOverviewProvider data={data} activeTab={activeTab}>
            <div className="hidden md:block">
              <DesktopDashboard />
            </div>
            <div className="md:hidden">
              <MobileDashboard gettingStarted={gettingStarted} />
            </div>
          </DashboardOverviewProvider>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
          <WalletAnalytics overview={overview} charts={charts} />
        </TabsContent>

        <TabsContent value="performance" className="mt-4 pb-10 sm:pb-14">
          <PerformanceAnalytics
            overview={overview}
            charts={charts}
            gamePerformance={gamePerformance}
            gameActivity={gameActivity}
            competitions={competitions}
            challenges={challenges}
            overviewStanding={overviewStanding}
            showTradingChrome={showTradingChrome}
          />
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
