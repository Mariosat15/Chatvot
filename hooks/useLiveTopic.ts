"use client";

import { useEffect, useRef } from "react";
import { LIVE_EVENT, type LiveEventDetail } from "@/lib/utils/notification-events";

interface UseLiveTopicOptions {
  /** Only react to events for this record (or events that name no record). */
  id?: string;
  /**
   * Safety-net re-read while the tab is visible, in ms. Reason: a socket can
   * drop or a server can forget to announce a change; this keeps a missed
   * signal to a delay rather than a page that never updates. 0 disables it.
   */
  fallbackMs?: number;
  /** Turn the whole hook off (e.g. while a filter is still loading). */
  enabled?: boolean;
}

/** Bursts (twenty players joining at once) collapse into one re-read. */
const DEBOUNCE_MS = 600;

/**
 * Re-read a screen's data whenever the server says a topic changed.
 *
 * Listens to the page event `ChallengePopup` relays from the one socket every
 * signed-in tab already has, so this opens no connection of its own. Also
 * re-reads when the tab becomes visible again, since a hidden tab may have
 * missed events.
 */
export default function useLiveTopic(
  topics: string | readonly string[],
  onChange: () => void,
  { id, fallbackMs = 60_000, enabled = true }: UseLiveTopicOptions = {},
): void {
  // Reason: the latest callback is read through a ref, so a caller passing an
  // inline function does not tear down and re-add the listeners every render.
  const callbackRef = useRef(onChange);
  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  const topicKey = typeof topics === "string" ? topics : topics.join("|");

  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(topicKey.split("|"));
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (document.visibilityState === "visible") callbackRef.current();
      }, DEBOUNCE_MS);
    };

    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveEventDetail>).detail;
      if (!detail || !wanted.has(detail.topic)) return;
      if (id && detail.id && detail.id !== id) return;
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };

    window.addEventListener(LIVE_EVENT, onLive);
    document.addEventListener("visibilitychange", onVisible);
    const interval =
      fallbackMs > 0
        ? setInterval(() => {
            if (document.visibilityState === "visible") callbackRef.current();
          }, fallbackMs)
        : null;

    return () => {
      window.removeEventListener(LIVE_EVENT, onLive);
      document.removeEventListener("visibilitychange", onVisible);
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [topicKey, id, fallbackMs, enabled]);
}
