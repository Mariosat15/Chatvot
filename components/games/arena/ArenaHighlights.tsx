import {
  Check,
  Crown,
  Flame,
  Lightbulb,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonHeadedPanel, NeonIllustration } from "@/components/neon/Cards";

/**
 * The operator's "why this game is fun" cards along the bottom of the arena.
 *
 * RENDERS NOTHING WHEN THERE ARE NONE, and that is the important behaviour. This is content
 * an operator writes per title; a game whose copy has not been written yet must not show four
 * empty cards, and it must not show invented ones either. An absent row reads as a spare
 * design. A row of placeholders reads as a bug, and a row of generic filler teaches players
 * to ignore the whole strip.
 *
 * Nothing here is per-game code - it is a list from the catalogue row, so a new title's cards
 * appear with no change to this file.
 *
 * THE HEADING IS `GAME TIPS` SINCE 11 SEPTEMBER 2026, AND THAT REVERSES A RECORDED DECISION
 * rather than settling an open question, so it is worth the paragraph. This panel deliberately
 * said `What to expect`: the lines are the operator's "why this game is fun" cards, and heading
 * marketing copy as advice is a caption making a claim the content does not keep. The owner
 * asked for `GAME TIPS` twice, in the reference and then by name, and overrode it - reasonably,
 * because the field is free text the operator owns, so a heading that says `GAME TIPS` is an
 * instruction to whoever writes the next title's copy as much as a label on this one. The cost
 * is real while the seeded copy is still marketing: the three cards on `circuit-sprint` read as
 * promises, not as advice, until an operator rewrites them in the content dialog. Recorded in
 * `13` s4.1u rather than by quietly editing the note that argued the other way.
 *
 * THERE IS NO `layout` PROP, and there was one for an afternoon. The full-width `row` variant
 * had no caller at all once the band existed - the lobby renders the rules panel and no
 * highlights - so it was deleted rather than left as an invitation, on the `shouldBlockEntry`
 * and `requiresSyncPlay` precedent. A `layout?: "strip"` narrowed down to one value then sat
 * declared and ignored, which is the declared-written-dead shape one prop along.
 */

interface Props {
  highlights: { title: string; detail: string }[];
  /**
   * The operator's emblem for this title, drawn beside the tips on the `strip` layout.
   *
   * OPTIONAL AND NORMALLY ABSENT - no title in the catalogue carries one - so the panel
   * draws the crown emblem instead rather than leaving the space empty. See
   * `NeonIllustration`.
   */
  imageUrl?: string;
}

/**
 * How many ticked lines the card draws.
 *
 * FOUR, BECAUSE FOUR IS WHAT FITS - the same arithmetic as the rules card's three steps, one
 * row cheaper because a tip has no numbered disc to set its height. The band is a fixed-height
 * row (see `GameArenaLayout`), so a fifth line does not shrink the type; it falls off the
 * bottom of a card that cannot grow.
 *
 * AND `CONTENT_LIMITS.highlights` IS SIX, SO THE LAST TWO ARE NOT DRAWN ANYWHERE. That is
 * worth stating rather than leaving as an arithmetic coincidence for somebody to find: this
 * is the only screen that renders highlights at all, the full-width `row` layout having been
 * deleted with this change because nothing had called it since the band was built. The admin
 * content dialog says so beside the field, which is the one place an operator can act on it.
 */
const STRIP_TIP_LIMIT = 4;

/**
 * One distinct icon per tip slot so the list reads as four different points rather than four
 * identical checkmarks. Indexed by position, never by title text - titles are operator free
 * text and matching nouns would be per-game code in the layer built to avoid it.
 */
const TIP_ICONS: LucideIcon[] = [Zap, Trophy, Timer, Target, Flame, Check];

export function ArenaHighlights({ highlights, imageUrl }: Props) {
  if (highlights.length === 0) return null;

  return (
    <NeonHeadedPanel icon={Lightbulb} title="Game tips">
      <div className="flex h-full items-center gap-3 px-3 py-2.5">
        <ul className="min-w-0 flex-1 space-y-3">
          {highlights.slice(0, STRIP_TIP_LIMIT).map((highlight, index) => {
            // Reason: `index` is from a capped slice, never from input.
             
            const Icon = TIP_ICONS[index % TIP_ICONS.length] ?? Check;
            return (
              <li key={highlight.title} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/45 bg-amber-300/15 text-amber-200"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>
                {/*
                  BIGGER TYPE SINCE 25 SEPTEMBER 2026 (owner: "the game tips wording must be
                  more big to take more space and also have icons"). Title + detail both show
                  so the card fills its height instead of leaving empty navy beside the emblem.
                */}
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-snug text-gray-50">
                    {highlight.title}
                  </span>
                  {highlight.detail ? (
                    <span className="mt-0.5 block text-[13px] leading-snug text-gray-300 line-clamp-2">
                      {highlight.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {/*
          THE EMBLEM IS BESIDE THE LINES. `shape="fill"` takes the body's full height and its
          width from the picture's own proportions, capped at half the card so the tips keep
          their room (25 September 2026).
        */}
        <div className="hidden max-w-[50%] shrink-0 self-stretch sm:flex sm:justify-end">
          <NeonIllustration
            src={imageUrl}
            alt="This game's emblem"
            icon={Crown}
            accent="prize"
            shape="fill"
            fit="contain"
          />
        </div>
      </div>
    </NeonHeadedPanel>
  );
}
