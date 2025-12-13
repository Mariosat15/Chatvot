'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LiveStatusIndicatorProps {
  onRefresh?: () => Promise<void>;
  refreshInterval?: number; // in milliseconds
}

export default function LiveStatusIndicator({ 
  onRefresh, 
  refreshInterval = 10000 // 10 seconds default
}: LiveStatusIndicatorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);

  // Check if we're online
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Initial check
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleRefresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      handleRefresh(false); // Silent refresh
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [handleRefresh, refreshInterval, isOnline]);

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOnline) {
        handleRefresh(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh, isOnline]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (isOnline) {
        handleRefresh(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [handleRefresh, isOnline]);

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 border h-[72px] ${
      isOnline ? 'border-green-500/30' : 'border-red-500/30'
    }`}>
      {/* Status indicator */}
      <div className="relative">
        {isOnline ? (
          <>
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-50"></div>
          </>
        ) : (
          <Circle className="w-2.5 h-2.5 text-red-500 fill-red-500" />
        )}
      </div>

      {/* Refresh button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleRefresh(true)}
        disabled={isRefreshing || !isOnline}
        className="h-8 w-8 p-0 hover:bg-gray-700"
        title="Refresh"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-yellow-500' : 'text-gray-400'}`} />
      </Button>

      {/* Status text */}
      <div className="flex flex-col">
        <span className={`text-[10px] leading-tight font-semibold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
          ● {isOnline ? 'LIVE' : 'OFFLINE'}
        </span>
        <span className="text-[10px] text-gray-500 leading-tight">
          Auto-updates • {lastRefresh.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

