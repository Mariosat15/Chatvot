"use client";

import CountdownPanel from "@/components/competitions/CountdownPanel";
import { useServerClock } from "@/hooks/useServerClock";

/**
 * "Round closes in" - the second clock, shown once a player has a round running.
 *
 * It counts to the round's `expiresAt`, the server's hard deadline after which the round can
 * no longer be played or reported. The game's own clock inside the frame may finish sooner
 * (it counts the configured playing time; `expiresAt` adds headroom for the frame loading),
 * so this states when the round CLOSES, never how long the player has left to score.
 *
 * Reason it reads its own server clock rather than taking `now` as a prop: the host renders the
 * game frame beside it, and a once-a-second re-render belongs to this panel, not to the frame.
 */
export function RoundCloseClock({
  expiresAt,
  serverNow,
}: {
  expiresAt: string | null | undefined;
  serverNow: string;
}) {
  const now = useServerClock(serverNow);
  const endMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (Number.isNaN(endMs) || endMs <= now) return null;

  return (
    <CountdownPanel
      remainingMs={endMs - now}
      label="Round closes in"
      variant="end"
      size="showcase"
    />
  );
}
