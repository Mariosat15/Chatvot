"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

/**
 * Global presence tracker component that should be added to the root layout.
 * This tracks user online/offline status across all pages.
 *
 * IMPORTANT: This is the ONLY presence tracker in the app. Page-specific
 * trackers (LeaderboardPresenceTracker, challenges usePresence) have been
 * removed to avoid duplicate heartbeats and conflicting offline signals.
 *
 * Users stay ONLINE as long as they are logged in, even if the
 * browser tab is in the background. They only go offline when:
 * - They close the browser/tab completely
 * - They log out
 * - Session expires (server-side timeout)
 *
 * Reason: Browsers throttle setInterval in background tabs (often to ~60-120s).
 * The visibilitychange listener sends an immediate heartbeat when the user
 * returns to the tab, preventing false "offline" status in the admin panel.
 */
export default function GlobalPresenceTracker({ userId }: { userId?: string }) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/user/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "online",
          currentPage: pathnameRef.current,
        }),
      });
    } catch {
      // Silently fail - presence is non-critical
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    sendHeartbeat();

    heartbeatRef.current = setInterval(
      sendHeartbeat,
      PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT,
    );

    // Reason: When the user returns to this tab after it was backgrounded,
    // the interval may have been throttled past the offline threshold.
    // Sending an immediate heartbeat re-establishes "online" status.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        "/api/user/presence",
        JSON.stringify({ status: "offline" }),
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      try {
        navigator.sendBeacon(
          "/api/user/presence",
          JSON.stringify({ status: "offline" }),
        );
      } catch {
        // Ignore errors on cleanup
      }
    };
  }, [userId, sendHeartbeat]);

  return null;
}
