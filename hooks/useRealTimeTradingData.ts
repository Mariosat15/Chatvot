'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

/**
 * Real-Time Trading Data Hook
 * 
 * Connects to WebSocket server for instant price and candle updates.
 * Replaces HTTP polling for much better performance:
 * - 1 WebSocket connection vs 5 HTTP requests/second per user
 * - Instant updates (no 200ms polling delay)
 * - All users receive same data at same time = identical charts
 */

interface PriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  timestamp: number;
}

interface FormingCandle {
  symbol: string;
  time: number;      // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

interface RealTimeTradingData {
  prices: Map<ForexSymbol, PriceQuote>;
  formingCandles: Map<string, FormingCandle>;
  isConnected: boolean;
  lastUpdate: number;
}

// Get WebSocket URL
function getWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (envUrl) {
      return envUrl.replace(/\/$/, '');
    }
    // Production: Use /ws path through Nginx
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${wsProtocol}//${host}/ws`;
  }
  return 'ws://localhost:3003';
}

export function useRealTimeTradingData(): RealTimeTradingData {
  const [data, setData] = useState<RealTimeTradingData>({
    prices: new Map(),
    formingCandles: new Map(),
    isConnected: false,
    lastUpdate: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const baseUrl = getWebSocketUrl();
      // Connect as anonymous for price updates (no auth needed for public prices)
      const wsUrl = `${baseUrl}?token=anonymous&type=user`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        console.log('📡 [Trading WS] Connected');
        setData(prev => ({ ...prev, isConnected: true }));

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'price_update' && message.data) {
            const { prices, formingCandles, timestamp } = message.data;
            
            setData(prev => {
              const newPrices = new Map(prev.prices);
              const newFormingCandles = new Map(prev.formingCandles);
              
              // Update prices
              if (Array.isArray(prices)) {
                prices.forEach((p: PriceQuote) => {
                  if (p.symbol && p.bid && p.ask) {
                    newPrices.set(p.symbol as ForexSymbol, {
                      symbol: p.symbol as ForexSymbol,
                      bid: p.bid,
                      ask: p.ask,
                      mid: p.mid || (p.bid + p.ask) / 2,
                      timestamp: p.timestamp || timestamp || Date.now(),
                    });
                  }
                });
              }
              
              // Update forming candles
              if (Array.isArray(formingCandles)) {
                formingCandles.forEach((c: FormingCandle) => {
                  if (c.symbol && c.time !== undefined) {
                    newFormingCandles.set(c.symbol, c);
                  }
                });
              }
              
              return {
                prices: newPrices,
                formingCandles: newFormingCandles,
                isConnected: true,
                lastUpdate: Date.now(),
              };
            });
          }
        } catch (error) {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        console.log('📡 [Trading WS] Disconnected');
        setData(prev => ({ ...prev, isConnected: false }));
        
        // Cleanup heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        // Reconnect after 3 seconds
        if (!isUnmountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // Will trigger onclose
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('📡 [Trading WS] Connection error:', error);
      // Retry after 3 seconds
      if (!isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  return data;
}

export default useRealTimeTradingData;
