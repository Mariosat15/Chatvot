'use client';

import { useEffect, useRef } from 'react';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

/**
 * Global presence tracker component that should be added to the root layout.
 * This tracks user online/offline status across all pages.
 */
export default function GlobalPresenceTracker({ userId }: { userId?: string }) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      if (!isActiveRef.current) return;
      
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

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for heartbeats - optimized to 30 seconds (was 10)
    heartbeatRef.current = setInterval(sendHeartbeat, PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        // Send offline status when tab is hidden
        navigator.sendBeacon('/api/user/presence', JSON.stringify({ status: 'offline' }));
      } else {
        isActiveRef.current = true;
        sendHeartbeat();
      }
    };

    // Handle window focus/blur
    const handleFocus = () => {
      isActiveRef.current = true;
      sendHeartbeat();
    };

    const handleBlur = () => {
      // Keep online but note window lost focus
    };

    // Handle page unload - mark as offline
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/user/presence', JSON.stringify({ status: 'offline' }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Try to send offline status on cleanup
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

