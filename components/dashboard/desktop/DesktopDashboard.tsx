"use client";

import AccountStatusCard from "../AccountStatusCard";
import GameSuggestionsCard from "../GameSuggestionsCard";
import OverviewHero from "../overview/OverviewHero";
import OverviewBackdrop from "../overview/OverviewBackdrop";
import OverviewKpiRow from "../overview/OverviewKpiRow";
import OverviewPlayByGame from "../overview/OverviewPlayByGame";
import OverviewProgress from "../overview/OverviewProgress";
import OverviewActivity from "../overview/OverviewActivity";
import OverviewStreaks from "../overview/OverviewStreaks";
import OverviewCompete from "../overview/OverviewCompete";
import {
  useDashboardOverview,
  useOverviewLive,
} from "@/hooks/useDashboardOverview";

/**
 * Desktop Overview (md and up). Moved verbatim out of DashboardLayout when the
 * mobile tree was added (29 Sep 2026) — the markup is unchanged.
 */
export default function DesktopDashboard() {
  const { data, accountOk } = useDashboardOverview();
  const liveEnabled = useOverviewLive("desktop");
  const { overview, player, accountStatus, overviewStanding } = data;

  return (
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
        liveEnabled={liveEnabled}
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
          />
        </div>
        <OverviewActivity items={overviewStanding.recentActivity} />
      </div>

      <OverviewCompete liveEnabled={liveEnabled} />

      <OverviewStreaks streaks={overviewStanding.streaks} />

      <GameSuggestionsCard />
    </OverviewBackdrop>
  );
}
