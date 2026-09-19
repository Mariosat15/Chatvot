import { BookOpen, Target } from "lucide-react";
import { NeonHeadedPanel, NeonIllustration } from "@/components/neon/Cards";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";

/**
 * The operator's rules for a game title, on the two screens a player reads before and while
 * they play.
 *
 * WHY IT EXISTS. `provider_game.rulesSummary` and `howToPlay` are contractual - `01` section
 * 3.1 requires both of every provider - and R63 made the catalogue sync actually store them
 * on 10 September 2026, after a parse bug had been discarding them. They were then read by
 * nothing: `getGamePresentation` did not select either field, so a paying player could see
 * the pot, the entry fee, the clock and the leaderboard and never be told what a winning
 * score was. The owner reported it the next day.
 *
 * ONE DEFINITION, TWO SCREENS, and the negative half of the guard is the load-bearing one: a
 * test asserts this file's headings appear in NO consumer, because a screen that imports the
 * panel and then hand-rolls a rules block beside it satisfies any check that the import
 * exists. Same rule as `components/neon/` and `components/competitions/PrizeTable.tsx`.
 *
 * THE SCORING RULE IS GIVEN THE PROMINENCE, NOT THE CONTROLS, and that is a deliberate
 * ordering rather than a layout preference. How to draw a path is discoverable by trying;
 * whether an unfinished board scores nothing, or whether the LOWEST total wins, is not - and
 * on a lower-is-better title a player who assumes the usual direction plays to lose while
 * every screen looks correct. It is also the sentence that decides a prize, which is why the
 * content assistant is barred from writing it (`AI_NEVER_WRITABLE_CONTENT_FIELDS`).
 *
 * NOT `"use client"`. It renders text and no interactivity, so it stays a server component -
 * which keeps it out of the browser bundle and away from R58's model-import hazard entirely.
 *
 * NOT MIRRORED. `apps/admin` has no player screen; the operator edits this content through
 * `GameContentDialog.tsx`, which is a different surface with a different job.
 */

interface Props {
  /**
   * Read straight off the presentation rather than as two loose strings, so a caller cannot
   * pass the description where the rules belong. Both fields are optional on that shape and
   * must stay so - a title synced before they existed carries neither.
   */
  presentation: Pick<
    GamePresentation,
    "rulesSummary" | "howToPlay" | "gameName" | "howToPlayImageUrl"
  >;
  /**
   * Which of the two screens this is.
   *
   * `wide` IS THE LOBBY'S FULL PANEL - the scoring rule, the instructions and the diagram in
   * one row. `strip` IS THE ARENA'S BOTTOM BAND, which is a different panel rather than a
   * narrower one; see `STRIP_STEP_LIMIT` below for what it drops and why that is safe.
   *
   * THERE WAS A THIRD, `column`, AND IT WAS DELETED ON 11 SEPTEMBER 2026. It was the default
   * and no caller ever passed it, so it was a stacked layout nobody could see - the
   * declared-written-dead shape, and the same reason `ArenaHighlights` lost its `list`
   * variant the same day. Required rather than defaulted for the same reason: a default is
   * how a fourth unreachable branch arrives.
   */
  layout: "wide" | "strip";
}

/**
 * How many numbered steps the compact strip draws.
 *
 * THREE, BECAUSE THREE IS WHAT FITS, and saying that plainly matters more than the number.
 * The owner's reference measures 986 x 103 for the whole band, so a card is about 96px: a
 * dense heading strip is 26 of those and three 22px rows are the remaining 70. A fourth step
 * does not shrink the type, it falls off the bottom of a `overflow-hidden` card - which is
 * content vanishing with nothing on screen to say so, the failure this codebase keeps
 * finding. So the cap is explicit, it is asserted by a test, and the overflow rule is there
 * only as a backstop for a step long enough to wrap.
 *
 * NOTHING IS UNREACHABLE BECAUSE OF IT. The lobby renders this same panel at `column`, with
 * every step and the scoring rule in full, and a player reaches the lobby before they can
 * reach the arena - the dashboard's contest cards deliberately link there rather than to
 * `/play`, because launching a round spends an attempt. The strip is a reminder beside a
 * board, not the only place the rules exist.
 */
const STRIP_STEP_LIMIT = 3;

/**
 * Paragraphs from free text.
 *
 * Reason: both fields are 2,000-character operator-editable textareas, so an operator who
 * presses Return expects a break. Rendered as one block, their paragraphs run together into a
 * wall - and the provider's own `howToPlay` arrives as four joined sentences, which is
 * legitimately one paragraph. Splitting on blank-or-single newlines serves both without the
 * panel having to know which kind of text it was handed.
 *
 * `white-space: pre-wrap` was the alternative and is worse: it preserves the incidental
 * wrapping of whatever the operator's textarea was doing at the width they typed it.
 */
function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function GameRulesPanel({ presentation, layout }: Props) {
  const scoring = presentation.rulesSummary?.trim();
  const playing = presentation.howToPlay?.trim();

  /*
   * Both absent renders NOTHING, never an empty panel with a heading.
   *
   * This is the rule `GamePresentation`'s own header states: a screen printing an empty slot
   * where copy would go tells a player the game has no rules, which is worse than a screen
   * that says less. It is also the live state of every title synced before R63 and of every
   * provider registered but not yet re-synced, so it is the common case rather than an edge.
   */
  if (!scoring && !playing) return null;

  if (layout === "strip") {
    return (
      <RulesStrip
        text={playing || scoring || ""}
        imageUrl={presentation.howToPlayImageUrl}
        gameName={presentation.gameName}
      />
    );
  }

  return (
    /*
      THE HEADED SHELL SINCE 11 SEPTEMBER 2026, and the swap is the owner's "the graphics are
      not like the design" in its smallest form: every panel in the reference carries its
      heading in a tinted strip running edge to edge, and this one wore the quieter padded
      shell - so the one panel a player most needs to read looked like the least important
      thing on the page.

      THE HEADING DROPPED THE GAME'S NAME ON 11 SEPTEMBER 2026, on the owner's "do it like the
      other you fixed", and it is a defect fix rather than a preference. `gameName` is an
      operator-editable display name, and the live one is `Circuit Sprint: Fast and Fun
      Spatial Puzzles` - so the template produced a heading that ran the width of the page and
      said almost nothing. Interpolating a free-text field of unbounded length into a sentence
      is the fault; any title with a subtitle in its name reproduces it. Now one heading for
      both screens, which is also one fewer thing that can differ between them. The name is
      still on the picture's `alt`, where a length is harmless.
    */
    <NeonHeadedPanel icon={BookOpen} title="How it works" bodyClassName="p-4">
      {/*
        ONE ROW, NOT A GRID OF STACKED BLOCKS, which is the owner's correction applied to the
        lobby after the arena band. The two-column grid put the scoring rule in one cell and
        the instructions plus a full-width picture in the other, so the panel was as tall as
        its tallest cell and the short one was a column of empty space beside a hero image.
        Side by side the panel is only as tall as the copy inside it.
      */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {scoring && (
          /*
           * THE STANDOUT BLOCK. An amber rule and a tinted ground, because the owner's report
           * was that the rules are invisible and a paragraph of grey body text among six other
           * panels is invisible in the way that matters. The larger type is on this block only;
           * giving both the same weight is how a page ends up with no emphasis at all.
           */
          <div className="rounded-lg border-l-2 border-amber-400/70 bg-amber-400/[0.07] p-3 md:flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-semibold text-amber-200">
                How you win
              </h3>
            </div>
            {paragraphs(scoring).map((line, index) => (
              <p
                key={index}
                className="text-sm leading-relaxed text-amber-50/90 [&+p]:mt-2"
              >
                {line}
              </p>
            ))}
          </div>
        )}

        {playing && (
          <div className="flex min-w-0 items-start gap-4 md:flex-1">
            <div className="min-w-0 flex-1">
              <HowToPlay text={playing} />
            </div>

            {/*
              THE ILLUSTRATION SITS WITH THE STEPS, NOT WITH THE SCORING RULE, and that is
              an ordering decision rather than a layout one. The amber block is the sentence
              that decides a prize and it is deliberately the loudest thing in the panel; a
              picture beside it competes with the one line a player must read. The steps are
              the half a picture actually helps with, which is also what the owner's
              reference shows.

              BOTH LAYOUTS DRAW IT. The arena's band panel is the one the owner's reference
              shows and it is the narrower of the two, so gating this on the wide layout
              would have left the picture off the only screen it was asked for - which is
              the kind of condition that reads as careful and delivers nothing.

              BESIDE THE TEXT AND CAPPED, since 11 September 2026. It was drawn BELOW the
              instructions at the cell's full width, and the cell was half a two-thirds
              column - so the operator's small graphic became a 300px hero and the panel grew
              a screen taller to hold it, which is the arena band's rejection one page along.
              `w-[132px]` at 4/3 is 99px tall: a width and never a height, because
              `NeonIllustration` derives one from the other and two numbers beside one aspect
              ratio disagree the moment either moves.

              `contain`, NOT THE DEFAULT `cover`, for the same reason the band uses it: these
              two uploads are graphics rather than photographs, so a crop takes the corners
              off a badge. `cover` stays the kit's default because the slots that came first
              are a logo and a hero banner.
            */}
            <div className="hidden w-[132px] shrink-0 sm:block">
              <NeonIllustration
                src={presentation.howToPlayImageUrl}
                alt={`How ${presentation.gameName} is played`}
                icon={BookOpen}
                accent="players"
                shape="landscape"
                fit="contain"
              />
            </div>
          </div>
        )}
      </div>
    </NeonHeadedPanel>
  );
}

/**
 * The arena band's `HOW IT WORKS` card: a fixed-height panel of numbered steps with the
 * operator's diagram beside them.
 *
 * WHY IT IS HERE AND NOT IN `components/games/arena/`. The steps are the operator's own
 * sentences about their own game, so the file that renders them is the file that owns this
 * content - and a test forbids the arena folder from containing a game-shaped sentence in a
 * quoted string, which is exactly what a hard-coded "Connect matching numbers with a path"
 * would be. The heading is the only words this component writes, and it names no game.
 *
 * THE HEADING NAMES NO GAME, AND SINCE 11 SEPTEMBER 2026 NEITHER DOES THE FULL PANEL'S. This
 * sentence used to end "the lobby's panel still names the game, where there is room for it
 * and where a player is deciding whether to pay", and the owner's screenshot of that panel is
 * what disproved it: `How Circuit Sprint: Fast and Fun Spatial Puzzles is scored` ran the
 * width of the page and said almost nothing, because `gameName` is free text of unbounded
 * length and this title carries its tagline inside it. Both screens now read `How it works`.
 *
 * THE SCORING RULE IS NOT DRAWN HERE, on the owner's instruction of 11 September 2026, and
 * that is the one thing about this card worth checking before changing it. It is the sentence
 * that decides a prize and it is deliberately the loudest thing in the full panel - see the
 * note on that block - so removing it from a screen is a decision rather than a tidy-up. What
 * makes it safe is the lobby: every route into the arena passes through it, and it carries
 * the rule in full. What makes it a cost is that a player halfway through a contest cannot
 * re-read the rule without leaving the board. The compact fallback below is why the panel is
 * not silent when a title has a scoring rule and no instructions.
 */
function RulesStrip({
  text,
  imageUrl,
  gameName,
}: {
  text: string;
  imageUrl?: string;
  gameName: string;
}) {
  const steps = paragraphs(text).slice(0, STRIP_STEP_LIMIT);

  return (
    <NeonHeadedPanel icon={BookOpen} title="How it works" dense>
      <div className="flex h-full items-center gap-2.5 px-2.5 py-1">
        <ol className="min-w-0 flex-1 space-y-1">
          {steps.map((step, index) => (
            <li key={index} className="flex items-center gap-2">
              {/*
                The reference's small blue numbered disc. `aria-hidden` because the ordinal is
                already carried by the `<ol>`, and read aloud it would announce every step
                twice.
              */}
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-[9px] font-bold text-cyan-300"
                aria-hidden
              >
                {index + 1}
              </span>
              {/*
                ONE LINE PER STEP, with the whole sentence on the element's `title`. A step
                that wraps pushes the one below it out of a card that cannot grow, so the
                clamp is what keeps three steps visible - and the tooltip is what keeps a long
                one recoverable rather than merely cut. The lobby has it in full either way.
              */}
              <span
                className="truncate text-[10px] leading-tight text-gray-300"
                title={step}
              >
                {step}
              </span>
            </li>
          ))}
        </ol>

        {/*
          THE DIAGRAM IS BESIDE THE STEPS AND SMALL, which is the correction the owner asked
          for: it was drawn beneath them at the panel's full width, so a card meant to be a
          thin strip became a 600px column with a hero image in it. Fixed at 66px rather than
          a percentage, because a proportion of a flexible column is how it grew in the first
          place - and 66 is the owner's 65-75 met at the largest size the band's body has
          room for.

          THE WIDTH IS THE SIZE. `NeonIllustration` is `aspect-square`, so it takes its height
          from its width - which is why this is `w-[66px]` and not a height, and why the band
          had to be 104px rather than 96 for the number the owner asked for to fit at all.
        */}
        <div className="hidden w-[66px] shrink-0 sm:block">
          <NeonIllustration
            src={imageUrl}
            alt={`How ${gameName} is played`}
            icon={BookOpen}
            accent="players"
            fit="contain"
          />
        </div>
      </div>
    </NeonHeadedPanel>
  );
}

/**
 * The operator's instructions, numbered when they wrote them as steps.
 *
 * THE STEPS ARE THE OPERATOR'S PARAGRAPH BREAKS AND NOTHING ELSE. The reference draws a
 * numbered list, and the tempting way to produce one is to split on sentences - which would
 * invent a step boundary in the middle of the operator's meaning and number four clauses of
 * one instruction as four things to do. If they pressed Return, they meant a step; if they
 * did not, this renders the prose they wrote.
 *
 * SO THE COMMON CASE TODAY IS PROSE, and that is worth saying plainly rather than presenting
 * the numbered form as the normal one: `circuit-sprint`'s `howToPlay` is a single paragraph,
 * so it will render as a paragraph until somebody edits it in the content dialog. The list
 * appears the moment an operator writes one, with no code change - which is the point.
 */
function HowToPlay({ text }: { text: string }) {
  const steps = paragraphs(text);

  return (
    <div>
      <h3 className="mb-2.5 text-sm font-semibold text-gray-200">How to play</h3>

      {steps.length < 2 ? (
        <p className="text-sm leading-relaxed text-gray-400">{steps[0]}</p>
      ) : (
        <ol className="space-y-2.5">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-[11px] font-bold text-cyan-300"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-gray-400">
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
