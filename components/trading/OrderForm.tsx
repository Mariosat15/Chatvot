"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { placeOrder } from "@/lib/actions/trading/order.actions";
import {
  FOREX_PAIRS,
  ForexSymbol,
  calculateMarginRequired,
} from "@/lib/services/pnl-calculator.service";
import { usePrices } from "@/contexts/PriceProvider";
import { useChartSymbol } from "@/contexts/ChartSymbolContext";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validateLimitOrderPrice,
  getPipValue,
} from "@/lib/utils/limit-order-validation";
import LiveRankingPanel from "./LiveRankingPanel";

// Collapsible Section Component
const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = true,
  className = "",
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-dark-300/80 to-dark-400/50 rounded-xl border border-dark-400/30 shadow-lg overflow-hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-dark-400/20 transition-colors"
      >
        <p className="text-xs font-bold text-light-900 uppercase tracking-wider flex items-center gap-2">
          {icon} {title}
        </p>
        {isOpen ? (
          <ChevronUp className="size-5 text-dark-600 transition-transform" />
        ) : (
          <ChevronDown className="size-5 text-dark-600 transition-transform" />
        )}
      </button>
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          isOpen
            ? "max-h-[2000px] opacity-100"
            : "max-h-0 opacity-0 overflow-hidden",
        )}
      >
        <div className="p-4 pt-0 space-y-4">{children}</div>
      </div>
    </div>
  );
};

interface OrderFormProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number; // Admin-controlled, users cannot change
  openPositionsCount: number;
  maxPositions: number;
  currentEquity: number;
  existingUsedMargin: number;
  currentBalance: number;
  marginThresholds?: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE: number;
  };
  disabled?: boolean; // Disable trading (e.g., when disqualified)
  disabledReason?: string; // Reason for disabling
  userId?: string; // Current user ID for live ranking highlight
  contestType?: "competition" | "challenge"; // Type of contest - challenges don't show ranking panel
}

const OrderForm = ({
  competitionId,
  availableCapital,
  defaultLeverage,
  openPositionsCount,
  maxPositions,
  currentEquity,
  existingUsedMargin,
  currentBalance,
  marginThresholds,
  disabled = false,
  disabledReason,
  userId,
  contestType = "competition",
}: OrderFormProps) => {
  const { prices, subscribe, unsubscribe, marketOpen, marketStatus } =
    usePrices();
  const { symbol, setSymbol: setChartSymbol } = useChartSymbol();
  const { settings: riskSettings } = useRiskSettings(10000); // Poll every 10 seconds

  // Form state
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("0.01");
  const [limitPrice, setLimitPrice] = useState("");
  const [limitPriceMode, setLimitPriceMode] = useState<"price" | "pips">(
    "price",
  );
  const [limitPricePips, setLimitPricePips] = useState("");
  const [limitValidation, setLimitValidation] = useState<{
    isValid: boolean;
    pipsAway: number;
    directionValid: boolean;
    minDistanceValid: boolean;
  } | null>(null);

  // Check which side (buy/sell) the limit price is valid for
  const [validForBuy, setValidForBuy] = useState(false);
  const [validForSell, setValidForSell] = useState(false);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TP/SL Enable/Disable toggles (default OFF)
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);

  // TP/SL Input Modes
  const [tpMode, setTpMode] = useState<"price" | "pips">("pips");
  const [slMode, setSlMode] = useState<"price" | "pips">("pips");
  const [takeProfitPips, setTakeProfitPips] = useState("50");
  const [stopLossPips, setStopLossPips] = useState("30");

  // Leverage is admin-controlled, not user-adjustable
  // Use real-time settings from admin, fallback to prop
  const leverage = riskSettings.defaultLeverage || defaultLeverage;

  // Subscribe to price updates for selected symbol
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);

  // Real-time limit order validation - ONLY checks minimum pips distance
  useEffect(() => {
    const currentPrice = prices.get(symbol);

    if (orderType === "limit" && currentPrice) {
      const pipValue = getPipValue(symbol);
      const MIN_DISTANCE_PIPS = symbol.includes("JPY") ? 10 : 10;

      // Calculate prices for BOTH buy and sell validation
      let buyLimitPrice: number | undefined;
      let sellLimitPrice: number | undefined;

      if (limitPriceMode === "price") {
        // In PRICE mode: same price for both
        const price = limitPrice ? parseFloat(limitPrice) : undefined;
        if (price && !isNaN(price)) {
          buyLimitPrice = price;
          sellLimitPrice = price;
        }
      } else {
        // In PIPS mode: calculate separate prices for buy and sell
        const pips = limitPricePips ? parseFloat(limitPricePips) : undefined;
        if (pips && !isNaN(pips)) {
          const pip = FOREX_PAIRS[symbol].pip;
          // BUY limit: below current ASK (subtract pips)
          buyLimitPrice = currentPrice.ask - pips * pip;
          // SELL limit: above current BID (add pips)
          sellLimitPrice = currentPrice.bid + pips * pip;
        }
      }

      // Validate BUY - ONLY check pips distance (no direction restriction)
      let isBuyValid = false;
      let buyPipsAway = 0;
      let buyMinDistanceValid = false;

      if (buyLimitPrice && !isNaN(buyLimitPrice)) {
        // Calculate distance from ASK price
        buyPipsAway = Math.abs(currentPrice.ask - buyLimitPrice) / pipValue;
        buyMinDistanceValid = buyPipsAway >= MIN_DISTANCE_PIPS;
        isBuyValid = buyMinDistanceValid; // ✅ ONLY check pips distance
      }

      // Validate SELL - ONLY check pips distance (no direction restriction)
      let isSellValid = false;
      let sellPipsAway = 0;
      let sellMinDistanceValid = false;

      if (sellLimitPrice && !isNaN(sellLimitPrice)) {
        // Calculate distance from BID price
        sellPipsAway = Math.abs(sellLimitPrice - currentPrice.bid) / pipValue;
        sellMinDistanceValid = sellPipsAway >= MIN_DISTANCE_PIPS;
        isSellValid = sellMinDistanceValid; // ✅ ONLY check pips distance
      }

      setValidForBuy(isBuyValid);
      setValidForSell(isSellValid);

      // Set validation display for currently selected side
      if (side === "buy") {
        setLimitValidation({
          isValid: isBuyValid,
          pipsAway: buyPipsAway,
          directionValid: true, // Always true now (no direction check)
          minDistanceValid: buyMinDistanceValid,
        });
      } else {
        setLimitValidation({
          isValid: isSellValid,
          pipsAway: sellPipsAway,
          directionValid: true, // Always true now (no direction check)
          minDistanceValid: sellMinDistanceValid,
        });
      }
    } else {
      setLimitValidation(null);
      setValidForBuy(false);
      setValidForSell(false);
    }
  }, [
    orderType,
    limitPrice,
    limitPricePips,
    limitPriceMode,
    side,
    symbol,
    prices,
  ]);

  // Get current price
  const currentPrice = prices.get(symbol);
  const displayPrice = currentPrice
    ? side === "buy"
      ? currentPrice.ask
      : currentPrice.bid
    : 0;

  // TP/SL Helpers
  const pipValue = FOREX_PAIRS[symbol].pip;

  const calculateTPFromPips = (pips: number): number => {
    // Round to 5 decimal places to avoid floating point precision issues
    if (side === "buy") {
      return Math.round((displayPrice + pips * pipValue) * 100000) / 100000;
    } else {
      return Math.round((displayPrice - pips * pipValue) * 100000) / 100000;
    }
  };

  const calculateSLFromPips = (pips: number): number => {
    // Round to 5 decimal places to avoid floating point precision issues
    if (side === "buy") {
      return Math.round((displayPrice - pips * pipValue) * 100000) / 100000;
    } else {
      return Math.round((displayPrice + pips * pipValue) * 100000) / 100000;
    }
  };

  // Limit Price Helpers
  const calculateLimitFromPips = (pips: number): number => {
    const currentPrice = prices.get(symbol);
    if (!currentPrice) return 0;

    if (side === "buy") {
      // Buy limit must be BELOW current ASK
      return currentPrice.ask - pips * pipValue;
    } else {
      // Sell limit must be ABOVE current BID
      return currentPrice.bid + pips * pipValue;
    }
  };

  const getEffectiveLimitPrice = (): number | undefined => {
    if (orderType !== "limit") return undefined;
    if (limitPriceMode === "price") {
      if (!limitPrice || limitPrice.trim() === "") return undefined;
      const parsed = parseFloat(limitPrice);
      return isNaN(parsed) ? undefined : parsed;
    } else {
      if (!limitPricePips || limitPricePips.trim() === "") return undefined;
      const parsed = parseFloat(limitPricePips);
      if (isNaN(parsed)) return undefined;
      return calculateLimitFromPips(parsed);
    }
  };

  const getEffectiveTPPrice = (): number | undefined => {
    if (!tpEnabled) return undefined; // Don't send TP if disabled
    if (!takeProfit && !takeProfitPips) return undefined;
    if (tpMode === "price") {
      return takeProfit ? parseFloat(takeProfit) : undefined;
    } else {
      return takeProfitPips
        ? calculateTPFromPips(parseFloat(takeProfitPips))
        : undefined;
    }
  };

  const getEffectiveSLPrice = (): number | undefined => {
    if (!slEnabled) return undefined; // Don't send SL if disabled
    if (!stopLoss && !stopLossPips) return undefined;
    if (slMode === "price") {
      return stopLoss ? parseFloat(stopLoss) : undefined;
    } else {
      return stopLossPips
        ? calculateSLFromPips(parseFloat(stopLossPips))
        : undefined;
    }
  };

  // Calculate margin required
  const marginRequired =
    quantity && displayPrice
      ? calculateMarginRequired(
          parseFloat(quantity),
          displayPrice,
          leverage,
          symbol,
        )
      : 0;

  // Calculate CURRENT margin level
  const currentMarginLevel =
    existingUsedMargin > 0
      ? (currentEquity / existingUsedMargin) * 100
      : Infinity;

  // Calculate what margin level would be AFTER this trade
  const newTotalMargin = existingUsedMargin + marginRequired;
  const marginLevelAfterTrade =
    newTotalMargin > 0 ? (currentEquity / newTotalMargin) * 100 : Infinity;

  // Get thresholds (default to 50%/100% if not provided)
  const stopoutThreshold = marginThresholds?.LIQUIDATION || 50;
  const marginCallThreshold = marginThresholds?.MARGIN_CALL || 100;

  // Check if current margin is already below margin call (block ALL trades)
  const currentlyBelowMarginCall =
    existingUsedMargin > 0 && currentMarginLevel < marginCallThreshold;

  // Check if trade would push margin below margin call
  const wouldCauseMarginCall = marginLevelAfterTrade < marginCallThreshold;

  // Allow trade if:
  // 1. User has enough available capital
  // 2. Not at max positions
  // 3. Current margin is above margin call threshold
  // 4. Trade won't push margin below margin call
  // 5. Trading is not disabled (e.g., disqualified)
  const canPlaceOrder =
    !disabled &&
    availableCapital >= marginRequired &&
    openPositionsCount < maxPositions &&
    !currentlyBelowMarginCall &&
    !wouldCauseMarginCall;

  // Calculate potential P&L for TP/SL preview
  const calculatePotentialPnL = (
    targetPrice: number,
  ): { pnl: number; percentage: number } => {
    const qty = parseFloat(quantity) || 0;
    if (!displayPrice || qty === 0) return { pnl: 0, percentage: 0 };

    const contractSize = FOREX_PAIRS[symbol].contractSize;
    const priceDiff =
      side === "buy" ? targetPrice - displayPrice : displayPrice - targetPrice;
    const pnl = priceDiff * contractSize * qty;
    const percentage = (pnl / marginRequired) * 100;

    return { pnl, percentage };
  };

  const takeProfitPrice = getEffectiveTPPrice();
  const stopLossPrice = getEffectiveSLPrice();

  const potentialProfit = takeProfitPrice
    ? calculatePotentialPnL(takeProfitPrice)
    : null;
  const potentialLoss = stopLossPrice
    ? calculatePotentialPnL(stopLossPrice)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if trading is disabled first
    if (disabled) {
      toast.error("Trading Disabled", {
        description:
          disabledReason ||
          "Trading is currently disabled for this competition.",
      });
      return;
    }

    if (!canPlaceOrder) {
      let errorMessage = "Insufficient capital";

      if (openPositionsCount >= maxPositions) {
        errorMessage = `Maximum ${maxPositions} positions reached`;
      } else if (currentlyBelowMarginCall) {
        errorMessage = `MARGIN CALL: Your current margin level is ${currentMarginLevel.toFixed(1)}%, below the ${marginCallThreshold}% threshold. Close some positions before opening new trades.`;
      } else if (wouldCauseMarginCall) {
        errorMessage = `This trade would push your margin level to ${marginLevelAfterTrade.toFixed(1)}%, below the ${marginCallThreshold}% margin call threshold. Close some positions first or reduce trade size.`;
      }

      toast.error("Cannot place order", {
        description: errorMessage,
      });
      return;
    }

    // Validate limit orders (wait a moment for side state to update)
    if (orderType === "limit") {
      await new Promise((resolve) => setTimeout(resolve, 150));

      const effectivePrice = getEffectiveLimitPrice();
      if (!effectivePrice) {
        toast.error("Invalid limit price", {
          description: "Please enter a valid limit price",
        });
        return;
      }

      // Re-validate with current side
      const currentPrice = prices.get(symbol);
      if (!currentPrice) {
        toast.error("Price unavailable", {
          description: "Cannot get current market price",
        });
        return;
      }

      const validation = validateLimitOrderPrice(
        side,
        effectivePrice,
        currentPrice,
        symbol,
      );
      if (!validation.valid) {
        toast.error("Invalid limit order", {
          description: validation.error,
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 🔒 LOCK THE CURRENT PRICE at the moment user clicks trade
      const currentPrice = prices.get(symbol);
      const lockedPrice =
        currentPrice && orderType === "market"
          ? {
              bid: currentPrice.bid,
              ask: currentPrice.ask,
              timestamp: Date.now(),
            }
          : undefined;

      const result = await placeOrder({
        competitionId,
        symbol,
        side,
        orderType,
        quantity: parseFloat(quantity),
        limitPrice: getEffectiveLimitPrice(),
        stopLoss: getEffectiveSLPrice(),
        takeProfit: getEffectiveTPPrice(),
        leverage,
        lockedPrice,
      });

      if (result.success) {
        // ⚡ IMMEDIATE UI UPDATE - dispatch position data for instant chart update
        if (result.position && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("positionOpened", {
              detail: result.position,
            }),
          );
        }

        toast.success("Order placed!", {
          description: result.message,
        });

        // Show loading toast for refresh (only if TP/SL)
        if (stopLoss || takeProfit || stopLossPips || takeProfitPips) {
          toast.loading("Loading TP/SL on chart...", {
            id: "tpsl-refresh",
            description: "Updating positions with Take Profit and Stop Loss",
          });

          // Auto-dismiss after 2 seconds
          setTimeout(() => {
            toast.dismiss("tpsl-refresh");
          }, 2500);
        }

        // Reset form
        setQuantity("0.01");
        setLimitPrice("");
        setStopLoss("");
        setTakeProfit("");
        setTakeProfitPips("50");
        setStopLossPips("30");

        // Dispatch event for other components to refresh
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("orderPlaced"));
        }
      }
    } catch (error) {
      toast.error("Order failed", {
        description:
          error instanceof Error ? error.message : "Failed to place order",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Content Area */}
      <div className="space-y-3 pb-3">
        {/* Section 1: Live Ranking - Only show for competitions, not challenges */}
        {contestType === "competition" && (
          <CollapsibleSection title="Live Ranking" icon="🏆" defaultOpen={false}>
            {userId ? (
              <LiveRankingPanel competitionId={competitionId} userId={userId} />
            ) : (
              <div className="text-center py-4 text-gray-500 text-xs">
                Loading ranking...
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Combined Order Setup & Trade Size Section */}
        <div className="bg-gradient-to-br from-dark-300/80 to-dark-400/50 rounded-xl border border-dark-400/30 shadow-lg p-4 space-y-4">
          {/* Order Type Tabs - Compact */}
          <div>
            <Tabs
              value={orderType}
              onValueChange={(value) => setOrderType(value as "market" | "limit")}
            >
              <TabsList className="grid grid-cols-2 w-full bg-dark-400 p-1 h-9">
                <TabsTrigger
                  value="market"
                  className="data-[state=active]:bg-primary data-[state=active]:text-white font-semibold text-sm h-7"
                >
                  ⚡ Market
                </TabsTrigger>
                <TabsTrigger
                  value="limit"
                  className="data-[state=active]:bg-blue-500 data-[state=active]:text-white font-semibold text-sm h-7"
                >
                  📊 Limit
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Limit Price Configuration - Compact */}
          {orderType === "limit" && (
            <div className="bg-dark-400/30 rounded-lg p-3 border border-dark-500/30">
              <Tabs
                value={limitPriceMode}
                onValueChange={(value) =>
                  setLimitPriceMode(value as "price" | "pips")
                }
              >
                <TabsList className="grid grid-cols-2 w-full mb-2 bg-dark-500 h-8">
                  <TabsTrigger
                    value="pips"
                    className="data-[state=active]:bg-primary text-xs h-6"
                  >
                    📏 Pips
                  </TabsTrigger>
                  <TabsTrigger
                    value="price"
                    className="data-[state=active]:bg-primary text-xs h-6"
                  >
                    💰 Price
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pips" className="mt-0">
                  <Input
                    type="number"
                    step="0.1"
                    value={limitPricePips}
                    onChange={(e) => setLimitPricePips(e.target.value)}
                    placeholder="Enter pips"
                    className="bg-dark-500 border-dark-600 h-10 text-sm font-semibold"
                  />
                  {limitPricePips && displayPrice > 0 && (
                    <p className="text-xs text-primary font-bold text-center mt-1">
                      = {calculateLimitFromPips(parseFloat(limitPricePips)).toFixed(5)}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="price" className="mt-0">
                  <Input
                    type="number"
                    step="0.00001"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder="Enter price"
                    className="bg-dark-500 border-dark-600 h-10 text-sm font-semibold"
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Quantity & Leverage - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Quantity */}
            <div>
              <Label className="text-xs font-semibold text-dark-600 mb-1.5 uppercase tracking-wide block">
                Quantity (Lots)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-dark-400 border-dark-500 h-10 text-sm font-bold"
                required
              />
            </div>

            {/* Leverage Display */}
            <div>
              <Label className="text-xs font-semibold text-dark-600 mb-1.5 uppercase tracking-wide block">
                Leverage
              </Label>
              <div className="bg-dark-400 border border-dark-500 rounded-md h-10 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-100">1:{leverage}</span>
              </div>
            </div>
          </div>

        </div>

        {/* TP/SL Section - Collapsed by default */}
        <CollapsibleSection
          title="Take Profit / Stop Loss"
          icon="🎯"
          defaultOpen={false}
        >
          {/* Take Profit - Compact */}
          <div className="bg-dark-400/30 rounded-lg p-3 border border-dark-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-dark-600 uppercase tracking-wide">
                🎯 Take Profit
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold", tpEnabled ? "text-green-400" : "text-dark-600")}>
                  {tpEnabled ? "ON" : "OFF"}
                </span>
                <Switch checked={tpEnabled} onCheckedChange={setTpEnabled} />
              </div>
            </div>

            {tpEnabled && (
              <>
                <div className="flex gap-2 items-center">
                  <Tabs value={tpMode} onValueChange={(v) => setTpMode(v as "price" | "pips")} className="flex-1">
                    <TabsList className="grid w-full grid-cols-2 bg-dark-500 h-7">
                      <TabsTrigger value="pips" className="text-xs data-[state=active]:bg-green-500 h-5">Pips</TabsTrigger>
                      <TabsTrigger value="price" className="text-xs data-[state=active]:bg-green-500 h-5">Price</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Input
                    type="number"
                    step={tpMode === "pips" ? "1" : "0.00001"}
                    value={tpMode === "pips" ? takeProfitPips : takeProfit}
                    onChange={(e) => tpMode === "pips" ? setTakeProfitPips(e.target.value) : setTakeProfit(e.target.value)}
                    placeholder={tpMode === "pips" ? "50" : "Price"}
                    className="bg-dark-500 border-dark-600 h-8 w-24 text-xs font-semibold"
                  />
                </div>
                {potentialProfit && (
                  <div className="flex justify-between text-xs">
                    <span className="text-green-400">Profit: +${potentialProfit.pnl.toFixed(2)}</span>
                    <span className="text-green-400/70">+{potentialProfit.percentage.toFixed(1)}%</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Stop Loss - Compact */}
          <div className="bg-dark-400/30 rounded-lg p-3 border border-dark-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-dark-600 uppercase tracking-wide">
                🛑 Stop Loss
              </Label>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold", slEnabled ? "text-red-400" : "text-dark-600")}>
                  {slEnabled ? "ON" : "OFF"}
                </span>
                <Switch checked={slEnabled} onCheckedChange={setSlEnabled} />
              </div>
            </div>

            {slEnabled && (
              <>
                <div className="flex gap-2 items-center">
                  <Tabs value={slMode} onValueChange={(v) => setSlMode(v as "price" | "pips")} className="flex-1">
                    <TabsList className="grid w-full grid-cols-2 bg-dark-500 h-7">
                      <TabsTrigger value="pips" className="text-xs data-[state=active]:bg-red-500 h-5">Pips</TabsTrigger>
                      <TabsTrigger value="price" className="text-xs data-[state=active]:bg-red-500 h-5">Price</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Input
                    type="number"
                    step={slMode === "pips" ? "1" : "0.00001"}
                    value={slMode === "pips" ? stopLossPips : stopLoss}
                    onChange={(e) => slMode === "pips" ? setStopLossPips(e.target.value) : setStopLoss(e.target.value)}
                    placeholder={slMode === "pips" ? "30" : "Price"}
                    className="bg-dark-500 border-dark-600 h-8 w-24 text-xs font-semibold"
                  />
                </div>
                {potentialLoss && (
                  <div className="flex justify-between text-xs">
                    <span className="text-red-400">Loss: ${potentialLoss.pnl.toFixed(2)}</span>
                    <span className="text-red-400/70">{potentialLoss.percentage.toFixed(1)}%</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Risk:Reward Ratio - Compact */}
          {potentialProfit && potentialLoss && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-400">Risk:Reward</span>
                <span className="text-sm font-bold text-blue-400">
                  1:{Math.abs(potentialProfit.pnl / potentialLoss.pnl).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* Limit Order Validation - Compact */}
        {orderType === "limit" && (
          <div className={cn(
            "p-3 rounded-lg border transition-all",
            (side === "buy" && validForBuy) || (side === "sell" && validForSell)
              ? "bg-green-500/10 border-green-500/50"
              : "bg-dark-300 border-dark-400",
          )}>
            <div className="flex gap-2 mb-2">
              <div className={cn(
                "flex-1 text-xs font-semibold py-1 px-2 rounded text-center",
                validForBuy ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-dark-400 text-dark-600",
              )}>
                {validForBuy ? "✅" : "❌"} BUY
              </div>
              <div className={cn(
                "flex-1 text-xs font-semibold py-1 px-2 rounded text-center",
                validForSell ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-dark-400 text-dark-600",
              )}>
                {validForSell ? "✅" : "❌"} SELL
              </div>
            </div>
            {limitValidation && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-dark-600">Distance:</span>
                <span className={cn("font-semibold", limitValidation.minDistanceValid ? "text-green-400" : "text-red-400")}>
                  {limitValidation.pipsAway.toFixed(1)} pips {limitValidation.minDistanceValid ? "✅" : "(min: 10)"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Buy/Sell Footer */}
      <div className="border-t border-dark-400/50 pt-3 pb-1">
        {/* Error Messages */}
        {!canPlaceOrder && (
          <p className="text-xs text-red-400 text-center mb-2">
            {disabled
              ? disabledReason || "🚫 Trading is disabled"
              : openPositionsCount >= maxPositions
                ? `Maximum ${maxPositions} positions reached`
                : "Insufficient capital for this trade"}
          </p>
        )}

        {orderType === "limit" && !validForBuy && !validForSell && canPlaceOrder && limitValidation && (
          <p className="text-xs text-red-400 text-center mb-2">
            ⚠️ Adjust limit price - minimum 10 pips from market
          </p>
        )}

        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || !canPlaceOrder || (orderType === "limit" && !validForBuy)}
            onClick={() => setSide("buy")}
            className={cn(
              "font-bold h-14 transition-all text-lg shadow-lg",
              validForBuy && orderType === "limit"
                ? "bg-green-500 hover:bg-green-600 text-white ring-2 ring-green-400"
                : "bg-[#26a69a] hover:bg-[#26a69a]/90 text-white",
            )}
          >
            {isSubmitting && side === "buy" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <TrendingUp className="size-5 mr-2" />
                BUY
              </>
            )}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !canPlaceOrder || (orderType === "limit" && !validForSell)}
            onClick={() => setSide("sell")}
            className={cn(
              "font-bold h-14 transition-all text-lg shadow-lg",
              validForSell && orderType === "limit"
                ? "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-400"
                : "bg-[#ef5350] hover:bg-[#ef5350]/90 text-white",
            )}
          >
            {isSubmitting && side === "sell" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <TrendingDown className="size-5 mr-2" />
                SELL
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default OrderForm;
