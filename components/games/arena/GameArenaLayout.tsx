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

      {/*
        THE HERO IS ONE THIN BANNER AND ITS HEIGHT IS FIXED (owner instruction, 11 September
        2026: "far too tall and has unnecessary content/cards underneath", with 110-125px
        named as the range). 118 is the middle of it.

        FIXED RATHER THAN MINIMUM, and that is the whole lesson of the two rebuilds this
        component has had. A `min-height` is a floor that content is free to exceed, so every
        individually-reasonable addition - a subtitle, a longer description, a row of facts -
        made the banner taller than the board it sits above, on a screen a player is paying by
        the attempt to use. With a fixed height and `overflow-hidden` the ceiling holds no
        matter what the catalogue contains; what fits is decided here, once, by clamping each
        line rather than by hoping the copy is short.

        `sm:` ONLY, so a phone stacks instead of cropping. The same rule as the bottom band:
        a measurement the owner gave for the desktop must not silently become a crop on a
        narrow screen, where the copy needs two rows and there is no artwork to protect.
      */}
      <div className={`${NEON_PANEL_LIT} relative mb-5 overflow-hidden`}>
        {/*
          THE ARTWORK IS A RIGHT-HAND PIECE NOW, NOT A FULL-BLEED BACKGROUND, and the reason is
          arithmetic rather than taste. The banners are 1280x720; `object-cover` across a
          1350x118 panel shows a 16%-tall horizontal slice through the middle of the picture,
          so the trophy the owner asked to keep would have been reduced to a band of glare.

          So the picture is drawn at 300px tall inside a 330px window anchored to the right
          edge, which crops it horizontally to roughly its right half - the part carrying the
          trophy and the pot - at a size a player can actually read. It still bleeds to the
          edges, and the gradient below feathers its left side into the panel so the banner
          reads as one continuous graphic rather than as a picture in a box.

          Decorative, so it is `aria-hidden` with an empty alt: the heading beside it carries
          the meaning. A plain `<img>` because an operator's banner is served by an API route
          with a database fallback - see `ArenaIdentity`.
        */}
        {/*
          A DIM COPY ACROSS THE WHOLE BANNER FIRST, so the background is the game's rather than
          flat navy - the owner's "one continuous graphic". Heavily scrimmed, because this pass
          sits under the copy and the only thing a scrim MUST guarantee is that white text on
          an arbitrary uploaded picture stays legible. That guarantee cannot depend on which
          image arrives, which is why the left edge is fully opaque.

          FIRST IN THE DOM, AND THAT IS LOAD-BEARING. Both passes are absolutely positioned
          siblings with no z-index between them, so they paint in document order: written the
          other way round this full-width wash covers the right-hand piece and the trophy
          disappears behind a 40%-opacity version of itself - which looks like a dim banner
          rather than like a layer in the wrong order.
        */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.src}
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070C1A] via-[#070C1A]/85 to-[#070C1A]/60" />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[330px] overflow-hidden xl:block"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.src}
            alt=""
            className="absolute right-0 top-[52%] h-[300px] w-auto max-w-none -translate-y-1/2"
          />
          {/*
            Feathered from the left, because the copy stops at this window's edge and a hard
            seam between panel and picture is the thing that makes artwork look pasted on. It
            is opaque where it meets the text and clear at the outer edge, so nothing is
            written over paint and nothing hides the trophy.
          */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#070C1A] via-[#070C1A]/40 to-transparent" />
        </div>

        <div className="relative px-4 py-3 sm:h-[118px] sm:px-[18px] sm:py-2">
          <ArenaIdentity
            presentation={presentation}
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
        THE REFERENCE'S BOTTOM INFORMATION STRIP: three compact cards in one row, the whole
        band about 100px tall.

        THE MEASUREMENT IS THE SPECIFICATION, and it is the only reason this comment is long.
        The owner supplied the reference at 986 x 103 and rejected the first build for
        stretching to 600-plus - "three large dashboard cards" instead of a thin bar - so the
        height here is fixed rather than derived. It does NOT scale with the viewport: a wider
        screen makes the cards wider and must not make them taller, or the strip becomes a
        section again at 1440px while measuring correctly at 986.

        104px IS ARRIVED AT, NOT CHOSEN, and the working is worth keeping because the first
        attempt at 96 was wrong in a way nothing would have reported. A card is the band less
        its 30px heading strip, so 96 left 66px of body - and the owner also specified the
        pictures at 65-75px. `NeonIllustration` derives its height from its WIDTH through an
        aspect ratio, so a 66px-wide square is 66px tall in a body that, after padding, had
        49: it would have been silently cropped by the `overflow-hidden` backstop, on the two
        acceptance points that ask whether the pictures are there. 104 gives 74px of body,
        which fits a 66px picture, three 24px feed rows, and the owner's own 95-115 range.

        WHICH MEANS THE CARDS CANNOT GROW, so what goes in them is capped rather than
        wrapped. Each panel takes the reference's own count - three steps, four tips, three
        players - and clamps every line to one, with the full text on a tooltip and the
        uncapped version on the lobby. `overflow-hidden` is a backstop, not the mechanism;
        relying on it alone is how content disappears with nothing on screen to say so.

        STILL `flex-wrap`, NOT `grid-cols-3`, AND THAT IS A DELIBERATE DEVIATION FROM THE
        OWNER'S CSS - which asked for `grid-template-columns: 1.15fr 1.15fr 1fr`. The
        proportions are identical: `flex-[1.15_1_0]` twice and `flex-[1_1_0]` once divides the
        row 34/34/32 exactly as those tracks do. What differs is the empty case, and it is the
        common one. All three slots render NOTHING when their content is absent - a title with
        no rules text, no feature cards written, or a contest nobody has played yet - and a
        layout cannot see that its child returned `null`. A hidden GRID item leaves its track
        behind, so the first attempt at this band put one panel adrift in an empty row; a
        hidden FLEX item leaves the line, and `:empty` is how CSS sees what React cannot. The
        one or two cards that do have content then grow to fill the row.

        `min-w-[260px]` IS WHAT STACKS IT ON A PHONE AND NOT ON A DESKTOP. Three cards at
        260 plus two 10px gaps needs 800px, so the row survives every width the owner called
        desktop and wraps below it - which is the responsive rule stated as a measurement
        instead of a breakpoint that has to agree with one.

        `[&>*]:h-full` IS WHAT MAKES THEM LEVEL. The wrappers already stretch - that is the
        flex default - so they were the same height all along; what differs is the PANEL
        inside each one, which sizes to its own text and leaves the rest of its stretched
        wrapper empty. It belongs here rather than in the three panels because two of them
        are also rendered in the lobby, where a forced full height would stretch one card to
        the length of a whole column.
      */}
      <div className="mt-4 flex flex-wrap items-stretch gap-2.5 sm:h-[104px]">
        <div className="min-w-[260px] flex-[1.15_1_0] empty:hidden [&>*]:h-full">
          {rules}
        </div>
        <div className="min-w-[260px] flex-[1.15_1_0] empty:hidden [&>*]:h-full">
          {highlights}
        </div>
        <div className="min-w-[260px] flex-[1_1_0] empty:hidden [&>*]:h-full">
          {activity}
        </div>
      </div>

      <p className={`mt-5 text-center ${NEON_LABEL}`}>
        Scores are reported by the game and settled by ChartVolt.
      </p>
    </div>
  );
}
