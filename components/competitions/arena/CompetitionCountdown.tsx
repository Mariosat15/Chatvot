"use client";

import { useEffect, useState } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { CompetitionInfoDataBlock } from "./CompetitionInfoDataBlock";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${clock}` : clock;
}

/**
 * Ticking "Starts in" / "Ends in" clock in the card's data grid.
 *
 * Reason: the first render shows a placeholder and the clock starts after
 * mount, so server and client markup agree (no hydration mismatch from two
 * different `Date.now()` values). Once the moment passes it reads
 * "Starting now" / "Ending now" rather than disappearing.
 */
export function CompetitionCountdownDataBlock({
  kind,
  target,
  accent,
  className,
}: {
  kind: "starts" | "ends";
  target: string;
  accent: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  // Reason: the card's row packer already counted this box, so it must keep
  // its cell even when the moment passes (or the date is bad). Removing it
  // left a hole in the row until the page reloaded. Show the moment instead.
  const end = new Date(target).getTime();
  const ms = now === null || !Number.isFinite(end) ? null : end - now;
  const passed = ms !== null && ms <= 0;

  const starts = kind === "starts";
  let display = "--:--:--";
  if (passed) display = starts ? "Starting now" : "Ending now";
  else if (ms !== null) display = formatRemaining(ms);
  return (
    <CompetitionInfoDataBlock
      icon={COMPETITION_ICON.clock}
      label={starts ? "Starts in" : "Ends in"}
      value={
        // Reason: a slightly smaller clock (owner, 9 Oct 2026) so it never
        // crowds the boxes beside it; whitespace-nowrap keeps "1d 00:37:45" whole.
        <span className="whitespace-nowrap font-mono text-[12px] tabular-nums @[150px]:text-[13px]">
          {display}
        </span>
      }
      explanation={
        starts
          ? "Time remaining until this competition starts."
          : "Time remaining until this competition ends."
      }
      accent={starts ? "#ffb020" : accent}
      className={className}
    />
  );
}
