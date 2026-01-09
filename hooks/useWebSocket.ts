'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

interface UseWebSocketOptions {
  token: string | null;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  send: (message: any) => void;
  subscribe: (conversationId: string) => void;
  unsubscribe: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  disconnect: () => void;
}

// Get WebSocket URL from environment or default
function getWebSocketUrl(): string {
  // In production, use the configured WebSocket URL
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_WS_URL;
    
    // If env variable is set and already includes path, use as-is
    if (envUrl) {
      // Remove trailing slash and return
      return envUrl.replace(/\/$/, '');
    }
    
    // Default: construct from hostname
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.hostname}:3003/ws`;
  }
  return 'ws://localhost:3003/ws';
}

export function useWebSocket({
  token,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    cleanup();

    try {
      const baseUrl = getWebSocketUrl();
      const wsUrl = `${baseUrl}?token=${encodeURIComponent(token)}&type=user`;
      console.log('🔌 [WS] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        onConnect?.();

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 25000); // Every 25 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        cleanup();
        onDisconnect?.();

        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`🔄 Reconnecting in ${reconnectInterval}ms (attempt ${reconnectCountRef.current}/${reconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnecting(false);
    }
  }, [token, onConnect, onDisconnect, onMessage, onError, reconnectAttempts, reconnectInterval, cleanup]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      wsRef.current.close(1000, 'User initiated disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, [cleanup]);

  // Send message
  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }, []);

  // Subscribe to conversation
  const subscribe = useCallback((conversationId: string) => {
    send({ type: 'subscribe', conversationId });
  }, [send]);

  // Unsubscribe from conversation
  const unsubscribe = useCallback((conversationId: string) => {
    send({ type: 'unsubscribe', conversationId });
  }, [send]);

  // Set typing indicator
  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    send({ type: 'typing', conversationId, isTyping });
  }, [send]);

  // Connect when token is available
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    send,
    subscribe,
    unsubscribe,
    setTyping,
    disconnect,
  };
}

export default useWebSocket;

