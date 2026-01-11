'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Default pairs (fallback if database is empty)
const DEFAULT_PAIR_CATEGORIES = {
  major: {
    label: 'Major Pairs',
    icon: '🔷',
    pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD'] as ForexSymbol[],
  },
  cross: {
    label: 'Cross Pairs',
    icon: '🔶',
    pairs: ['EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/AUD', 'GBP/AUD', 'EUR/CAD', 'AUD/JPY', 'CHF/JPY', 'EUR/CHF', 'GBP/CHF', 'AUD/NZD', 'EUR/NZD', 'GBP/NZD', 'NZD/JPY', 'CAD/JPY', 'AUD/CAD', 'AUD/CHF', 'NZD/CAD'] as ForexSymbol[],
  },
  exotic: {
    label: 'Exotic Pairs',
    icon: '💎',
    pairs: ['USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK'] as ForexSymbol[],
  },
};

interface TradingSymbolData {
  symbol: ForexSymbol;
  name: string;
  category: 'major' | 'cross' | 'exotic' | 'custom';
  enabled: boolean;
  icon?: string;
}

// Currency flag emojis
const CURRENCY_FLAGS: Record<string, string> = {
  EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', MXN: '🇲🇽', ZAR: '🇿🇦',
  TRY: '🇹🇷', SEK: '🇸🇪', NOK: '🇳🇴',
};

interface WatchlistProps {
  className?: string;
  compact?: boolean;
}

export default function Watchlist({ className, compact = false }: WatchlistProps) {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol: selectedSymbol, setSymbol } = useChartSymbol();
  
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    major: true,
    cross: true,
    exotic: true,
    custom: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [pairCategories, setPairCategories] = useState(DEFAULT_PAIR_CATEGORIES);

  // Fetch enabled symbols from database
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch('/api/trading/symbols');
        if (res.ok) {
          const data = await res.json();
          
          // Group symbols by category
          const grouped: Record<string, { label: string; icon: string; pairs: ForexSymbol[] }> = {
            major: { label: 'Major Pairs', icon: '🔷', pairs: [] },
            cross: { label: 'Cross Pairs', icon: '🔶', pairs: [] },
            exotic: { label: 'Exotic Pairs', icon: '💎', pairs: [] },
            custom: { label: 'Custom', icon: '✨', pairs: [] },
          };
          
          data.symbols.forEach((sym: TradingSymbolData) => {
            if (sym.enabled && grouped[sym.category]) {
              grouped[sym.category].pairs.push(sym.symbol);
            }
          });
          
          // Only update if we have symbols
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

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleSelectSymbol = (symbol: ForexSymbol) => {
    setSymbol(symbol);
  };

  // Filter pairs based on search
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return pairCategories;

    const filtered: typeof pairCategories = {
      major: { ...pairCategories.major, pairs: [] },
      cross: { ...pairCategories.cross, pairs: [] },
      exotic: { ...pairCategories.exotic, pairs: [] },
      custom: { label: 'Custom', icon: '✨', pairs: [] },
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

  const getFlag = (symbol: ForexSymbol) => {
    const [base] = symbol.split('/');
    return CURRENCY_FLAGS[base] || '💱';
  };

  const renderPriceRow = (symbol: ForexSymbol) => {
    const quote = prices.get(symbol);
    const isSelected = selectedSymbol === symbol;
    const isJPY = symbol.includes('JPY');
    const decimals = isJPY ? 3 : 5;

    return (
      <div
        key={symbol}
        onClick={() => handleSelectSymbol(symbol)}
        className={cn(
          "group grid gap-1 px-2 py-1.5 cursor-pointer transition-all duration-150 border-l-2",
          "hover:bg-gradient-to-r hover:from-[#2962ff]/10 hover:to-transparent",
          isSelected 
            ? "bg-gradient-to-r from-[#2962ff]/20 to-transparent border-l-[#2962ff]" 
            : "border-l-transparent hover:border-l-[#2962ff]/50",
          compact ? "grid-cols-[1fr_auto]" : "grid-cols-[100px_1fr_1fr_1fr_60px]"
        )}
      >
        {/* Symbol */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{getFlag(symbol)}</span>
          <span className={cn(
            "text-xs font-semibold truncate",
            isSelected ? "text-[#2962ff]" : "text-[#d1d4dc]"
          )}>
            {symbol.replace('/', '')}
          </span>
        </div>

        {!compact && quote && (
          <>
            {/* Bid */}
            <div className="text-right">
              <span className="text-[10px] font-mono text-[#ef5350]">
                {quote.bid.toFixed(decimals)}
              </span>
            </div>

            {/* Ask */}
            <div className="text-right">
              <span className="text-[10px] font-mono text-[#26a69a]">
                {quote.ask.toFixed(decimals)}
              </span>
            </div>

            {/* Mid (Current) */}
            <div className="text-right">
              <span className={cn(
                "text-[10px] font-mono font-bold",
                isSelected ? "text-white" : "text-[#d1d4dc]"
              )}>
                {quote.mid.toFixed(decimals)}
              </span>
            </div>

            {/* Spread */}
            <div className="text-right">
              <span className="text-[10px] font-mono text-[#787b86]">
                {((quote.spread / quote.mid) * 10000).toFixed(1)}
              </span>
            </div>
          </>
        )}

        {compact && quote && (
          <div className="text-right">
            <span className={cn(
              "text-[10px] font-mono",
              isSelected ? "text-white" : "text-[#d1d4dc]"
            )}>
              {quote.mid.toFixed(decimals)}
            </span>
          </div>
        )}

        {!quote && !compact && (
          <div className="col-span-4 text-right text-[10px] text-[#787b86]">Loading...</div>
        )}
      </div>
    );
  };

  const renderCategory = (categoryKey: string, category: typeof DEFAULT_PAIR_CATEGORIES.major) => {
    const categoryData = filteredCategories[categoryKey as keyof typeof filteredCategories];
    if (!categoryData) return null;
    const pairs = categoryData.pairs;
    if (pairs.length === 0) return null;
    const isExpanded = expandedCategories[categoryKey];

    return (
      <div key={categoryKey} className="mb-1">
        <button
          onClick={() => toggleCategory(categoryKey)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#1e222d]/50 transition-colors"
        >
          <span>{category.icon}</span>
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="flex-1 text-left">{category.label}</span>
          <span className="px-1.5 py-0.5 bg-[#2a2e39] rounded text-[9px] font-normal">
            {pairs.length}
          </span>
        </button>
        {isExpanded && (
          <div className="border-l border-[#2b2b43] ml-3">
            {pairs.map(renderPriceRow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-gradient-to-b from-[#131722] to-[#0d0f14] border border-[#2b2b43] rounded-lg overflow-hidden flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2b2b43] bg-[#0d0f14]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#2962ff]" />
          <span className="text-sm font-bold text-white">Watchlist</span>
        </div>
        <span className="text-[10px] text-[#787b86] bg-[#1e222d] px-2 py-0.5 rounded">
          {isLoadingSymbols ? (
            <Loader2 className="w-3 h-3 animate-spin inline" />
          ) : (
            `${Object.values(pairCategories).reduce((sum, cat) => sum + cat.pairs.length, 0)} pairs`
          )}
        </span>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-[#2b2b43]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#787b86]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pairs..."
            className="h-7 pl-7 text-xs bg-[#1e222d] border-[#2b2b43] text-white placeholder:text-[#787b86] focus:border-[#2962ff]"
          />
        </div>
      </div>

      {/* Column Headers */}
      {!compact && (
        <div className="grid grid-cols-[100px_1fr_1fr_1fr_60px] gap-1 px-2 py-1 text-[9px] font-semibold text-[#787b86] border-b border-[#2b2b43] bg-[#0d0f14]/50">
          <span>Symbol</span>
          <span className="text-right">Bid</span>
          <span className="text-right">Ask</span>
          <span className="text-right">Mid</span>
          <span className="text-right">Sprd</span>
        </div>
      )}

      {/* Pairs List */}
      <div className="flex-1 overflow-y-auto dark-scrollbar">
        {isLoadingSymbols ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#787b86]" />
          </div>
        ) : (
          <>
            {renderCategory('major', pairCategories.major)}
            {renderCategory('cross', pairCategories.cross)}
            {renderCategory('exotic', pairCategories.exotic)}
            {pairCategories.custom?.pairs.length > 0 && renderCategory('custom', pairCategories.custom)}
          </>
        )}
      </div>
    </div>
  );
}
