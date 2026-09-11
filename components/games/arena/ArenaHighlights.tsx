import { Check, Lightbulb, Zap } from "lucide-react";
import { NEON_PANEL } from "@/components/neon/tokens";
import { IconTile, NeonHeadedPanel } from "@/components/neon/Cards";

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
 */

interface Props {
  highlights: { title: string; detail: string }[];
  /**
   * `list` is the reference's bottom-band panel: a headed box of ticked lines, one per card.
   * `row` is the full-width strip of cards this used to be, kept for the lobby.
   *
   * THE HEADING NAMES WHAT THE CONTENT IS, NOT WHAT THE REFERENCE CALLS IT. The mock's middle
   * panel is headed `GAME TIPS`, and these are not tips - they are the operator's "why this
   * game is fun" cards, which is why the shape is copied and the word is not. A caption is a
   * claim: heading marketing copy as advice tells a player these lines will help them play,
   * and the catalogue has no field that would. There is nothing to read them from.
   */
  layout?: "row" | "list";
}

export function ArenaHighlights({ highlights, layout = "row" }: Props) {
  if (highlights.length === 0) return null;

  if (layout === "list") {
    return (
      <NeonHeadedPanel icon={Lightbulb} title="What to expect">
        <ul className="space-y-3 p-4">
          {highlights.map((highlight) => (
            <li key={highlight.title} className="flex gap-2.5">
              {/*
                The reference's tick, and it is `aria-hidden` with the text carrying the
                meaning - a checklist glyph beside a sentence says nothing a screen reader
                needs, and read aloud it would imply the player has done something.
              */}
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                aria-hidden
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-100">
                  {highlight.title}
                </div>
                <div className="text-xs leading-relaxed text-gray-500">
                  {highlight.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </NeonHeadedPanel>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {highlights.map((highlight) => (
        <div
          key={highlight.title}
          className={`${NEON_PANEL} flex items-center gap-3 px-4 py-3.5`}
        >
          {/*
            The kit's tile rather than a bare glyph, so this row reads as part of the same
            design as the contest panel above it. The reference gives every icon on the page
            a tinted rounded ground; a loose icon beside text is the one shape it never uses.
          */}
          <IconTile icon={Zap} accent="rate" size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-100">
              {highlight.title}
            </div>
            <div className="text-xs leading-relaxed text-gray-500">
              {highlight.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
