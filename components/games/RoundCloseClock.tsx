"use client";

import { useEffect, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { roundCloseRemainingMs } from "./round-close-time";
import { useRoundClock } from "./round-clock-bus";
import { clock } from "./arena/arena-facts";

/** The game's own timer repaints four times a second; matching it needs the same cadence. */
const GAME_CLOCK_TICK_MS = 250;

/**
 * The "Round time" tile's value: the round's length until a round is running, then the time
 * left in it, counting down.
 *
 * 15 Oct 2026 (owner): the separate "Round closes in" panel under the competition clock was
 * removed - "just start reducing the time from the round time on the right". The round host
 * publishes the running round through `round-clock-bus`; nothing published means no round is
 * live and the tile shows the configured length.
 *
 * Once the game reports its own clock (`gameEndsAtMs`) this counts to exactly the moment the
 * game's timer shows. Until then it falls back to `expiresAt`, the server's hard close, which
 * includes headroom for the frame loading and so reads a little longer.
 */
export function RoundTimeValue({ fallback }: { fallback: string }) {
  const fact = useRoundClock();
  if (!fact) return <>{fallback}</>;
  return <CountingRoundTime fact={fact} fallback={fallback} />;
}

function CountingRoundTime({
  fact,
  fallback,
}: {
  fact: NonNullable<ReturnType<typeof useRoundClock>>;
  fallback: string;
}) {
  const serverNowMs = useServerClock(fact.serverNow);
  const followsGame = typeof fact.gameEndsAtMs === "number";
  const [browserNowMs, setBrowserNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!followsGame) return;
    setBrowserNowMs(Date.now());
    const timer = setInterval(() => setBrowserNowMs(Date.now()), GAME_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [followsGame]);

  const remainingMs = roundCloseRemainingMs({
    expiresAtMs: fact.expiresAt ? Date.parse(fact.expiresAt) : Number.NaN,
    serverNowMs,
    gameEndsAtMs: fact.gameEndsAtMs,
    browserNowMs,
  });
  // A deadline that has passed reads 0:00 rather than snapping back to the round length.
  if (remainingMs === null) {
    return <>{fact.expiresAt || followsGame ? "0:00" : fallback}</>;
  }

  return (
    <span className="tabular-nums text-amber-300">
      {clock(remainingMs / 1000) ?? "0:00"}
    </span>
  );
}
