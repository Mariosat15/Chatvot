import { BarChart3, Gamepad2 } from "lucide-react";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { CompetitionDetailShell } from "@/components/competitions/detail/CompetitionDetailShell";
import { TradingDetailTabs } from "@/components/competitions/detail/TradingDetailTabs";
import { NeonBackLink, NeonPill } from "@/components/neon/Buttons";
import { NeonHero, NeonStatusBadge } from "@/components/neon/Hero";
import { NeonNote, NeonPanel, NeonRow } from "@/components/neon/Cards";
import {
  GameLobbySidebar,
  type GameLobbySidebarProps,
} from "@/components/games/lobby/GameLobbySidebar";
import { LobbyContestStatsGrid } from "@/components/games/lobby/LobbyContestStatsGrid";
import { LobbyHeroFeaturePills } from "@/components/games/lobby/LobbyHeroFeaturePills";

/**
 * Desktop provider-game competition lobby — same shell and column order as
 * `DesktopTradingLobby` (`CompetitionDetailShell`), with games data.
 *
 * Phone stays in `MobileGameCompetitionLobby`. Trading is untouched.
 */

export type DesktopGameLobbyProps = {
  contestsHref: string;
  contestsLabel: string;
  competitionId: string;
  isCompleted: boolean;
  isUserIn: boolean;
  /** Banner path from `resolveProviderBanner`. */
  banner: string;
  heroBadgeLabel: string;
  heroTitle: string;
  heroSubtitle?: string | null;
  heroFeatures: { icon?: string; label: string }[];
  status: string;
  cancellationReason?: string | null;
  summary: React.ReactNode;
  description?: string | null;
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
  leaderboard: React.ReactNode;
  /** Seated player's score / attempts — trading's CompetitionDashboard equivalent. */
  yourRun?: React.ReactNode;
  sidebar: GameLobbySidebarProps;
  footer?: React.ReactNode;
};

export function DesktopGameLobby({
  contestsHref,
  contestsLabel,
  competitionId,
  isCompleted,
  isUserIn,
  banner,
  heroBadgeLabel,
  heroTitle,
  heroSubtitle,
  heroFeatures,
  status,
  cancellationReason,
  summary,
  description,
  sections,
  overview,
  leaderboard,
  yourRun,
  sidebar,
  footer,
}: DesktopGameLobbyProps) {
  return (
    <CompetitionDetailShell
      nav={
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <NeonBackLink href={contestsHref} label={contestsLabel} />
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
        <NeonHero
          banner={banner}
          badge={{ icon: Gamepad2, label: heroBadgeLabel }}
          title={heroTitle}
          subtitle={heroSubtitle || undefined}
          status={
            <>
              <NeonStatusBadge status={status} />
              {cancellationReason ? (
                <span className="text-sm text-rose-300">{cancellationReason}</span>
              ) : null}
            </>
          }
          meta={<LobbyHeroFeaturePills features={heroFeatures} />}
        />
      }
      summary={summary}
      main={
        <>
          <TradingDetailTabs
            kind="game"
            description={description}
            sections={sections}
            overview={overview}
          />

          <div id="competition-leaderboard" className="scroll-mt-24">
            {leaderboard}
          </div>

          {yourRun}
        </>
      }
      sidebar={<GameLobbySidebar {...sidebar} />}
      footer={footer}
    />
  );
}

/** Seated "your run" block under the leaderboard — games data, not trading capital. */
export function GameLobbyYourRun({
  roundTimeLabel,
  attemptsLabel,
  attemptsNote,
  initialScore,
  initialRank,
  scoringNote,
  showScore,
}: {
  roundTimeLabel: string;
  attemptsLabel?: string;
  attemptsNote?: string | null;
  initialScore?: number;
  initialRank?: number;
  scoringNote: string;
  showScore: boolean;
}) {
  return (
    <NeonPanel
      iconSrc={NEON_ICON("trophy-blue")}
      accent="prize"
      title="Your arena run"
      size="lg"
    >
      <LobbyContestStatsGrid
        roundTimeLabel={roundTimeLabel}
        attemptsLabel={attemptsLabel}
        initialScore={initialScore}
        initialRank={initialRank}
        showScore={showScore}
        scoringNote={scoringNote}
      />
      {attemptsLabel ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <NeonRow
            label="Attempts remaining"
            accent="score"
            value={attemptsLabel}
          />
          {attemptsNote ? <NeonNote>{attemptsNote}</NeonNote> : null}
          <NeonNote>
            An attempt is used the moment a round opens, even if you leave before
            finishing.
          </NeonNote>
        </div>
      ) : null}
    </NeonPanel>
  );
}
