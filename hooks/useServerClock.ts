"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A ticking clock anchored to the SERVER's time rather than the browser's.
 *
 * WHY THE BROWSER'S CLOCK IS NOT GOOD ENOUGH HERE, and it is not a theoretical worry. Every
 * gate that decides whether a player may start a round - the contest window, the play window,
 * whether a round can still finish before the cut-off - is enforced on the server against the
 * server's `new Date()`. A screen that computes the same thing from `Date.now()` in the browser
 * gives a different answer on any machine whose clock is off, and the two failure directions are
 * both bad: a Play button offered against a closed window produces a red refusal the player
 * cannot act on, and a button withheld against an open one hides a paid attempt they are
 * entitled to. Neither logs anything, because neither is an error.
 *
 * HOW IT ANCHORS, and the honest limitation. `serverNowIso` was produced when the payload was
 * generated, so by the time this hook runs, transit and hydration have passed. The offset
 * therefore counts that transit as clock skew and can read up to about a second ahead of the
 * server. That is deliberate and is the safe direction: a countdown running marginally early
 * closes the window a moment before the server does, so the player is never offered a button
 * the server is about to refuse. Re-anchoring on every fresh payload keeps the error bounded
 * to one round trip rather than letting it accumulate.
 *
 * Reason it returns a number rather than a `Date`: a new `Date` object every second re-runs
 * every `useMemo` and effect keyed on it. Milliseconds compare and subtract directly.
 */
export function useServerClock(serverNowIso: string | undefined): number {
  /*
    The offset is state, not a ref, because a fresh anchor must re-render: the whole point is
    that a poll bringing a newer `serverNow` corrects a drifting countdown on screen.
  */
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  /*
    Reason for the ref: this effect must react to a CHANGED anchor and not to the offset it
    itself computes, or setting the offset re-runs the effect that set it. Comparing against the
    last anchor we consumed is cheaper and clearer than fighting the dependency array.
  */
  const lastAnchor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!serverNowIso || serverNowIso === lastAnchor.current) return;

    const parsed = new Date(serverNowIso).getTime();
    // Fails closed to the browser's own clock. An unparseable anchor is a bug on our side, and
    // an offset of NaN would make every comparison below false - so the countdown would freeze
    // and every gate would silently open.
    if (Number.isNaN(parsed)) return;

    lastAnchor.current = serverNowIso;
    setOffsetMs(parsed - Date.now());
  }, [serverNowIso]);

  useEffect(() => {
    // One second, because that is the smallest unit any of these countdowns displays. A faster
    // tick would re-render for no visible change.
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return now + offsetMs;
}

/**
 * A duration as a player reads it: `2d 4h 11m`, `11m 03s`, `9s`.
 *
 * Reason the units drop off rather than padding to a fixed width: "0d 0h 11m 03s" is harder to
 * read at a glance than "11m 03s", and the seconds are what a player watches in the last
 * minute. Seconds are shown only below the hour mark, because a second changing inside a
 * two-day countdown is noise that forces a re-render every tick.
 *
 * Exported for the same reason `deriveWindow` is one function: two screens formatting the same
 * remaining time differently is the shape behind several defects here, and a countdown is
 * exactly the kind of thing somebody re-implements inline.
 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
