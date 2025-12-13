'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function usePresence(currentPage?: string) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const [isActive, setIsActive] = useState(false);

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/user/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPage }),
      });
      if (res.ok) {
        setIsActive(true);
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }, [currentPage]);

  const goOffline = useCallback(async () => {
    try {
      await fetch('/api/user/presence', {
        method: 'DELETE',
      });
      setIsActive(false);
    } catch (error) {
      console.error('Failed to go offline:', error);
    }
  }, []);

  useEffect(() => {
    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Go offline on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      goOffline();
    };
  }, [sendHeartbeat, goOffline]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sendHeartbeat]);

  // Handle page unload
  useEffect(() => {
    const handleUnload = () => {
      // Use sendBeacon for reliability on page close
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/user/presence?action=offline');
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  return { sendHeartbeat, goOffline, isActive };
}

export default usePresence;

