'use client';

import { useState, useMemo } from 'react';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { usePrices } from '@/contexts/PriceProvider';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { placeOrder } from '@/lib/actions/trading/order.actions';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Loader2, TrendingUp, TrendingDown, Zap, Target, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface GameModeOrderFormProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number;
  currentBalance: number;
  disabled?: boolean;
}

export default function GameModeOrderForm({
  competitionId,
  availableCapital,
  defaultLeverage,
  currentBalance,
  disabled = false,
}: GameModeOrderFormProps) {
  const { symbol } = useChartSymbol();
  const { prices } = usePrices();
  
  const [lotSize, setLotSize] = useState(0.01);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tpPips, setTpPips] = useState<number>(20);
  const [slPips, setSlPips] = useState<number>(10);
  const [useTp, setUseTp] = useState(true);
  const [useSl, setUseSl] = useState(true);
  
  // Use fixed leverage from admin
  const leverage = defaultLeverage;
  
  const currentPrice = prices.get(symbol);
  const symbolInfo = FOREX_PAIRS[symbol as ForexSymbol];
  const pipValue = symbolInfo?.pip || 0.0001;
  
  // Calculate margin required
  const marginRequired = useMemo(() => {
    if (!currentPrice) return 0;
    const notionalValue = lotSize * (symbolInfo?.contractSize || 100000) * currentPrice.mid;
    return notionalValue / leverage;
  }, [lotSize, leverage, currentPrice, symbolInfo]);
  
  // Calculate TP/SL prices
  const calculateTPFromPips = (side: 'long' | 'short', pips: number) => {
    if (!currentPrice) return 0;
    const price = side === 'long' ? currentPrice.ask : currentPrice.bid;
    const tpPrice = side === 'long' 
      ? price + (pips * pipValue)
      : price - (pips * pipValue);
    return Math.round(tpPrice * 100000) / 100000;
  };
  
  const calculateSLFromPips = (side: 'long' | 'short', pips: number) => {
    if (!currentPrice) return 0;
    const price = side === 'long' ? currentPrice.ask : currentPrice.bid;
    const slPrice = side === 'long'
      ? price - (pips * pipValue)
      : price + (pips * pipValue);
    return Math.round(slPrice * 100000) / 100000;
  };
  
  // Handle trade execution
  const handleTrade = async (direction: 'long' | 'short') => {
    if (disabled || !currentPrice || isSubmitting) return;
    
    if (marginRequired > availableCapital) {
      toast.error('⚠️ Insufficient funds!', {
        description: 'You need more capital to make this trade.',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const tp = useTp ? calculateTPFromPips(direction, tpPips) : undefined;
      const sl = useSl ? calculateSLFromPips(direction, slPips) : undefined;
      
      // Convert long/short to buy/sell for the API
      const side = direction === 'long' ? 'buy' : 'sell';
      
      const result = await placeOrder({
        competitionId,
        symbol: symbol as ForexSymbol,
        side,
        orderType: 'market',
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
        toast.success(direction === 'long' ? '🚀 Position Opened!' : '📉 Position Opened!', {
          description: `${direction === 'long' ? 'BUY' : 'SELL'} ${lotSize} lots on ${symbol}`,
        });
      } else {
        toast.error('❌ Trade failed!', {
          description: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('❌ Error!', {
        description: 'Something went wrong. Try again!',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Quick lot size presets
  const lotPresets = [0.01, 0.05, 0.1, 0.5, 1.0];
  
  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/50 overflow-hidden">
      {/* Header with Gaming Icon */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/game-icons/sword.png" alt="Trade" width={28} height={28} className="drop-shadow-lg" />
          <span className="text-white font-bold text-lg">⚔️ Trade Station</span>
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
                  {((currentPrice.ask - currentPrice.bid) / pipValue).toFixed(1)} pips
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
      
      {/* Lot Size Selection */}
      <div className="p-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm flex items-center gap-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            Position Size (Lots)
          </span>
          <span className="text-white font-bold">{lotSize}</span>
        </div>
        <div className="flex gap-2">
          {lotPresets.map((preset) => (
            <button
              key={preset}
              onClick={() => setLotSize(preset)}
              className={cn(
                "flex-1 py-2 rounded-lg font-bold text-sm transition-all",
                lotSize === preset
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/50"
                  : "bg-dark-400 text-gray-400 hover:bg-dark-300"
              )}
            >
              {preset}
            </button>
          ))}
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
      <div className="p-4 border-b border-purple-500/30 bg-dark-400/30">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">💵 Required Margin</span>
          <span className={cn(
            "font-bold",
            marginRequired > availableCapital ? "text-red-400" : "text-green-400"
          )}>
            ${marginRequired.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-400">💰 Available</span>
          <span className="text-yellow-400 font-bold">${availableCapital.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => handleTrade('long')}
          disabled={disabled || isSubmitting || !currentPrice}
          className={cn(
            "py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
            "hover:from-green-400 hover:to-emerald-500 hover:shadow-lg hover:shadow-green-500/50",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
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
          onClick={() => handleTrade('short')}
          disabled={disabled || isSubmitting || !currentPrice}
          className={cn(
            "py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-r from-red-500 to-rose-600 text-white",
            "hover:from-red-400 hover:to-rose-500 hover:shadow-lg hover:shadow-red-500/50",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
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
        <div className="p-3 bg-red-500/20 border-t border-red-500/30 text-center">
          <span className="text-red-400 text-sm">⚔️ Trading is disabled</span>
        </div>
      )}
    </div>
  );
}
