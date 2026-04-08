"use client";

import { useState, useEffect, useCallback } from "react";

const POLL_INTERVAL = 30000; // 30 seconds

/**
 * Hook that polls /api/messaging/unread for the current user's unread message count.
 * Returns the count and a manual refresh function.
 */
export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/unread");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silent fail — non-critical
    }
  }, []);

  useEffect(() => {
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
    };
  }, [refresh]);

  return { unreadCount, refresh };
}
