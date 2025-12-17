/**
 * Hook for optimistic UI updates
 * Provides a way to update UI immediately while background refresh happens
 */

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface OptimisticUpdateOptions {
  // Delay before triggering server refresh (ms)
  refreshDelay?: number;
  // Whether to skip router.refresh entirely (use local state only)
  skipServerRefresh?: boolean;
}

/**
 * Hook that provides optimistic update capabilities
 * 
 * Usage:
 * ```tsx
 * const { triggerRefresh, scheduleRefresh } = useOptimisticUpdate();
 * 
 * // After successful action:
 * // 1. Update local state immediately (optimistic)
 * // 2. Schedule a delayed server refresh (non-blocking)
 * scheduleRefresh(500); // Refresh after 500ms
 * ```
 */
export function useOptimisticUpdate(options: OptimisticUpdateOptions = {}) {
  const router = useRouter();
  const { refreshDelay = 300, skipServerRefresh = false } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  /**
   * Trigger immediate router refresh
   */
  const triggerRefresh = useCallback(() => {
    if (skipServerRefresh || isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    router.refresh();
    
    // Reset flag after a short delay
    setTimeout(() => {
      isRefreshingRef.current = false;
    }, 1000);
  }, [router, skipServerRefresh]);

  /**
   * Schedule a delayed refresh (debounced)
   * Multiple calls within the delay window will only result in one refresh
   */
  const scheduleRefresh = useCallback((delay?: number) => {
    if (skipServerRefresh) return;
    
    // Clear any pending refresh
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      triggerRefresh();
      timeoutRef.current = null;
    }, delay ?? refreshDelay);
  }, [refreshDelay, skipServerRefresh, triggerRefresh]);

  /**
   * Cancel any pending refresh
   */
  const cancelRefresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    triggerRefresh,
    scheduleRefresh,
    cancelRefresh,
    isRefreshing: isRefreshingRef.current,
  };
}

/**
 * Create a custom event dispatcher for cross-component communication
 * This allows components to communicate state changes without full page refreshes
 */
export function dispatchTradingEvent(
  eventType: 'positionOpened' | 'positionClosed' | 'positionUpdated' | 'orderPlaced' | 'tpslUpdated',
  detail: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;
  
  window.dispatchEvent(new CustomEvent(eventType, { detail }));
}

/**
 * Subscribe to trading events
 */
export function subscribeTradingEvent(
  eventType: 'positionOpened' | 'positionClosed' | 'positionUpdated' | 'orderPlaced' | 'tpslUpdated',
  callback: (detail: Record<string, unknown>) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (event: Event) => {
    callback((event as CustomEvent).detail);
  };
  
  window.addEventListener(eventType, handler);
  
  return () => {
    window.removeEventListener(eventType, handler);
  };
}

