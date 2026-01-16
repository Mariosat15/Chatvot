'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search, Zap, Loader2, Swords, Gem, Globe, TrendingUp } from 'lucide-react';

// Currency flag emojis
const CURRENCY_FLAGS: Record<string, string> = {
  EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', MXN: '🇲🇽', ZAR: '🇿🇦',
  TRY: '🇹🇷', SEK: '🇸🇪', NOK: '🇳🇴', XAU: '🥇', XAG: '🥈',
};

// Default pairs (fallback if database is empty)
const DEFAULT_PAIR_CATEGORIES = {
  major: {
    label: '⚔️ Majors',
    icon: <Swords className="w-3 h-3" />,
    pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD'] as ForexSymbol[],
  },
  cross: {
    label: '💎 Crosses',
    icon: <Gem className="w-3 h-3" />,
    pairs: ['EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/AUD', 'GBP/AUD', 'EUR/CAD', 'AUD/JPY', 'CHF/JPY', 'EUR/CHF', 'GBP/CHF', 'AUD/NZD', 'EUR/NZD', 'GBP/NZD', 'NZD/JPY', 'CAD/JPY', 'AUD/CAD', 'AUD/CHF', 'NZD/CAD'] as ForexSymbol[],
  },
  exotic: {
    label: '🌍 Exotic',
    icon: <Globe className="w-3 h-3" />,
    pairs: ['USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK'] as ForexSymbol[],
  },
};

interface TradingSymbolData {
  symbol: ForexSymbol;
  name: string;
  category: 'major' | 'cross' | 'exotic' | 'custom';
  enabled: boolean;
}

export default function GameMarketWatchSidebar() {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol: selectedSymbol, setSymbol } = useChartSymbol();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [pairCategories, setPairCategories] = useState(DEFAULT_PAIR_CATEGORIES);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    major: true,
    cross: false,
    exotic: false,
  });

  // Fetch enabled symbols from database
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch('/api/trading/symbols');
        if (res.ok) {
          const data = await res.json();
          
          // Group symbols by category
          const grouped: Record<string, { label: string; icon: JSX.Element; pairs: ForexSymbol[] }> = {
            major: { label: '⚔️ Majors', icon: <Swords className="w-3 h-3" />, pairs: [] },
            cross: { label: '💎 Crosses', icon: <Gem className="w-3 h-3" />, pairs: [] },
            exotic: { label: '🌍 Exotic', icon: <Globe className="w-3 h-3" />, pairs: [] },
          };
          
          data.symbols.forEach((sym: TradingSymbolData) => {
            if (sym.enabled && grouped[sym.category]) {
              grouped[sym.category].pairs.push(sym.symbol);
            }
          });
          
          const totalPairs = Object.values(grouped).reduce((sum, cat) => sum + cat.pairs.length, 0);
          if (totalPairs > 0) {
            setPairCategories(grouped as typeof DEFAULT_PAIR_CATEGORIES);
          }
        }
      } catch (error) {
        console.error('Failed to fetch symbols, using defaults:', error);
      }
      setIsLoadingSymbols(false);
    };
    
    fetchSymbols();
  }, []);

  // Subscribe to all enabled pairs
  useEffect(() => {
    if (isLoadingSymbols) return;
    
    const allPairs = Object.values(pairCategories).flatMap(cat => cat.pairs);
    allPairs.forEach(pair => subscribe(pair));
    
    return () => {
      allPairs.forEach(pair => unsubscribe(pair));
    };
  }, [subscribe, unsubscribe, pairCategories, isLoadingSymbols]);

  // Filter pairs based on search
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return pairCategories;

    const filtered: typeof pairCategories = {
      major: { ...pairCategories.major, pairs: [] },
      cross: { ...pairCategories.cross, pairs: [] },
      exotic: { ...pairCategories.exotic, pairs: [] },
    };

    Object.entries(pairCategories).forEach(([key, category]) => {
      if (filtered[key as keyof typeof pairCategories]) {
        filtered[key as keyof typeof pairCategories].pairs = category.pairs.filter(
          pair => pair.toLowerCase().includes(query) || pair.replace('/', '').toLowerCase().includes(query)
        );
      }
    });

    return filtered;
  }, [searchQuery, pairCategories]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleSelect = (pair: string) => {
    setSymbol(pair);
  };

  const getFlag = (symbol: ForexSymbol) => {
    const [base] = symbol.split('/');
    return CURRENCY_FLAGS[base] || '💱';
  };

  const totalPairs = Object.values(pairCategories).reduce((sum, cat) => sum + cat.pairs.length, 0);
  
  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/50 to-pink-600/50 px-3 py-2 flex items-center justify-between border-b border-purple-500/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-300" />
          <span className="text-white font-bold text-sm">🎮 Market Watch</span>
        </div>
        <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">
          {isLoadingSymbols ? '...' : `${totalPairs}`}
        </span>
      </div>
      
      {/* Search */}
      <div className="p-2 border-b border-purple-500/20">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-dark-400/50 border border-purple-500/30 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_55px_55px_35px] gap-0.5 px-2 py-1 text-[8px] font-bold text-purple-400 border-b border-purple-500/20 bg-purple-900/20 uppercase tracking-wider">
        <span>Pair</span>
        <span className="text-right">Bid</span>
        <span className="text-right">Ask</span>
        <span className="text-right">Sp</span>
      </div>
      
      {/* Pairs List - Scrollable */}
      <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
        {isLoadingSymbols ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <span className="text-purple-400 text-xs">Loading...</span>
          </div>
        ) : (
          Object.entries(filteredCategories).map(([categoryKey, category]) => {
            if (category.pairs.length === 0) return null;
            const isExpanded = expandedCategories[categoryKey];
            
            return (
              <div key={categoryKey} className="border-b border-purple-500/10 last:border-b-0">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(categoryKey)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-purple-300 hover:bg-purple-500/10 transition-colors"
                >
                  <span className="text-purple-400">{category.icon}</span>
                  {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                  <span className="flex-1 text-left">{category.label}</span>
                  <span className="px-1 py-0.5 bg-purple-500/20 rounded text-[9px] text-purple-300">
                    {category.pairs.length}
                  </span>
                </button>
                
                {/* Pairs */}
                {isExpanded && (
                  <div className="pb-0.5">
                    {category.pairs.map((pair) => {
                      const quote = prices.get(pair);
                      const isSelected = selectedSymbol === pair;
                      const isJPY = pair.includes('JPY');
                      const decimals = isJPY ? 3 : 5;
                      
                      return (
                        <div
                          key={pair}
                          onClick={() => handleSelect(pair)}
                          className={cn(
                            "grid grid-cols-[1fr_55px_55px_35px] gap-0.5 px-2 py-1 cursor-pointer transition-all border-l-2 mx-0.5 rounded-r",
                            "hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-transparent",
                            isSelected 
                              ? "bg-gradient-to-r from-purple-600/30 to-transparent border-l-purple-500" 
                              : "border-l-transparent hover:border-l-purple-500/50"
                          )}
                        >
                          {/* Symbol */}
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px]">{getFlag(pair as ForexSymbol)}</span>
                            <span className={cn(
                              "text-[10px] font-bold truncate",
                              isSelected ? "text-purple-300" : "text-white"
                            )}>
                              {pair.replace('/', '')}
                            </span>
                            {isSelected && <Zap className="w-2.5 h-2.5 text-yellow-400" />}
                          </div>

                          {quote ? (
                            <>
                              {/* Bid */}
                              <div className="text-right">
                                <span className="text-[9px] font-mono text-cyan-400">
                                  {quote.bid.toFixed(decimals)}
                                </span>
                              </div>

                              {/* Ask */}
                              <div className="text-right">
                                <span className="text-[9px] font-mono text-pink-400">
                                  {quote.ask.toFixed(decimals)}
                                </span>
                              </div>

                              {/* Spread */}
                              <div className="text-right">
                                <span className="text-[8px] font-mono text-gray-400">
                                  {((quote.spread / quote.mid) * 10000).toFixed(1)}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-3 flex items-center justify-end">
                              <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(139, 92, 246, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </div>
  );
}
