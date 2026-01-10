'use client';

import { useEffect, useRef } from 'react';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

/**
 * Global presence tracker component that should be added to the root layout.
 * This tracks user online/offline status across all pages.
 * 
 * IMPORTANT: Users stay ONLINE as long as they are logged in, even if the 
 * browser tab is in the background. They only go offline when:
 * - They close the browser/tab completely
 * - They log out
 * - Session expires (server-side timeout)
 */
export default function GlobalPresenceTracker({ userId }: { userId?: string }) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      // Always send heartbeat - user is online as long as they're logged in
      try {
        await fetch('/api/user/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'online' }),
        });
      } catch (error) {
        // Silently fail - presence is non-critical
      }
    };

    // Send initial heartbeat immediately
    sendHeartbeat();

    // Set up interval for heartbeats - keeps user online even in background tabs
    // The heartbeat continues regardless of tab visibility
    heartbeatRef.current = setInterval(sendHeartbeat, PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT);

    // Handle page unload - mark as offline ONLY when browser/tab is closed
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/user/presence', JSON.stringify({ status: 'offline' }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Send offline status on cleanup (component unmount = likely logout or navigation away)
      try {
        navigator.sendBeacon('/api/user/presence', JSON.stringify({ status: 'offline' }));
      } catch (e) {
        // Ignore errors on cleanup
      }
    };
  }, [userId]);

  // This component doesn't render anything visible
  return null;
}

