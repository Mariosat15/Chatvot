"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ProviderLeaderboard, {
  type ProviderLeaderboardRow,
} from "@/components/games/ProviderLeaderboard";
import { NeonCountPill } from "@/components/neon/Cards";
import {
  ArenaActivityFeed,
  type ArenaActivityEntry,
} from "./ArenaActivityFeed";
import type { RoundActivitySummary } from "@/lib/utils/round-activity";

/**
 * Keeps the arena's standings rail true after the page has been drawn.
 *
 * THE DEFECT THIS CLOSES IS NOT THAT THE BOARD WAS WRONG - it was right when it was rendered,
 * and then stayed exactly as it was for as long as the player sat at the game. A player who
 * finished four boards, watched a rival pass them and came back to a screen reporting "Playing
 * now" for both of them has been shown a photograph of a moment that has gone.
 *
 * -------------------------------------------------------------------------------------------
 * WHY A CONTEXT PROVIDER AROUND THE WHOLE ARENA, WHICH LOOKS LIKE MORE MACHINERY THAN THE JOB
 * NEEDS. Two panels in two different columns show the same facts: the standings and the recent
 * players. Fetching in each of them is two polls of one endpoint, and worse, two answers - so
 * the board could name a rival's finished round while the feed beside it had not heard of it.
 * One fetch, two consumers.
 *
 * AND WHY THAT IS SAFE BESIDE A LIVE IFRAME, WHICH IS THE PROPERTY THE WHOLE FILE TURNS ON.
 * The arena hosts a round somebody has PAID for. `LiveContestRefresher` is forbidden on this
 * page by a test, because `router.refresh()` re-renders the page under the frame. This does
 * not: the provider receives the rest of the arena as its `children` prop, and a `children`
 * element passed down from a server component is the SAME OBJECT on every re-render, so React
 * reconciles it by identity and never descends into it. Only the two context consumers
 * re-render. The frame is not in their subtree and cannot remount.
 *
 * That is a real guarantee rather than a hopeful one, but it is also easy to destroy - so do
 * not make `ProviderRoundHost` a consumer of this context, and do not compute anything from
 * the live state above the provider. Either turns a board refresh into a reloaded game.
 * -------------------------------------------------------------------------------------------
 *
 * WHAT IT DOES NOT DO. It does not make a round in flight report its progress: nothing on
 * either side of the provider seam sends anything mid-round, so a live row says "Playing now"
 * until the round is reported and no amount of polling changes that. What this fixes is the
 * moment AFTER a round lands, which used to require a reload.
 */

interface ArenaLiveState {
  rows: ProviderLeaderboardRow[];
  activity: Record<string, RoundActivitySummary>;
  feed: ArenaActivityEntry[];
  currentUserId: string;
}

const ArenaLiveContext = createContext<ArenaLiveState | null>(null);

function useArenaLive(): ArenaLiveState {
  const value = useContext(ArenaLiveContext);
  if (!value) {
    // Reason: a consumer rendered outside the provider would silently render an empty board,
    // which on this screen reads as "nobody has played" - a false statement rather than a
    // missing one. Failing loudly in development is the lesser harm.
    throw new Error("Arena standings consumer used outside ArenaLiveProvider");
  }
  return value;
}

const DEFAULT_INTERVAL_MS = 15_000;

interface ProviderProps {
  competitionId: string;
  currentUserId: string;
  /** The server's first answer, so the rail is correct before any fetch has happened. */
  initial: {
    rows: ProviderLeaderboardRow[];
    activity: Record<string, RoundActivitySummary>;
    feed: ArenaActivityEntry[];
  };
  /**
   * Whether the contest is running, derived on the server from the STORED status.
   *
   * Never from a clock in the browser: a contest whose end time has passed is still `active`
   * until a cron finalizes it, so a client deciding for itself would freeze the board exactly
   * while the last rounds are being scored. Same rule as `LiveContestRefresher`.
   */
  active: boolean;
  /**
   * Matches the lobby's cadence deliberately. A game score changes when somebody finishes a
   * round, so a faster poll buys nothing, and a slower one makes this board visibly behind the
   * one a player just came from.
   */
  intervalMs?: number;
  children: ReactNode;
}

export function ArenaLiveProvider({
  competitionId,
  currentUserId,
  initial,
  active,
  intervalMs = DEFAULT_INTERVAL_MS,
  children,
}: ProviderProps) {
  const [live, setLive] = useState(initial);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    // Reason: its OWN flag, never one shared with another effect. The round poll in
    // `ProviderRoundHost` has one of its own, and sharing it lets that effect's cleanup
    // silence this one with no error and nothing in a log.
    let mounted = true;

    const read = async () => {
      try {
        const response = await fetch(
          `/api/competitions/${competitionId}/standings`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!mounted) return;

        // Reason: a response that is not a well-formed board is ignored rather than rendered.
        // An error payload spread into state empties the rail, and an empty rail on this screen
        // says "nobody has played", which is a false statement about a contest in progress.
        if (!Array.isArray(data?.rows)) return;

        setLive({
          rows: data.rows,
          activity:
            data.activity && typeof data.activity === "object"
              ? data.activity
              : {},
          feed: Array.isArray(data.feed) ? data.feed : [],
        });
      } catch {
        // Reason: a failed poll leaves the last good answer on screen. There is nothing useful
        // to tell a player about one missed refresh, and a banner would be on screen more often
        // than the network is down.
      }
    };

    const start = () => {
      clearTimer();
      timerRef.current = setInterval(read, intervalMs);
    };

    // Reason: polling a tab nobody is reading is work for no reader - and a player returning to
    // the tab wants the board now rather than up to `intervalMs` later.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void read();
        start();
      } else {
        clearTimer();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, competitionId, intervalMs, clearTimer]);

  return (
    <ArenaLiveContext.Provider value={{ ...live, currentUserId }}>
      {children}
    </ArenaLiveContext.Provider>
  );
}

/**
 * The board itself. Renders the same component the lobby does - the live state changes what it
 * is given, never how it draws.
 */
export function ArenaLiveBoard({ scoreLabel }: { scoreLabel?: string }) {
  const { rows, activity, currentUserId } = useArenaLive();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-gray-500">
        No scores yet. Be the first.
      </p>
    );
  }

  return (
    <ProviderLeaderboard
      rows={rows}
      currentUserId={currentUserId}
      scoreLabel={scoreLabel}
      activity={activity}
    />
  );
}

/**
 * The player count beside the Standings heading.
 *
 * A CONSUMER RATHER THAN A NUMBER PASSED IN, because it counts the rows the board is drawing.
 * Left as a server-rendered figure it would disagree with the list beneath it the moment
 * somebody joined - one panel, two answers, which is the failure this whole file exists to
 * avoid rather than to introduce one heading higher.
 */
export function ArenaLiveCount() {
  const { rows } = useArenaLive();
  // "Players (24)", the reference's form - the noun first, so the pill reads as a heading for
  // the figure rather than as a sentence fragment. Still "players", never "traders".
  return <NeonCountPill>Players ({rows.length})</NeonCountPill>;
}

/** The recent-players feed, from the same fetch as the board above it. */
export function ArenaLiveFeed() {
  const { feed, currentUserId } = useArenaLive();
  return <ArenaActivityFeed entries={feed} currentUserId={currentUserId} />;
}
