"use client";

import { useCallback, useState } from "react";

/**
 * DEPRECATED: Page-specific presence tracking is now handled by
 * GlobalPresenceTracker (in root layout) which sends the current pathname
 * with every heartbeat.
 *
 * This hook is kept only for backward-compatibility — it no longer creates
 * its own heartbeat interval or marks the user offline on unmount. Those
 * behaviours were causing duplicate heartbeats and conflicting offline
 * signals when the user navigated between pages.
 *
 * If you need to know the user's online state, read it from the presence API
 * or from GlobalPresenceTracker's heartbeat instead.
 */
export function usePresence(_currentPage?: string) {
  const [isActive] = useState(true); // always true — global tracker handles it

  const sendHeartbeat = useCallback(async () => {
    // No-op: GlobalPresenceTracker already sends heartbeats
  }, []);

  const goOffline = useCallback(async () => {
    // No-op: Only GlobalPresenceTracker should control online/offline status
  }, []);

  return { sendHeartbeat, goOffline, isActive };
}

export default usePresence;
