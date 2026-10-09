"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";

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
 * Ticking "Starts in" / "Ends in" clock beside a card's tags.
 *
 * Reason: the first render shows a placeholder and the clock starts after
 * mount, so server and client markup agree (no hydration mismatch from two
 * different `Date.now()` values). Hidden once the moment has passed.
 */
export function CompetitionCountdown({
  kind,
  target,
}: {
  kind: "starts" | "ends";
  target: string;
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
    <span
      className={`inline-flex h-[30px] shrink-0 items-center gap-2 rounded-lg border px-2.5 ${
        starts
          ? "border-amber-400/60 bg-amber-500/15 shadow-[0_0_14px_rgba(255,176,32,.35)]"
          : "border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_14px_rgba(0,216,255,.35)]"
      }`}
    >
      <Image
        src={COMPETITION_ICON.clock}
        alt=""
        width={20}
        height={20}
        className="size-5 object-contain"
      />
      <span
        className={`text-[9px] font-bold uppercase leading-none tracking-[0.08em] ${
          starts ? "text-amber-200" : "text-cyan-200"
        }`}
      >
        {starts ? "Starts in" : "Ends in"}
      </span>
      <span className="font-mono text-[14px] font-black leading-none tabular-nums text-white">
        {ms === null ? "--:--:--" : formatRemaining(ms)}
      </span>
    </span>
  );
}
