import { Check, Crown, Lightbulb } from "lucide-react";
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
 * row cheaper because a tip has no numbered disc to set its height. The band is a fixed 96px
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

export function ArenaHighlights({ highlights, imageUrl }: Props) {
  if (highlights.length === 0) return null;

  return (
    <NeonHeadedPanel icon={Lightbulb} title="Game tips" dense>
      <div className="flex h-full items-center gap-2.5 px-2.5 py-1">
        <ul className="min-w-0 flex-1 space-y-1">
          {highlights.slice(0, STRIP_TIP_LIMIT).map((highlight) => (
            <li key={highlight.title} className="flex items-center gap-1.5">
              {/*
                The reference's tick, in its gold rather than a green one. `aria-hidden` with
                the text carrying the meaning - a checklist glyph beside a sentence says
                nothing a screen reader needs, and read aloud it would imply the player has
                done something.
              */}
              <Check className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />
              {/*
                THE TITLE ALONE, WITH THE DETAIL ON THE TOOLTIP. Two lines per tip is what
                made this card 300px tall: four tips of two lines each is eight rows in a
                panel with room for four. The operator's headline IS the tip; the detail is
                the sentence that used to sit underneath it.
              */}
              <span
                className="truncate text-[10px] leading-tight text-gray-300"
                title={highlight.detail || highlight.title}
              >
                {highlight.title}
              </span>
            </li>
          ))}
        </ul>

        {/*
          THE EMBLEM IS BESIDE THE LINES AND SMALL, which is the correction the owner asked
          for: it was centred ABOVE them at 96px, so the card spent its whole height on a
          badge before the first tip. Landscape rather than square because the graphic this
          slot holds is wider than it is tall, and 82px fixed rather than a proportion of a
          flexible column - a percentage is how it grew the first time.
        */}
        {/*
          THE WIDTH IS THE SIZE, because `NeonIllustration` takes its height from its width -
          here through `aspect-[4/3]`, so 88px wide is 66px tall. That is the owner's
          85-105 by 65-80 met at the largest the band's 74px body has room for, and it is why
          a height is not written anywhere: a hard height beside an aspect ratio is two
          numbers that disagree the moment either moves.
        */}
        <div className="hidden w-[88px] shrink-0 sm:block">
          <NeonIllustration
            src={imageUrl}
            alt="This game's emblem"
            icon={Crown}
            accent="prize"
            shape="landscape"
            fit="contain"
          />
        </div>
      </div>
    </NeonHeadedPanel>
  );
}
