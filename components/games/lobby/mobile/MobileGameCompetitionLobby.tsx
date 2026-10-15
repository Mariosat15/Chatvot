import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";
import { NeonBackLink, NeonPill } from "@/components/neon/Buttons";
import type { NeonHeroBanner } from "@/components/neon/Hero";
import type { PlayState } from "@/components/games/play-state";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import { MobileLobbyHero } from "@/components/competitions/lobby/mobile/MobileLobbyHero";
import { MobileLobbyCard } from "@/components/competitions/lobby/mobile/MobileLobbyCard";
import {
  MobileLobbyPages,
  type MobileLobbyPage,
} from "@/components/competitions/lobby/mobile/MobileLobbyPages";
import { MobileGameLobbyRunCard } from "./MobileGameLobbyRunCard";
import { MobileGameLobbyMetrics } from "./MobileGameLobbyMetrics";
import { MobileGameLobbyRounds } from "./MobileGameLobbyRounds";

/**
 * Dedicated phone Game Competition Lobby
 * (`ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide`, rebuilt 15 Oct 2026 after the
 * owner found the first pass "too busy, no flow").
 *
 * It reads in the SAME order as the trading phone lobby, with the same shared hero, tiles,
 * card shell and tabs: what is it -> the four facts -> what do I do -> more detail.
 *   back (+ Results when finished and in) -> hero -> 2×2 tiles (one clock) -> one action
 *   card -> tabs. A tab with nothing in it is not drawn, rather than showing a placeholder.
 * Desktop three-column shell is untouched. Same loaders / entry / standings.
 */

export type MobileGameCompetitionLobbyProps = {
  competitionId: string;
  contestsHref: string;
  contestsLabel: string;
  hero: {
    title: string;
    description?: string | null;
    banner?: NeonHeroBanner;
    categoryLabel?: string | null;
    status: string;
    cancellationReason?: string | null;
  };
  contest: {
    isActive: boolean;
    isUpcoming: boolean;
    isCompleted: boolean;
    isCancelled: boolean;
    countdownTarget?: Date | string | null;
  };
  run: {
    isUserIn: boolean;
    state: PlayState | null;
    roundTimeLabel?: string | null;
    scoringNote?: string | null;
    initialScore?: number;
    initialRank?: number;
    entryControl: ReactNode;
  };
  metrics: {
    prizePool: number;
    entryFee: number;
    currentParticipants: number;
    maxParticipants: number;
    minParticipants: number;
    playersLabel: string;
    creditSymbol?: string;
    funded?: boolean;
  };
  leaderboard: ReactNode;
  prizes?: ReactNode;
  howItWorks?: ReactNode;
  tips?: ReactNode;
  rounds: {
    list: PlayState["rounds"];
    scoreType?: GameScoreType;
    scoreLabel?: string;
  };
  details?: ReactNode;
};

export function MobileGameCompetitionLobby({
  competitionId,
  contestsHref,
  contestsLabel,
  hero,
  contest,
  run,
  metrics,
  leaderboard,
  prizes,
  howItWorks,
  tips,
  rounds,
  details,
}: MobileGameCompetitionLobbyProps) {
  const scoringNote = run.scoringNote?.trim();

  const pages: MobileLobbyPage[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <>
          {scoringNote ? (
            <MobileLobbyCard title="How to win">
              <p className="text-center text-[14px] font-semibold text-amber-200">{scoringNote}</p>
            </MobileLobbyCard>
          ) : null}
          {howItWorks}
          {details}
        </>
      ),
    },
    { id: "leaderboard", label: "Leaderboard", content: leaderboard },
    ...(run.isUserIn
      ? [
          {
            id: "rounds",
            label: "Your rounds",
            content: (
              <MobileGameLobbyRounds
                rounds={rounds.list}
                scoreType={rounds.scoreType}
                scoreLabel={rounds.scoreLabel}
              />
            ),
          },
        ]
      : []),
    ...(tips ? [{ id: "tips", label: "Tips", content: tips }] : []),
    ...(prizes ? [{ id: "prizes", label: "Prizes", content: prizes }] : []),
  ];

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
        className="mx-auto flex w-full max-w-[430px] min-w-0 flex-col gap-3.5 overflow-x-hidden px-4 pt-4"
        style={{
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <NeonBackLink href={contestsHref} label={contestsLabel} />
          {contest.isCompleted && run.isUserIn ? (
            <NeonPill
              href={`/competitions/${competitionId}/results`}
              icon={BarChart3}
              label="Results"
            />
          ) : null}
        </div>

        <MobileLobbyHero
          title={hero.title}
          description={hero.description}
          banner={hero.banner}
          kind="game"
          kindLabel={hero.categoryLabel}
          status={hero.status}
          isCancelled={contest.isCancelled}
          cancellationReason={hero.cancellationReason}
        />

        <MobileGameLobbyMetrics {...metrics} {...contest} />

        <MobileGameLobbyRunCard
          isUserIn={run.isUserIn}
          isCompleted={contest.isCompleted}
          isUpcoming={contest.isUpcoming}
          isCancelled={contest.isCancelled}
          state={run.state}
          roundTimeLabel={run.roundTimeLabel}
          scoringNote={run.scoringNote}
          initialScore={run.initialScore}
          initialRank={run.initialRank}
          entryControl={run.entryControl}
        />

        <MobileLobbyPages pages={pages} />
      </div>
    </div>
  );
}
