import { Zap } from "lucide-react";
import { NEON_PANEL } from "@/components/neon/tokens";
import { IconTile } from "@/components/neon/Cards";

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
}

export function ArenaHighlights({ highlights }: Props) {
  if (highlights.length === 0) return null;

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
