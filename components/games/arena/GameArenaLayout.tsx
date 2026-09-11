import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import {
  NEON_DIVIDER,
  NEON_LABEL,
  NEON_PANEL_LIT,
} from "@/components/neon/tokens";
import {
  NeonGridBackdrop,
  NeonHeadedPanel,
  NeonScopeStrip,
} from "@/components/neon/Cards";
import { NeonButton } from "@/components/neon/Buttons";
import type { NeonHeroBanner } from "@/components/neon/Hero";
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
  /**
   * The hero artwork, already chosen.
   *
   * THE CALLER RESOLVES IT AND THAT IS NOT A STYLE CHOICE. This file resolved its own until
   * 11 September 2026 and resolved it wrongly - it called `providerBanner(undefined)`,
   * because `GamePresentation` carries no game code, so the arena wore the GENERIC trophy
   * for every title in the catalogue while the lobby and the results screen, which both pass
   * the code, drew the game's own artwork. Three callers and one of them forgot.
   *
   * The obvious repair - pass the game code in - is **forbidden here by a test**, and the
   * test is right: `game-content-editor.test.ts` asserts that nothing in this folder names a
   * game code, a provider key or a game key, because the one way to lose "a new title needs
   * no code" is a screen that enumerates games. So the page, which already knows which game
   * it is, picks the picture and hands over data. The layout stays unable to have an opinion.
   */
  banner: NeonHeroBanner;
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
  /**
   * What has just happened in this contest - the reference's third bottom panel.
   *
   * IT MOVED OUT OF THE SIDEBAR ON THE OWNER'S INSTRUCTION (11 September 2026). It sat there
   * because the reference's three-panel band was tried and reverted: two of the three render
   * nothing until the catalogue is re-synced, and a grid column holding a child that returned
   * `null` is still a column, so the common case was one panel adrift in an empty row. The
   * owner asked for the band anyway, and the band below now survives an empty slot - see the
   * comment on it, which is the part that made this safe rather than merely ordered.
   */
  activity: ReactNode;
}

export function GameArenaLayout({
  competitionId,
  competitionName,
  presentation,
  banner,
  minParticipants,
  maxParticipants,
  stage,
  standings,
  standingsCount,
  sidebar,
  rules,
  highlights,
  activity,
}: Props) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/*
        THE PAGE'S OWN SURFACE, and the reason it is a fixed backdrop rather than a class on
        the app's body: the reference's arena is a lit navy room and the rest of the
        application is neutral near-black. Restyling the body would change every trading
        screen through a shared layout, which is the invisible change the kit's notes keep
        warning about. Fixed rather than absolute, so it covers the viewport however far this
        page - which is taller than one - is scrolled.
      */}
      <NeonGridBackdrop />

      <Link
        href={`/competitions/${competitionId}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {competitionName}
      </Link>

      <div className={`${NEON_PANEL_LIT} relative mb-5 overflow-hidden`}>
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
            icon={Trophy}
            /*
              "Leaderboard", the reference's word, since 11 Sep 2026 - it said "Standings" for
              three days, and the owner's rejection listed the panel by the reference's name.
              The trophy is the reference's glyph too.
            */
            title="Leaderboard"
            /*
              "players", never "traders", and the bare count was the reference's one legible
              omission - a pill reading `20` beside a heading reading `Leaderboard` says twenty
              of what. The wording now lives with the count in `ArenaLiveCount`, because the
              figure and its noun have to change together.
            */
            action={standingsCount}
          >
            {/*
              The reference's scope strip, with the one scope this board can answer. The other
              two it draws - friends, country - have no data source, and `NeonScopeStrip`'s
              header says why they are not drawn as dead tabs.
            */}
            <NeonScopeStrip scopes={["Global"]} />
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
              blue text under a scrolling list is the thing a player's eye skips. It is the
              kit's `outline` button rather than a class list written here, so the control is
              the same one the results screen draws and neither can drift from the other.
            */}
            <div className={`border-t p-3 ${NEON_DIVIDER}`}>
              <NeonButton
                href={`/competitions/${competitionId}?view=details`}
                tone="outline"
                label="View Full Leaderboard"
                trailingIcon={ArrowRight}
              />
            </div>
          </NeonHeadedPanel>
        </div>

        <div className="order-1 lg:order-1 xl:order-2">{stage}</div>

        <div className="order-3 space-y-5 lg:order-2 xl:order-3">{sidebar}</div>
      </div>

      {/*
        THE REFERENCE'S THREE-PANEL BAND, on the owner's instruction of 11 September 2026 -
        and the reason it is safe this time is the two words `empty:hidden`, not the owner's
        say-so.

        It was tried and reverted the same day. All three of these slots render NOTHING when
        their content is absent, and that is the common case rather than an edge: no title
        carries rules text until the catalogue is re-synced, an operator writes the feature
        cards per title, and a contest nobody has played yet has no activity. A layout cannot
        see that its child returned `null`, so a grid column holding one is still a column -
        which is how the first attempt produced one panel adrift in an empty row.

        CSS can see it, even though React cannot: a wrapper whose child rendered nothing has
        no child nodes, so `:empty` matches it and the slot leaves the flex line entirely.
        `flex-wrap` with a basis rather than `grid-cols-3`, so the one or two panels that DO
        have content grow to fill the row instead of huddling in the first tracks. One panel
        reads as a full-width panel; three read as the reference.
      */}
      <div className="mt-5 flex flex-wrap gap-5">
        <div className="min-w-[300px] flex-1 empty:hidden">{rules}</div>
        <div className="min-w-[280px] flex-1 empty:hidden">{highlights}</div>
        <div className="min-w-[280px] flex-1 empty:hidden">{activity}</div>
      </div>

      <p className={`mt-5 text-center ${NEON_LABEL}`}>
        Scores are reported by the game and settled by ChartVolt.
      </p>
    </div>
  );
}
