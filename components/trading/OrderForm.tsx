'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { placeOrder } from '@/lib/actions/trading/order.actions';
import { FOREX_PAIRS, ForexSymbol, calculateMarginRequired } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { useRiskSettings } from '@/hooks/useRiskSettings';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateLimitOrderPrice, getPipValue } from '@/lib/utils/limit-order-validation';

// Collapsible Section Component
const CollapsibleSection = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = true,
  className = ""
}: { 
  title: string; 
  icon: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className={cn("bg-gradient-to-br from-dark-300/80 to-dark-400/50 rounded-xl border border-dark-400/30 shadow-lg overflow-hidden", className)}>
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
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
      )}>
        <div className="p-4 pt-0 space-y-4">
          {children}
        </div>
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
}: OrderFormProps) => {
  const { prices, subscribe, unsubscribe, marketOpen, marketStatus } = usePrices();
  const { symbol, setSymbol: setChartSymbol } = useChartSymbol();
  const { settings: riskSettings } = useRiskSettings(10000); // Poll every 10 seconds

  // Form state
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('0.01');
  const [limitPrice, setLimitPrice] = useState('');
  const [limitPriceMode, setLimitPriceMode] = useState<'price' | 'pips'>('price');
  const [limitPricePips, setLimitPricePips] = useState('');
  const [limitValidation, setLimitValidation] = useState<{
    isValid: boolean;
    pipsAway: number;
    directionValid: boolean;
    minDistanceValid: boolean;
  } | null>(null);

  // Check which side (buy/sell) the limit price is valid for
  const [validForBuy, setValidForBuy] = useState(false);
  const [validForSell, setValidForSell] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // TP/SL Enable/Disable toggles (default OFF)
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  
  // TP/SL Input Modes
  const [tpMode, setTpMode] = useState<'price' | 'pips'>('pips');
  const [slMode, setSlMode] = useState<'price' | 'pips'>('pips');
  const [takeProfitPips, setTakeProfitPips] = useState('50');
  const [stopLossPips, setStopLossPips] = useState('30');
  
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
    
    if (orderType === 'limit' && currentPrice) {
      const pipValue = getPipValue(symbol);
      const MIN_DISTANCE_PIPS = symbol.includes('JPY') ? 10 : 10;

      // Calculate prices for BOTH buy and sell validation
      let buyLimitPrice: number | undefined;
      let sellLimitPrice: number | undefined;

      if (limitPriceMode === 'price') {
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
          buyLimitPrice = currentPrice.ask - (pips * pip);
          // SELL limit: above current BID (add pips)
          sellLimitPrice = currentPrice.bid + (pips * pip);
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
      if (side === 'buy') {
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
  }, [orderType, limitPrice, limitPricePips, limitPriceMode, side, symbol, prices]);

  // Get current price
  const currentPrice = prices.get(symbol);
  const displayPrice = currentPrice
    ? side === 'buy'
      ? currentPrice.ask
      : currentPrice.bid
    : 0;

  // TP/SL Helpers
  const pipValue = FOREX_PAIRS[symbol].pip;
  
  const calculateTPFromPips = (pips: number): number => {
    if (side === 'buy') {
      return displayPrice + (pips * pipValue);
    } else {
      return displayPrice - (pips * pipValue);
    }
  };

  const calculateSLFromPips = (pips: number): number => {
    if (side === 'buy') {
      return displayPrice - (pips * pipValue);
    } else {
      return displayPrice + (pips * pipValue);
    }
  };

  // Limit Price Helpers
  const calculateLimitFromPips = (pips: number): number => {
    const currentPrice = prices.get(symbol);
    if (!currentPrice) return 0;
    
    if (side === 'buy') {
      // Buy limit must be BELOW current ASK
      return currentPrice.ask - (pips * pipValue);
    } else {
      // Sell limit must be ABOVE current BID
      return currentPrice.bid + (pips * pipValue);
    }
  };

  const getEffectiveLimitPrice = (): number | undefined => {
    if (orderType !== 'limit') return undefined;
    if (limitPriceMode === 'price') {
      if (!limitPrice || limitPrice.trim() === '') return undefined;
      const parsed = parseFloat(limitPrice);
      return isNaN(parsed) ? undefined : parsed;
    } else {
      if (!limitPricePips || limitPricePips.trim() === '') return undefined;
      const parsed = parseFloat(limitPricePips);
      if (isNaN(parsed)) return undefined;
      return calculateLimitFromPips(parsed);
    }
  };

  const getEffectiveTPPrice = (): number | undefined => {
    if (!tpEnabled) return undefined; // Don't send TP if disabled
    if (!takeProfit && !takeProfitPips) return undefined;
    if (tpMode === 'price') {
      return takeProfit ? parseFloat(takeProfit) : undefined;
    } else {
      return takeProfitPips ? calculateTPFromPips(parseFloat(takeProfitPips)) : undefined;
    }
  };

  const getEffectiveSLPrice = (): number | undefined => {
    if (!slEnabled) return undefined; // Don't send SL if disabled
    if (!stopLoss && !stopLossPips) return undefined;
    if (slMode === 'price') {
      return stopLoss ? parseFloat(stopLoss) : undefined;
    } else {
      return stopLossPips ? calculateSLFromPips(parseFloat(stopLossPips)) : undefined;
    }
  };

  // Calculate margin required
  const marginRequired =
    quantity && displayPrice
      ? calculateMarginRequired(
          parseFloat(quantity),
          displayPrice,
          leverage,
          symbol
        )
      : 0;

  // Calculate CURRENT margin level
  const currentMarginLevel = existingUsedMargin > 0 ? (currentEquity / existingUsedMargin) * 100 : Infinity;
  
  // Calculate what margin level would be AFTER this trade
  const newTotalMargin = existingUsedMargin + marginRequired;
  const marginLevelAfterTrade = newTotalMargin > 0 ? (currentEquity / newTotalMargin) * 100 : Infinity;
  
  // Get thresholds (default to 50%/100% if not provided)
  const stopoutThreshold = marginThresholds?.LIQUIDATION || 50;
  const marginCallThreshold = marginThresholds?.MARGIN_CALL || 100;
  
  // Check if current margin is already below margin call (block ALL trades)
  const currentlyBelowMarginCall = existingUsedMargin > 0 && currentMarginLevel < marginCallThreshold;
  
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
  const calculatePotentialPnL = (targetPrice: number): { pnl: number; percentage: number } => {
    const qty = parseFloat(quantity) || 0;
    if (!displayPrice || qty === 0) return { pnl: 0, percentage: 0 };

    const contractSize = FOREX_PAIRS[symbol].contractSize;
    const priceDiff = side === 'buy' ? (targetPrice - displayPrice) : (displayPrice - targetPrice);
    const pnl = priceDiff * contractSize * qty;
    const percentage = (pnl / marginRequired) * 100;

    return { pnl, percentage };
  };

  const takeProfitPrice = getEffectiveTPPrice();
  const stopLossPrice = getEffectiveSLPrice();

  const potentialProfit = takeProfitPrice ? calculatePotentialPnL(takeProfitPrice) : null;
  const potentialLoss = stopLossPrice ? calculatePotentialPnL(stopLossPrice) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canPlaceOrder) {
      let errorMessage = 'Insufficient capital';
      
      if (openPositionsCount >= maxPositions) {
        errorMessage = `Maximum ${maxPositions} positions reached`;
      } else if (currentlyBelowMarginCall) {
        errorMessage = `MARGIN CALL: Your current margin level is ${currentMarginLevel.toFixed(1)}%, below the ${marginCallThreshold}% threshold. Close some positions before opening new trades.`;
      } else if (wouldCauseMarginCall) {
        errorMessage = `This trade would push your margin level to ${marginLevelAfterTrade.toFixed(1)}%, below the ${marginCallThreshold}% margin call threshold. Close some positions first or reduce trade size.`;
      }
      
      toast.error('Cannot place order', {
        description: errorMessage,
      });
      return;
    }

    // Validate limit orders (wait a moment for side state to update)
    if (orderType === 'limit') {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const effectivePrice = getEffectiveLimitPrice();
      if (!effectivePrice) {
        toast.error('Invalid limit price', {
          description: 'Please enter a valid limit price',
        });
        return;
      }

      // Re-validate with current side
      const currentPrice = prices.get(symbol);
      if (!currentPrice) {
        toast.error('Price unavailable', {
          description: 'Cannot get current market price',
        });
        return;
      }

      const validation = validateLimitOrderPrice(side, effectivePrice, currentPrice, symbol);
      if (!validation.valid) {
        toast.error('Invalid limit order', {
          description: validation.error,
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 🔒 LOCK THE CURRENT PRICE at the moment user clicks trade
      const currentPrice = prices.get(symbol);
      const lockedPrice = currentPrice && orderType === 'market' ? {
        bid: currentPrice.bid,
        ask: currentPrice.ask,
        timestamp: Date.now(),
      } : undefined;


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
        if (result.position && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('positionOpened', { 
            detail: result.position 
          }));
        }

        toast.success('Order placed!', {
          description: result.message,
        });

        // Show loading toast for refresh (only if TP/SL)
        if (stopLoss || takeProfit || stopLossPips || takeProfitPips) {
          toast.loading('Loading TP/SL on chart...', {
            id: 'tpsl-refresh',
            description: 'Updating positions with Take Profit and Stop Loss',
          });
          
          // Auto-dismiss after 2 seconds
          setTimeout(() => {
            toast.dismiss('tpsl-refresh');
          }, 2500);
        }

        // Reset form
        setQuantity('0.01');
        setLimitPrice('');
        setStopLoss('');
        setTakeProfit('');
        setTakeProfitPips('50');
        setStopLossPips('30');

        // Dispatch event for other components to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('orderPlaced'));
        }
      }
    } catch (error) {
      toast.error('Order failed', {
        description: error instanceof Error ? error.message : 'Failed to place order',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Section 1: Live Price Display */}
      <CollapsibleSection title="Live Market Prices" icon="💰" defaultOpen={true}>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-dark-400/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="size-2 bg-red-400 rounded-full" />
              <span className="text-sm font-semibold text-dark-600">BID</span>
            </div>
            <span className="text-xl font-bold text-red-400 tabular-nums">
              {currentPrice ? currentPrice.bid.toFixed(5) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-dark-400/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="size-2 bg-green-400 rounded-full" />
              <span className="text-sm font-semibold text-dark-600">ASK</span>
            </div>
            <span className="text-xl font-bold text-green-400 tabular-nums">
              {currentPrice ? currentPrice.ask.toFixed(5) : '—'}
            </span>
          </div>
        </div>
        {!marketOpen && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
            <p className="text-xs text-red-400 font-semibold">
              ⚠️ Market Closed - Last Known Prices
            </p>
          </div>
        )}
      </CollapsibleSection>

      {/* Section 3: Order Configuration */}
      <CollapsibleSection title="Order Setup" icon="⚙️" defaultOpen={true}>
        {/* Order Type Tabs */}
        <div>
          <Label className="text-xs font-semibold text-dark-600 mb-2 uppercase tracking-wide">Order Type</Label>
          <Tabs value={orderType} onValueChange={(value) => setOrderType(value as 'market' | 'limit')}>
            <TabsList className="grid grid-cols-2 w-full bg-dark-400 p-1">
              <TabsTrigger 
                value="market" 
                className="data-[state=active]:bg-primary data-[state=active]:text-white font-semibold"
              >
                ⚡ Market
              </TabsTrigger>
              <TabsTrigger 
                value="limit" 
                className="data-[state=active]:bg-blue-500 data-[state=active]:text-white font-semibold"
              >
                📊 Limit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Limit Price Configuration */}
        {orderType === 'limit' && (
          <div className="bg-dark-400/30 rounded-lg p-3 border border-dark-500/30">
            <Label className="text-xs font-semibold text-dark-600 mb-2 uppercase tracking-wide">Limit Price</Label>
            <Tabs value={limitPriceMode} onValueChange={(value) => setLimitPriceMode(value as 'price' | 'pips')}>
              <TabsList className="grid grid-cols-2 w-full mb-3 bg-dark-500">
                <TabsTrigger value="pips" className="data-[state=active]:bg-primary">📏 Pips</TabsTrigger>
                <TabsTrigger value="price" className="data-[state=active]:bg-primary">💰 Price</TabsTrigger>
              </TabsList>

              <TabsContent value="pips" className="mt-0">
                <Input
                  type="number"
                  step="0.1"
                  value={limitPricePips}
                  onChange={(e) => setLimitPricePips(e.target.value)}
                  placeholder="Enter pips"
                  className="bg-dark-500 border-dark-600 h-11 text-base font-semibold"
                />
                {limitPricePips && displayPrice > 0 && (
                  <div className="mt-2 bg-dark-500/50 rounded p-2 text-center">
                    <p className="text-xs text-dark-600">Calculated Limit Price</p>
                    <p className="text-sm font-bold text-primary">
                      {calculateLimitFromPips(parseFloat(limitPricePips)).toFixed(5)}
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="price" className="mt-0">
                <Input
                  type="number"
                  step="0.00001"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="Enter price"
                  className="bg-dark-500 border-dark-600 h-11 text-base font-semibold"
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CollapsibleSection>

      {/* Section 4: Trading Size */}
      <CollapsibleSection title="Trade Size & Risk" icon="📐" defaultOpen={true}>
        {/* Quantity */}
        <div>
          <Label className="text-xs font-semibold text-dark-600 mb-2 uppercase tracking-wide flex items-center gap-2">
            📊 Quantity (Lots)
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max="100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="bg-dark-400 border-dark-500 h-11 text-base font-bold"
            required
          />
          <p className="text-xs text-dark-600 mt-1.5 text-center">Range: 0.01 - 100 lots</p>
        </div>

        {/* Leverage Display (Admin-controlled, read-only) */}
        <div className="bg-dark-300/50 border border-dark-400 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-dark-600">Leverage (Admin-controlled)</Label>
            <div className="flex items-center gap-1">
              <RefreshCw className="size-3 text-green-500 animate-spin" style={{ animationDuration: '3s' }} />
              <span className="text-xs text-green-500">Live</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-bold text-gray-100">1:{leverage}</span>
            <span className="text-xs text-dark-600">Auto-updates</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 5: Take Profit & Stop Loss */}
      <CollapsibleSection title="Take Profit / Stop Loss" icon="🎯" defaultOpen={false}>
        {/* Take Profit Toggle & Input */}
        <div className="bg-dark-400/30 rounded-lg p-3 border border-dark-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-dark-600 uppercase tracking-wide flex items-center gap-2">
              🎯 Take Profit
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-bold",
                tpEnabled ? "text-green-400" : "text-dark-600"
              )}>
                {tpEnabled ? 'ON' : 'OFF'}
              </span>
              <Switch
                checked={tpEnabled}
                onCheckedChange={setTpEnabled}
              />
            </div>
          </div>
          
          {tpEnabled && (
            <>
              <Tabs value={tpMode} onValueChange={(v) => setTpMode(v as 'price' | 'pips')}>
                <TabsList className="grid w-full grid-cols-2 bg-dark-500">
                  <TabsTrigger value="pips" className="text-xs data-[state=active]:bg-green-500">📏 Pips</TabsTrigger>
                  <TabsTrigger value="price" className="text-xs data-[state=active]:bg-green-500">💰 Price</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pips" className="mt-2">
                  <Input
                    type="number"
                    value={takeProfitPips}
                    onChange={(e) => setTakeProfitPips(e.target.value)}
                    placeholder="e.g., 50"
                    className="bg-dark-500 border-dark-600 h-10 font-semibold"
                  />
                  {takeProfitPips && displayPrice > 0 && (
                    <div className="mt-2 bg-green-500/10 rounded p-2 text-center">
                      <p className="text-xs text-dark-600">Target Price</p>
                      <p className="text-sm font-bold text-green-400">
                        {calculateTPFromPips(parseFloat(takeProfitPips)).toFixed(5)}
                      </p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="price" className="mt-2">
                  <Input
                    type="number"
                    step="0.00001"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="Enter target price"
                    className="bg-dark-500 border-dark-600 h-10 font-semibold"
                  />
                </TabsContent>
            </Tabs>
            
            {/* TP Potential Profit Preview */}
            {potentialProfit && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-400">💰 Potential Profit:</span>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-400">
                      +${potentialProfit.pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-green-400/70">
                      +{potentialProfit.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

        {/* Stop Loss Toggle & Input */}
        <div className="bg-dark-400/30 rounded-lg p-3 border border-dark-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-dark-600 uppercase tracking-wide flex items-center gap-2">
              🛑 Stop Loss
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-bold",
                slEnabled ? "text-red-400" : "text-dark-600"
              )}>
                {slEnabled ? 'ON' : 'OFF'}
              </span>
              <Switch
                checked={slEnabled}
                onCheckedChange={setSlEnabled}
              />
            </div>
          </div>
          
          {slEnabled && (
            <>
              <Tabs value={slMode} onValueChange={(v) => setSlMode(v as 'price' | 'pips')}>
                <TabsList className="grid w-full grid-cols-2 bg-dark-500">
                  <TabsTrigger value="pips" className="text-xs data-[state=active]:bg-red-500">📏 Pips</TabsTrigger>
                  <TabsTrigger value="price" className="text-xs data-[state=active]:bg-red-500">💰 Price</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pips" className="mt-2">
                  <Input
                    type="number"
                    value={stopLossPips}
                    onChange={(e) => setStopLossPips(e.target.value)}
                    placeholder="e.g., 30"
                    className="bg-dark-500 border-dark-600 h-10 font-semibold"
                  />
                  {stopLossPips && displayPrice > 0 && (
                    <div className="mt-2 bg-red-500/10 rounded p-2 text-center">
                      <p className="text-xs text-dark-600">Stop Price</p>
                      <p className="text-sm font-bold text-red-400">
                        {calculateSLFromPips(parseFloat(stopLossPips)).toFixed(5)}
                      </p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="price" className="mt-2">
                  <Input
                    type="number"
                    step="0.00001"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="Enter stop price"
                    className="bg-dark-500 border-dark-600 h-10 font-semibold"
                  />
                </TabsContent>
              </Tabs>
              
              {/* SL Potential Loss Preview */}
              {potentialLoss && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-400 font-semibold">⚠️ Potential Loss:</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-400">
                        ${potentialLoss.pnl.toFixed(2)}
                      </div>
                      <div className="text-xs text-red-400/70">
                        {potentialLoss.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Risk:Reward Ratio */}
              {potentialProfit && potentialLoss && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-400">📊 Risk:Reward:</span>
                  <span className="text-sm font-bold text-blue-400">
                    1:{Math.abs(potentialProfit.pnl / potentialLoss.pnl).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </CollapsibleSection>

      {/* Limit Order Validation Status */}
      {orderType === 'limit' && (
        <div className={cn(
          "p-3 rounded-lg border space-y-2 transition-all",
          (side === 'buy' && validForBuy) || (side === 'sell' && validForSell)
            ? "bg-green-500/10 border-green-500/50"
            : "bg-dark-300 border-dark-400"
        )}>
          {/* Quick Status - Which sides are valid */}
          <div className="flex gap-2 mb-2">
            <div className={cn(
              "flex-1 text-xs font-semibold py-1.5 px-2 rounded text-center transition-all",
              validForBuy
                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                : "bg-dark-400 text-dark-600 border border-dark-500"
            )}>
              {validForBuy ? '✅' : '❌'} BUY
            </div>
            <div className={cn(
              "flex-1 text-xs font-semibold py-1.5 px-2 rounded text-center transition-all",
              validForSell
                ? "bg-red-500/20 text-red-400 border border-red-500/50"
                : "bg-dark-400 text-dark-600 border border-dark-500"
            )}>
              {validForSell ? '✅' : '❌'} SELL
            </div>
          </div>

          {limitValidation && (
            <>
              <div className={cn(
                "text-xs font-semibold mb-2 flex items-center gap-2",
                (side === 'buy' && validForBuy) || (side === 'sell' && validForSell)
                  ? "text-green-400"
                  : "text-dark-600"
              )}>
                {(side === 'buy' && validForBuy) && <CheckCircle2 className="size-4" />}
                {(side === 'sell' && validForSell) && <CheckCircle2 className="size-4" />}
                {!(validForBuy || validForSell) && <AlertCircle className="size-4 text-red-400" />}
                <span>
                  {side === 'buy' ? 'BUY' : 'SELL'} Limit Validation
                  {(side === 'buy' && validForBuy) && ' ✅'}
                  {(side === 'sell' && validForSell) && ' ✅'}
                </span>
              </div>
          
          {/* Pips Distance Check - ONLY validation rule */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-dark-600">Distance from Market:</span>
            <div className="flex items-center gap-1">
              {limitValidation.minDistanceValid ? (
                <>
                  <CheckCircle2 className="size-3 text-green-400" />
                  <span className={cn(
                    "text-xs font-semibold",
                    (side === 'buy' && validForBuy) || (side === 'sell' && validForSell)
                      ? "text-green-400"
                      : "text-green-400"
                  )}>
                    ✅ {limitValidation.pipsAway.toFixed(1)} pips away (min: 10)
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="size-3 text-red-400" />
                  <span className="text-xs font-semibold text-red-400">
                    ❌ {limitValidation.pipsAway.toFixed(1)} pips away (min: 10)
                  </span>
                </>
              )}
            </div>
          </div>

            </>
          )}
        </div>
      )}

      {/* Margin Required */}
      <CollapsibleSection title="Margin Required" icon="💳" defaultOpen={true}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-600 flex items-center gap-1">
            Margin Required:
          </span>
          <span className="text-lg font-bold text-light-900">
            ${marginRequired.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-dark-600">Available:</span>
          <span className={cn(
            "text-sm font-semibold",
            canPlaceOrder ? "text-green" : "text-red"
          )}>
            ${availableCapital.toFixed(2)}
          </span>
        </div>
        {marginRequired > 0 && (
          <div className="mt-2 pt-2 border-t border-dark-400">
            <div className="flex items-center justify-between">
              <span className="text-xs text-dark-600">Margin Level After Trade:</span>
              <span className={cn(
                "text-sm font-bold",
                wouldCauseMarginCall ? "text-red-500" : 
                marginLevelAfterTrade < (marginThresholds?.WARNING || 150) ? "text-yellow-500" : 
                "text-green-500"
              )}>
                {Number.isFinite(marginLevelAfterTrade) ? `${marginLevelAfterTrade.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            {currentlyBelowMarginCall && (
              <p className="text-xs text-red-500 mt-1 font-semibold">
                🚨 Current margin at {currentMarginLevel.toFixed(1)}% - below {marginCallThreshold}% margin call. Close positions to trade.
              </p>
            )}
            {!currentlyBelowMarginCall && wouldCauseMarginCall && (
              <p className="text-xs text-red-500 mt-1">
                ⚠️ Would drop below {marginCallThreshold}% margin call - trade blocked
              </p>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Buy/Sell Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="submit"
          disabled={
            isSubmitting || 
            !canPlaceOrder || 
            (orderType === 'limit' && !validForBuy)
          }
          onClick={() => setSide('buy')}
          className={cn(
            "font-bold h-12 transition-all text-xl",
            validForBuy && orderType === 'limit' 
              ? "bg-green-500 hover:bg-green-600 text-white ring-2 ring-green-400" 
              : "bg-[#26a69a] hover:bg-[#26a69a]/90 text-white"
          )}
        >
          {isSubmitting && side === 'buy' ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <TrendingUp className="size-6 mr-2" />
              Buy
            </>
          )}
        </Button>
        <Button
          type="submit"
          disabled={
            isSubmitting || 
            !canPlaceOrder || 
            (orderType === 'limit' && !validForSell)
          }
          onClick={() => setSide('sell')}
          className={cn(
            "font-bold h-12 transition-all text-xl",
            validForSell && orderType === 'limit'
              ? "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-400"
              : "bg-[#ef5350] hover:bg-[#ef5350]/90 text-white"
          )}
        >
          {isSubmitting && side === 'sell' ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <TrendingDown className="size-6 mr-2" />
              Sell
            </>
          )}
        </Button>
      </div>

      {!canPlaceOrder && (
        <p className="text-xs text-red text-center">
          {disabled
            ? (disabledReason || '🚫 Trading is disabled')
            : openPositionsCount >= maxPositions
            ? `Maximum ${maxPositions} positions reached`
            : 'Insufficient capital for this trade'}
        </p>
      )}
      
      {orderType === 'limit' && !validForBuy && !validForSell && canPlaceOrder && limitValidation && (
        <p className="text-xs text-red-400 text-center">
          ⚠️ Price not valid for either BUY or SELL - adjust price or distance
        </p>
      )}
    </form>
  );
};

export default OrderForm;

