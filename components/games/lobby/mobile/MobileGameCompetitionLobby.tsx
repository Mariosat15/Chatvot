import type { ReactNode } from "react";
import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";
import { NeonBackLink } from "@/components/neon/Buttons";
import type { NeonHeroBanner } from "@/components/neon/Hero";
import type { PlayState } from "@/components/games/play-state";
import type { GameScoreType } from "@/lib/utils/format-game-score";
import {
  MobileLobbyPages,
  type MobileLobbyPage,
} from "@/components/competitions/lobby/mobile/MobileLobbyPages";
import { MobileGameLobbyHero } from "./MobileGameLobbyHero";
import { MobileGameLobbyStatus } from "./MobileGameLobbyStatus";
import { MobileGameLobbyRunCard } from "./MobileGameLobbyRunCard";
import { MobileGameLobbyMetrics } from "./MobileGameLobbyMetrics";
import { MobileGameLobbyRounds } from "./MobileGameLobbyRounds";

/**
 * Dedicated phone Game Competition Lobby
 * (`ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide`, 15 Oct 2026).
 *
 * Order: back → hero → status/countdown → Your Run → essentials → tab pages.
 * Desktop three-column shell is untouched. Same loaders / entry / standings.
 */

export type MobileGameCompetitionLobbyProps = {
  contestsHref: string;
  contestsLabel: string;
  hero: {
    title: string;
    tagline?: string | null;
    description?: string | null;
    banner?: NeonHeroBanner;
    categoryLabel?: string | null;
    status: string;
    scoringNote?: string | null;
  };
  status: {
    status: string;
    isActive: boolean;
    isCompleted: boolean;
    isCancelled: boolean;
    countdownTarget?: Date | string | null;
    contestLabel?: string;
  };
  run: {
    isUserIn: boolean;
    isCompleted: boolean;
    isUpcoming: boolean;
    isCancelled: boolean;
    state: PlayState | null;
    roundTimeLabel?: string | null;
    initialScore?: number;
    initialRank?: number;
    entryControl: ReactNode;
  };
  metrics: {
    prizePool: number;
    entryFee: number;
    currentParticipants: number;
    maxParticipants: number;
    roundTimeLabel?: string | null;
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
  contestsHref,
  contestsLabel,
  hero,
  status,
  run,
  metrics,
  leaderboard,
  prizes,
  howItWorks,
  tips,
  rounds,
  details,
}: MobileGameCompetitionLobbyProps) {
  const pages: MobileLobbyPage[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-4">
          {howItWorks}
          {details}
        </div>
      ),
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      content: leaderboard,
    },
    {
      id: "prizes",
      label: "Prizes",
      content: prizes ?? (
        <p className="text-center text-[13px] text-gray-400">
          No prize distribution for this competition.
        </p>
      ),
    },
    {
      id: "rounds",
      label: "Rounds",
      content: (
        <MobileGameLobbyRounds
          rounds={rounds.list}
          scoreType={rounds.scoreType}
          scoreLabel={rounds.scoreLabel}
        />
      ),
    },
    {
      id: "tips",
      label: "Tips",
      content: tips ?? (
        <p className="text-center text-[13px] text-gray-400">
          No tips for this game yet.
        </p>
      ),
    },
  ];

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.55), rgba(1,7,20,.78)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
      }}
    >
      <div
        className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-4 overflow-x-hidden px-3 py-4"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex min-w-0 items-center">
          <NeonBackLink href={contestsHref} label={contestsLabel} />
        </div>

        <MobileGameLobbyHero {...hero} />
        <MobileGameLobbyStatus {...status} />
        <MobileGameLobbyRunCard {...run} />
        <MobileGameLobbyMetrics {...metrics} />
        <MobileLobbyPages pages={pages} />
      </div>
    </div>
  );
}
