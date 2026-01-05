'use client';

import { useState, useMemo, useEffect } from 'react';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Search, TrendingUp, ArrowLeftRight, Globe, Star, ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react';

// Default categorized forex pairs (fallback)
const DEFAULT_PAIR_CATEGORIES = {
  major: {
    name: 'Major Pairs',
    icon: TrendingUp,
    description: 'Most traded, tightest spreads',
    pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'] as ForexSymbol[],
  },
  cross: {
    name: 'Cross Pairs',
    icon: ArrowLeftRight,
    description: 'Currency crosses without USD',
    pairs: [
      'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD', 'EUR/CAD', 'EUR/NZD',
      'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
      'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
      'CAD/JPY', 'CAD/CHF', 'CHF/JPY',
      'NZD/JPY', 'NZD/CHF', 'NZD/CAD',
    ] as ForexSymbol[],
  },
  exotic: {
    name: 'Exotic Pairs',
    icon: Globe,
    description: 'Emerging market currencies',
    pairs: ['USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK'] as ForexSymbol[],
  },
  custom: {
    name: 'Custom',
    icon: Sparkles,
    description: 'Custom added symbols',
    pairs: [] as ForexSymbol[],
  },
};

type PairCategoriesType = typeof DEFAULT_PAIR_CATEGORIES;

interface TradingSymbolData {
  symbol: ForexSymbol;
  name: string;
  category: 'major' | 'cross' | 'exotic' | 'custom';
  enabled: boolean;
}

// Get pair info
function getPairInfo(symbol: ForexSymbol) {
  const config = FOREX_PAIRS[symbol];
  return {
    symbol,
    name: config?.name || symbol,
    base: symbol.split('/')[0],
    quote: symbol.split('/')[1],
  };
}

// Currency flag emoji mapping
const CURRENCY_FLAGS: Record<string, string> = {
  EUR: '🇪🇺',
  USD: '🇺🇸',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CHF: '🇨🇭',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  NZD: '🇳🇿',
  MXN: '🇲🇽',
  ZAR: '🇿🇦',
  TRY: '🇹🇷',
  SEK: '🇸🇪',
  NOK: '🇳🇴',
};

interface SymbolSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSymbol: ForexSymbol;
  onSelectSymbol: (symbol: ForexSymbol) => void;
  portalContainer?: HTMLElement | null;
  favorites?: ForexSymbol[];
  onToggleFavorite?: (symbol: ForexSymbol) => void;
}

export function SymbolSelector({
  open,
  onOpenChange,
  selectedSymbol,
  onSelectSymbol,
  portalContainer,
  favorites = [],
  onToggleFavorite,
}: SymbolSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    major: true,
    cross: true,
    exotic: true,
    custom: true,
    favorites: true,
  });
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [pairCategories, setPairCategories] = useState<PairCategoriesType>(DEFAULT_PAIR_CATEGORIES);

  // Fetch enabled symbols from database
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch('/api/trading/symbols');
        if (res.ok) {
          const data = await res.json();
          
          // Group symbols by category
          const grouped: PairCategoriesType = {
            major: { ...DEFAULT_PAIR_CATEGORIES.major, pairs: [] },
            cross: { ...DEFAULT_PAIR_CATEGORIES.cross, pairs: [] },
            exotic: { ...DEFAULT_PAIR_CATEGORIES.exotic, pairs: [] },
            custom: { ...DEFAULT_PAIR_CATEGORIES.custom, pairs: [] },
          };
          
          data.symbols.forEach((sym: TradingSymbolData) => {
            if (sym.enabled && grouped[sym.category]) {
              grouped[sym.category].pairs.push(sym.symbol);
            }
          });
          
          // Only update if we have symbols
          const totalPairs = Object.values(grouped).reduce((sum, cat) => sum + cat.pairs.length, 0);
          if (totalPairs > 0) {
            setPairCategories(grouped);
          }
        }
      } catch (error) {
        console.error('Failed to fetch symbols, using defaults:', error);
      }
      setIsLoadingSymbols(false);
    };
    
    if (open) {
      fetchSymbols();
    }
  }, [open]);

  // Filter pairs based on search
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    if (!query) {
      // Return only categories that have pairs
      const result: Partial<PairCategoriesType> = {};
      Object.entries(pairCategories).forEach(([key, category]) => {
        if (category.pairs.length > 0) {
          result[key as keyof PairCategoriesType] = category;
        }
      });
      return result as PairCategoriesType;
    }

    const filtered: Partial<PairCategoriesType> = {};
    
    Object.entries(pairCategories).forEach(([key, category]) => {
      const matchingPairs = category.pairs.filter((symbol) => {
        const info = getPairInfo(symbol);
        return (
          symbol.toLowerCase().includes(query) ||
          symbol.replace('/', '').toLowerCase().includes(query) ||
          info.name.toLowerCase().includes(query) ||
          info.base.toLowerCase().includes(query) ||
          info.quote.toLowerCase().includes(query)
        );
      });

      if (matchingPairs.length > 0) {
        filtered[key as keyof PairCategoriesType] = {
          ...category,
          pairs: matchingPairs,
        };
      }
    });

    return filtered as PairCategoriesType;
  }, [searchQuery, pairCategories]);

  // Favorites section
  const favoritePairs = useMemo(() => {
    if (!favorites || favorites.length === 0) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return favorites;
    return favorites.filter((symbol) => {
      const info = getPairInfo(symbol);
      return (
        symbol.toLowerCase().includes(query) ||
        symbol.replace('/', '').toLowerCase().includes(query) ||
        info.name.toLowerCase().includes(query)
      );
    });
  }, [favorites, searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSelect = (symbol: ForexSymbol) => {
    onSelectSymbol(symbol);
    onOpenChange(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-[#131722] border-[#2b2b43] text-white max-w-md p-0 gap-0 overflow-hidden" 
        style={{ zIndex: 99999 }} 
        container={portalContainer}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-[#2b2b43]">
          <DialogTitle className="text-white text-lg font-semibold">Select Symbol</DialogTitle>
          <DialogDescription className="text-[#787b86] text-sm">Choose a currency pair to trade</DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-4 py-3 border-b border-[#2b2b43]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787b86]" />
            <Input
              type="text"
              placeholder="Search pairs... (e.g., EUR, USD/JPY)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#1e222d] border-[#2b2b43] text-white placeholder:text-[#787b86] h-10 focus:border-[#2962ff] focus:ring-[#2962ff]"
              autoFocus
            />
          </div>
        </div>

        {/* Pairs List */}
        <div className="max-h-[400px] overflow-y-auto">
          {/* Favorites Section */}
          {favoritePairs.length > 0 && (
            <div className="border-b border-[#2b2b43]">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); toggleCategory('favorites'); }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1e222d] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-white">Favorites</span>
                  <span className="text-xs text-[#787b86]">({favoritePairs.length})</span>
                </div>
                {expandedCategories.favorites ? (
                  <ChevronDown className="h-4 w-4 text-[#787b86]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#787b86]" />
                )}
              </button>
              {expandedCategories.favorites && (
                <div className="pb-2">
                  {favoritePairs.map((symbol) => (
                    <PairItem
                      key={symbol}
                      symbol={symbol}
                      isSelected={selectedSymbol === symbol}
                      isFavorite={true}
                      onSelect={handleSelect}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoadingSymbols && (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#787b86]" />
            </div>
          )}

          {/* Category Sections */}
          {!isLoadingSymbols && Object.entries(filteredCategories).map(([key, category]) => {
            if (!category || category.pairs.length === 0) return null;
            const Icon = category.icon;
            const isExpanded = expandedCategories[key];

            return (
              <div key={key} className="border-b border-[#2b2b43] last:border-b-0">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); toggleCategory(key); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1e222d] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn(
                      "h-4 w-4",
                      key === 'major' && "text-green-500",
                      key === 'cross' && "text-blue-500",
                      key === 'exotic' && "text-purple-500",
                      key === 'custom' && "text-yellow-500"
                    )} />
                    <span className="text-sm font-medium text-white">{category.name}</span>
                    <span className="text-xs text-[#787b86]">({category.pairs.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#787b86] hidden sm:block">{category.description}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#787b86]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#787b86]" />
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="pb-2">
                    {category.pairs.map((symbol) => (
                      <PairItem
                        key={symbol}
                        symbol={symbol}
                        isSelected={selectedSymbol === symbol}
                        isFavorite={favorites.includes(symbol)}
                        onSelect={handleSelect}
                        onToggleFavorite={onToggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* No Results */}
          {!isLoadingSymbols && Object.keys(filteredCategories).length === 0 && favoritePairs.length === 0 && (
            <div className="py-8 text-center">
              <Search className="h-8 w-8 text-[#787b86] mx-auto mb-2" />
              <p className="text-[#787b86] text-sm">No pairs found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Individual Pair Item Component
function PairItem({
  symbol,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  symbol: ForexSymbol;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (symbol: ForexSymbol) => void;
  onToggleFavorite?: (symbol: ForexSymbol) => void;
}) {
  const info = getPairInfo(symbol);
  const baseFlag = CURRENCY_FLAGS[info.base] || '💱';
  const quoteFlag = CURRENCY_FLAGS[info.quote] || '💱';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(symbol);
      }}
      className={cn(
        "w-full flex items-center justify-between px-4 py-2 hover:bg-[#1e222d] transition-colors group",
        isSelected && "bg-[#2962ff]/20 hover:bg-[#2962ff]/30"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Currency Flags */}
        <div className="flex -space-x-1">
          <span className="text-lg">{baseFlag}</span>
          <span className="text-lg">{quoteFlag}</span>
        </div>
        
        {/* Symbol and Name */}
        <div className="text-left">
          <div className={cn(
            "text-sm font-medium",
            isSelected ? "text-[#2962ff]" : "text-white"
          )}>
            {symbol}
          </div>
          <div className="text-[10px] text-[#787b86] truncate max-w-[150px]">
            {info.name}
          </div>
        </div>
      </div>

      {/* Favorite Star */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(symbol);
          }}
          className={cn(
            "p-1 rounded hover:bg-[#2b2b43] transition-colors",
            isFavorite ? "text-yellow-500" : "text-[#787b86] opacity-0 group-hover:opacity-100"
          )}
        >
          <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </button>
      )}

      {/* Selected Indicator */}
      {isSelected && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />
      )}
    </button>
  );
}

// Compact version for toolbar
export function SymbolSelectorButton({
  symbol,
  onClick,
  className,
}: {
  symbol: ForexSymbol;
  onClick: () => void;
  className?: string;
}) {
  const info = getPairInfo(symbol);
  const baseFlag = CURRENCY_FLAGS[info.base] || '💱';
  const quoteFlag = CURRENCY_FLAGS[info.quote] || '💱';

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "h-8 px-2 gap-1.5 hover:bg-[#2a2e39] text-white",
        className
      )}
    >
      <div className="flex -space-x-1">
        <span className="text-sm">{baseFlag}</span>
        <span className="text-sm">{quoteFlag}</span>
      </div>
      <span className="font-semibold text-sm">{symbol}</span>
      <ChevronDown className="h-3 w-3 text-[#787b86]" />
    </Button>
  );
}

export default SymbolSelector;

