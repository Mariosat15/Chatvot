"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AccountInfoPanel } from "./AccountInfoPanel";
import { useTradingMode } from "./TradingInterface";
import {
  executeLiquidation,
  backupMarginCheck,
} from "@/lib/actions/trading/liquidation.actions";
import { useRouter } from "next/navigation";
import { useLiveAccountStats } from "@/hooks/useLiveAccountStats";

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
  side: "long" | "short";
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
  initialEquity: _initialEquity,
  initialUnrealizedPnl: _initialUnrealizedPnl,
  initialUsedMargin,
  initialAvailableCapital: _initialAvailableCapital,
  positions: initialPositions,
  marginThresholds,
  startingCapital = 0,
  dailyRealizedPnl = 0,
}: LiveAccountInfoProps) {
  const { mode } = useTradingMode();
  const router = useRouter();

  const thresholds = marginThresholds || DEFAULT_THRESHOLDS;

  // Shared hook: recalculates PnL/equity/margin from live prices on every tick
  const {
    liveUnrealizedPnl,
    liveEquity,
    liveAvailableCapital,
    liveMarginLevel,
    isBelowLiquidation,
  } = useLiveAccountStats({
    balance: initialBalance,
    usedMargin: initialUsedMargin,
    positions: initialPositions,
    liquidationThreshold: thresholds.LIQUIDATION,
    marginCallThreshold: thresholds.MARGIN_CALL,
  });

  // Liquidation state management
  const [liquidationState, setLiquidationState] = useState<
    "idle" | "pending" | "executing" | "completed"
  >("idle");
  const liquidationRequestedRef = useRef(false);
  const lastBackupCheckRef = useRef<number>(0);
  const backupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // PRIMARY: Formula-based liquidation trigger
  // When local calculation shows margin below liquidation threshold, execute immediately
  const triggerLiquidation = useCallback(async () => {
    // Guard: Prevent duplicate requests
    if (liquidationRequestedRef.current || liquidationState !== "idle") {
      return;
    }

    // Guard: No positions to liquidate
    if (initialPositions.length === 0) {
      return;
    }

    // Mark as requested to prevent duplicates
    liquidationRequestedRef.current = true;
    setLiquidationState("pending");

    try {
      setLiquidationState("executing");

      // Call server to validate and execute liquidation
      const result = await executeLiquidation(
        competitionId,
        liveMarginLevel,
      );

      if (result.liquidated) {
        setLiquidationState("completed");
        // Refresh to show updated positions
        router.refresh();
      } else {
        // Server rejected liquidation (margin was okay server-side)
        setLiquidationState("idle");
        liquidationRequestedRef.current = false;
      }
    } catch {
      setLiquidationState("idle");
      liquidationRequestedRef.current = false;
    }
  }, [
    competitionId,
    liveMarginLevel,
    initialPositions.length,
    liquidationState,
    router,
  ]);

  // TRIGGER: When margin drops below liquidation threshold
  useEffect(() => {
    if (
      isBelowLiquidation &&
      liquidationState === "idle" &&
      !liquidationRequestedRef.current
    ) {
      triggerLiquidation();
    }
  }, [isBelowLiquidation, liquidationState, triggerLiquidation]);

  // SAFETY NET: Backup periodic check (catches edge cases)
  // Runs every 60 seconds as a fallback if local calculation misses something
  useEffect(() => {
    if (initialPositions.length === 0) return;

    const runBackupCheck = async () => {
      // Don't run if already liquidating
      if (liquidationState !== "idle" || liquidationRequestedRef.current)
        return;

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
    backupIntervalRef.current = setInterval(
      runBackupCheck,
      BACKUP_CHECK_INTERVAL,
    );

    return () => {
      clearTimeout(timeoutId);
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }
    };
  }, [
    competitionId,
    initialPositions.length,
    liquidationState,
    triggerLiquidation,
  ]);

  // Reset liquidation state when positions change (after liquidation completes)
  useEffect(() => {
    if (initialPositions.length === 0 && liquidationState === "completed") {
      // All positions closed, reset state for next time
      setLiquidationState("idle");
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
