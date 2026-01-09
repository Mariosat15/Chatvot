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
  const isUnmountedRef = useRef(false);
  const lastConnectAttemptRef = useRef(0);

  // Store callbacks in refs to avoid dependency changes causing reconnects
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onMessage, onConnect, onDisconnect, onError]);

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
    // Prevent multiple rapid connection attempts
    const now = Date.now();
    if (now - lastConnectAttemptRef.current < 2000) {
      console.log('🛑 [WS] Throttling connection attempt');
      return;
    }
    lastConnectAttemptRef.current = now;
    
    if (!token || isUnmountedRef.current) {
      return;
    }
    
    // Check if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('🔌 [WS] Already connected');
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('🔌 [WS] Already connecting');
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
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        onConnectRef.current?.();

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
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event.code);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        cleanup();
        onDisconnectRef.current?.();

        // Don't reconnect if unmounted or clean close
        if (isUnmountedRef.current || event.code === 1000) {
          return;
        }

        // Attempt reconnection with exponential backoff
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          // Exponential backoff: 3s, 6s, 12s, 24s, 48s
          const delay = reconnectInterval * Math.pow(2, reconnectCountRef.current - 1);
          const cappedDelay = Math.min(delay, 60000); // Cap at 60 seconds
          console.log(`🔄 Reconnecting in ${cappedDelay}ms (attempt ${reconnectCountRef.current}/${reconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, cappedDelay);
        } else {
          console.log('❌ [WS] Max reconnect attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onErrorRef.current?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnecting(false);
    }
  }, [token, reconnectAttempts, reconnectInterval, cleanup]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    reconnectCountRef.current = reconnectAttempts; // Prevent reconnection
    cleanup();
    if (wsRef.current) {
      wsRef.current.close(1000, 'User initiated disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, [cleanup, reconnectAttempts]);

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
    isUnmountedRef.current = false;
    
    if (token) {
      // Small delay to prevent double-connection on strict mode
      const timeout = setTimeout(() => {
        if (!isUnmountedRef.current) {
          connect();
        }
      }, 100);
      
      return () => {
        clearTimeout(timeout);
        isUnmountedRef.current = true;
        cleanup();
        if (wsRef.current) {
          wsRef.current.close(1000, 'Component unmounting');
          wsRef.current = null;
        }
        setIsConnected(false);
        setIsConnecting(false);
      };
    }
    
    return () => {
      isUnmountedRef.current = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Only reconnect when token changes

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

