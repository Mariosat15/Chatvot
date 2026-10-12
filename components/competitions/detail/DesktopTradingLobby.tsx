import { ArrowLeft, BarChart3 } from "lucide-react";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import CompetitionLeaderboard from "@/components/trading/CompetitionLeaderboard";
import CompetitionDashboard from "@/components/trading/CompetitionDashboard";
import TradingLobbyHero from "@/components/trading/lobby/TradingLobbyHero";
import { TradingLobbySummary } from "@/components/trading/lobby/TradingLobbySummary";
import TradingLobbySidebar, {
  type TradingLobbySidebarProps,
} from "@/components/trading/lobby/TradingLobbySidebar";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { CompetitionDetailShell } from "@/components/competitions/detail/CompetitionDetailShell";
import { TradingDetailTabs } from "@/components/competitions/detail/TradingDetailTabs";
import { NeonCountPill, NeonPanel } from "@/components/neon/Cards";
import { NeonPill } from "@/components/neon/Buttons";

/**
 * Desktop trading competition detail (md and up).
 *
 * Reason: the phone tree is a separate layout (`mobile/MobileTradingLobby`), not a shrunk
 * copy of this shell. Keeping this file as the desktop-only composition stops mobile edits
 * from rewriting the two-column page.
 */

export type DesktopTradingLobbyProps = {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userParticipant: any;
  competitionId: string;
  /** Built once on the page and shared with the phone tree. */
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
  sidebar: TradingLobbySidebarProps;
};

export function DesktopTradingLobby({
  competition,
  leaderboard,
  creditSymbol,
  bannerUrl,
  isCancelled,
  isActive,
  isUpcoming,
  isCompleted,
  isUserIn,
  userParticipant,
  competitionId,
  sections,
  overview,
  sidebar,
}: DesktopTradingLobbyProps) {
  return (
    <CompetitionDetailShell
      nav={
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <NeonPill
              href="/competitions"
              icon={ArrowLeft}
              label="Back to Competitions"
            />
            {isCompleted && isUserIn && (
              <NeonPill
                href={`/competitions/${competitionId}/results`}
                icon={BarChart3}
                label="View Results"
              />
            )}
          </div>
        </div>
      }
      hero={
        <TradingLobbyHero
          competition={competition}
          bannerUrl={bannerUrl}
          isCancelled={isCancelled}
        />
      }
      summary={
        <TradingLobbySummary
          competition={competition}
          creditSymbol={creditSymbol}
          isActive={isActive}
          isUpcoming={isUpcoming}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
        />
      }
      main={
        <>
          <TradingDetailTabs
            description={competition.description}
            sections={sections}
            overview={overview}
          />

          <div id="competition-leaderboard" className="scroll-mt-24">
            <NeonPanel
              iconSrc={NEON_ICON("trophy-blue")}
              accent="prize"
              title="Leaderboard"
              size="lg"
              action={
                <div className="flex items-center gap-2">
                  <NeonCountPill>{leaderboard.length} traders</NeonCountPill>
                  {competition.rules?.minimumTrades > 0 && (
                    <NeonCountPill tone="warn">
                      Min {competition.rules.minimumTrades} trades
                    </NeonCountPill>
                  )}
                </div>
              }
            >
              <CompetitionLeaderboard
                leaderboard={leaderboard}
                userParticipantId={userParticipant?._id}
                prizeDistribution={competition.prizeDistribution}
                minimumTrades={competition.rules?.minimumTrades || 0}
                competitionStatus={competition.status}
              />
            </NeonPanel>
          </div>

          {isUserIn && userParticipant && (
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
          )}
        </>
      }
      sidebar={<TradingLobbySidebar {...sidebar} />}
    />
  );
}
