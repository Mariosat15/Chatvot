import { Crown, Lightbulb } from "lucide-react";
import { NeonHeadedPanel, NeonIllustration } from "@/components/neon/Cards";
import { resolveFeatureLucideIcon } from "@/components/games/resolve-feature-icon";

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
 * Icons come from optional `highlight.icon` (HERO_FEATURE_ICONS slugs) set on the Guides
 * tab; position-based fallbacks keep older tips looking the same when no icon is stored.
 */

interface Props {
  highlights: { title: string; detail: string; icon?: string }[];
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
 * Guides tab says so beside the field, which is the one place an operator can act on it.
 */
const STRIP_TIP_LIMIT = 4;

export function ArenaHighlights({ highlights, imageUrl }: Props) {
  if (highlights.length === 0) return null;

  return (
    <NeonHeadedPanel icon={Lightbulb} title="Game tips">
      <div className="flex h-full items-center gap-3 px-3 py-2.5">
        <ul className="min-w-0 flex-1 space-y-3">
          {highlights.slice(0, STRIP_TIP_LIMIT).map((highlight, index) => {
            const Icon = resolveFeatureLucideIcon(highlight.icon, index);
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
          their room (25 September 2026). The picture is absolute so it can never add height to
          the card (that is what cut the card's bottom off), so this slot is `relative` and sized.
        */}
        <div className="relative hidden w-[36%] shrink-0 self-stretch sm:block">
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
