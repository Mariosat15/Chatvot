'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { TrendingUp, TrendingDown, Zap, Target, Shield, Flame, Trophy, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { useRiskSettings } from '@/hooks/useRiskSettings';
import { placeOrder } from '@/lib/actions/trading/order.actions';
import { getUserStreak } from '@/lib/actions/trading/competition.actions';
import { 
  calculateMaxSafeTradeAmount, 
  calculateProjectedMarginLevel, 
  getMarginSafetyMessage,
  DEFAULT_MARGIN_THRESHOLDS,
  type MarginThresholds
} from '@/lib/services/margin-safety.service';
import { toast } from 'sonner';

interface GameModeOrderFormProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number; // Admin-controlled, users cannot change
  openPositionsCount: number;
  maxPositions: number;
  // For margin safety calculations
  currentEquity: number;
  existingUsedMargin: number;
  // Margin thresholds from admin settings (optional - falls back to defaults)
  // This ensures admin panel issues don't break trading
  marginThresholds?: MarginThresholds;
}

// Risk levels with gaming terminology and clear descriptions
const RISK_LEVELS = {
  safe: { 
    name: 'Safe', 
    icon: Shield, 
    color: 'green', 
    multiplier: 0.02, 
    emoji: '🛡️',
    description: 'Very small risk - Good for beginners!'
  },
  balanced: { 
    name: 'Balanced', 
    icon: Target, 
    color: 'blue', 
    multiplier: 0.05, 
    emoji: '⚖️',
    description: 'Medium risk - Best for most traders'
  },
  aggressive: { 
    name: 'Aggressive', 
    icon: Flame, 
    color: 'orange', 
    multiplier: 0.1, 
    emoji: '🔥',
    description: 'High risk - Can win or lose BIG!'
  },
  yolo: { 
    name: 'YOLO', 
    icon: Zap, 
    color: 'red', 
    multiplier: 0.25, 
    emoji: '🚀',
    description: 'EXTREME risk - Only for experts!'
  },
};

export default function GameModeOrderForm({
  competitionId,
  availableCapital,
  defaultLeverage,
  openPositionsCount,
  maxPositions,
  currentEquity,
  existingUsedMargin,
  marginThresholds = DEFAULT_MARGIN_THRESHOLDS,
}: GameModeOrderFormProps) {
  const { symbol: chartSymbol, setSymbol: setChartSymbol } = useChartSymbol();
  const { prices, subscribe, unsubscribe } = usePrices();
  const { settings: riskSettings } = useRiskSettings(10000); // Poll every 10 seconds
  
  const [symbol, setSymbol] = useState<ForexSymbol>(chartSymbol);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [riskLevel, setRiskLevel] = useState<keyof typeof RISK_LEVELS | null>('balanced');
  const [amount, setAmount] = useState(1); // Start from $1
  const [takeProfitPips, setTakeProfitPips] = useState<number>(50); // Default 50 pips
  const [stopLossPips, setStopLossPips] = useState<number>(30); // Default 30 pips
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [streak, setStreak] = useState(0);
  
  // Leverage is admin-controlled, not user-adjustable
  // Use real-time settings from admin, fallback to prop
  const leverage = riskSettings.defaultLeverage || defaultLeverage;

  // Subscribe to price updates (CRITICAL - same as Professional mode!)
  useEffect(() => {
    console.log('🎮 Game Mode Order Form: Subscribing to price updates for', symbol);
    subscribe(symbol);
    return () => {
      console.log('🎮 Game Mode Order Form: Unsubscribing from', symbol);
      unsubscribe(symbol);
    };
  }, [symbol, subscribe, unsubscribe]);

  // Sync with chart symbol
  useEffect(() => {
    setSymbol(chartSymbol);
  }, [chartSymbol]);

  // Fetch streak on mount and after successful trades
  useEffect(() => {
    const fetchStreak = async () => {
      const currentStreak = await getUserStreak(competitionId);
      setStreak(currentStreak);
    };
    fetchStreak();
  }, [competitionId]);

  const handleSymbolChange = (newSymbol: ForexSymbol) => {
    setSymbol(newSymbol);
    setChartSymbol(newSymbol);
  };

  const currentPrice = prices.get(symbol);
  
  // Calculate trade details
  let actualAmount = 0;
  
  if (riskLevel) {
    // Use risk level if selected
    const riskInfo = RISK_LEVELS[riskLevel];
    const suggestedAmount = availableCapital * riskInfo.multiplier;
    actualAmount = amount || suggestedAmount;
  } else {
    // Fallback to amount or balanced
    const riskInfo = RISK_LEVELS['balanced'];
    const suggestedAmount = availableCapital * riskInfo.multiplier;
    actualAmount = amount || suggestedAmount;
  }
  
  // Get contract size (100,000 for Forex)
  const contractSize = 100000;
  const currentMarketPrice = currentPrice?.mid || 1.0;
  
  // CORRECT CALCULATION matching server-side:
  // 1. Calculate lot size from desired amount and leverage
  // Formula: quantity = (amount * leverage) / (contractSize * price)
  let lotSize = (actualAmount * leverage) / (contractSize * currentMarketPrice);
  lotSize = Math.round(lotSize * 100) / 100; // Round to 0.01
  lotSize = Math.max(0.01, lotSize); // Minimum 0.01 lots
  
  // 2. Calculate REAL margin required (what server will check)
  // Formula: margin = (quantity * contractSize * price) / leverage
  const positionValue = lotSize * contractSize * currentMarketPrice;
  const marginRequired = positionValue / leverage;
  
  // 3. Calculate CURRENT margin level (before any new trade)
  const currentMarginLevel = existingUsedMargin > 0 
    ? (currentEquity / existingUsedMargin) * 100 
    : Infinity;
  
  // 4. Check if CURRENT margin is already below margin call threshold
  const marginCallThreshold = marginThresholds?.MARGIN_CALL || 100;
  const currentlyBelowMarginCall = existingUsedMargin > 0 && currentMarginLevel < marginCallThreshold;
  
  // 5. Calculate projected margin level after this trade
  const projectedMarginLevel = calculateProjectedMarginLevel(
    currentEquity,
    existingUsedMargin,
    marginRequired
  );
  
  // 6. Check if trade would push margin below margin call
  const wouldCauseMarginCall = projectedMarginLevel < marginCallThreshold;
  
  // 7. Get margin safety status for display
  const marginSafety = getMarginSafetyMessage(projectedMarginLevel, 'game', marginThresholds);
  
  // 8. Validation: Block trade if current margin is below call OR trade would cause margin call
  const hasEnoughBalance = marginRequired <= availableCapital;
  const positionWithinLimit = positionValue <= (availableCapital * leverage);
  const marginSafeToTrade = !currentlyBelowMarginCall && !wouldCauseMarginCall;
  const canPlaceOrder = hasEnoughBalance && positionWithinLimit && openPositionsCount < maxPositions && marginSafeToTrade;

  // Calculate max safe amount considering margin stopout levels
  // This ensures we don't push margin level below the WARNING threshold
  const marginSafetyCalc = calculateMaxSafeTradeAmount(
    currentEquity,
    existingUsedMargin,
    availableCapital,
    leverage,
    marginThresholds.WARNING, // Keep margin level above WARNING threshold
    marginThresholds
  );
  
  const maxSafeAmount = marginSafetyCalc.maxSafeAmount;
  const safetyReason = marginSafetyCalc.reason;

  // Handle risk level change
  const handleRiskLevelChange = (level: keyof typeof RISK_LEVELS) => {
    setRiskLevel(level);
    const riskInfo = RISK_LEVELS[level];
    const suggestedAmount = Math.min(availableCapital * riskInfo.multiplier, maxSafeAmount);
    setAmount(suggestedAmount);
  };

  // Handle trade placement
  const handleTrade = async (tradeSide: 'buy' | 'sell') => {
    if (!canPlaceOrder || !currentPrice) {
      // Show specific error message
      if (currentlyBelowMarginCall) {
        toast.error('Cannot Place Trade', {
          description: `🚨 MARGIN CALL! Your current margin level is ${currentMarginLevel.toFixed(1)}%. Close some positions before opening new trades.`,
          duration: 5000,
        });
      } else if (wouldCauseMarginCall) {
        toast.error('Cannot Place Trade', {
          description: `⚠️ This trade would push your margin level to ${projectedMarginLevel.toFixed(1)}%, below the ${marginCallThreshold}% margin call threshold. Reduce trade size or close positions first.`,
          duration: 5000,
        });
      } else if (!hasEnoughBalance) {
        toast.error('Insufficient Balance', {
          description: `You need $${marginRequired.toFixed(2)} margin but only have $${availableCapital.toFixed(2)} available.`,
          duration: 5000,
        });
      } else if (openPositionsCount >= maxPositions) {
        toast.error('Max Positions Reached', {
          description: `You've reached the maximum of ${maxPositions} open positions.`,
          duration: 5000,
        });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate quantity based on capital and leverage
      // In Forex, quantity represents lots (1 lot = 100,000 units)
      // With leverage, positionValue = actualAmount * leverage
      // quantity (in lots) = positionValue / 100,000
      const positionValueInUnits = (actualAmount * leverage);
      let quantity = positionValueInUnits / 100000; // Convert to lots
      
      // Round to 0.01 increments (micro lots)
      quantity = Math.round(quantity * 100) / 100;
      
      // Ensure minimum 0.01 lots
      quantity = Math.max(0.01, quantity);
      
      // Calculate TP/SL prices from pips if enabled
      const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
      let takeProfitPrice: number | undefined;
      let stopLossPrice: number | undefined;
      
      if (tpEnabled) {
        if (tradeSide === 'buy') {
          takeProfitPrice = currentPrice.ask + (takeProfitPips * pipSize);
        } else {
          takeProfitPrice = currentPrice.bid - (takeProfitPips * pipSize);
        }
      }
      
      if (slEnabled) {
        if (tradeSide === 'buy') {
          stopLossPrice = currentPrice.ask - (stopLossPips * pipSize);
        } else {
          stopLossPrice = currentPrice.bid + (stopLossPips * pipSize);
        }
      }
      
      await placeOrder({
        competitionId,
        symbol,
        side: tradeSide,
        orderType: 'market',
        quantity,
        leverage,
        takeProfit: takeProfitPrice,
        stopLoss: stopLossPrice,
      });

      // Success feedback
      toast.success(
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-yellow-500" />
          <div>
            <p className="font-bold">Trade Placed! 🎉</p>
            <p className="text-xs">
              {tradeSide === 'buy' ? 'Going LONG' : 'Going SHORT'} on {symbol}
            </p>
          </div>
        </div>,
        { duration: 3000 }
      );

      // Refresh streak after trade is placed
      const updatedStreak = await getUserStreak(competitionId);
      setStreak(updatedStreak);

      // Reset amount after successful trade to $1
      setAmount(1);

    } catch (error: any) {
      toast.error(error.message || 'Failed to place trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Celebration Animation */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-6xl animate-bounce">🚀💰🎯</div>
        </div>
      )}

      {/* Winning Streak - Tracks all trades from both modes */}
      {streak > 0 && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg p-3 flex items-center gap-2 animate-pulse">
          <Flame className="size-5 text-orange-500" />
          <div>
            <p className="text-sm font-bold text-yellow-500">ON FIRE! 🔥</p>
            <p className="text-xs text-dark-600">{streak} winning {streak === 1 ? 'trade' : 'trades'} in a row!</p>
          </div>
        </div>
      )}

      {/* Symbol Selector - HIDDEN (Now in chart area) */}
      {/* The symbol selector is now displayed above the chart for better UX */}

      {/* Current Price Display */}
      {currentPrice && (
        <div className="bg-dark-300 rounded-lg p-4">
          <p className="text-xs text-dark-600 mb-2 text-center">Current Price</p>
          
          {/* Mid Price - Large */}
          <p className="text-2xl font-bold text-white font-mono text-center mb-3">
            {currentPrice.mid.toFixed(5)}
          </p>
          
          {/* BID and ASK */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-dark-200 rounded p-2">
              <p className="text-xs text-blue-400 mb-1">BID</p>
              <p className="text-sm font-bold text-blue-400 font-mono">
                {currentPrice.bid.toFixed(5)}
              </p>
              <p className="text-xs text-dark-600 mt-1">You sell here</p>
            </div>
            <div className="bg-dark-200 rounded p-2">
              <p className="text-xs text-red-400 mb-1">ASK</p>
              <p className="text-sm font-bold text-red-400 font-mono">
                {currentPrice.ask.toFixed(5)}
              </p>
              <p className="text-xs text-dark-600 mt-1">You buy here</p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Level Selector - Gamified */}
      <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/50 rounded-xl p-4">
        <Label className="text-light-900 font-bold text-lg flex items-center justify-center gap-2 mb-4">
          🎲 Pick Your Risk Level
          <HelpTooltip 
            content="Choose how much risk you want to take! Safe = small trades, YOLO = big trades. Higher risk = bigger wins or losses!"
            side="bottom"
          />
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(RISK_LEVELS).map(([key, info]) => {
            const riskAmount = Math.min(availableCapital * info.multiplier, maxSafeAmount);
            const isSelected = riskLevel === key;
            return (
              <button
                key={key}
                onClick={() => handleRiskLevelChange(key as keyof typeof RISK_LEVELS)}
                className={cn(
                  "relative p-4 rounded-xl border-3 transition-all transform hover:scale-105",
                  isSelected
                    ? "bg-gradient-to-br from-yellow-500 to-orange-500 border-yellow-400 shadow-2xl shadow-yellow-500/50 scale-105 ring-2 ring-yellow-300"
                    : "bg-gradient-to-br from-dark-300 to-dark-400 border-dark-500 hover:border-dark-600 shadow-lg"
                )}
              >
                <div className="text-center">
                  <span className="text-4xl block mb-2">{info.emoji}</span>
                  <span className={cn(
                    "text-base font-black block mb-1 uppercase",
                    isSelected ? "text-black" : "text-white"
                  )}>
                    {info.name}
                  </span>
                  <p className={cn(
                    "text-sm font-bold mb-2",
                    isSelected ? "text-black/80" : "text-primary"
                  )}>
                    ${riskAmount.toFixed(2)}
                  </p>
                  <p className={cn(
                    "text-xs font-semibold",
                    isSelected ? "text-black/70" : "text-dark-600"
                  )}>
                    {info.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute -top-2 -right-2 bg-green-500 rounded-full size-6 flex items-center justify-center shadow-lg animate-pulse">
                    <span className="text-xs">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Amount Slider */}
      <div>
        <Label className="text-light-900 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            Fine-tune Amount
            <HelpTooltip 
              content="Adjust exactly how much money you want to risk on this trade. Slide left for less, right for more!"
              side="bottom"
            />
          </span>
          <span className="text-primary font-bold">${actualAmount.toFixed(2)}</span>
        </Label>
        <Slider
          value={[amount || 1]}
          onValueChange={(value) => {
            setAmount(value[0]);
            setRiskLevel(null);
          }}
          min={1}
          max={maxSafeAmount}
          step={1}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-dark-600 mt-1">
          <span>$1</span>
          <span>${maxSafeAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Take Profit Slider */}
      <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-lg p-4 border border-green-500/30">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-white font-bold flex items-center gap-2">
            🎯 Take Profit
            <HelpTooltip 
              content="Automatically close your trade when you reach this profit! The trade will close and you'll lock in your winnings. Set in pips (price movement steps)."
              side="bottom"
            />
          </Label>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded",
              tpEnabled ? "bg-green-500/20 text-green-400" : "bg-dark-500 text-dark-600"
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
            <Slider
              value={[takeProfitPips]}
              onValueChange={(value) => setTakeProfitPips(value[0])}
              min={10}
              max={500}
              step={10}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-green-400 mt-1">
              <span>10 pips</span>
              <span className="text-white font-bold">{takeProfitPips} pips</span>
              <span>500 pips</span>
            </div>
          </>
        )}
      </div>

      {/* Stop Loss Slider */}
      <div className="bg-gradient-to-br from-red-900/20 to-rose-900/20 rounded-lg p-4 border border-red-500/30">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-white font-bold flex items-center gap-2">
            🛑 Stop Loss
            <HelpTooltip 
              content="Automatically close your trade when you're losing this much! This protects you from losing too much money. Set in pips (price movement steps)."
              side="bottom"
            />
          </Label>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded",
              slEnabled ? "bg-red-500/20 text-red-400" : "bg-dark-500 text-dark-600"
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
            <Slider
              value={[stopLossPips]}
              onValueChange={(value) => setStopLossPips(value[0])}
              min={10}
              max={500}
              step={10}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-red-400 mt-1">
              <span>10 pips</span>
              <span className="text-white font-bold">{stopLossPips} pips</span>
              <span>500 pips</span>
            </div>
          </>
        )}
      </div>

      {/* Leverage (Admin-controlled, read-only) */}
      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg p-4 border border-yellow-500/50 relative overflow-hidden">
        {/* Live indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full border border-green-500/30">
          <div className="size-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-400 font-medium">LIVE</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-yellow-500" />
            <div>
              <div className="text-xs text-dark-600 flex items-center gap-1">
                Power Multiplier
                <HelpTooltip 
                  content="This multiplies your profit/loss! Higher number = bigger wins AND bigger losses. Set by the admin - you can't change this."
                  side="right"
                  className="size-4"
                />
              </div>
              <div className="text-sm text-gray-400">(Auto-updates)</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              {leverage}x
            </div>
          </div>
        </div>
      </div>

      {/* Trade Info Panel - Show lot size, margin, no decimals */}
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-3 border border-purple-500/30">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-dark-600">Trade Size (Lots)</p>
            <p className="text-lg font-bold text-white">{lotSize.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-dark-600">Money Needed</p>
            <p className="text-lg font-bold text-white">${marginRequired.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-dark-600">Position Value</p>
            <p className="text-lg font-bold text-primary">${positionValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-dark-600">Risk Level</p>
            <p className="text-lg font-bold text-white">
              {riskLevel ? (
                <>
                  {RISK_LEVELS[riskLevel].emoji}
                </>
              ) : (
                <>🎨</>
              )}
            </p>
          </div>
          <div>
            <p className="text-dark-600">Available</p>
            <p className="text-sm font-semibold text-white">${availableCapital.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Margin Safety Warning - Show stopout info */}
      {marginSafety.status !== 'safe' && (
        <div className={cn(
          "rounded-lg p-3 border-2",
          marginSafety.status === 'critical' && "bg-red-900/30 border-red-500 animate-pulse",
          marginSafety.status === 'danger' && "bg-orange-900/30 border-orange-500",
          marginSafety.status === 'warning' && "bg-yellow-900/30 border-yellow-500"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className={cn(
              "size-5",
              marginSafety.status === 'critical' && "text-red-500",
              marginSafety.status === 'danger' && "text-orange-500",
              marginSafety.status === 'warning' && "text-yellow-500"
            )} />
            <p className={cn(
              "text-sm font-bold",
              marginSafety.status === 'critical' && "text-red-400",
              marginSafety.status === 'danger' && "text-orange-400",
              marginSafety.status === 'warning' && "text-yellow-400"
            )}>
              Safety Level After Trade: {projectedMarginLevel.toFixed(2)}%
            </p>
          </div>
          <p className="text-xs text-white mb-2">
            {marginSafety.message}
          </p>
          <div className="bg-dark-400/50 rounded p-2 text-xs">
            <p className="text-dark-600">📊 Stopout Levels:</p>
            <div className="mt-1 space-y-1">
              <p className="text-red-400">💀 Stopout at {marginThresholds.LIQUIDATION}% - All trades close!</p>
              <p className="text-orange-400">🚨 Danger at {marginThresholds.MARGIN_CALL}% - High risk!</p>
              <p className="text-yellow-400">⚠️ Warning at {marginThresholds.WARNING}% - Be careful!</p>
              <p className="text-green-400">✅ Safe at {marginThresholds.SAFE}%+ - Good to trade!</p>
            </div>
          </div>
        </div>
      )}

      {/* Buy/Sell Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => {
            setSide('buy');
            handleTrade('buy');
          }}
          disabled={isSubmitting || !canPlaceOrder}
          className={cn(
            "h-16 text-xl font-bold transition-all relative overflow-hidden border-2",
            side === 'buy'
              ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-green-400 shadow-lg shadow-green-500/50"
              : "bg-gradient-to-r from-green-600/30 to-emerald-700/30 hover:from-green-600/50 hover:to-emerald-700/50 border-green-600/50"
          )}
        >
          {isSubmitting && side === 'buy' && (
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          )}
          <div className="relative z-10 flex flex-col items-center text-white">
            <TrendingUp className="size-7 mb-1" />
            <span className="text-xl">BUY</span>
          </div>
        </Button>

        <Button
          onClick={() => {
            setSide('sell');
            handleTrade('sell');
          }}
          disabled={isSubmitting || !canPlaceOrder}
          className={cn(
            "h-16 text-xl font-bold transition-all relative overflow-hidden border-2",
            side === 'sell'
              ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 border-red-400 shadow-lg shadow-red-500/50"
              : "bg-gradient-to-r from-red-600/30 to-rose-700/30 hover:from-red-600/50 hover:to-rose-700/50 border-red-600/50"
          )}
        >
          {isSubmitting && side === 'sell' && (
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          )}
          <div className="relative z-10 flex flex-col items-center text-white">
            <TrendingDown className="size-7 mb-1" />
            <span className="text-xl">SELL</span>
          </div>
        </Button>
      </div>

      {/* Warning Messages - Clear explanation */}
      {currentlyBelowMarginCall && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-center animate-pulse">
          <p className="text-sm text-red-500 font-bold">
            🚨 MARGIN CALL - Cannot Trade!
          </p>
          <p className="text-xs text-red-400 mt-1">
            Current margin level: {currentMarginLevel.toFixed(1)}% (need {marginCallThreshold}%+)
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Close some positions before opening new trades
          </p>
        </div>
      )}

      {!currentlyBelowMarginCall && wouldCauseMarginCall && (
        <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-3 text-center animate-pulse">
          <p className="text-sm text-orange-500 font-bold">
            ⚠️ Trade Would Cause Margin Call!
          </p>
          <p className="text-xs text-orange-400 mt-1">
            Would drop to {projectedMarginLevel.toFixed(1)}% (need {marginCallThreshold}%+)
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Reduce trade size or close positions
          </p>
        </div>
      )}

      {!canPlaceOrder && !currentlyBelowMarginCall && !wouldCauseMarginCall && (
        <div className="bg-red/10 border border-red rounded-lg p-3 text-center animate-pulse">
          <p className="text-sm text-red font-semibold">
            {!hasEnoughBalance 
              ? '❌ Not enough money!' 
              : !positionWithinLimit
              ? '⚠️ Trade is too big!'
              : openPositionsCount >= maxPositions
              ? `❌ Max ${maxPositions} positions reached!`
              : '❌ Cannot place trade!'
            }
          </p>
          <p className="text-xs text-dark-600 mt-1">
            {!hasEnoughBalance 
              ? `This trade needs $${marginRequired.toFixed(2)} but you only have $${availableCapital.toFixed(2)}. Lower your bet amount!`
              : !positionWithinLimit
              ? `Max trade size is $${(availableCapital * leverage).toFixed(2)}. Lower your bet amount!`
              : `You can only have ${maxPositions} trades open at once. Close some trades first!`
            }
          </p>
        </div>
      )}

      {/* Pro Tips */}
      <div className="bg-blue/10 border border-blue rounded-lg p-3">
        <p className="text-xs font-semibold text-blue mb-1">💡 Pro Tip</p>
        <p className="text-xs text-dark-600">
          {riskLevel === 'safe' && "Safe mode is great for learning! Start small and build confidence."}
          {riskLevel === 'balanced' && "Balanced risk-reward. Perfect for most traders!"}
          {riskLevel === 'aggressive' && "Higher risk, higher reward! Make sure you know what you're doing."}
          {riskLevel === 'yolo' && "⚠️ EXTREME RISK! Only use if you're ready to lose it all!"}
          {!riskLevel && "Choose a risk level or use the slider to customize your bet amount!"}
        </p>
      </div>
    </div>
  );
}

