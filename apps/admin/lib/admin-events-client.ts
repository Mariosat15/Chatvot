'use client';

/**
 * Admin Events Client - Using Polling instead of SSE
 * 
 * SSE has issues with Next.js App Router + Turbopack causing connection loops.
 * This uses simple polling every 30 seconds to check for changes.
 */

export interface AdminEvent {
  type: string;
  section: string;
  action: 'create' | 'update' | 'delete' | 'refresh';
  data?: any;
  adminId?: string;
  adminEmail?: string;
  timestamp: number;
}

type EventListener = (event: AdminEvent) => void;

class AdminEventsClient {
  private listeners: Set<EventListener> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;
  private lastEventTime = 0;
  private _isConnected = false;

  get isConnected() {
    return this._isConnected;
  }

  get subscriberCount() {
    return this.listeners.size;
  }

  /**
   * Add a listener for admin events
   */
  addListener(listener: EventListener): () => void {
    this.listeners.add(listener);
    
    // Start polling if this is the first listener
    if (this.listeners.size === 1) {
      this.startPolling();
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
      
      // Stop polling if no more listeners
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  private startPolling() {
    if (this.pollInterval) return;
    
    this._isConnected = true;
    console.log('📡 [Polling] Started admin events polling (every 30s)');
    
    // Poll every 30 seconds
    this.pollInterval = setInterval(() => this.poll(), 30000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this._isConnected = false;
    console.log('📡 [Polling] Stopped admin events polling');
  }

  private async poll() {
    try {
      const url = `/api/admin/events/poll${this.lastEventTime ? `?since=${this.lastEventTime}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.events && data.events.length > 0) {
        data.events.forEach((event: AdminEvent) => {
          if (event.timestamp) {
            this.lastEventTime = Math.max(this.lastEventTime, event.timestamp);
          }
          
          // Notify all listeners
          this.listeners.forEach(listener => {
            try {
              listener(event);
            } catch (err) {
              console.error('Error in event listener:', err);
            }
          });
        });
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  reconnect() {
    this.stopPolling();
    if (this.listeners.size > 0) {
      this.startPolling();
    }
  }
}

// Singleton instance
let adminEventsClient: AdminEventsClient | null = null;

export function getAdminEventsClient(): AdminEventsClient {
  if (typeof window === 'undefined') {
    return {
      isConnected: false,
      subscriberCount: 0,
      addListener: () => () => {},
      reconnect: () => {},
    } as AdminEventsClient;
  }
  
  if (!adminEventsClient) {
    adminEventsClient = new AdminEventsClient();
  }
  
  return adminEventsClient;
}
