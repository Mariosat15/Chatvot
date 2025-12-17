'use client';

import { useState, useEffect, useRef } from 'react';
import { AccountInfoPanel } from './AccountInfoPanel';
import { usePrices } from '@/contexts/PriceProvider';
import { calculateUnrealizedPnL, type ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { useTradingMode } from './TradingInterface';
import { checkUserMargin } from '@/lib/actions/trading/margin-monitor.actions';
import { useRouter } from 'next/navigation';

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

  // Update metrics in real-time based on price changes
  useEffect(() => {
    if (initialPositions.length === 0) {
      setLiveUnrealizedPnl(0);
      setLiveEquity(initialBalance);
      setLiveAvailableCapital(initialBalance - initialUsedMargin);
      return;
    }

    // Recalculate total unrealized P&L from all positions with current prices
    let totalUnrealizedPnl = 0;

    for (const position of initialPositions) {
      const currentPrice = prices.get(position.symbol as ForexSymbol);
      if (!currentPrice) {
        // Use stored price if real-time price not available
        totalUnrealizedPnl += position.unrealizedPnl;
        continue;
      }

      // Get current market price based on position side
      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;

      // Calculate P&L with current price
      const pnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol
      );

      totalUnrealizedPnl += pnl;
    }

    // Update derived values
    const newEquity = initialBalance + totalUnrealizedPnl;
    const newAvailableCapital = newEquity - initialUsedMargin;

    setLiveUnrealizedPnl(totalUnrealizedPnl);
    setLiveEquity(newEquity);
    setLiveAvailableCapital(Math.max(0, newAvailableCapital));
  }, [prices, initialPositions, initialBalance, initialUsedMargin]);

  // Real-time margin monitoring - check every 5 seconds
  useEffect(() => {
    if (initialPositions.length === 0) return;

    const checkMargin = async () => {
      const now = Date.now();
      // Throttle to once every 5 seconds
      if (now - lastMarginCheck.current < 5000) return;
      
      lastMarginCheck.current = now;

      try {
        const result = await checkUserMargin(competitionId);
        
        if (result.liquidated) {
          // Refresh the page to show closed positions
          router.refresh();
        }
      } catch (error) {
        console.error('Error checking margin:', error);
      }
    };

    // Check margin on every price update
    checkMargin();
  }, [prices, initialPositions, competitionId, router]);

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

