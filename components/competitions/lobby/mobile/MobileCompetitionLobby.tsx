import { ArrowLeft, BarChart3 } from "lucide-react";
import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { DifficultyLevel } from "@/lib/utils/competition-difficulty";
import type { TitleLevel } from "@/lib/constants/levels";
import CompetitionDashboard from "@/components/trading/CompetitionDashboard";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { NeonPanel } from "@/components/neon/Cards";
import { NeonPill } from "@/components/neon/Buttons";
import { resolveLevelName } from "@/lib/utils/level-title";
import { resolveTradingBanner } from "@/components/neon/banners";
import { MobileLobbyHero } from "./MobileLobbyHero";
import { MobileLobbyMetrics } from "./MobileLobbyMetrics";
import { MobileLobbyEntryPanel } from "./MobileLobbyEntryPanel";
import { MobileLobbyCountdown } from "./MobileLobbyCountdown";
import { MobileLobbyTabs } from "./MobileLobbyTabs";
import { MobileLobbyLeaderboard } from "./MobileLobbyLeaderboard";
import { MobileLobbySchedule } from "./MobileLobbySchedule";
import { MobileLobbyDifficulty } from "./MobileLobbyDifficulty";
import { MobileLobbyRewards } from "./MobileLobbyRewards";

/**
 * Dedicated phone Competition Lobby (Complobyymobile).
 *
 * Breakpoint: widths under 769px via the page wrapper. Never imports the desktop
 * two-column shell. Same loaders, entry rules, neon graphics and prize logic as desktop.
 */

export type MobileCompetitionLobbyProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaderboard: any[];
  creditSymbol?: string;
  bannerUrl?: string | null;
  isCancelled: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isUserIn: boolean;
  isFull: boolean;
  registrationClosed: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userParticipant: any;
  competitionId: string;
  walletBalance: number;
  userLevel: { level: number; title: string; icon: string };
  levelLadder: TitleLevel[];
  currentUserId?: string;
  difficultyData: {
    level: DifficultyLevel;
    label: string;
    score: number;
  };
  formatUTCDate: (date: Date) => string;
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
};

export function MobileCompetitionLobby({
  competition,
  leaderboard,
  creditSymbol,
  bannerUrl,
  isCancelled,
  isActive,
  isUpcoming,
  isCompleted,
  isUserIn,
  isFull,
  registrationClosed,
  userParticipant,
  competitionId,
  walletBalance,
  userLevel,
  levelLadder,
  currentUserId,
  difficultyData,
  formatUTCDate,
  sections,
  overview,
}: MobileCompetitionLobbyProps) {
  const about =
    typeof competition.description === "string" &&
    competition.description.trim().length > 0
      ? competition.description.trim()
      : "Compete for the prize pool. Check the rules tabs for how this contest works.";

  return (
    <div
      className="min-h-screen w-full min-w-0"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.35), rgba(1,7,20,.55)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[430px] min-w-0 flex-col gap-4 overflow-x-hidden px-4 pt-4"
        style={{
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <NeonPill
            href="/competitions"
            icon={ArrowLeft}
            label="Competitions"
          />
          {isCompleted && isUserIn ? (
            <NeonPill
              href={`/competitions/${competitionId}/results`}
              icon={BarChart3}
              label="Results"
            />
          ) : null}
        </div>

        <MobileLobbyHero
          title={competition.name}
          description={competition.description}
          banner={resolveTradingBanner(bannerUrl)}
          kind="trading"
          status={String(competition.status ?? "")}
          isCancelled={isCancelled}
          cancellationReason={competition.cancellationReason}
        />

        <MobileLobbyMetrics
          competition={competition}
          creditSymbol={creditSymbol}
          kind="trading"
          isActive={isActive}
          isUpcoming={isUpcoming}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
        />

        <MobileLobbyEntryPanel
          competition={competition}
          walletBalance={walletBalance}
          isUserIn={isUserIn}
          isFull={isFull}
          registrationClosed={registrationClosed}
          userParticipant={userParticipant}
          userLevel={userLevel}
          levelLadder={levelLadder}
          currentUserId={currentUserId}
          show={!isCompleted || isUserIn}
        />

        <MobileLobbyCountdown
          startTime={competition.startTime}
          endTime={competition.endTime}
          isUpcoming={isUpcoming}
          isActive={isActive}
        />

        <MobileLobbyTabs
          about={about}
          overview={overview}
          sections={sections}
        />

        <MobileLobbyLeaderboard
          leaderboard={leaderboard}
          userParticipantId={userParticipant?._id}
          prizeDistribution={competition.prizeDistribution}
          minimumTrades={competition.rules?.minimumTrades || 0}
          competitionStatus={competition.status}
          playersLabel="traders"
        />

        {isUserIn && userParticipant ? (
          <CompetitionDashboard
            competitionId={competitionId}
            initialParticipant={{
              _id: userParticipant._id.toString(),
              currentCapital: userParticipant.currentCapital,
              pnl: userParticipant.pnl,
              pnlPercentage: userParticipant.pnlPercentage,
              totalTrades: userParticipant.totalTrades,
              currentRank: userParticipant.currentRank,
              winningTrades: userParticipant.winningTrades,
              losingTrades: userParticipant.losingTrades,
              status: userParticipant.status,
            }}
            competitionStatus={
              isCancelled
                ? "cancelled"
                : isCompleted
                  ? "completed"
                  : isActive
                    ? "active"
                    : "upcoming"
            }
            startTime={new Date(competition.startTime).toISOString()}
            endTime={new Date(competition.endTime).toISOString()}
            startingCapital={
              competition.startingCapital ||
              competition.startingTradingPoints ||
              10000
            }
            competitionRules={
              competition.rules
                ? {
                    minimumTrades: competition.rules.minimumTrades,
                    minimumWinRate: competition.rules.minimumWinRate,
                    disqualifyOnLiquidation:
                      competition.rules.disqualifyOnLiquidation,
                  }
                : undefined
            }
            totalParticipants={competition.currentParticipants}
            competitionName={competition.name}
            rankingMethod={competition.rankingMethod}
            entryFee={competition.entryFee ?? competition.entryFeeCredits}
            creditSymbol={creditSymbol}
          />
        ) : null}

        <MobileLobbySchedule
          startLabel={formatUTCDate(new Date(competition.startTime))}
          endLabel={formatUTCDate(new Date(competition.endTime))}
        />

        <MobileLobbyDifficulty difficultyData={difficultyData} />

        {competition.levelRequirement?.enabled ? (
          <NeonPanel
            iconSrc={NEON_ICON("crown")}
            accent="score"
            title="Level requirement"
            size="lg"
          >
            <p className="text-sm font-medium text-gray-100 break-words">
              {(() => {
                const min = Number(competition.levelRequirement.minLevel);
                const max = competition.levelRequirement.maxLevel
                  ? Number(competition.levelRequirement.maxLevel)
                  : null;
                return max
                  ? `${resolveLevelName(min, levelLadder)} to ${resolveLevelName(max, levelLadder)}`
                  : `${resolveLevelName(min, levelLadder)} or higher`;
              })()}
            </p>
          </NeonPanel>
        ) : null}

        <MobileLobbyRewards
          competition={competition}
          creditSymbol={creditSymbol}
        />
      </div>
    </div>
  );
}
