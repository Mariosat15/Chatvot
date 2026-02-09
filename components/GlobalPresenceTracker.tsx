"use client";

import { useEffect, useRef } from "react";
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
 */
export default function GlobalPresenceTracker({ userId }: { userId?: string }) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  // Keep pathname in a ref so the interval always sends the latest page
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      // Always send heartbeat - user is online as long as they're logged in
      // Include currentPage so the server knows which page the user is viewing
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
    };

    // Send initial heartbeat immediately
    sendHeartbeat();

    // Set up interval for heartbeats - keeps user online even in background tabs
    // The heartbeat continues regardless of tab visibility
    heartbeatRef.current = setInterval(
      sendHeartbeat,
      PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT,
    );

    // Handle page unload - mark as offline ONLY when browser/tab is closed
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        "/api/user/presence",
        JSON.stringify({ status: "offline" }),
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Send offline status on cleanup (component unmount = likely logout or navigation away)
      try {
        navigator.sendBeacon(
          "/api/user/presence",
          JSON.stringify({ status: "offline" }),
        );
      } catch {
        // Ignore errors on cleanup
      }
    };
  }, [userId]);

  // This component doesn't render anything visible
  return null;
}
