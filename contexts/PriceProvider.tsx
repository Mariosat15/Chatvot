'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

// Disable debug logging in production
const DEBUG = false;
const log = (...args: unknown[]): void => { if (DEBUG) console.log(...args); };
const error = (...args: unknown[]): void => { if (DEBUG) console.error(...args); };

// Price quote structure
interface PriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
}

interface PriceContextValue {
  prices: Map<ForexSymbol, PriceQuote>;
  subscribe: (symbol: ForexSymbol) => void;
  unsubscribe: (symbol: ForexSymbol) => void;
  isConnected: boolean;
  marketOpen: boolean;
  marketStatus: string;
}

const PriceContext = createContext<PriceContextValue | undefined>(undefined);

export const PriceProvider = ({ children }: { children: React.ReactNode }) => {
  const [prices, setPrices] = useState<Map<ForexSymbol, PriceQuote>>(new Map());
  const [subscriptions, setSubscriptions] = useState<Set<ForexSymbol>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [marketOpen, setMarketOpen] = useState(true);
  const [marketStatus, setMarketStatus] = useState('Connecting...');

  // Subscribe to a symbol
  const subscribe = useCallback((symbol: ForexSymbol) => {
    setSubscriptions((prev) => {
      const next = new Set(prev);
      next.add(symbol);
      return next;
    });
  }, []);

  // Unsubscribe from a symbol
  const unsubscribe = useCallback((symbol: ForexSymbol) => {
    setSubscriptions((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
  }, []);

  // Simulate real-time price updates
  useEffect(() => {
    if (subscriptions.size === 0) {
      setIsConnected(false);
      return;
    }

    setIsConnected(true);

    // Fetch REAL prices from Massive.com API
    const fetchPrices = async () => {
      try {
        const symbolsArray = Array.from(subscriptions);
        log('🔄 Fetching REAL prices for:', symbolsArray);
        
        const response = await fetch('/api/trading/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: symbolsArray }),
          cache: 'no-store', // Always get fresh data
        });

        if (response.ok) {
          const data = await response.json();
          log('💰 Received REAL prices:', data.prices.length, 'quotes');
          log(`📊 Market Status: ${data.status}`);
          
          setMarketOpen(data.marketOpen);
          setMarketStatus(data.status);
          
          setPrices((prev) => {
            const next = new Map(prev);
            data.prices.forEach((quote: PriceQuote) => {
              next.set(quote.symbol, quote);
            });
            return next;
          });
        } else if (response.status === 404) {
          // API endpoint doesn't exist (likely not on trading page) - fail silently
          setIsConnected(false);
          return;
        } else {
          error('❌ Price fetch failed:', response.status, response.statusText);
          setMarketStatus('⚠️ Connection Error');
        }
      } catch (error) {
        // Fail silently if not on a page that uses prices
        setIsConnected(false);
      }
    };

    fetchPrices();

    // Update prices every 2 seconds (if market is open, prices will update; if closed, they stay the same)
    const interval = setInterval(fetchPrices, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [subscriptions]);

  const value: PriceContextValue = {
    prices,
    subscribe,
    unsubscribe,
    isConnected,
    marketOpen,
    marketStatus,
  };

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export const usePrices = () => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};

