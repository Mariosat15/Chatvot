'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getAdminEventsClient, AdminEvent } from '@/lib/admin-events-client';

export type { AdminEvent };

interface UseAdminEventsOptions {
  // Sections to listen to (empty = all sections)
  sections?: string[];
  // Callback when an event is received
  onEvent?: (event: AdminEvent) => void;
  // Whether to show toast notifications
  showToasts?: boolean;
}

/**
 * Hook for subscribing to admin events via polling
 */
export function useAdminEvents(options: UseAdminEventsOptions = {}) {
  const [isConnected, setIsConnected] = useState(true); // Polling is always "connected"
  const [lastEvent, setLastEvent] = useState<AdminEvent | null>(null);
  
  // Store options in ref to avoid re-subscriptions
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const client = getAdminEventsClient();
    setIsConnected(client.isConnected);
    
    // Subscribe to events
    const unsubscribe = client.addListener((event: AdminEvent) => {
      const opts = optionsRef.current;
      
      // Filter by section if specified
      const sections = opts.sections || [];
      if (sections.length > 0 && !sections.includes(event.section)) {
        return;
      }

      setLastEvent(event);

      // Show toast notification (disabled by default - set showToasts: true to enable)
      if (opts.showToasts === true && event.adminEmail) {
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
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const reconnect = useCallback(() => {
    getAdminEventsClient().reconnect();
  }, []);

  return {
    isConnected,
    lastEvent,
    subscriberCount: 1, // Not applicable for polling
    reconnect,
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
