'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

// Disable debug logging in production
const DEBUG = false;
const log = (...args: unknown[]): void => { if (DEBUG) console.log(...args); };

// Price quote structure
interface PriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
}

/**
 * Normalize a price quote - ensures mid = (bid + ask) / 2
 * This prevents mid from lagging behind bid/ask on the chart
 */
function normalizePriceQuote(quote: PriceQuote): PriceQuote {
  const mid = (quote.bid + quote.ask) / 2;
  const spread = quote.ask - quote.bid;
  const safeMid = Math.max(quote.bid, Math.min(quote.ask, mid));
  
  return {
    ...quote,
    mid: Number(safeMid.toFixed(5)),
    spread: Number(Math.abs(spread).toFixed(5)),
  };
}

/**
 * Check if a price has meaningfully changed (avoids unnecessary re-renders)
 */
function priceChanged(oldPrice: PriceQuote | undefined, newPrice: PriceQuote): boolean {
  if (!oldPrice) return true;
  // Only trigger update if bid, ask, or mid changed by at least 0.00001
  const threshold = 0.00001;
  return (
    Math.abs(oldPrice.bid - newPrice.bid) >= threshold ||
    Math.abs(oldPrice.ask - newPrice.ask) >= threshold
  );
}

interface PriceContextValue {
  prices: Map<ForexSymbol, PriceQuote>;
  subscribe: (symbol: ForexSymbol) => void;
  unsubscribe: (symbol: ForexSymbol) => void;
  isConnected: boolean;
  marketOpen: boolean;
  marketStatus: string;
}

// Combined state to batch updates (prevents multiple re-renders)
interface PriceState {
  prices: Map<ForexSymbol, PriceQuote>;
  isConnected: boolean;
  marketOpen: boolean;
  marketStatus: string;
}

const PriceContext = createContext<PriceContextValue | undefined>(undefined);

// Polling interval - 1000ms is smoother and less CPU intensive
const POLLING_INTERVAL = 1000;

export const PriceProvider = ({ children }: { children: React.ReactNode }) => {
  // Combined state to batch all updates into single re-render
  const [state, setState] = useState<PriceState>({
    prices: new Map(),
    isConnected: false,
    marketOpen: true,
    marketStatus: 'Connecting...',
  });

  const [subscriptions, setSubscriptions] = useState<Set<ForexSymbol>>(new Set());
  
  // Track if fetch is in progress to prevent overlapping requests
  const fetchingRef = useRef(false);
  // Track last successful fetch time
  const lastFetchRef = useRef(0);

  // Subscribe to a symbol
  const subscribe = useCallback((symbol: ForexSymbol) => {
    setSubscriptions((prev) => {
      if (prev.has(symbol)) return prev; // No change needed
      const next = new Set(prev);
      next.add(symbol);
      return next;
    });
  }, []);

  // Unsubscribe from a symbol
  const unsubscribe = useCallback((symbol: ForexSymbol) => {
    setSubscriptions((prev) => {
      if (!prev.has(symbol)) return prev; // No change needed
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
  }, []);

  // Fetch prices effect
  useEffect(() => {
    if (subscriptions.size === 0) {
      setState(prev => prev.isConnected ? { ...prev, isConnected: false } : prev);
      return;
    }

    // Fetch REAL prices from API
    const fetchPrices = async () => {
      // Prevent overlapping requests
      if (fetchingRef.current) {
        log('⏳ Skipping fetch - previous request still in progress');
        return;
      }

      fetchingRef.current = true;

      try {
        const symbolsArray = Array.from(subscriptions);
        log('🔄 Fetching REAL prices for:', symbolsArray);
        
        const response = await fetch('/api/trading/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: symbolsArray }),
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          log('💰 Received REAL prices:', data.prices.length, 'quotes');
          
          lastFetchRef.current = Date.now();

          // BATCHED STATE UPDATE - single setState call
          setState(prev => {
            // Check if anything actually changed
            let hasChanges = false;
            const newPrices = new Map(prev.prices);
            
            data.prices.forEach((quote: PriceQuote) => {
              const normalized = normalizePriceQuote(quote);
              const existing = prev.prices.get(quote.symbol);
              
              // Only update if price actually changed
              if (priceChanged(existing, normalized)) {
                newPrices.set(quote.symbol, normalized);
                hasChanges = true;
              }
            });

            // If nothing changed, return same state (no re-render)
            if (!hasChanges && 
                prev.isConnected === true && 
                prev.marketOpen === data.marketOpen && 
                prev.marketStatus === data.status) {
              return prev;
            }

            return {
              prices: hasChanges ? newPrices : prev.prices,
              isConnected: true,
              marketOpen: data.marketOpen,
              marketStatus: data.status,
            };
          });
        } else if (response.status === 404) {
          setState(prev => prev.isConnected ? { ...prev, isConnected: false } : prev);
        } else {
          setState(prev => ({ 
            ...prev, 
            marketStatus: '⚠️ Connection Error' 
          }));
        }
      } catch {
        // Fail silently if not on a page that uses prices
        setState(prev => prev.isConnected ? { ...prev, isConnected: false } : prev);
      } finally {
        fetchingRef.current = false;
      }
    };

    // Initial fetch
    fetchPrices();

    // Update prices at reduced interval (1000ms instead of 500ms)
    const interval = setInterval(fetchPrices, POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [subscriptions]);

  // Memoize context value - only changes when state changes
  const value = useMemo<PriceContextValue>(() => ({
    prices: state.prices,
    subscribe,
    unsubscribe,
    isConnected: state.isConnected,
    marketOpen: state.marketOpen,
    marketStatus: state.marketStatus,
  }), [state, subscribe, unsubscribe]);

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export const usePrices = () => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};
