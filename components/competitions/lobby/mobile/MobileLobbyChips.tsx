"use client";

import { useState } from "react";

/**
 * Compact jump chips (mobile fix guide, point 6) - replaces the arrow tab strip.
 *
 * Every block is on the page in one vertical flow; a chip only scrolls to its block. The chips
 * WRAP rather than scroll sideways, so none can be cut off at the screen edge, and there are
 * no arrow buttons taking a third of the row.
 */

export type MobileLobbyChip = { id: string; label: string };

export function MobileLobbyChips({ chips }: { chips: MobileLobbyChip[] }) {
  const [active, setActive] = useState(chips.at(0)?.id ?? "");

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label="Jump to section" className="flex min-w-0 flex-wrap gap-2">
      {chips.map((chip) => {
        const selected = chip.id === active;
        return (
          <button
            key={chip.id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => jump(chip.id)}
            className={`min-h-9 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              selected
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                : "border-white/10 bg-white/[0.03] text-gray-300"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </nav>
  );
}
