'use client';

/**
 * Global Admin Events Client (Singleton)
 * 
 * This manages a SINGLE SSE connection for the entire admin app.
 * It's outside React's lifecycle to avoid reconnection loops.
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
  private eventSource: EventSource | null = null;
  private listeners: Set<EventListener> = new Set();
  private isConnecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastEventTime = 0;
  private _isConnected = false;
  private _subscriberCount = 0;
  private connectionAttempts = 0;
  private maxReconnectDelay = 30000; // Max 30 seconds between reconnects

  get isConnected() {
    return this._isConnected;
  }

  get subscriberCount() {
    return this._subscriberCount;
  }

  /**
   * Add a listener for admin events
   */
  addListener(listener: EventListener): () => void {
    this.listeners.add(listener);
    
    // Start connection if this is the first listener
    if (this.listeners.size === 1 && !this.eventSource) {
      this.connect();
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
      
      // Disconnect if no more listeners
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private connect() {
    // Prevent multiple simultaneous connections
    if (this.isConnecting || this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    // Build URL
    let url = '/api/admin/events';
    if (this.lastEventTime > 0) {
      url += `?since=${this.lastEventTime}`;
    }

    console.log(`📡 [Global] Connecting to SSE (attempt ${this.connectionAttempts})...`);
    
    try {
      const eventSource = new EventSource(url);
      this.eventSource = eventSource;

      eventSource.onopen = () => {
        console.log('📡 [Global] SSE connection opened');
        this.isConnecting = false;
        this._isConnected = true;
        this.connectionAttempts = 0; // Reset on successful connection
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          
          if (event.type === 'connected') {
            this._subscriberCount = event.subscriberCount;
            return;
          }
          
          if (event.type === 'ping') {
            return; // Heartbeat
          }

          if (event.timestamp) {
            this.lastEventTime = event.timestamp;
          }

          // Notify all listeners
          this.listeners.forEach(listener => {
            try {
              listener(event);
            } catch (err) {
              console.error('Error in event listener:', err);
            }
          });
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        console.error('📡 [Global] SSE connection error');
        this.isConnecting = false;
        this._isConnected = false;
        
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Exponential backoff for reconnection
        if (this.listeners.size > 0) {
          const delay = Math.min(
            1000 * Math.pow(2, this.connectionAttempts),
            this.maxReconnectDelay
          );
          console.log(`📡 [Global] Reconnecting in ${delay / 1000}s...`);
          
          this.reconnectTimeout = setTimeout(() => {
            if (this.listeners.size > 0) {
              this.connect();
            }
          }, delay);
        }
      };
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      this.isConnecting = false;
    }
  }

  private disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.eventSource) {
      console.log('📡 [Global] Disconnecting SSE');
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this._isConnected = false;
    this.connectionAttempts = 0;
  }

  /**
   * Force reconnect
   */
  reconnect() {
    this.disconnect();
    if (this.listeners.size > 0) {
      this.connect();
    }
  }
}

// Singleton instance - only create in browser
let adminEventsClient: AdminEventsClient | null = null;

export function getAdminEventsClient(): AdminEventsClient {
  if (typeof window === 'undefined') {
    // Return a no-op client for SSR
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

