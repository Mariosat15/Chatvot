'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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
 * Usage:
 * ```tsx
 * const { isConnected, lastEvent } = useAdminEvents({
 *   sections: ['users', 'employees'],
 *   onEvent: (event) => {
 *     // Refresh data when relevant event occurs
 *     if (event.section === 'users') {
 *       refetchUsers();
 *     }
 *   },
 *   showToasts: true,
 * });
 * ```
 */
export function useAdminEvents(options: UseAdminEventsOptions = {}) {
  const {
    sections = [],
    onEvent,
    showToasts = true,
    autoReconnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AdminEvent | null>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(0);

  const connect = useCallback(() => {
    // Don't connect if already connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Build URL with last event time for reconnection
    let url = '/api/admin/events';
    if (lastEventTimeRef.current > 0) {
      url += `?since=${lastEventTimeRef.current}`;
    }

    console.log('📡 Connecting to admin events SSE...');
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('📡 SSE connection opened');
      setIsConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        
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
        if (sections.length > 0 && !sections.includes(event.section)) {
          return;
        }

        console.log('📡 Received admin event:', event);
        setLastEvent(event);

        // Show toast notification
        if (showToasts && event.adminEmail) {
          const actionText = getActionText(event.type, event.action);
          toast.info(`${event.adminEmail} ${actionText}`, {
            description: `Section: ${event.section}`,
            duration: 3000,
          });
        }

        // Call callback
        if (onEvent) {
          onEvent(event);
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('📡 SSE connection error:', error);
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Auto-reconnect after 5 seconds
      if (autoReconnect) {
        console.log('📡 Reconnecting in 5 seconds...');
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      }
    };
  }, [sections, onEvent, showToasts, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    subscriberCount,
    reconnect: connect,
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

