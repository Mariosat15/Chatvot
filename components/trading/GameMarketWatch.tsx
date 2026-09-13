"use client";

import { useState, useEffect, useMemo } from "react";
import { usePrices } from "@/contexts/PriceProvider";
import { useChartSymbol } from "@/contexts/ChartSymbolContext";
import { ForexSymbol } from "@/lib/services/pnl-calculator.service";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Zap,
  Loader2,
  Swords,
  Crown,
  Gem,
  Globe,
} from "lucide-react";

// Currency flag emojis
const CURRENCY_FLAGS: Record<string, string> = {
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  NZD: "🇳🇿",
  MXN: "🇲🇽",
  ZAR: "🇿🇦",
  TRY: "🇹🇷",
  SEK: "🇸🇪",
  NOK: "🇳🇴",
  XAU: "🥇",
  XAG: "🥈",
};

// Default pairs (fallback if database is empty)
const DEFAULT_PAIR_CATEGORIES = {
  major: {
    label: "⚔️ Major Pairs",
    icon: <Swords className="w-4 h-4" />,
    pairs: [
      "EUR/USD",
      "GBP/USD",
      "USD/JPY",
      "AUD/USD",
      "USD/CAD",
      "USD/CHF",
      "NZD/USD",
    ] as ForexSymbol[],
  },
  cross: {
    label: "💎 Cross Pairs",
    icon: <Gem className="w-4 h-4" />,
    pairs: [
      "EUR/GBP",
      "EUR/JPY",
      "GBP/JPY",
      "EUR/AUD",
      "GBP/AUD",
      "EUR/CAD",
      "AUD/JPY",
      "CHF/JPY",
      "EUR/CHF",
      "GBP/CHF",
      "AUD/NZD",
      "EUR/NZD",
      "GBP/NZD",
      "NZD/JPY",
      "CAD/JPY",
      "AUD/CAD",
      "AUD/CHF",
      "NZD/CAD",
    ] as ForexSymbol[],
  },
  exotic: {
    label: "🌍 Exotic Pairs",
    icon: <Globe className="w-4 h-4" />,
    pairs: [
      "USD/MXN",
      "USD/ZAR",
      "USD/TRY",
      "USD/SEK",
      "USD/NOK",
    ] as ForexSymbol[],
  },
};

interface TradingSymbolData {
  symbol: ForexSymbol;
  name: string;
  category: "major" | "cross" | "exotic" | "custom";
  enabled: boolean;
}

interface GameMarketWatchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GameMarketWatch({
  isOpen,
  onClose,
}: GameMarketWatchProps) {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol: selectedSymbol, setSymbol } = useChartSymbol();

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [pairCategories, setPairCategories] = useState(DEFAULT_PAIR_CATEGORIES);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    major: true,
    cross: true,
    exotic: true,
    custom: true,
  });

  // Fetch enabled symbols from database
  useEffect(() => {
    if (!isOpen) return;

    const fetchSymbols = async () => {
      try {
        const res = await fetch("/api/trading/symbols");
        if (res.ok) {
          const data = await res.json();

          // Group symbols by category
          const grouped: Record<
            string,
            { label: string; icon: React.ReactNode; pairs: ForexSymbol[] }
          > = {
            major: {
              label: "⚔️ Major Pairs",
              icon: <Swords className="w-4 h-4" />,
              pairs: [],
            },
            cross: {
              label: "💎 Cross Pairs",
              icon: <Gem className="w-4 h-4" />,
              pairs: [],
            },
            exotic: {
              label: "🌍 Exotic Pairs",
              icon: <Globe className="w-4 h-4" />,
              pairs: [],
            },
            custom: {
              label: "✨ Custom",
              icon: <Crown className="w-4 h-4" />,
              pairs: [],
            },
          };

          data.symbols.forEach((sym: TradingSymbolData) => {
            if (sym.enabled && grouped[sym.category]) {
              grouped[sym.category].pairs.push(sym.symbol);
            }
          });

          // Only update if we have symbols
          const totalPairs = Object.values(grouped).reduce(
            (sum, cat) => sum + cat.pairs.length,
            0,
          );
          if (totalPairs > 0) {
            setPairCategories(grouped as typeof DEFAULT_PAIR_CATEGORIES);
          }
        }
      } catch (error) {
        console.error("Failed to fetch symbols, using defaults:", error);
      }
      setIsLoadingSymbols(false);
    };

    fetchSymbols();
  }, [isOpen]);

  // Subscribe to all enabled pairs
  useEffect(() => {
    if (isLoadingSymbols || !isOpen) return;

    const allPairs = Object.values(pairCategories).flatMap((cat) => cat.pairs);
    allPairs.forEach((pair) => subscribe(pair));

    return () => {
      allPairs.forEach((pair) => unsubscribe(pair));
    };
  }, [subscribe, unsubscribe, pairCategories, isLoadingSymbols, isOpen]);

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
        filtered[key as keyof typeof pairCategories].pairs =
          category.pairs.filter(
            (pair) =>
              pair.toLowerCase().includes(query) ||
              pair.replace("/", "").toLowerCase().includes(query),
          );
      }
    });

    return filtered;
  }, [searchQuery, pairCategories]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const handleSelect = (pair: string) => {
    setSymbol(pair as ForexSymbol);
    onClose();
  };

  const getFlag = (symbol: ForexSymbol) => {
    const [base] = symbol.split("/");
    return CURRENCY_FLAGS[base] || "💱";
  };

  const totalPairs = Object.values(pairCategories).reduce(
    (sum, cat) => sum + cat.pairs.length,
    0,
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[420px] sm:max-h-[80vh] bg-gradient-to-br from-[#1a1025] via-[#150d20] to-[#0d0a15] rounded-xl border border-purple-500/40 shadow-2xl shadow-purple-500/20 z-50 flex flex-col overflow-hidden">
        {/* Header - Gaming Style */}
        <div className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 p-3 flex items-center justify-between border-b border-purple-400/30">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <div>
              <h2 className="text-white font-bold text-lg">Market Watch</h2>
              <p className="text-white/60 text-[10px]">
                {isLoadingSymbols
                  ? "Loading..."
                  : `${totalPairs} pairs available`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-purple-500/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
            <input
              type="text"
              placeholder="Search pairs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-dark-400/50 border border-purple-500/30 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_70px_70px_50px] gap-1 px-3 py-1.5 text-[9px] font-bold text-purple-400 border-b border-purple-500/20 bg-purple-900/20 uppercase tracking-wider">
          <span>Symbol</span>
          <span className="text-right">Bid</span>
          <span className="text-right">Ask</span>
          <span className="text-right">Sprd</span>
        </div>

        {/* Pairs List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingSymbols ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="text-purple-400 text-sm">Loading pairs...</span>
            </div>
          ) : (
            Object.entries(filteredCategories).map(
              ([categoryKey, category]) => {
                if (category.pairs.length === 0) return null;
                const isExpanded = expandedCategories[categoryKey];

                return (
                  <div
                    key={categoryKey}
                    className="border-b border-purple-500/10"
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(categoryKey)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/10 transition-colors"
                    >
                      <span className="text-purple-400">{category.icon}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span className="flex-1 text-left">{category.label}</span>
                      <span className="px-1.5 py-0.5 bg-purple-500/20 rounded text-[10px] text-purple-300">
                        {category.pairs.length}
                      </span>
                    </button>

                    {/* Pairs */}
                    {isExpanded && (
                      <div className="pb-1">
                        {category.pairs.map((pair) => {
                          const quote = prices.get(pair);
                          const isSelected = selectedSymbol === pair;
                          const isJPY = pair.includes("JPY");
                          const decimals = isJPY ? 3 : 5;

                          return (
                            <div
                              key={pair}
                              onClick={() => handleSelect(pair)}
                              className={cn(
                                "grid grid-cols-[1fr_70px_70px_50px] gap-1 px-3 py-1.5 cursor-pointer transition-all border-l-2 mx-1 rounded-r",
                                "hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-transparent",
                                isSelected
                                  ? "bg-gradient-to-r from-purple-600/30 to-transparent border-l-purple-500 shadow-lg shadow-purple-500/10"
                                  : "border-l-transparent hover:border-l-purple-500/50",
                              )}
                            >
                              {/* Symbol */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm">
                                  {getFlag(pair as ForexSymbol)}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold truncate",
                                    isSelected
                                      ? "text-purple-300"
                                      : "text-white",
                                  )}
                                >
                                  {pair.replace("/", "")}
                                </span>
                                {isSelected && (
                                  <Zap className="w-3 h-3 text-yellow-400" />
                                )}
                              </div>

                              {quote ? (
                                <>
                                  {/* Bid */}
                                  <div className="text-right">
                                    <span className="text-[11px] font-mono text-cyan-400">
                                      {quote.bid.toFixed(decimals)}
                                    </span>
                                  </div>

                                  {/* Ask */}
                                  <div className="text-right">
                                    <span className="text-[11px] font-mono text-pink-400">
                                      {quote.ask.toFixed(decimals)}
                                    </span>
                                  </div>

                                  {/* Spread in pips */}
                                  <div className="text-right">
                                    <span className="text-[10px] font-mono text-gray-400">
                                      {(
                                        quote.spread *
                                        (pair.includes("JPY") ? 100 : 10000)
                                      ).toFixed(1)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-3 flex items-center justify-end gap-1">
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                                  <span className="text-[10px] text-gray-500">
                                    Loading...
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              },
            )
          )}
        </div>

        {/* Footer - Current Selection */}
        <div className="p-2 border-t border-purple-500/30 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span className="text-gray-400 text-xs">Selected:</span>
              <span className="text-white font-bold text-sm">
                {selectedSymbol}
              </span>
            </div>
            {prices.get(selectedSymbol) && (
              <span
                className="text-purple-300 font-mono font-bold text-sm"
                style={{ textShadow: "0 0 10px rgba(168, 85, 247, 0.5)" }}
              >
                {prices
                  .get(selectedSymbol)!
                  .bid.toFixed(selectedSymbol.includes("JPY") ? 3 : 5)}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
