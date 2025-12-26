'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AccountInfoPanel } from './AccountInfoPanel';
import { usePrices } from '@/contexts/PriceProvider';
import { calculateUnrealizedPnL, type ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { useTradingMode } from './TradingInterface';
import { executeLiquidation, backupMarginCheck } from '@/lib/actions/trading/liquidation.actions';
import { useRouter } from 'next/navigation';

// Default margin thresholds (will be overridden by server values)
const DEFAULT_THRESHOLDS = {
  LIQUIDATION: 50,
  MARGIN_CALL: 100,
  WARNING: 150,
  SAFE: 200,
};

// Performance intervals
const BACKUP_CHECK_INTERVAL = 60000; // 60 seconds - safety net backup check

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
  
  // Thresholds from props or defaults
  const thresholds = marginThresholds || DEFAULT_THRESHOLDS;
  
  // Live-updating state
  const [liveEquity, setLiveEquity] = useState(initialEquity);
  const [liveUnrealizedPnl, setLiveUnrealizedPnl] = useState(initialUnrealizedPnl);
  const [liveAvailableCapital, setLiveAvailableCapital] = useState(initialAvailableCapital);
  
  // Liquidation state management
  const [liquidationState, setLiquidationState] = useState<'idle' | 'pending' | 'executing' | 'completed'>('idle');
  const liquidationRequestedRef = useRef(false); // Prevents duplicate requests
  const lastBackupCheckRef = useRef<number>(0);
  const backupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate PnL and margin level locally using real-time prices
  const calculatedData = useMemo(() => {
    // No positions = infinite margin (safe)
    if (initialPositions.length === 0) {
      return { 
        totalUnrealizedPnl: 0, 
        newEquity: initialBalance, 
        newAvailableCapital: initialBalance - initialUsedMargin,
        marginLevel: Infinity,
        isBelowLiquidation: false,
        isBelowMarginCall: false,
      };
    }

    let totalUnrealizedPnl = 0;
    let hasAllPrices = true;

    for (const position of initialPositions) {
      const currentPrice = prices.get(position.symbol as ForexSymbol);
      if (!currentPrice) {
        // Use cached P&L if no live price available
        totalUnrealizedPnl += position.unrealizedPnl;
        hasAllPrices = false;
        continue;
      }

      // Use correct price based on position side (bid for longs, ask for shorts)
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
    
    // FORMULA: Margin Level = (Equity / Used Margin) * 100
    const marginLevel = initialUsedMargin > 0 
      ? (newEquity / initialUsedMargin) * 100 
      : Infinity;
    
    // Check thresholds
    const isBelowLiquidation = marginLevel < thresholds.LIQUIDATION;
    const isBelowMarginCall = marginLevel < thresholds.MARGIN_CALL;

    return { 
      totalUnrealizedPnl, 
      newEquity, 
      newAvailableCapital, 
      marginLevel,
      isBelowLiquidation,
      isBelowMarginCall,
      hasAllPrices,
    };
  }, [prices, initialPositions, initialBalance, initialUsedMargin, thresholds.LIQUIDATION, thresholds.MARGIN_CALL]);

  // Update display state when calculations change
  useEffect(() => {
    setLiveUnrealizedPnl(calculatedData.totalUnrealizedPnl);
    setLiveEquity(calculatedData.newEquity);
    setLiveAvailableCapital(calculatedData.newAvailableCapital);
  }, [calculatedData]);

  // PRIMARY: Formula-based liquidation trigger
  // When local calculation shows margin below liquidation threshold, execute immediately
  const triggerLiquidation = useCallback(async () => {
    // Guard: Prevent duplicate requests
    if (liquidationRequestedRef.current || liquidationState !== 'idle') {
      return;
    }

    // Guard: No positions to liquidate
    if (initialPositions.length === 0) {
      return;
    }

    // Mark as requested to prevent duplicates
    liquidationRequestedRef.current = true;
    setLiquidationState('pending');

    try {
      setLiquidationState('executing');
      
      // Call server to validate and execute liquidation
      const result = await executeLiquidation(competitionId, calculatedData.marginLevel);
      
      if (result.liquidated) {
        setLiquidationState('completed');
        // Refresh to show updated positions
        router.refresh();
      } else {
        // Server rejected liquidation (margin was okay server-side)
        setLiquidationState('idle');
        liquidationRequestedRef.current = false;
      }
    } catch {
      setLiquidationState('idle');
      liquidationRequestedRef.current = false;
    }
  }, [competitionId, calculatedData.marginLevel, initialPositions.length, liquidationState, router]);

  // TRIGGER: When margin drops below liquidation threshold
  useEffect(() => {
    if (calculatedData.isBelowLiquidation && liquidationState === 'idle' && !liquidationRequestedRef.current) {
      triggerLiquidation();
    }
  }, [calculatedData.isBelowLiquidation, liquidationState, triggerLiquidation]);

  // SAFETY NET: Backup periodic check (catches edge cases)
  // Runs every 60 seconds as a fallback if local calculation misses something
  useEffect(() => {
    if (initialPositions.length === 0) return;

    const runBackupCheck = async () => {
      // Don't run if already liquidating
      if (liquidationState !== 'idle' || liquidationRequestedRef.current) return;
      
      const now = Date.now();
      // Throttle to prevent excessive calls
      if (now - lastBackupCheckRef.current < BACKUP_CHECK_INTERVAL) return;
      lastBackupCheckRef.current = now;

      try {
        const result = await backupMarginCheck(competitionId);
        
        if (result.needsLiquidation && !liquidationRequestedRef.current) {
          triggerLiquidation();
        }
      } catch {
        // Silent fail - backup check is non-critical
      }
    };

    // Initial backup check after 5 seconds (give time for prices to load)
    const timeoutId = setTimeout(runBackupCheck, 5000);

    // Then run every 60 seconds
    backupIntervalRef.current = setInterval(runBackupCheck, BACKUP_CHECK_INTERVAL);

    return () => {
      clearTimeout(timeoutId);
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }
    };
  }, [competitionId, initialPositions.length, liquidationState, triggerLiquidation]);

  // Reset liquidation state when positions change (after liquidation completes)
  useEffect(() => {
    if (initialPositions.length === 0 && liquidationState === 'completed') {
      // All positions closed, reset state for next time
      setLiquidationState('idle');
      liquidationRequestedRef.current = false;
    }
  }, [initialPositions.length, liquidationState]);

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
