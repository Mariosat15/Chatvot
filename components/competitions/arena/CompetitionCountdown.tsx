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
 * different `Date.now()` values). Hidden once the moment has passed.
 */
export function CompetitionCountdownDataBlock({
  kind,
  target,
  accent,
}: {
  kind: "starts" | "ends";
  target: string;
  accent: string;
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

  const end = new Date(target).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = now === null ? null : end - now;
  if (ms !== null && ms <= 0) return null;

  const starts = kind === "starts";
  return (
    <CompetitionInfoDataBlock
      icon={COMPETITION_ICON.clock}
      label={starts ? "Starts in" : "Ends in"}
      value={
        <span className="font-mono tabular-nums">
          {ms === null ? "--:--:--" : formatRemaining(ms)}
        </span>
      }
      explanation={
        starts
          ? "Time remaining until this competition starts."
          : "Time remaining until this competition ends."
      }
      accent={starts ? "#ffb020" : accent}
    />
  );
}
