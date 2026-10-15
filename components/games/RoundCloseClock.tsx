"use client";

import { useEffect, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { roundCloseRemainingMs, serverDeadlineCutsRoundShort } from "./round-close-time";
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
 * Once the game reports its own clock (`gameEndsAtMs`, remembered per round by
 * `game-clock-memory`) this counts to exactly the moment the game's timer shows.
 *
 * 15 Oct 2026 (owner, screenshot with the tile reading the competition's 13:12): until the game
 * has reported its clock, the tile must NOT count to `expiresAt` - that deadline is capped at
 * the competition end, so on a resume screen it showed the competition's time, not the round's.
 * It shows the round length instead, and counts to `expiresAt` only when the competition ends
 * before a full round could, because then that IS when the round stops.
 */
export function RoundTimeValue({
  fallback,
  roundSeconds,
}: {
  fallback: string;
  roundSeconds?: number | null;
}) {
  const fact = useRoundClock();
  if (!fact) return <>{fallback}</>;
  return <CountingRoundTime fact={fact} fallback={fallback} roundSeconds={roundSeconds} />;
}

function CountingRoundTime({
  fact,
  fallback,
  roundSeconds,
}: {
  fact: NonNullable<ReturnType<typeof useRoundClock>>;
  fallback: string;
  roundSeconds?: number | null;
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

  const expiresAtMs = fact.expiresAt ? Date.parse(fact.expiresAt) : Number.NaN;
  if (
    !followsGame &&
    !serverDeadlineCutsRoundShort(expiresAtMs - serverNowMs, roundSeconds)
  ) {
    return <>{fallback}</>;
  }

  const remainingMs = roundCloseRemainingMs({
    expiresAtMs,
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
