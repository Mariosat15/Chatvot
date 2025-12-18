'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to sync positions with server in real-time
 * Detects when positions are closed (via TP/SL or otherwise) and refreshes the UI
 * 
 * This solves the issue where positions closed by TP/SL don't disappear from the UI
 * until the user manually refreshes the page.
 */

// How often to check for position changes (in ms)
// Set to 3 seconds for faster TP/SL detection
const POSITION_SYNC_INTERVAL = 3000; // 3 seconds

// Throttle between checks (prevents rapid-fire requests)
const CHECK_THROTTLE_MS = 2000; // 2 seconds

// Custom event types
export const POSITION_EVENTS = {
  POSITION_CLOSED: 'positionClosed',
  POSITIONS_CHANGED: 'positionsChanged',
} as const;

// Global tracker to prevent multiple instances from polling simultaneously
// When multiple PositionsTable components exist (e.g., main page + fullscreen chart)
const globalState = {
  lastCheck: 0,
  isChecking: false,
  positionIds: new Set<string>(),
  initialized: false,
  // Track the last known count to detect changes even for new positions
  lastKnownCount: -1,
  // Track current context ID to reset state when navigating between pages
  currentContextId: '',
  // ⚡ Authoritative server position IDs - persists across component remounts
  // This is used by PositionsTable to filter stale positions from props
  authoritativePositionIds: null as Set<string> | null,
};

/**
 * Get the authoritative position IDs from the last sync
 * Used by PositionsTable to filter stale positions
 */
export function getAuthoritativePositionIds(): Set<string> | null {
  return globalState.authoritativePositionIds;
}

/**
 * Set the authoritative position IDs
 * Called when position sync gets a response from the server
 */
export function setAuthoritativePositionIds(ids: Set<string>): void {
  globalState.authoritativePositionIds = ids;
}

// Reset global state when context changes
function resetGlobalState(contextId: string) {
  if (globalState.currentContextId !== contextId) {
    console.log('🔄 [Position Sync] Context changed, resetting state');
    globalState.lastCheck = 0;
    globalState.isChecking = false;
    globalState.positionIds = new Set<string>();
    globalState.initialized = false;
    globalState.lastKnownCount = -1;
    globalState.currentContextId = contextId;
  }
}

interface UsePositionSyncOptions {
  competitionId?: string;
  challengeId?: string;
  enabled?: boolean;
  onPositionClosed?: (positionId: string, reason: 'manual' | 'tp' | 'sl' | 'margin' | 'auto') => void;
}

export function usePositionSync({
  competitionId,
  challengeId,
  enabled = true,
  onPositionClosed,
}: UsePositionSyncOptions) {
  const router = useRouter();
  const isMountedRef = useRef(true);

  // Fetch current position count/IDs from server
  // Uses global state to prevent multiple instances from polling simultaneously
  const checkPositions = useCallback(async () => {
    if (!enabled) return;
    if (!competitionId && !challengeId) return;

    const contextId = competitionId || challengeId || '';
    
    // Reset state if context changed (user navigated to different competition/challenge)
    resetGlobalState(contextId);

    const now = Date.now();
    
    // Global throttle - prevents multiple component instances from rapid-fire polling
    if (now - globalState.lastCheck < CHECK_THROTTLE_MS) return;
    if (globalState.isChecking) return;
    
    globalState.isChecking = true;
    globalState.lastCheck = now;

    try {
      const endpoint = competitionId 
        ? `/api/competitions/${competitionId}/positions/check`
        : `/api/challenges/${challengeId}/positions/check`;

      const response = await fetch(endpoint, { cache: 'no-store' });
      
      if (!response.ok) {
        globalState.isChecking = false;
        return;
      }
      
      const data = await response.json();
      const serverPositionIds = new Set<string>(data.positionIds || []);
      const serverCount = data.count ?? serverPositionIds.size;
      
      // Only log when there's something meaningful (initialization or changes)
      const hasChange = globalState.lastKnownCount !== serverCount || 
        Array.from(globalState.positionIds).some(id => !serverPositionIds.has(id));
      
      if (!globalState.initialized || hasChange) {
        console.log('📡 [Position Sync] Check result:', {
          serverCount,
          serverPositionIds: Array.from(serverPositionIds),
          previousCount: globalState.lastKnownCount,
          previousIds: Array.from(globalState.positionIds),
          initialized: globalState.initialized,
        });
      }
      
      // First call - store state AND dispatch sync event to ensure UI matches server
      if (!globalState.initialized) {
        console.log('📡 [Position Sync] Initializing state with', serverCount, 'positions');
        globalState.initialized = true;
        globalState.positionIds = serverPositionIds;
        globalState.lastKnownCount = serverCount;
        
        // ⚡ Store authoritative position IDs (persists across component remounts)
        globalState.authoritativePositionIds = serverPositionIds;
        
        // IMPORTANT: Dispatch sync event on first check to ensure UI matches server
        // This handles the case where page loads with stale data
        window.dispatchEvent(new CustomEvent(POSITION_EVENTS.POSITIONS_CHANGED, {
          detail: { 
            closedPositions: [], 
            newCount: serverCount,
            serverPositionIds: Array.from(serverPositionIds),
            isInitialSync: true
          }
        }));
        
        globalState.isChecking = false;
        return;
      }

      // Check for closed positions (positions we knew about that are now gone)
      const closedPositions: string[] = [];
      globalState.positionIds.forEach(id => {
        if (!serverPositionIds.has(id)) {
          closedPositions.push(id);
        }
      });

      // Also detect if count decreased (handles case where new position was opened and then closed)
      const countDecreased = globalState.lastKnownCount > serverCount;
      const shouldRefresh = closedPositions.length > 0 || countDecreased;

      // If positions were closed OR count decreased, trigger update
      if (shouldRefresh) {
        if (closedPositions.length > 0) {
          console.log('🔔 [Position Sync] Detected closed positions:', closedPositions);
        }
        if (countDecreased) {
          console.log('🔔 [Position Sync] Position count decreased:', globalState.lastKnownCount, '->', serverCount);
        }
        
        // Notify via callback for known closed positions
        // Note: We use 'auto' as reason since we don't know if it was TP, SL, or manual
        closedPositions.forEach(id => {
          onPositionClosed?.(id, 'auto'); // Generic - we don't know the exact reason
          
          // Dispatch custom event
          window.dispatchEvent(new CustomEvent(POSITION_EVENTS.POSITION_CLOSED, {
            detail: { positionId: id, reason: 'auto' }
          }));
        });

        // If count decreased but we don't know which position was closed,
        // dispatch events for ALL position IDs that are no longer on server
        // This handles the case where a position was opened and closed between polls
        if (countDecreased && closedPositions.length === 0) {
          // We don't know the specific position, but we need to notify UI
          // The PositionsTable will compare against its local state
          console.log('🔔 [Position Sync] Unknown position closed - triggering sync');
          window.dispatchEvent(new CustomEvent(POSITION_EVENTS.POSITION_CLOSED, {
            detail: { positionId: 'unknown', reason: 'auto', serverPositionIds: Array.from(serverPositionIds) }
          }));
        }

        // ⚡ Update authoritative position IDs BEFORE dispatching event
        globalState.authoritativePositionIds = serverPositionIds;
        
        // Dispatch general change event with server position IDs
        window.dispatchEvent(new CustomEvent(POSITION_EVENTS.POSITIONS_CHANGED, {
          detail: { 
            closedPositions, 
            newCount: serverCount,
            serverPositionIds: Array.from(serverPositionIds)
          }
        }));

        // Refresh the page data
        if (isMountedRef.current) {
          console.log('🔄 [Position Sync] Triggering page refresh...');
          router.refresh();
        }
      }

      // ALWAYS update global state to track current positions (including new ones)
      globalState.positionIds = serverPositionIds;
      globalState.lastKnownCount = serverCount;
      // ⚡ Also always update authoritative position IDs
      globalState.authoritativePositionIds = serverPositionIds;

    } catch {
      // Silently fail - don't spam console
    } finally {
      globalState.isChecking = false;
    }
  }, [competitionId, challengeId, enabled, router, onPositionClosed]);

  // Set up polling
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) return;

    // Initial check
    checkPositions();

    // Set up interval
    const intervalId = setInterval(checkPositions, POSITION_SYNC_INTERVAL);

    // Also check when tab becomes visible
    const handleVisibility = () => {
      if (!document.hidden) {
        checkPositions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkPositions, enabled]);

  // Listen for position closed events (from server-side actions)
  useEffect(() => {
    const handlePositionClosed = (event: CustomEvent) => {
      console.log('🔔 [Position Sync] Position closed event received:', event.detail);
      // Refresh to get latest data
      router.refresh();
    };

    window.addEventListener(POSITION_EVENTS.POSITION_CLOSED, handlePositionClosed as EventListener);
    
    return () => {
      window.removeEventListener(POSITION_EVENTS.POSITION_CLOSED, handlePositionClosed as EventListener);
    };
  }, [router]);

  return {
    checkPositions,
  };
}

/**
 * Dispatch position closed event
 * Call this from server action responses to immediately update UI
 */
export function dispatchPositionClosed(positionId: string, reason: 'manual' | 'tp' | 'sl' | 'margin' = 'manual') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POSITION_EVENTS.POSITION_CLOSED, {
      detail: { positionId, reason }
    }));
  }
}

