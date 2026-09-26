import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NEON_PANEL_LIT } from "@/components/neon/tokens";
import { NeonGridBackdrop } from "@/components/neon/Cards";
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
  /**
   * Where the back link goes.
   *
   * A HREF RATHER THAN A CONTEST ID, because this layout now renders two kinds of contest: a
   * competition, whose lobby is `/competitions/[id]`, and a 1v1 challenge, whose lobby is
   * `/challenges/[id]`. Building the path here would mean the layout knowing which one it is
   * holding, which is one branch away from the game-specific knowledge this folder is
   * deliberately kept free of - the caller already knows, so the caller says.
   */
  backHref: string;
  /** What the back link calls the thing it returns to: a contest's name, or "the challenge". */
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
  /**
   * The whole leaderboard rail - tabs, filters, table and footer.
   *
   * THE PANEL'S CHROME USED TO BE COMPOSED HERE and it is not any more, since 11 September
   * 2026. The heading, the scope strip and the footer button were written in this file while a
   * separate consumer supplied the rows, so nothing owned the panel's height: a heading sized
   * to its text, a rows box capped at 460px and a footer at its content height, inside a grid
   * cell as tall as the game board. The owner's fifth reference calls the result "a small
   * player status card", and the empty area beneath it was this file's doing rather than the
   * board's.
   *
   * One component owns the panel now, so it can be `h-full` with one `flex-1` inside it. This
   * file's remaining job is the grid, and the stretch immediately below.
   */
  standings: ReactNode;
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
  /*
    THERE IS NO `activity` SLOT ANY MORE (owner, 25 September 2026: "the last part recent
    players remove and adjust the 2 on the left to fill the space"). It was the band's third
    card from 11 September. Nothing is lost by removing it: the same players, and what each
    has done, are on the leaderboard rail beside the board, which is where a player looks.
  */
}

export function GameArenaLayout({
  backHref,
  competitionName,
  presentation,
  banner,
  minParticipants,
  maxParticipants,
  stage,
  standings,
  sidebar,
  rules,
  highlights,
}: Props) {
  return (
    /*
      1720px, WIDENED FROM 1480 ON 25 SEPTEMBER 2026 ("increase the board size"). The board is
      width-bound - a taller game window only adds space around it - so the only way to draw a
      bigger board is a wider middle column, and on a wide monitor the old cap left that width
      unused at the page's sides. At 1480px and below nothing changes.
    */
    <div className="mx-auto max-w-[1720px] px-3 py-4">
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
        href={backHref}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {competitionName}
      </Link>

      {/*
        THE HERO IS ONE THIN BANNER AND ITS HEIGHT IS FIXED (owner instruction, 11 September
        2026: "far too tall and has unnecessary content/cards underneath", with 110-125px
        named as the range - then, on seeing 118, "the icons and info needs to be bigger and
        also the game logo bigger and also the info of the game must show - you may need to
        make the banner bigger").

        150 IS ARRIVED AT, NOT CHOSEN, which is the only way a second number is any better
        than the first. It is the badge, a 25px heading, the subtitle, the tagline and two
        lines of description at the sizes asked for - about 112px - plus the 16px of padding,
        with the logo at 120 inside the same box. Nothing in it is a guess about the copy.

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
          1350x150 panel shows a 20%-tall horizontal slice through the middle of the picture,
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
          <div className="absolute inset-0 bg-gradient-to-r from-[#06122c] via-[#0a1d45]/80 to-[#2a0a4a]/55" />
        </div>

        {/*
          RIGHT-HAND ART FILLS THE WINDOW, never an oversized free-floating bitmap.
          Owner 26 Sep 2026: the previous `h-[300px]` piece was clipped mid-trophy by the
          panel's `overflow-hidden`, which read as "the banner is cutoff". `object-cover` +
          `object-right` keeps the trophy side inside the box; a light left feather still
          joins copy to picture without eating the right edge.
        */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[360px] overflow-hidden xl:block"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070C1A] via-[#070C1A]/35 to-transparent to-55%" />
        </div>

        {/*
          220px since 26 Sep 2026 — bigger logo track (owner green mark) needs the ceiling
          raised; still fixed, never min-height (arena-hero.test.ts).
        */}
        <div className="relative px-4 py-3 sm:h-[220px] sm:px-[18px] sm:py-3">
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
      {/*
        THE FACTS COLUMN IS 340px, WIDENED FROM 300 ON 25 SEPTEMBER 2026: at 300 the stat
        tiles cut their own labels ("ROUND TI...", "YOUR SCO..."). The standings rail gave
        40px back (340 to 300) so the board's column is not narrowed to pay for it.
      */}
      {/*
        `items-stretch` FROM `xl` UP so the standings rail and the board window grow to match
        the prize sidebar's height (owner screenshot, 25 Sep 2026: green arrows marking empty
        navy under the leaderboard CTA and under Submit). `items-start` left those cells short
        while the row was still as tall as the sidebar, which is exactly the void he marked.

        The standings list keeps its own `overflow-y-auto` - that is the only scroller when the
        roster is long. The page still scrolls for the band below; do not reintroduce a
        viewport max-height on the rail that short-circuits the stretch.
      */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
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
        {/*
          `[&>*]:h-full` reaches the panel; a bare `h-full` on this wrapper is a no-op on a
          stretched grid item (s4.1t / s4.1y). No viewport max-height - that was what left the
          green-marked gap under the CTA while the prize column kept growing.
        */}
        <div className="order-2 min-h-0 lg:order-3 xl:order-1 xl:[&>*]:h-full">
          {standings}
        </div>

        {/*
          A COLUMN FROM `xl` UP, so the game window fills the stretched row via `flex-1` on
          the frame. `h-full` + `min-h` together: the floor keeps a short Resume usable; the
          stretch fills the void under Submit when the prize sidebar is taller.
        */}
        <div className="order-1 min-h-0 lg:order-1 xl:order-2 xl:flex xl:h-full xl:min-h-[min(70dvh,720px)] xl:flex-col">
          {stage}
        </div>

        {/*
          PRIZE COLUMN STRETCHES TO THE BOARD'S BOTTOM (owner green arrow, 26 Sep 2026).
          `xl:h-full` matches the standings/stage stretch; the last sidebar child (prize
          breakdown) is the only `flex-1` so contest facts stay their natural height and the
          prize panel's foot lines up with Submit / the board frame.
        */}
        <div className="order-3 flex flex-col gap-3 lg:order-2 xl:order-3 xl:h-full xl:min-h-0 [&>*:last-child]:xl:flex-1 [&>*:last-child]:xl:min-h-0">
          {sidebar}
        </div>
      </div>

      {/*
        THE REFERENCE'S BOTTOM INFORMATION STRIP: two compact cards in one row after Recent
        players was removed (25 Sep 2026).

        300px SINCE 25 SEPTEMBER 2026 (third raise the same day). 200 still clipped How it
        works / Game tips after tips grew icons + title + detail - the owner's "cutoff"
        screenshot. Fixed height stays; content still cannot turn the strip into a section.
      */}
      {/*
        Rules / tips sit quieter than the board stage (26 Sep 2026 hierarchy pass). Opacity on
        the wrappers, not inside the panels — lobby callers of the same panels stay full-bright.
      */}
      <div className="mt-3 flex flex-wrap items-stretch gap-2.5 overflow-hidden opacity-85 has-[>:not(:empty)]:sm:h-[300px] [:not(:has(>:not(:empty)))]:hidden">
        <div className="min-w-[260px] flex-[1_1_0] empty:hidden [&>*]:h-full">
          {rules}
        </div>
        <div className="min-w-[260px] flex-[1_1_0] empty:hidden [&>*]:h-full">
          {highlights}
        </div>
      </div>
    </div>
  );
}
