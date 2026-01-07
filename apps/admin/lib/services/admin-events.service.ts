/**
 * Admin Events Service
 * 
 * Manages real-time event broadcasting between admin users.
 * When one admin makes a change, all other connected admins are notified.
 */

type EventCallback = (event: AdminEvent) => void;

export interface AdminEvent {
  type: AdminEventType;
  section: string;
  action: 'create' | 'update' | 'delete' | 'refresh';
  data?: any;
  adminId?: string;
  adminEmail?: string;
  timestamp: number;
}

export type AdminEventType = 
  | 'user_updated'
  | 'user_created'
  | 'user_deleted'
  | 'employee_updated'
  | 'employee_created'
  | 'employee_deleted'
  | 'employee_status_changed'
  | 'competition_updated'
  | 'competition_created'
  | 'competition_deleted'
  | 'challenge_updated'
  | 'transaction_updated'
  | 'withdrawal_updated'
  | 'withdrawal_processed'
  | 'deposit_updated'
  | 'settings_updated'
  | 'fraud_alert_updated'
  | 'kyc_updated'
  | 'badge_updated'
  | 'template_updated'
  | 'symbol_updated'
  | 'general_refresh';

// In-memory subscribers (works for single server)
// For multi-server, use Redis pub/sub
const subscribers = new Map<string, EventCallback>();

// Event history for new connections (last 50 events, max 5 minutes old)
const eventHistory: AdminEvent[] = [];
const MAX_HISTORY = 50;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

class AdminEventsService {
  /**
   * Subscribe to admin events
   * Returns an unsubscribe function
   */
  subscribe(clientId: string, callback: EventCallback): () => void {
    subscribers.set(clientId, callback);
    console.log(`📡 Admin event subscriber connected: ${clientId} (total: ${subscribers.size})`);
    
    return () => {
      subscribers.delete(clientId);
      console.log(`📡 Admin event subscriber disconnected: ${clientId} (total: ${subscribers.size})`);
    };
  }

  /**
   * Broadcast an event to all connected admins
   */
  broadcast(event: Omit<AdminEvent, 'timestamp'>): void {
    const fullEvent: AdminEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Add to history
    eventHistory.push(fullEvent);
    
    // Trim history
    while (eventHistory.length > MAX_HISTORY) {
      eventHistory.shift();
    }
    
    // Remove old events
    const cutoff = Date.now() - MAX_AGE_MS;
    while (eventHistory.length > 0 && eventHistory[0].timestamp < cutoff) {
      eventHistory.shift();
    }

    // Broadcast to all subscribers
    console.log(`📡 Broadcasting admin event: ${event.type} to ${subscribers.size} subscribers`);
    subscribers.forEach((callback, clientId) => {
      try {
        callback(fullEvent);
      } catch (error) {
        console.error(`Failed to send event to ${clientId}:`, error);
      }
    });
  }

  /**
   * Get recent events (for new connections)
   */
  getRecentEvents(since?: number): AdminEvent[] {
    if (!since) return eventHistory.slice(-10); // Last 10 events
    return eventHistory.filter(e => e.timestamp > since);
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return subscribers.size;
  }

  // ============================================
  // Convenience methods for common events
  // ============================================

  userUpdated(userId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'user_updated',
      section: 'users',
      action: 'update',
      data: { userId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  userCreated(userId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'user_created',
      section: 'users',
      action: 'create',
      data: { userId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  employeeUpdated(employeeId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'employee_updated',
      section: 'employees',
      action: 'update',
      data: { employeeId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  employeeCreated(employeeId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'employee_created',
      section: 'employees',
      action: 'create',
      data: { employeeId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  employeeDeleted(employeeId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'employee_deleted',
      section: 'employees',
      action: 'delete',
      data: { employeeId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  employeeStatusChanged(employeeId: string, status: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'employee_status_changed',
      section: 'employees',
      action: 'update',
      data: { employeeId, status },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  competitionUpdated(competitionId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'competition_updated',
      section: 'competitions',
      action: 'update',
      data: { competitionId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  withdrawalUpdated(withdrawalId: string, status: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'withdrawal_updated',
      section: 'withdrawals',
      action: 'update',
      data: { withdrawalId, status },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  withdrawalProcessed(withdrawalId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'withdrawal_processed',
      section: 'pending-withdrawals',
      action: 'update',
      data: { withdrawalId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  depositUpdated(transactionId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'deposit_updated',
      section: 'financial',
      action: 'update',
      data: { transactionId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  settingsUpdated(settingType: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'settings_updated',
      section: 'settings',
      action: 'update',
      data: { settingType },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  fraudAlertUpdated(alertId: string, status: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'fraud_alert_updated',
      section: 'fraud',
      action: 'update',
      data: { alertId, status },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  kycUpdated(userId: string, status: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'kyc_updated',
      section: 'kyc-history',
      action: 'update',
      data: { userId, status },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  badgeUpdated(badgeId: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'badge_updated',
      section: 'badges',
      action: 'update',
      data: { badgeId },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  symbolUpdated(symbol: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'symbol_updated',
      section: 'symbols',
      action: 'update',
      data: { symbol },
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }

  refreshSection(section: string, adminInfo?: { id: string; email: string }) {
    this.broadcast({
      type: 'general_refresh',
      section,
      action: 'refresh',
      adminId: adminInfo?.id,
      adminEmail: adminInfo?.email,
    });
  }
}

// Singleton instance
export const adminEventsService = new AdminEventsService();

