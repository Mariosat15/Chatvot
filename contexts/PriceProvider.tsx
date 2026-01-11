'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

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
  isStale: boolean;
  lastUpdate: number;
  forceRefresh: () => void;
}

// Combined state to batch updates (prevents multiple re-renders)
interface PriceState {
  prices: Map<ForexSymbol, PriceQuote>;
  isConnected: boolean;
  marketOpen: boolean;
  marketStatus: string;
  isStale: boolean;
  lastUpdate: number;
}

const PriceContext = createContext<PriceContextValue | undefined>(undefined);

// Polling interval - 2000ms reduces CPU load significantly while still being responsive
const POLLING_INTERVAL = PERFORMANCE_INTERVALS.PRICE_POLLING;

// Stale price threshold - if no update for this long, prices are considered stale
// Increased to 15 seconds to reduce false positives during TP/SL processing
const STALE_THRESHOLD_MS = 15000; // 15 seconds

// Max consecutive errors before showing stale indicator
const MAX_CONSECUTIVE_ERRORS = 8;

export const PriceProvider = ({ children }: { children: React.ReactNode }) => {
  // Combined state to batch all updates into single re-render
  const [state, setState] = useState<PriceState>({
    prices: new Map(),
    isConnected: false,
    marketOpen: true,
    marketStatus: 'Connecting...',
    isStale: false,
    lastUpdate: 0,
  });

  const [subscriptions, setSubscriptions] = useState<Set<ForexSymbol>>(new Set());
  
  // Track if fetch is in progress to prevent overlapping requests
  const fetchingRef = useRef(false);
  // Track last successful fetch time
  const lastFetchRef = useRef(0);
  // Track consecutive errors
  const errorCountRef = useRef(0);
  // Track stale check interval
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Force refresh prices (can be called manually)
  const forceRefresh = useCallback(() => {
    fetchingRef.current = false;
    errorCountRef.current = 0;
    // Reset stale state immediately
    setState(prev => ({ ...prev, isStale: false, marketStatus: 'Refreshing...' }));
    log('🔄 Force refresh triggered');
  }, []);

  // Stale price detection
  useEffect(() => {
    // Check for stale prices every second
    staleCheckRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceUpdate = now - lastFetchRef.current;
      const isStale = timeSinceUpdate > STALE_THRESHOLD_MS && lastFetchRef.current > 0;
      
      setState(prev => {
        if (prev.isStale !== isStale) {
          if (isStale) {
            log('⚠️ Prices are stale - no update for', timeSinceUpdate, 'ms');
          }
          return { ...prev, isStale };
        }
        return prev;
      });
    }, 1000);

    return () => {
      if (staleCheckRef.current) {
        clearInterval(staleCheckRef.current);
      }
    };
  }, []);

  // Fetch prices effect with visibility awareness
  useEffect(() => {
    if (subscriptions.size === 0) {
      setState(prev => prev.isConnected ? { ...prev, isConnected: false } : prev);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Fetch REAL prices from API
    const fetchPrices = async () => {
      // Skip if tab is hidden - save resources
      // BUT continue if we're in fullscreen mode (fullscreen can cause document.hidden to be true)
      const isInFullscreen = !!document.fullscreenElement;
      if (document.hidden && !isInFullscreen) {
        log('⏸️ Skipping fetch - tab is hidden');
        return;
      }

      // Prevent overlapping requests
      if (fetchingRef.current) {
        log('⏳ Skipping fetch - previous request still in progress');
        return;
      }

      fetchingRef.current = true;

      try {
        const symbolsArray = Array.from(subscriptions);
        log('🔄 Fetching REAL prices for:', symbolsArray);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        const response = await fetch('/api/trading/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: symbolsArray }),
          cache: 'no-store',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          log('💰 Received REAL prices:', data.prices.length, 'quotes');
          
          const now = Date.now();
          lastFetchRef.current = now;
          errorCountRef.current = 0; // Reset error count on success

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
                prev.marketStatus === data.status &&
                !prev.isStale) {
              return prev;
            }

            return {
              prices: hasChanges ? newPrices : prev.prices,
              isConnected: true,
              marketOpen: data.marketOpen,
              marketStatus: data.status,
              isStale: false,
              lastUpdate: now,
            };
          });
        } else if (response.status === 404) {
          setState(prev => prev.isConnected ? { ...prev, isConnected: false } : prev);
        } else {
          errorCountRef.current++;
          setState(prev => ({ 
            ...prev, 
            marketStatus: '⚠️ Connection Error',
            isStale: true,
          }));
        }
      } catch (error) {
        // Check if this is an abort error (expected during timeout or navigation)
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        
        if (!isAbortError) {
          errorCountRef.current++;
          log('❌ Price fetch error:', error);
          
          // If too many consecutive errors, show stale indicator
          if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
            setState(prev => ({ 
              ...prev, 
              isConnected: false,
              isStale: true,
              marketStatus: '⚠️ Reconnecting...',
            }));
          }
        } else {
          // Abort is expected - don't count as error, just log
          log('⏹️ Price fetch aborted (timeout or navigation)');
        }
      } finally {
        fetchingRef.current = false;
      }
    };

    // Handle visibility change - pause/resume polling
    const handleVisibilityChange = () => {
      const isInFullscreen = !!document.fullscreenElement;
      
      // If we're in fullscreen mode, don't pause - fullscreen can trigger visibility change
      if (document.hidden && !isInFullscreen) {
        log('👁️ Tab hidden - pausing price updates');
      } else {
        log('👁️ Tab visible - resuming price updates');
        // Reset stale state when tab becomes visible
        errorCountRef.current = 0;
        fetchPrices(); // Fetch immediately when tab becomes visible
      }
    };
    
    // Handle fullscreen change - ensure prices continue updating
    const handleFullscreenChange = () => {
      const isInFullscreen = !!document.fullscreenElement;
      log(isInFullscreen ? '📺 Entered fullscreen - keeping prices active' : '📺 Exited fullscreen');
      
      // If entering fullscreen and prices are stale, force refresh
      if (isInFullscreen) {
        errorCountRef.current = 0;
        fetchPrices();
      }
    };

    // Initial fetch
    fetchPrices();

    // Update prices at polling interval (pauses when tab hidden)
    intervalId = setInterval(fetchPrices, POLLING_INTERVAL);

    // Listen for visibility and fullscreen changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
    isStale: state.isStale,
    lastUpdate: state.lastUpdate,
    forceRefresh,
  }), [state, subscribe, unsubscribe, forceRefresh]);

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export const usePrices = () => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};
