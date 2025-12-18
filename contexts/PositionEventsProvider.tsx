'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

/**
 * Position Events Provider
 * 
 * Manages SSE connection for real-time position updates.
 * When TP/SL triggers on the server, this receives the event instantly
 * and dispatches it to all listening components.
 * 
 * Benefits over polling:
 * - < 100ms latency (vs 3+ seconds with polling)
 * - No wasted API calls
 * - Single connection per user
 */

// Event types
export interface PositionEvent {
  id: string;
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  eventType: 'closed' | 'opened' | 'modified';
  closeReason?: 'user' | 'stop_loss' | 'take_profit' | 'margin_call' | 'competition_end' | 'challenge_end';
  realizedPnl?: number;
  exitPrice?: number;
  contestType: 'competition' | 'challenge';
  timestamp: string;
}

// Custom event name for position updates
export const POSITION_SSE_EVENT = 'positionSSEEvent';

interface PositionEventsContextType {
  isConnected: boolean;
  lastEvent: PositionEvent | null;
  connectionError: string | null;
}

const PositionEventsContext = createContext<PositionEventsContextType>({
  isConnected: false,
  lastEvent: null,
  connectionError: null,
});

export const usePositionEvents = () => useContext(PositionEventsContext);

interface PositionEventsProviderProps {
  children: React.ReactNode;
  competitionId: string;
  contestType?: 'competition' | 'challenge';
}

export function PositionEventsProvider({ 
  children, 
  competitionId,
  contestType = 'competition'
}: PositionEventsProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<PositionEvent | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // Start with 2 seconds

  // Handle incoming position event
  const handlePositionEvent = useCallback((event: PositionEvent) => {
    console.log('⚡ [SSE] Position event received:', event);
    setLastEvent(event);
    
    // Dispatch custom DOM event for components to listen
    window.dispatchEvent(new CustomEvent(POSITION_SSE_EVENT, {
      detail: event
    }));

    // Show toast notification for closed positions
    if (event.eventType === 'closed') {
      const reasonText = event.closeReason === 'take_profit' ? 'Take Profit' 
        : event.closeReason === 'stop_loss' ? 'Stop Loss'
        : event.closeReason === 'margin_call' ? 'Margin Call'
        : event.closeReason === 'user' ? 'Manual Close'
        : 'Auto Close';
      
      const pnlText = event.realizedPnl !== undefined 
        ? ` • P&L: ${event.realizedPnl >= 0 ? '+' : ''}$${event.realizedPnl.toFixed(2)}`
        : '';
      
      if (event.realizedPnl !== undefined && event.realizedPnl >= 0) {
        toast.success(`${event.symbol} closed by ${reasonText}`, {
          description: `${event.side.toUpperCase()} position${pnlText}`,
        });
      } else {
        toast.info(`${event.symbol} closed by ${reasonText}`, {
          description: `${event.side.toUpperCase()} position${pnlText}`,
        });
      }
    }
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('🔌 [SSE] Connecting to position events...');
    const url = `/api/trading/position-events?competitionId=${competitionId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ [SSE] Connected to position events');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('✅ [SSE] Session established:', data.sessionId);
        } else if (data.type === 'position_event') {
          handlePositionEvent(data.event);
        }
      } catch (error) {
        console.error('[SSE] Error parsing event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ [SSE] Connection error:', error);
      setIsConnected(false);
      eventSource.close();
      
      // Attempt reconnection with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
        console.log(`🔄 [SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        setConnectionError('Connection lost. Please refresh the page.');
        console.error('❌ [SSE] Max reconnection attempts reached');
      }
    };
  }, [competitionId, handlePositionEvent]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      console.log('🔌 [SSE] Disconnecting...');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Reconnect if competitionId changes
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      reconnectAttemptsRef.current = 0;
      connect();
    }
  }, [competitionId, connect]);

  return (
    <PositionEventsContext.Provider value={{ isConnected, lastEvent, connectionError }}>
      {children}
    </PositionEventsContext.Provider>
  );
}

/**
 * Hook to listen for specific position events
 * Use this in components that need to react to position changes
 */
export function usePositionEventListener(
  callback: (event: PositionEvent) => void,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (event: CustomEvent<PositionEvent>) => {
      callbackRef.current(event.detail);
    };

    window.addEventListener(POSITION_SSE_EVENT, handler as EventListener);
    
    return () => {
      window.removeEventListener(POSITION_SSE_EVENT, handler as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

