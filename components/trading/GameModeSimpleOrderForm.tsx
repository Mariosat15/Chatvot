"use client";

import { useState, useMemo, useEffect } from "react";
import { useChartSymbol } from "@/contexts/ChartSymbolContext";
import { usePrices } from "@/contexts/PriceProvider";
import {
  ForexSymbol,
  FOREX_PAIRS,
} from "@/lib/services/pnl-calculator.service";
import { placeOrder } from "@/lib/actions/trading/order.actions";
import { cn } from "@/lib/utils";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  HelpCircle,
  Sparkles,
  Shield,
  Zap,
  Target,
} from "lucide-react";
import { toast } from "sonner";

interface GameModeSimpleOrderFormProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number;
  currentBalance: number;
  startingCapital: number;
  currentEquity?: number;
  usedMargin?: number;
  openPositionsCount?: number;
  maxPositions?: number;
  disabled?: boolean;
  disabledReason?: string;
  marginThresholds?: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE?: number;
  };
}

// Trading tips for beginners
const TRADING_TIPS = [
  { icon: "💡", tip: "Green means UP - you profit when price goes higher" },
  { icon: "📉", tip: "Red means DOWN - you profit when price goes lower" },
  { icon: "🎯", tip: "Start small! Use 'Tiny' or 'Small' trades to learn" },
  { icon: "⏰", tip: "Don't trade during major news events as a beginner" },
  { icon: "🛡️", tip: "Stop Loss protects you from big losses automatically" },
  { icon: "🎰", tip: "Never risk more than you can afford to lose" },
  { icon: "📊", tip: "Watch the chart - look for patterns before trading" },
  { icon: "🧘", tip: "Stay calm! Emotional trading leads to losses" },
  { icon: "📚", tip: "Each trade is a learning opportunity, win or lose" },
  { icon: "🎯", tip: "Set a daily profit goal and stop when you reach it" },
];

// Simple trade sizes (maps to lot sizes)
const TRADE_SIZES = [
  { name: "Tiny", lots: 0.01, emoji: "🐣", description: "Learn safely", riskLevel: "low" },
  { name: "Small", lots: 0.02, emoji: "🐤", description: "Low risk", riskLevel: "low" },
  { name: "Medium", lots: 0.05, emoji: "🐔", description: "Balanced", riskLevel: "medium" },
  { name: "Large", lots: 0.1, emoji: "🦅", description: "Higher reward", riskLevel: "high" },
];

// Risk presets for auto TP/SL
const RISK_PRESETS = [
  { name: "Safe", tpPips: 15, slPips: 10, emoji: "🛡️", color: "green" },
  { name: "Balanced", tpPips: 25, slPips: 15, emoji: "⚖️", color: "yellow" },
  { name: "Aggressive", tpPips: 50, slPips: 25, emoji: "🎯", color: "red" },
];

export default function GameModeSimpleOrderForm({
  competitionId,
  availableCapital,
  defaultLeverage,
  currentBalance,
  startingCapital,
  currentEquity,
  usedMargin = 0,
  openPositionsCount = 0,
  maxPositions = 10,
  disabled = false,
  disabledReason,
  marginThresholds,
}: GameModeSimpleOrderFormProps) {
  const { symbol } = useChartSymbol();
  const { prices } = usePrices();

  const [selectedSize, setSelectedSize] = useState(0); // Index of TRADE_SIZES
  const [selectedRisk, setSelectedRisk] = useState(0); // Index of RISK_PRESETS
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const currentPrice = prices.get(symbol);
  const symbolInfo = FOREX_PAIRS[symbol as ForexSymbol];
  const pipValue = symbolInfo?.pip || 0.0001;
  const leverage = defaultLeverage;

  // Rotate tips every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TRADING_TIPS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Calculate profit/loss from starting capital
  const equity = currentEquity ?? currentBalance;
  const totalPnL = currentBalance - startingCapital;
  const totalPnLPercent = startingCapital > 0 ? (totalPnL / startingCapital) * 100 : 0;

  // Calculate margin for selected trade
  const selectedLots = TRADE_SIZES[selectedSize].lots;
  const marginRequired = useMemo(() => {
    if (!currentPrice) return 0;
    const notionalValue = selectedLots * (symbolInfo?.contractSize || 100000) * currentPrice.mid;
    return notionalValue / leverage;
  }, [selectedLots, leverage, currentPrice, symbolInfo]);

  // Account health check
  const currentMarginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : Infinity;
  const safeMarginThreshold = marginThresholds?.MARGIN_CALL || 260;
  const currentlyBelowSafe = usedMargin > 0 && currentMarginLevel < safeMarginThreshold;
  const atMaxPositions = openPositionsCount >= maxPositions;

  // Simple health indicator
  const getHealthStatus = () => {
    if (currentlyBelowSafe) return { emoji: "😰", text: "Danger!", color: "red" };
    if (currentMarginLevel < 300) return { emoji: "😐", text: "Caution", color: "yellow" };
    if (openPositionsCount > 5) return { emoji: "🤔", text: "Many trades", color: "yellow" };
    return { emoji: "😊", text: "All good!", color: "green" };
  };
  const healthStatus = getHealthStatus();

  const canTrade = !disabled && availableCapital >= marginRequired && !atMaxPositions && !currentlyBelowSafe;

  // Calculate TP/SL prices
  const calculateTPSL = (side: "long" | "short") => {
    if (!currentPrice) return { tp: undefined, sl: undefined };
    const preset = RISK_PRESETS[selectedRisk];
    const price = side === "long" ? currentPrice.ask : currentPrice.bid;
    
    const tp = side === "long" 
      ? price + preset.tpPips * pipValue 
      : price - preset.tpPips * pipValue;
    const sl = side === "long" 
      ? price - preset.slPips * pipValue 
      : price + preset.slPips * pipValue;
    
    return {
      tp: Math.round(tp * 100000) / 100000,
      sl: Math.round(sl * 100000) / 100000,
    };
  };

  // Handle trade
  const handleTrade = async (direction: "up" | "down") => {
    if (!currentPrice || isSubmitting || !canTrade) {
      if (!canTrade) {
        const msg = disabled ? (disabledReason || "Trading disabled") 
          : atMaxPositions ? `Too many trades open (max ${maxPositions})`
          : currentlyBelowSafe ? "Account at risk! Close some trades first"
          : "Not enough money for this trade";
        toast.error("Can't trade right now", { description: msg });
      }
      return;
    }

    setIsSubmitting(true);
    const side = direction === "up" ? "buy" : "sell";
    const longShort = direction === "up" ? "long" : "short";
    const { tp, sl } = calculateTPSL(longShort);

    try {
      const result = await placeOrder({
        competitionId,
        symbol: symbol as ForexSymbol,
        side,
        orderType: "market",
        quantity: selectedLots,
        leverage,
        takeProfit: tp,
        stopLoss: sl,
        lockedPrice: {
          bid: currentPrice.bid,
          ask: currentPrice.ask,
          timestamp: Date.now(),
        },
      });

      if (result.success) {
        toast.success(direction === "up" ? "🚀 Going UP!" : "📉 Going DOWN!", {
          description: `${TRADE_SIZES[selectedSize].name} trade opened on ${symbol}`,
        });
      } else {
        toast.error("Trade failed", { description: result.message });
      }
    } catch (error) {
      toast.error("Something went wrong", { description: "Please try again" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 overflow-hidden">
      {/* Fun Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎮</span>
            <div>
              <h2 className="text-white font-bold text-xl">Quick Trade</h2>
              <p className="text-purple-200 text-xs">Simple & Easy</p>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Help Panel (expandable) */}
      {showHelp && (
        <div className="p-4 bg-purple-900/30 border-b border-purple-500/30">
          <h3 className="text-white font-bold mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            How to Trade
          </h3>
          <div className="space-y-2 text-sm text-purple-200">
            <p>1️⃣ Pick your trade size (start with Tiny!)</p>
            <p>2️⃣ Choose your risk level</p>
            <p>3️⃣ Think the price will go UP? Tap green!</p>
            <p>4️⃣ Think it will go DOWN? Tap red!</p>
            <p className="text-yellow-300 mt-2">💡 Tip: Watch the chart before deciding!</p>
          </div>
        </div>
      )}

      {/* Current Symbol & Price */}
      <div className="p-4 border-b border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💱</span>
            <div>
              <span className="text-white font-bold text-xl">{symbol}</span>
              <p className="text-purple-300 text-xs">Currency Pair</p>
            </div>
          </div>
          {currentPrice && (
            <div className="text-right">
              <div className="text-white font-mono font-bold text-xl">
                {currentPrice.mid.toFixed(5)}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-green-400 text-xs">▲ {currentPrice.ask.toFixed(5)}</span>
                <span className="text-red-400 text-xs">▼ {currentPrice.bid.toFixed(5)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simple P&L Display */}
      <div className="p-4 border-b border-purple-500/30">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/30">
            <div className="text-purple-300 text-xs mb-1">Started With</div>
            <div className="text-white font-bold">${startingCapital.toLocaleString()}</div>
          </div>
          <div className="bg-blue-900/30 rounded-xl p-3 border border-blue-500/30">
            <div className="text-blue-300 text-xs mb-1">Now Have</div>
            <div className="text-white font-bold">${currentBalance.toFixed(2)}</div>
          </div>
          <div className={cn(
            "rounded-xl p-3 border",
            totalPnL >= 0 
              ? "bg-green-900/30 border-green-500/30" 
              : "bg-red-900/30 border-red-500/30"
          )}>
            <div className={cn("text-xs mb-1", totalPnL >= 0 ? "text-green-300" : "text-red-300")}>
              {totalPnL >= 0 ? "Profit! 🎉" : "Loss 😔"}
            </div>
            <div className={cn("font-bold", totalPnL >= 0 ? "text-green-400" : "text-red-400")}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}
              <span className="text-xs ml-1">({totalPnLPercent >= 0 ? "+" : ""}{totalPnLPercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Health */}
      <div className="px-4 py-3 border-b border-purple-500/30 bg-dark-400/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{healthStatus.emoji}</span>
            <div>
              <span className={cn(
                "font-bold text-sm",
                healthStatus.color === "green" && "text-green-400",
                healthStatus.color === "yellow" && "text-yellow-400",
                healthStatus.color === "red" && "text-red-400"
              )}>
                {healthStatus.text}
              </span>
              <p className="text-gray-400 text-xs">{openPositionsCount} trades open</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-gray-400 text-xs">Available</span>
            <p className="text-white font-bold">${availableCapital.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Trade Size Selection */}
      <div className="p-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Trade Size
          </span>
          <span className="text-purple-300 text-xs">Pick one</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TRADE_SIZES.map((size, idx) => (
            <button
              key={size.name}
              onClick={() => setSelectedSize(idx)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-center",
                selectedSize === idx
                  ? "bg-purple-600/30 border-purple-500 scale-105"
                  : "bg-dark-400/30 border-dark-500/50 hover:border-purple-500/50"
              )}
            >
              <span className="text-2xl block mb-1">{size.emoji}</span>
              <span className="text-white font-bold text-sm block">{size.name}</span>
              <span className="text-gray-400 text-[10px]">{size.description}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 text-center text-purple-300 text-xs">
          This trade needs <span className="text-white font-bold">${marginRequired.toFixed(2)}</span> margin
        </div>
      </div>

      {/* Risk Preset Selection */}
      <div className="p-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Auto-Protection
          </span>
          <span className="text-purple-300 text-xs">Sets TP & SL for you</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RISK_PRESETS.map((preset, idx) => (
            <button
              key={preset.name}
              onClick={() => setSelectedRisk(idx)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-center",
                selectedRisk === idx
                  ? cn(
                      "scale-105",
                      preset.color === "green" && "bg-green-600/20 border-green-500",
                      preset.color === "yellow" && "bg-yellow-600/20 border-yellow-500",
                      preset.color === "red" && "bg-red-600/20 border-red-500"
                    )
                  : "bg-dark-400/30 border-dark-500/50 hover:border-purple-500/50"
              )}
            >
              <span className="text-xl block mb-1">{preset.emoji}</span>
              <span className="text-white font-bold text-sm">{preset.name}</span>
              <div className="flex justify-center gap-2 mt-1">
                <span className="text-green-400 text-[10px]">+{preset.tpPips}p</span>
                <span className="text-red-400 text-[10px]">-{preset.slPips}p</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Big Trading Buttons */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <button
          onClick={() => handleTrade("up")}
          disabled={!canTrade || isSubmitting || !currentPrice}
          className={cn(
            "py-6 rounded-2xl font-bold text-xl transition-all flex flex-col items-center justify-center gap-2",
            "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg",
            canTrade
              ? "hover:from-green-400 hover:to-emerald-500 hover:shadow-xl hover:shadow-green-500/30 hover:scale-[1.02] active:scale-95"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <TrendingUp className="w-8 h-8" />
              <span>UP 📈</span>
            </>
          )}
        </button>

        <button
          onClick={() => handleTrade("down")}
          disabled={!canTrade || isSubmitting || !currentPrice}
          className={cn(
            "py-6 rounded-2xl font-bold text-xl transition-all flex flex-col items-center justify-center gap-2",
            "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg",
            canTrade
              ? "hover:from-red-400 hover:to-rose-500 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-95"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <TrendingDown className="w-8 h-8" />
              <span>DOWN 📉</span>
            </>
          )}
        </button>
      </div>

      {/* Trading Tip */}
      <div className="p-4 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-t border-yellow-500/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{TRADING_TIPS[currentTipIndex].icon}</span>
          <div>
            <span className="text-yellow-300 text-xs font-semibold">PRO TIP</span>
            <p className="text-yellow-100 text-sm">{TRADING_TIPS[currentTipIndex].tip}</p>
          </div>
        </div>
      </div>

      {/* Disabled Message */}
      {disabled && (
        <div className="p-3 bg-red-500/20 border-t border-red-500/30 text-center">
          <span className="text-red-300 text-sm">
            {disabledReason || "⚠️ Trading is paused"}
          </span>
        </div>
      )}
    </div>
  );
}
