"use client";

import { useSyncExternalStore } from "react";

/**
 * The running round's close time, handed from the round host to the "Round time" tile.
 *
 * WHY A TINY STORE RATHER THAN THE ARENA CONTEXT. The round host must stay a CHILD of the live
 * standings provider and never a consumer of it - a consumer re-renders on every board poll, and
 * the host renders the paid game iframe. The tile sits in the sidebar, a sibling, so the fact has
 * to travel some other way. This store only ever carries a deadline: no score, no rank.
 */
export interface RoundClockFact {
  /** The server's hard close for the round (ISO). */
  expiresAt: string | null | undefined;
  /** Anchor for the server clock (ISO), from the same payload. */
  serverNow: string;
  /** The game's own timer end (epoch ms, browser clock), once the frame reports it. */
  gameEndsAtMs?: number | null;
}

let current: RoundClockFact | null = null;
const listeners = new Set<() => void>();

export function publishRoundClock(fact: RoundClockFact | null): void {
  const same =
    fact === current ||
    (fact !== null &&
      current !== null &&
      fact.expiresAt === current.expiresAt &&
      fact.serverNow === current.serverNow &&
      (fact.gameEndsAtMs ?? null) === (current.gameEndsAtMs ?? null));
  if (same) return;
  current = fact;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoundClock(): RoundClockFact | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
