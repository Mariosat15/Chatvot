"use client";

import { Hourglass } from "lucide-react";
import { useServerClock } from "@/hooks/useServerClock";
import { NEON_LABEL } from "@/components/neon/tokens";

/**
 * How long until this competition or challenge closes, on the arena beside the board.
 *
 * It counts to `playWindowEnd`, the moment the server stops accepting play, and it ticks on
 * the SERVER's clock (`useServerClock`), because that is the clock which actually ends the
 * contest - a visitor's own clock would show a different end on any machine that is off.
 *
 * An absent or unparseable end renders nothing rather than a guessed deadline.
 */
export function formatEndsIn(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

interface Props {
  endsAt?: string;
  serverNow: string;
  /** "competition" or "challenge" - only the wording changes. */
  noun: string;
}

export default function ArenaEndsIn({ endsAt, serverNow, noun }: Props) {
  const now = useServerClock(serverNow);
  const end = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  if (Number.isNaN(end)) return null;

  const remaining = end - now;
  const ended = remaining <= 0;

  return (
    // Reason (16 Oct 2026): wrap on phone so the clock does not shove the label off, and
    // keep the figure at the same optical size as the label (was oversized vs "ends in").
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-3 py-2">
      <span className={`flex min-w-0 items-center gap-1.5 ${NEON_LABEL}`}>
        <Hourglass className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
        {ended ? `${noun} time is up` : `${noun} ends in`}
      </span>
      <span
        className={`shrink-0 font-mono text-sm font-bold tabular-nums sm:text-base ${
          ended ? "text-gray-400" : remaining < 60_000 ? "text-red-300" : "text-cyan-200"
        }`}
      >
        {ended ? "Settling" : formatEndsIn(remaining)}
      </span>
    </div>
  );
}
