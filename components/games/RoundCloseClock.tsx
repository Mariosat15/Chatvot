"use client";

import { useEffect, useState } from "react";
import CountdownPanel from "@/components/competitions/CountdownPanel";
import { useServerClock } from "@/hooks/useServerClock";
import { roundCloseRemainingMs } from "./round-close-time";

/** The game's own timer repaints four times a second; matching it needs the same cadence. */
const GAME_CLOCK_TICK_MS = 250;

/**
 * "Round closes in" - the second clock, shown once a player has a round running.
 *
 * Once the game reports its own clock (`gameEndsAtMs`), this counts to exactly the moment the
 * game's timer shows. Until then - before the player presses Start inside the frame, or for a
 * game that never sends a `clock` message - it falls back to `expiresAt`, the server's hard
 * close, which includes headroom for the frame loading and so reads a little longer.
 *
 * Reason it reads its own clocks rather than taking `now` as a prop: the host renders the game
 * frame beside it, and a re-render several times a second belongs to this panel, not the frame.
 */
export function RoundCloseClock({
  expiresAt,
  serverNow,
  gameEndsAtMs,
}: {
  expiresAt: string | null | undefined;
  serverNow: string;
  gameEndsAtMs?: number | null;
}) {
  const serverNowMs = useServerClock(serverNow);
  const followsGame = typeof gameEndsAtMs === "number";
  const [browserNowMs, setBrowserNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!followsGame) return;
    setBrowserNowMs(Date.now());
    const timer = setInterval(() => setBrowserNowMs(Date.now()), GAME_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [followsGame]);

  const remainingMs = roundCloseRemainingMs({
    expiresAtMs: expiresAt ? Date.parse(expiresAt) : Number.NaN,
    serverNowMs,
    gameEndsAtMs,
    browserNowMs,
  });
  if (remainingMs === null) return null;

  return (
    <CountdownPanel
      remainingMs={remainingMs}
      label="Round closes in"
      variant="end"
      size="showcase"
    />
  );
}
