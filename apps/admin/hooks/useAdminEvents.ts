'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface AdminEvent {
  type: string;
  section: string;
  action: 'create' | 'update' | 'delete' | 'refresh';
  data?: any;
  adminId?: string;
  adminEmail?: string;
  timestamp: number;
}

interface UseAdminEventsOptions {
  // Sections to listen to (empty = all sections)
  sections?: string[];
  // Callback when an event is received
  onEvent?: (event: AdminEvent) => void;
  // Whether to show toast notifications
  showToasts?: boolean;
  // Auto-reconnect on disconnect
  autoReconnect?: boolean;
}

/**
 * Hook for subscribing to real-time admin events
 * 
 * IMPORTANT: This hook maintains a SINGLE stable SSE connection.
 * It uses refs to avoid reconnection loops caused by React re-renders.
 */
export function useAdminEvents(options: UseAdminEventsOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AdminEvent | null>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  
  // Use refs to store mutable values that shouldn't trigger re-renders
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Store options in refs to avoid useEffect re-runs
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Connect on mount, disconnect on unmount - ONLY ONCE
  useEffect(() => {
    isMountedRef.current = true;
    
    const connect = () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnectingRef.current) {
        return;
      }
      
      // Don't connect if already connected
      if (eventSourceRef.current?.readyState === EventSource.OPEN) {
        return;
      }
      
      // Don't connect if component unmounted
      if (!isMountedRef.current) {
        return;
      }

      isConnectingRef.current = true;

      // Build URL with last event time for reconnection
      let url = '/api/admin/events';
      if (lastEventTimeRef.current > 0) {
        url += `?since=${lastEventTimeRef.current}`;
      }

      console.log('📡 Connecting to admin events SSE...');
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!isMountedRef.current) {
          eventSource.close();
          return;
        }
        console.log('📡 SSE connection opened');
        isConnectingRef.current = false;
        setIsConnected(true);
      };

      eventSource.onmessage = (e) => {
        if (!isMountedRef.current) return;
        
        try {
          const event = JSON.parse(e.data);
          const opts = optionsRef.current;
          
          // Handle special events
          if (event.type === 'connected') {
            setSubscriberCount(event.subscriberCount);
            return;
          }
          
          if (event.type === 'ping') {
            // Heartbeat - ignore
            return;
          }

          // Update last event time for reconnection
          if (event.timestamp) {
            lastEventTimeRef.current = event.timestamp;
          }

          // Filter by section if specified
          const sections = opts.sections || [];
          if (sections.length > 0 && !sections.includes(event.section)) {
            return;
          }

          console.log('📡 Received admin event:', event);
          setLastEvent(event);

          // Show toast notification
          if (opts.showToasts !== false && event.adminEmail) {
            const actionText = getActionText(event.type, event.action);
            toast.info(`${event.adminEmail} ${actionText}`, {
              description: `Section: ${event.section}`,
              duration: 3000,
            });
          }

          // Call callback
          if (opts.onEvent) {
            opts.onEvent(event);
          }
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      eventSource.onerror = () => {
        console.error('📡 SSE connection error');
        isConnectingRef.current = false;
        
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        
        if (!isMountedRef.current) return;
        
        setIsConnected(false);

        // Auto-reconnect after 5 seconds (only if still mounted)
        const opts = optionsRef.current;
        if (opts.autoReconnect !== false && isMountedRef.current) {
          console.log('📡 Reconnecting in 5 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, 5000);
        }
      };
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      isConnectingRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        console.log('📡 Closing SSE connection (unmount)');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []); // Empty dependency array - run ONLY on mount/unmount

  // Manual reconnect function
  const reconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    isConnectingRef.current = false;
    
    // Trigger reconnect
    let url = '/api/admin/events';
    if (lastEventTimeRef.current > 0) {
      url += `?since=${lastEventTimeRef.current}`;
    }

    console.log('📡 Manual reconnect to admin events SSE...');
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('📡 SSE connection reopened');
      setIsConnected(true);
    };
    
    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'connected') {
          setSubscriberCount(event.subscriberCount);
        } else if (event.type !== 'ping') {
          setLastEvent(event);
          if (optionsRef.current.onEvent) {
            optionsRef.current.onEvent(event);
          }
        }
      } catch {}
    };
    
    eventSource.onerror = () => {
      setIsConnected(false);
    };
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  return {
    isConnected,
    lastEvent,
    subscriberCount,
    reconnect,
    disconnect,
  };
}

// Helper to get human-readable action text
function getActionText(type: string, action: string): string {
  const typeMap: Record<string, string> = {
    user_updated: 'updated a user',
    user_created: 'created a new user',
    user_deleted: 'deleted a user',
    employee_updated: 'updated an employee',
    employee_created: 'added a new employee',
    employee_deleted: 'removed an employee',
    employee_status_changed: 'changed employee status',
    competition_updated: 'updated a competition',
    competition_created: 'created a competition',
    competition_deleted: 'deleted a competition',
    challenge_updated: 'updated a challenge',
    transaction_updated: 'updated a transaction',
    withdrawal_updated: 'updated a withdrawal',
    withdrawal_processed: 'processed a withdrawal',
    deposit_updated: 'updated a deposit',
    settings_updated: 'changed settings',
    fraud_alert_updated: 'updated a fraud alert',
    kyc_updated: 'updated KYC status',
    badge_updated: 'updated a badge',
    symbol_updated: 'updated trading symbols',
    general_refresh: 'made changes',
  };

  return typeMap[type] || `made a ${action}`;
}

export default useAdminEvents;
