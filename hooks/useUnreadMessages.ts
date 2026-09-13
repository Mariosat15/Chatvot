"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const POLL_INTERVAL = 10000; // 10 seconds for faster responsiveness

/**
 * Hook that polls /api/messaging/unread for the current user's unread message count.
 * Uses BroadcastChannel so multiple tabs stay in sync instantly.
 */
export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/unread");
      if (res.ok) {
        const data = await res.json();
        const count = data.unreadCount ?? 0;
        setUnreadCount(count);
        // Broadcast to other tabs/components
        try {
          channelRef.current?.postMessage({ unreadCount: count });
        } catch { /* BroadcastChannel not supported */ }
      }
    } catch {
      // Silent fail — non-critical
    }
  }, []);

  useEffect(() => {
    // BroadcastChannel for cross-tab sync
    try {
      const bc = new BroadcastChannel("chartvolt-unread-messages");
      bc.onmessage = (event) => {
        if (typeof event.data?.unreadCount === "number") {
          setUnreadCount(event.data.unreadCount);
        }
      };
      channelRef.current = bc;
    } catch { /* BroadcastChannel not supported in this browser */ }

    refresh();

    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL);

    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      try { channelRef.current?.close(); } catch {}
    };
  }, [refresh]);

  return { unreadCount, refresh };
}
