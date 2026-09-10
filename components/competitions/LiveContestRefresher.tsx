"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the server's answer on a cadence while a contest is running, so a lobby's standings
 * stop being a photograph taken when the page happened to load.
 *
 * WHY THIS IS A REFRESH AND NOT A POLL OF A LEADERBOARD ENDPOINT. There is no player-facing JSON
 * API that returns a competition's ranking - `getCompetitionLeaderboard` is a server action, and
 * it is where the whole ranking rule lives: the score direction resolved from the catalogue, the
 * eligibility gate, the tie handling. Adding an endpoint means a second reader that can drift
 * from it, which is the shape behind `referenceId`, `failedReason`, `challengeId` and the Game
 * Master `||`, none of which `check:mirrors` can see. `router.refresh()` re-runs the page that
 * already calls it, so there is exactly one answer to "who is winning".
 *
 * It costs a whole server render rather than one query, which is the trade being made knowingly.
 * A lobby is not a hot path, the refresh is visibility-gated, and React preserves client state
 * across it - an open dialog stays open and a half-typed field keeps its text.
 *
 * DO NOT MOUNT THIS ON THE PLAY SCREEN. That page hosts the game in an iframe and owns its own
 * 20-second poll of `/rounds`, which updates the player's state without re-rendering the frame.
 * A timer calling `router.refresh()` underneath a live round is a way to disturb an attempt a
 * player has paid for, and the failure would be intermittent and unreproducible.
 */
interface LiveContestRefresherProps {
  /**
   * Whether the contest is currently running. Derived on the server from the stored status, never
   * from a clock in the browser: a contest whose end time has passed is still `active` until the
   * cron finalizes it, and a client that decided for itself would stop refreshing exactly when
   * the last scores are landing.
   */
  active: boolean;
  /**
   * Matches the trading workspace's live-ranking poll, deliberately. A game score changes when
   * somebody finishes a round, so a faster cadence buys nothing and a slower one makes a board
   * that is visibly behind the one on the play screen.
   */
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 15_000;

export default function LiveContestRefresher({
  active,
  intervalMs = DEFAULT_INTERVAL_MS,
}: LiveContestRefresherProps) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    const start = () => {
      clearTimer();
      timerRef.current = setInterval(() => router.refresh(), intervalMs);
    };

    // Reason: refreshing a tab nobody is looking at is server work for no reader, and a player
    // returning to the tab wants the board now rather than up to `intervalMs` later - so coming
    // back refreshes immediately and then resumes the cadence.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        clearTimer();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, intervalMs, router, clearTimer]);

  return null;
}
