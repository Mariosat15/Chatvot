import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ListOrdered } from "lucide-react";
import { NEON_PANEL, NEON_LABEL } from "@/components/neon/tokens";
import { NeonHeadedPanel } from "@/components/neon/Cards";
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
  /**
   * The pill beside the Standings heading.
   *
   * A NODE RATHER THAN A NUMBER since 11 September 2026, because the board below it refreshes
   * on a timer. A count rendered once on the server disagrees with the list beneath it the
   * moment somebody joins - one panel with two answers, which is precisely the failure the
   * live rail exists to remove rather than to reintroduce one heading higher.
   */
  standingsCount: ReactNode;
  /** The contest's facts and, beneath them, the prize table. */
  sidebar: ReactNode;
  /**
   * The operator's rules for the title, full width beneath the board.
   *
   * NOT IN THE SIDEBAR, and the reason is the 320px column: how a game scores is prose, and
   * prose in a narrow column beside a board is where a player stops reading. It sits below
   * the stage because the board is why they are here, and above the highlights because a
   * scoring rule outranks three marketing phrases.
   */
  rules: ReactNode;
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
  rules,
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
          <img src={banner.src} alt="" className="h-full w-full object-cover opacity-90" />
          {/*
            Two gradients rather than one. The horizontal pass keeps the copy on an opaque
            background, which is the only thing the scrim MUST guarantee; the vertical pass
            darkens the foot so the feature row reads against artwork instead of sitting on a
            bright patch of it. One gradient doing both jobs has to be dark enough for the
            worst case everywhere, which is how the banner ended up invisible before.

            THE SCRIM CAN BE THIS LIGHT ONLY BECAUSE THE ARTWORK WAS DRAWN FOR IT. The three
            banners redrawn on 11 September 2026 are deliberately bright at the outer thirds and
            near-black through the middle, so the copy sits on dark paint rather than on a
            gradient fighting a bright image. A banner supplied by a provider carries no such
            promise, which is why the horizontal pass is still opaque at the left edge - that is
            the guarantee, and it does not depend on which picture arrives.
          */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#070C1A] via-[#070C1A]/75 to-[#070C1A]/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070C1A] via-transparent to-transparent" />
        </div>

        {/*
          A MINIMUM HEIGHT, because the hero's size is the owner's point. Without one it is
          exactly as tall as its text, so a title with no tagline and no description collapses
          to a strip and the banner behind it is reduced to a stripe - which is the reference's
          largest element rendered as its smallest.
        */}
        <div className="relative min-h-[220px] p-5 sm:p-7">
          <ArenaIdentity
            presentation={presentation}
            contestName={competitionName}
            minParticipants={minParticipants}
            maxParticipants={maxParticipants}
          />
        </div>
      </div>

      {/*
        THE STANDINGS RAIL IS 360px, AND IT WAS 300 UNTIL THE OWNER SAW IT. 300 was itself a
        widening from 280, decided by reasoning about how many characters fit; the screen then
        rendered "M..." and "Andy ..." anyway, because the reasoning counted the rank plate,
        the name and the score and forgot the avatar, the title icon and the "you" marker.

        The reference settles it by measurement rather than by argument: its board occupies
        just under a quarter of the page width, and 300 of 1440 is a fifth. 360 is that
        quarter, and the width comes out of the middle column, which had more than the
        reference gives it. Count the things in the row, not the columns.
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
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
            /*
              "players", never "traders", and the bare count was the reference's one legible
              omission - a pill reading `20` beside a heading reading `Standings` says twenty
              of what. The wording now lives with the count in `ArenaLiveCount`, because the
              figure and its noun have to change together.
            */
            action={standingsCount}
          >
            {/*
              Tight padding, because the rows are flush now and their left accent bar is the
              state marker. Padded in from the panel edge as far as a card would be, the bar
              floats in the middle of a gutter and stops reading as an edge.
            */}
            <div className="max-h-[460px] overflow-y-auto px-1.5 py-1">
              {standings}
            </div>
            {/*
              A BUTTON, NOT A TEXT LINK. The reference draws a full-width bordered control at
              the foot of the board, and it is the only way off this panel: a line of small
              blue text under a scrolling list is the thing a player's eye skips.
            */}
            <div className="border-t border-[#161E36] p-3">
              <Link
                href={`/competitions/${competitionId}?view=details`}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1B2540] bg-[#0B1120] px-3 py-2 text-xs font-semibold text-sky-300 transition-colors hover:border-sky-500/40 hover:text-sky-200"
              >
                Full leaderboard and prizes
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </NeonHeadedPanel>
        </div>

        <div className="order-1 lg:order-1 xl:order-2">{stage}</div>

        <div className="order-3 space-y-5 lg:order-2 xl:order-3">{sidebar}</div>
      </div>

      {/*
        THE BOTTOM BAND STAYS STACKED, and the reference's three side-by-side panels were
        tried and reverted. Both of these render `null` when their content is absent - which
        is the COMMON case, since no title carries rules text until the catalogue is
        re-synced - and a two-thirds grid column holding a component that returned null is
        still a column: the highlights would sit alone on the right with two empty thirds
        beside them. A layout cannot see that its child rendered nothing, so the shape that
        survives an empty slot is the one to use.
      */}
      <div className="mt-5 space-y-5">
        {rules}
        {highlights}
      </div>

      <p className={`mt-5 text-center ${NEON_LABEL}`}>
        Scores are reported by the game and settled by ChartVolt.
      </p>
    </div>
  );
}
