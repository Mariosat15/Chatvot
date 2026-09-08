import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ListOrdered } from "lucide-react";
import { NEON_PANEL, NEON_LABEL } from "@/components/neon/tokens";
import { NeonCountPill, NeonHeadedPanel } from "@/components/neon/Cards";
import { providerBanner } from "@/components/neon/banners";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import { ArenaIdentity } from "./ArenaIdentity";

/**
 * The arena: the game's identity across the top, the board in the middle, standings on one
 * side and the contest's facts on the other.
 *
 * WHAT THIS REPLACED, because it explains the shape. The play screen used to be a single
 * narrow column holding a Play button and then an iframe, on a plain grey page. A player who
 * pressed Play could no longer see the pot they were playing for, where they stood, or how
 * many attempts they had left - all of which existed, one route away, on the lobby.
 *
 * THE BOARD IS FIRST IN THE DOM AND CENTRED ON WIDE SCREENS. On a phone the side panels
 * follow it rather than pushing it below the fold, which is what a naive three-column grid
 * would do. The board is the reason the player is here; the standings are context.
 *
 * THE BANNER FALLS BACK RATHER THAN GOING BLANK. An operator who has uploaded artwork gets
 * it; a title with none gets the generic banner from `components/neon/banners.ts`, which is
 * resolved from the game code. That fallback used to be the ONLY source, deliberately,
 * because a URL nothing maintained was judged worse than a visibly generic image. The admin
 * content editor is the thing that maintains it, so an operator's banner now wins and the
 * generic one remains for every title whose copy has not been written yet.
 */

interface Props {
  competitionId: string;
  competitionName: string;
  presentation: GamePresentation;
  minParticipants?: number;
  maxParticipants?: number;
  /** The board, the Play button, or the result - whatever phase the player is in. */
  stage: ReactNode;
  /** The live standings for this contest. */
  standings: ReactNode;
  standingsCount: number;
  /** The contest's facts and, beneath them, the prize table. */
  sidebar: ReactNode;
  highlights: ReactNode;
}

export function GameArenaLayout({
  competitionId,
  competitionName,
  presentation,
  minParticipants,
  maxParticipants,
  stage,
  standings,
  standingsCount,
  sidebar,
  highlights,
}: Props) {
  const banner = presentation.bannerUrl
    ? { src: presentation.bannerUrl, alt: presentation.gameName }
    : providerBanner(undefined);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <Link
        href={`/competitions/${competitionId}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {competitionName}
      </Link>

      <div className={`${NEON_PANEL} relative mb-5 overflow-hidden`}>
        {/*
          Decorative and behind the text, so it is `aria-hidden` with an empty alt and the
          heading below carries the meaning. A plain `<img>` because an operator's banner is
          served by an API route with a database fallback - see `ArenaIdentity`.
        */}
        {/*
          THE SCRIM IS NAVY, NOT BLACK, and the banner is no longer dimmed to near-nothing.
          Washing artwork out to 20% under a pure-black gradient made every game's header look
          the same shade of empty - the operator uploads a banner and cannot see that they
          did. The gradient still runs opaque behind the text, which is the only thing it has
          to guarantee, and the artwork survives on the right where nothing is written.
        */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.src} alt="" className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070C1A] via-[#070C1A]/90 to-[#070C1A]/30" />
        </div>

        <div className="relative p-5">
          <ArenaIdentity
            presentation={presentation}
            contestName={competitionName}
            minParticipants={minParticipants}
            maxParticipants={maxParticipants}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/*
          EVERY BREAKPOINT SETS AN ORDER, and the reason is that grid auto-placement follows
          order-modified document order, so a rule that only fires at `xl` leaves the other two
          layouts arranged by DOM order alone. Written that way, the standings came first on a
          phone - pushing the board below the fold, the exact thing the ordering exists to
          prevent - and at `lg`, where there are only two columns, the standings took the wide
          one and the BOARD was placed in the 320px sidebar column.

          Board first everywhere. Phone: board, standings, facts. Laptop: board beside the
          facts, standings full width beneath. Desktop: standings, board, facts.
        */}
        <div className="order-2 lg:order-3 xl:order-1">
          <NeonHeadedPanel
            icon={ListOrdered}
            title="Standings"
            action={<NeonCountPill>{standingsCount}</NeonCountPill>}
          >
            <div className="max-h-[420px] overflow-y-auto p-2">{standings}</div>
            <div className="border-t border-[#161E36] px-4 py-2.5">
              <Link
                href={`/competitions/${competitionId}?view=details`}
                className="text-xs text-sky-400 transition-colors hover:text-sky-300"
              >
                Full leaderboard and prizes →
              </Link>
            </div>
          </NeonHeadedPanel>
        </div>

        <div className="order-1 lg:order-1 xl:order-2">{stage}</div>

        <div className="order-3 space-y-5 lg:order-2 xl:order-3">{sidebar}</div>
      </div>

      <div className="mt-5">{highlights}</div>

      <p className={`mt-5 text-center ${NEON_LABEL}`}>
        Scores are reported by the game and settled by ChartVolt.
      </p>
    </div>
  );
}
