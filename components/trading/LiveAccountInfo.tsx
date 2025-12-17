'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AccountInfoPanel } from './AccountInfoPanel';
import { usePrices } from '@/contexts/PriceProvider';
import { calculateUnrealizedPnL, type ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { useTradingMode } from './TradingInterface';
import { checkUserMargin } from '@/lib/actions/trading/margin-monitor.actions';
import { useRouter } from 'next/navigation';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

interface Position {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  marginUsed: number;
}

interface LiveAccountInfoProps {
  competitionId: string;
  initialBalance: number;
  initialEquity: number;
  initialUnrealizedPnl: number;
  initialUsedMargin: number;
  initialAvailableCapital: number;
  positions: Position[];
  marginThresholds?: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE: number;
  };
  // New: For P&L percentages
  startingCapital?: number;
  dailyRealizedPnl?: number;
}

export function LiveAccountInfo({
  competitionId,
  initialBalance,
  initialEquity,
  initialUnrealizedPnl,
  initialUsedMargin,
  initialAvailableCapital,
  positions: initialPositions,
  marginThresholds,
  startingCapital = 0,
  dailyRealizedPnl = 0,
}: LiveAccountInfoProps) {
  const { prices } = usePrices();
  const { mode } = useTradingMode();
  const router = useRouter();
  
  // Live-updating state
  const [liveEquity, setLiveEquity] = useState(initialEquity);
  const [liveUnrealizedPnl, setLiveUnrealizedPnl] = useState(initialUnrealizedPnl);
  const [liveAvailableCapital, setLiveAvailableCapital] = useState(initialAvailableCapital);
  const lastMarginCheck = useRef<number>(0);
  const marginCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Memoize position symbols to avoid re-subscribing unnecessarily
  const positionSymbols = useMemo(() => 
    initialPositions.map(p => p.symbol as ForexSymbol),
    [initialPositions]
  );

  // Calculate PnL - memoized to prevent recalculation on every render
  const calculatedPnl = useMemo(() => {
    if (initialPositions.length === 0) {
      return { totalUnrealizedPnl: 0, newEquity: initialBalance, newAvailableCapital: initialBalance - initialUsedMargin };
    }

    let totalUnrealizedPnl = 0;

    for (const position of initialPositions) {
      const currentPrice = prices.get(position.symbol as ForexSymbol);
      if (!currentPrice) {
        totalUnrealizedPnl += position.unrealizedPnl;
        continue;
      }

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
      const pnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol
      );

      totalUnrealizedPnl += pnl;
    }

    const newEquity = initialBalance + totalUnrealizedPnl;
    const newAvailableCapital = Math.max(0, newEquity - initialUsedMargin);

    return { totalUnrealizedPnl, newEquity, newAvailableCapital };
  }, [prices, initialPositions, initialBalance, initialUsedMargin]);

  // Update state only when calculated values change
  useEffect(() => {
    setLiveUnrealizedPnl(calculatedPnl.totalUnrealizedPnl);
    setLiveEquity(calculatedPnl.newEquity);
    setLiveAvailableCapital(calculatedPnl.newAvailableCapital);
  }, [calculatedPnl]);

  // Margin check callback - memoized
  const checkMarginCallback = useCallback(async () => {
    if (initialPositions.length === 0) return;
    
    const now = Date.now();
    // Extra throttle protection
    if (now - lastMarginCheck.current < PERFORMANCE_INTERVALS.MARGIN_CHECK) return;
    
    lastMarginCheck.current = now;

    try {
      const result = await checkUserMargin(competitionId);
      
      if (result.liquidated) {
        router.refresh();
      }
    } catch (error) {
      // Silent fail - margin check is non-critical
    }
  }, [competitionId, initialPositions.length, router]);

  // Margin monitoring - uses interval instead of running on every price update
  useEffect(() => {
    if (initialPositions.length === 0) return;

    // Initial check after 2 seconds
    const timeoutId = setTimeout(checkMarginCallback, 2000);

    // Then check at regular intervals (not on every price tick!)
    marginCheckIntervalRef.current = setInterval(checkMarginCallback, PERFORMANCE_INTERVALS.MARGIN_CHECK);

    return () => {
      clearTimeout(timeoutId);
      if (marginCheckIntervalRef.current) {
        clearInterval(marginCheckIntervalRef.current);
      }
    };
  }, [initialPositions.length, checkMarginCallback]);

  return (
    <AccountInfoPanel
      balance={initialBalance}
      equity={liveEquity}
      unrealizedPnl={liveUnrealizedPnl}
      usedMargin={initialUsedMargin}
      availableCapital={liveAvailableCapital}
      mode={mode}
      openPositionsCount={initialPositions.length}
      marginThresholds={marginThresholds}
      startingCapital={startingCapital}
      dailyRealizedPnl={dailyRealizedPnl}
    />
  );
}

