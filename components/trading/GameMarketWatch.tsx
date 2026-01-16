'use client';

import { useState, useEffect } from 'react';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { FOREX_PAIRS, ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Zap, Star, Search, X } from 'lucide-react';

// Organize pairs by category
const PAIR_CATEGORIES = {
  '⭐ Majors': ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'],
  '💎 Crosses': ['EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD', 'GBP/JPY', 'GBP/CHF', 'AUD/JPY'],
  '🌟 Exotic': ['EUR/CAD', 'EUR/NZD', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD', 'AUD/CAD', 'AUD/NZD'],
  '🥇 Gold & More': ['XAU/USD', 'XAG/USD'],
};

interface GameMarketWatchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GameMarketWatch({ isOpen, onClose }: GameMarketWatchProps) {
  const { prices } = usePrices();
  const { symbol, setSymbol } = useChartSymbol();
  const [searchTerm, setSearchTerm] = useState('');
  const [priceChanges, setPriceChanges] = useState<Map<string, 'up' | 'down' | null>>(new Map());
  const [prevPrices, setPrevPrices] = useState<Map<string, number>>(new Map());
  
  // Track price changes for flash effect
  useEffect(() => {
    const newChanges = new Map<string, 'up' | 'down' | null>();
    
    prices.forEach((price, sym) => {
      const prev = prevPrices.get(sym);
      if (prev !== undefined) {
        if (price.bid > prev) {
          newChanges.set(sym, 'up');
        } else if (price.bid < prev) {
          newChanges.set(sym, 'down');
        }
      }
    });
    
    setPriceChanges(newChanges);
    
    // Update prev prices
    const newPrev = new Map<string, number>();
    prices.forEach((price, sym) => {
      newPrev.set(sym, price.bid);
    });
    setPrevPrices(newPrev);
    
    // Clear flash after 300ms
    const timer = setTimeout(() => {
      setPriceChanges(new Map());
    }, 300);
    
    return () => clearTimeout(timer);
  }, [prices]);
  
  // Filter pairs by search
  const filterPairs = (pairs: string[]) => {
    if (!searchTerm) return pairs;
    return pairs.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
  };
  
  const handleSelect = (pair: string) => {
    setSymbol(pair);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 shadow-2xl shadow-purple-500/20 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎮</span>
            <div>
              <h2 className="text-white font-bold text-xl">Market Watch</h2>
              <p className="text-white/70 text-xs">Select a pair to trade</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Search */}
        <div className="p-3 border-b border-purple-500/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search pairs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-400 border border-purple-500/30 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        
        {/* Pairs Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {Object.entries(PAIR_CATEGORIES).map(([category, pairs]) => {
            const filtered = filterPairs(pairs);
            if (filtered.length === 0) return null;
            
            return (
              <div key={category}>
                <h3 className="text-sm font-bold text-purple-400 mb-2 px-1">{category}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {filtered.map((pair) => {
                    const price = prices.get(pair);
                    const isSelected = symbol === pair;
                    const change = priceChanges.get(pair);
                    const pairInfo = FOREX_PAIRS[pair as ForexSymbol];
                    const decimals = pair.includes('JPY') ? 3 : 5;
                    
                    return (
                      <button
                        key={pair}
                        onClick={() => handleSelect(pair)}
                        className={cn(
                          "relative p-3 rounded-xl border-2 transition-all text-left overflow-hidden group",
                          isSelected
                            ? "bg-purple-600/30 border-purple-500 shadow-lg shadow-purple-500/30"
                            : "bg-dark-400/50 border-dark-300 hover:border-purple-500/50 hover:bg-dark-400",
                          change === 'up' && "animate-flash-green",
                          change === 'down' && "animate-flash-red"
                        )}
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-1 right-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          </div>
                        )}
                        
                        {/* Pair name */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-white font-bold text-sm">{pair}</span>
                        </div>
                        
                        {/* Price */}
                        {price ? (
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "font-mono text-lg font-bold transition-colors",
                              change === 'up' ? "text-green-400" :
                              change === 'down' ? "text-red-400" : "text-white"
                            )}>
                              {price.bid.toFixed(decimals)}
                            </span>
                            {change && (
                              change === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-green-400" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-400" />
                              )
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" />
                            <span className="text-gray-500 text-xs">Loading...</span>
                          </div>
                        )}
                        
                        {/* Spread */}
                        {price && (
                          <div className="text-[10px] text-gray-500 mt-1">
                            Spread: {((price.ask - price.bid) / (pairInfo?.pip || 0.0001)).toFixed(1)} pips
                          </div>
                        )}
                        
                        {/* Hover effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Footer - Current Selection */}
        <div className="p-3 border-t border-purple-500/30 bg-dark-400/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400 text-sm">Current:</span>
              <span className="text-white font-bold">{symbol}</span>
            </div>
            {prices.get(symbol) && (
              <span className="text-purple-400 font-mono font-bold">
                {prices.get(symbol)!.bid.toFixed(symbol.includes('JPY') ? 3 : 5)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* CSS for flash animations */}
      <style jsx global>{`
        @keyframes flash-green {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(34, 197, 94, 0.3); }
        }
        @keyframes flash-red {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(239, 68, 68, 0.3); }
        }
        .animate-flash-green {
          animation: flash-green 0.3s ease-out;
        }
        .animate-flash-red {
          animation: flash-red 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
