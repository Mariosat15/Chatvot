"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";
import {
  getOrCreateTabId,
  releasePresenceTab,
  touchPresenceTab,
} from "@/lib/utils/presence-tabs";

/**
 * Global presence tracker — mount once in the signed-in root layout.
 *
 * A user is ONLINE while ANY ChartVolt tab/window is still open, on any route,
 * including background tabs. They go offline only when:
 * - the last open tab closes (pagehide / beforeunload), or
 * - heartbeats go stale past PRESENCE_OFFLINE_THRESHOLD (server cleanup).
 *
 * Reason: browsers throttle setInterval in background tabs. Closing one of
 * several tabs must not send offline while another tab keeps heartbeating.
 * React effect cleanup must never send offline — Strict Mode remounts would
 * falsely clear presence for a still-open page.
 */
export default function GlobalPresenceTracker({ userId }: { userId?: string }) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const tabIdRef = useRef<string | null>(null);

  const sendHeartbeat = useCallback(async () => {
    const tabId = tabIdRef.current;
    if (tabId) touchPresenceTab(tabId);
    try {
      await fetch("/api/user/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "online",
          currentPage: pathnameRef.current,
        }),
        keepalive: true,
      });
    } catch {
      // Presence is non-critical
    }
  }, []);

  const signalOfflineIfLastTab = useCallback(() => {
    const tabId = tabIdRef.current;
    if (!tabId) return;
    const remaining = releasePresenceTab(
      tabId,
      PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD,
    );
    if (remaining > 0) return;
    try {
      navigator.sendBeacon(
        "/api/user/presence",
        new Blob([JSON.stringify({ status: "offline" })], {
          type: "application/json",
        }),
      );
    } catch {
      // Ignore — stale cleanup will mark offline
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    tabIdRef.current = getOrCreateTabId();
    touchPresenceTab(tabIdRef.current);
    void sendHeartbeat();

    heartbeatRef.current = setInterval(
      sendHeartbeat,
      PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT,
    );

    // Reason: background throttling can delay the interval past the offline
    // window; an immediate beat on return re-establishes online.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    };

    // Reason: pagehide is more reliable than beforeunload on mobile Safari.
    // Only the LAST open tab may signal offline.
    const handlePageHide = () => {
      signalOfflineIfLastTab();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      // Reason: deliberately no offline beacon here — React remounts and
      // soft navigations must not wipe presence for an open browser tab.
    };
  }, [userId, sendHeartbeat, signalOfflineIfLastTab]);

  // Reason: pathname changes update the next heartbeat via pathnameRef;
  // send an immediate beat so currentPage stays accurate without remounting.
  useEffect(() => {
    if (!userId) return;
    void sendHeartbeat();
  }, [pathname, userId, sendHeartbeat]);

  return null;
}
