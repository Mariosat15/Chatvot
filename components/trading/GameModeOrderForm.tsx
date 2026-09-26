"use client";

import { useState, useMemo, useEffect } from "react";
import { useChartSymbol } from "@/contexts/ChartSymbolContext";
import { usePrices } from "@/contexts/PriceProvider";
import { useSymbolConfig } from "@/contexts/SymbolConfigContext";
import { ForexSymbol } from "@/lib/services/pnl-calculator.service";
import { placeOrder } from "@/lib/actions/trading/order.actions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface MarginThresholds {
  LIQUIDATION: number;
  MARGIN_CALL: number;
  WARNING: number;
  SAFE?: number;
}

interface GameModeOrderFormProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number;
  currentBalance: number;
  currentEquity?: number;
  usedMargin?: number;
  openPositionsCount?: number;
  maxPositions?: number;
  disabled?: boolean;
  disabledReason?: string;
  marginThresholds?: MarginThresholds;
}

// Default margin thresholds
const DEFAULT_MARGIN_THRESHOLDS = {
  SAFE_MARGIN: 260, // 260% - block new trades (same as Pro)
  MARGIN_CALL: 100, // 100% - margin call level
  LIQUIDATION: 50, // 50% - stop out
  WARNING: 150, // 150% - warning
};

export default function GameModeOrderForm({
  competitionId,
  availableCapital,
  defaultLeverage,
  currentBalance,
  currentEquity,
  usedMargin = 0,
  openPositionsCount = 0,
  maxPositions = 10,
  disabled = false,
  disabledReason,
  marginThresholds: propMarginThresholds,
}: GameModeOrderFormProps) {
  const { symbol } = useChartSymbol();
  const { prices } = usePrices();
  const { getConfig } = useSymbolConfig();

  const [lotSize, setLotSize] = useState(0.01);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tpPips, setTpPips] = useState<number>(20);
  const [slPips, setSlPips] = useState<number>(10);
  const [useTp, setUseTp] = useState(true);
  const [useSl, setUseSl] = useState(true);
  // Use fixed leverage from admin
  const leverage = defaultLeverage;

  const currentPrice = prices.get(symbol);
  const symbolCfg = getConfig(symbol);
  const pipValue = symbolCfg.pip;

  // Use current equity or fallback to balance
  const equity = currentEquity ?? currentBalance;

  // Get margin thresholds from props or use defaults
  // SAFE_MARGIN is the level below which new trades are blocked (same as Pro uses MARGIN_CALL)
  const safeMarginThreshold =
    propMarginThresholds?.MARGIN_CALL || DEFAULT_MARGIN_THRESHOLDS.SAFE_MARGIN;
  const warningThreshold =
    propMarginThresholds?.WARNING || DEFAULT_MARGIN_THRESHOLDS.WARNING;

  // Calculate margin required for this trade
  const marginRequired = useMemo(() => {
    if (!currentPrice) return 0;
    const notionalValue =
      lotSize * symbolCfg.contractSize * currentPrice.mid;
    return notionalValue / leverage;
  }, [lotSize, leverage, currentPrice, symbolCfg.contractSize]);

  // Calculate CURRENT margin level
  const currentMarginLevel = useMemo(() => {
    return usedMargin > 0 ? (equity / usedMargin) * 100 : Infinity;
  }, [equity, usedMargin]);

  // Calculate what margin level would be AFTER this trade
  const newTotalMargin = usedMargin + marginRequired;
  const marginLevelAfterTrade = useMemo(() => {
    return newTotalMargin > 0 ? (equity / newTotalMargin) * 100 : Infinity;
  }, [equity, newTotalMargin]);

  // Check if current margin is already below safe margin (block ALL new trades)
  const currentlyBelowSafeMargin =
    usedMargin > 0 && currentMarginLevel < safeMarginThreshold;

  // Check if trade would push margin below safe margin (uses admin MARGIN_CALL setting)
  const wouldBreachSafeMargin = marginLevelAfterTrade < safeMarginThreshold;

  // Check if at max positions
  const atMaxPositions = openPositionsCount >= maxPositions;

  // Determine if trade can be placed
  const canPlaceOrder =
    !disabled &&
    availableCapital >= marginRequired &&
    !atMaxPositions &&
    !currentlyBelowSafeMargin &&
    !wouldBreachSafeMargin;

  // Calculate TP/SL prices
  const calculateTPFromPips = (side: "long" | "short", pips: number) => {
    if (!currentPrice) return 0;
    const price = side === "long" ? currentPrice.ask : currentPrice.bid;
    const tpPrice =
      side === "long" ? price + pips * pipValue : price - pips * pipValue;
    return Math.round(tpPrice * 100000) / 100000;
  };

  const calculateSLFromPips = (side: "long" | "short", pips: number) => {
    if (!currentPrice) return 0;
    const price = side === "long" ? currentPrice.ask : currentPrice.bid;
    const slPrice =
      side === "long" ? price - pips * pipValue : price + pips * pipValue;
    return Math.round(slPrice * 100000) / 100000;
  };

  // Handle trade execution
  const handleTrade = async (direction: "long" | "short") => {
    if (!currentPrice || isSubmitting) return;

    // Check all conditions and show appropriate error
    if (!canPlaceOrder) {
      let errorMessage = "Cannot place trade";
      let errorTitle = "⚠️ Trade Blocked";

      if (disabled) {
        errorMessage =
          disabledReason || "Trading is disabled for this competition.";
        errorTitle = "⏸️ Trading Disabled";
      } else if (atMaxPositions) {
        errorMessage = `Maximum ${maxPositions} positions reached. Close some positions first.`;
        errorTitle = "🚫 Max Positions";
      } else if (currentlyBelowSafeMargin) {
        errorMessage = `Your margin level is ${currentMarginLevel.toFixed(1)}%, below the ${safeMarginThreshold}% threshold. Close positions before opening new trades.`;
        errorTitle = "🚨 Low Margin";
      } else if (wouldBreachSafeMargin) {
        errorMessage = `This trade would drop your margin to ${marginLevelAfterTrade.toFixed(1)}%, below the ${safeMarginThreshold}% threshold. Reduce lot size or close positions.`;
        errorTitle = "⚠️ Margin Warning";
      } else if (marginRequired > availableCapital) {
        errorMessage = `Insufficient margin. Need $${marginRequired.toFixed(2)}, have $${availableCapital.toFixed(2)}.`;
        errorTitle = "💰 Insufficient Funds";
      }

      toast.error(errorTitle, {
        description: errorMessage,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const tp = useTp ? calculateTPFromPips(direction, tpPips) : undefined;
      const sl = useSl ? calculateSLFromPips(direction, slPips) : undefined;

      // Convert long/short to buy/sell for the API
      const side = direction === "long" ? "buy" : "sell";

      const result = await placeOrder({
        competitionId,
        symbol: symbol as ForexSymbol,
        side,
        orderType: "market",
        quantity: lotSize,
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
        toast.success(
          direction === "long" ? "🚀 Position Opened!" : "📉 Position Opened!",
          {
            description: `${direction === "long" ? "BUY" : "SELL"} ${lotSize} lots on ${symbol}`,
          },
        );
      } else {
        toast.error("❌ Trade blocked", {
          description: result.error || result.message || "Unable to place order. Please try again.",
        });
      }
    } catch (error) {
      const description =
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again or contact support if the issue persists.";
      toast.error("❌ Error placing trade", { description });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lot size controls
  const incrementLot = () =>
    setLotSize((prev) => Math.min(10, +(prev + 0.01).toFixed(2)));
  const decrementLot = () =>
    setLotSize((prev) => Math.max(0.01, +(prev - 0.01).toFixed(2)));
  const handleLotChange = (value: number) => {
    const rounded = Math.max(0.01, Math.min(10, +value.toFixed(2)));
    setLotSize(rounded);
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 overflow-hidden">
      {/* Header with Gaming Icon */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/game-icons/sword.png"
            alt="Trade"
            width={24}
            height={24}
            className="drop-shadow-lg"
          />
          <span className="text-white font-bold text-lg">Trade Station</span>
        </div>
        {currentPrice && (
          <div className="text-white font-mono font-bold">
            {currentPrice.bid.toFixed(5)}
          </div>
        )}
      </div>

      {/* Symbol & Price Display */}
      <div className="p-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <span className="text-white font-bold text-xl">{symbol}</span>
          </div>
          <div className="flex items-center gap-3">
            {currentPrice && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Spread</div>
                <div className="text-yellow-400 font-bold">
                  {((currentPrice.ask - currentPrice.bid) / pipValue).toFixed(
                    1,
                  )}{" "}
                  pips
                </div>
              </div>
            )}
            <div className="text-right px-2 py-1 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <div className="text-xs text-gray-400">Leverage</div>
              <div className="text-purple-400 font-bold">{leverage}x</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lot Size Selection - Slider */}
      <div className="p-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm flex items-center gap-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            Position Size (Lots)
          </span>
          <div className="flex items-center gap-2">
            {/* Decrement Button */}
            <button
              onClick={decrementLot}
              disabled={lotSize <= 0.01}
              className="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center transition-all"
            >
              -
            </button>

            {/* Lot Size Input */}
            <input
              type="number"
              value={lotSize}
              onChange={(e) =>
                handleLotChange(parseFloat(e.target.value) || 0.01)
              }
              step="0.01"
              min="0.01"
              max="10"
              className="w-20 px-2 py-1 bg-dark-400 border border-purple-500/50 rounded-lg text-white text-center font-bold text-lg focus:outline-none focus:border-purple-500"
            />

            {/* Increment Button */}
            <button
              onClick={incrementLot}
              disabled={lotSize >= 10}
              className="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          value={lotSize}
          onChange={(e) => handleLotChange(parseFloat(e.target.value))}
          step="0.01"
          min="0.01"
          max="2"
          className="w-full h-2 bg-dark-400 rounded-lg appearance-none cursor-pointer slider-purple"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>0.01</span>
          <span>0.5</span>
          <span>1.0</span>
          <span>1.5</span>
          <span>2.0</span>
        </div>
      </div>

      {/* TP/SL Quick Settings */}
      <div className="p-4 border-b border-purple-500/30 space-y-3">
        {/* Take Profit */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useTp}
              onChange={(e) => setUseTp(e.target.checked)}
              className="w-4 h-4 accent-green-500"
            />
            <span className="text-green-400 text-sm font-medium flex items-center gap-1">
              <Target className="w-4 h-4" /> Take Profit
            </span>
          </label>
          {useTp && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tpPips}
                onChange={(e) => setTpPips(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-dark-400 border border-green-500/30 rounded text-white text-sm text-center"
              />
              <span className="text-gray-400 text-xs">pips</span>
            </div>
          )}
        </div>

        {/* Stop Loss */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSl}
              onChange={(e) => setUseSl(e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-red-400 text-sm font-medium flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" /> Stop Loss
            </span>
          </label>
          {useSl && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={slPips}
                onChange={(e) => setSlPips(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-dark-400 border border-red-500/30 rounded text-white text-sm text-center"
              />
              <span className="text-gray-400 text-xs">pips</span>
            </div>
          )}
        </div>
      </div>

      {/* Margin Info */}
      <div className="p-4 border-b border-purple-500/30 bg-dark-400/30 space-y-2">
        {/* Current Margin Level - Gaming Style */}
        {openPositionsCount > 0 && (
          <div
            className={cn(
              "p-3 rounded-lg border-2 mb-3",
              currentMarginLevel < 100
                ? "bg-gradient-to-r from-red-900/40 to-orange-900/40 border-red-500 animate-pulse"
                : currentMarginLevel < safeMarginThreshold
                  ? "bg-gradient-to-r from-red-900/30 to-pink-900/30 border-red-500/70"
                  : currentMarginLevel < warningThreshold
                    ? "bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/50"
                    : "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-500/50",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentMarginLevel < 100 ? (
                  <span className="text-2xl animate-bounce">💀</span>
                ) : currentMarginLevel < safeMarginThreshold ? (
                  <span className="text-2xl">🚨</span>
                ) : currentMarginLevel < warningThreshold ? (
                  <span className="text-2xl">⚠️</span>
                ) : (
                  <span className="text-2xl">🛡️</span>
                )}
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    Current Margin
                  </span>
                  <p
                    className={cn(
                      "text-xl font-black font-mono",
                      currentMarginLevel < 100
                        ? "text-red-400"
                        : currentMarginLevel < safeMarginThreshold
                          ? "text-red-400"
                          : currentMarginLevel < warningThreshold
                            ? "text-yellow-400"
                            : "text-green-400",
                    )}
                  >
                    {Number.isFinite(currentMarginLevel)
                      ? `${currentMarginLevel.toFixed(1)}%`
                      : "∞"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">
                  Safe: {safeMarginThreshold}%
                </span>
              </div>
            </div>
            {/* Warning message */}
            {currentMarginLevel < 100 && (
              <p className="text-xs text-red-300 mt-2 font-semibold">
                💀 GAME OVER! Positions will be liquidated!
              </p>
            )}
            {currentMarginLevel >= 100 &&
              currentMarginLevel < safeMarginThreshold && (
                <p className="text-xs text-red-300 mt-2">
                  🚨 DANGER! Close positions or reduce exposure!
                </p>
              )}
            {currentMarginLevel >= safeMarginThreshold &&
              currentMarginLevel < warningThreshold && (
                <p className="text-xs text-yellow-300 mt-2">
                  ⚠️ Running low - consider reducing positions
                </p>
              )}
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">💵 Required Margin</span>
          <span
            className={cn(
              "font-bold",
              marginRequired > availableCapital
                ? "text-red-400"
                : "text-green-400",
            )}
          >
            ${marginRequired.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">💰 Available</span>
          <span className="text-yellow-400 font-bold">
            ${availableCapital.toFixed(2)}
          </span>
        </div>

        {/* Margin Level After Trade */}
        <div className="flex justify-between text-sm pt-2 border-t border-purple-500/20">
          <span className="text-gray-400">📊 After Trade</span>
          <span
            className={cn(
              "font-bold",
              wouldBreachSafeMargin
                ? "text-red-500"
                : marginLevelAfterTrade < warningThreshold
                  ? "text-yellow-500"
                  : "text-green-500",
            )}
          >
            {Number.isFinite(marginLevelAfterTrade)
              ? `${marginLevelAfterTrade.toFixed(1)}%`
              : "∞"}
          </span>
        </div>

        {/* Trade blocking warnings */}
        {!currentlyBelowSafeMargin && wouldBreachSafeMargin && (
          <div className="flex items-center gap-2 p-2 bg-orange-500/20 border border-orange-500/50 rounded-lg text-xs text-orange-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              ⚠️ Would drop below {safeMarginThreshold}% - Trade blocked
            </span>
          </div>
        )}
        {atMaxPositions && (
          <div className="flex items-center gap-2 p-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-xs text-purple-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>🚫 Max {maxPositions} positions reached</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => handleTrade("long")}
          disabled={!canPlaceOrder || isSubmitting || !currentPrice}
          className={cn(
            "py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
            canPlaceOrder
              ? "hover:from-green-400 hover:to-emerald-500 hover:shadow-lg hover:shadow-green-500/50"
              : "opacity-50 cursor-not-allowed",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <TrendingUp className="w-5 h-5" />
              BUY
            </>
          )}
        </button>

        <button
          onClick={() => handleTrade("short")}
          disabled={!canPlaceOrder || isSubmitting || !currentPrice}
          className={cn(
            "py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-r from-red-500 to-rose-600 text-white",
            canPlaceOrder
              ? "hover:from-red-400 hover:to-rose-500 hover:shadow-lg hover:shadow-red-500/50"
              : "opacity-50 cursor-not-allowed",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <TrendingDown className="w-5 h-5" />
              SELL
            </>
          )}
        </button>
      </div>

      {/* Disabled Message */}
      {disabled && (
        <div className="p-3 bg-yellow-500/20 border-t border-yellow-500/30 text-center">
          <span className="text-yellow-400 text-sm">
            {disabledReason || "⚔️ Trading is disabled"}
          </span>
        </div>
      )}

      {/* Slider Styles */}
      <style jsx global>{`
        .slider-purple::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 10px rgba(147, 51, 234, 0.5);
        }
        .slider-purple::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 10px rgba(147, 51, 234, 0.5);
        }
        .slider-purple::-webkit-slider-runnable-track {
          background: linear-gradient(90deg, #9333ea 0%, #ec4899 100%);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
