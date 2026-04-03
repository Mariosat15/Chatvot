"use client";

import { useMemo } from "react";
import { usePrices } from "@/contexts/PriceProvider";
import {
  calculateUnrealizedPnL,
  type ForexSymbol,
} from "@/lib/services/pnl-calculator.service";

interface Position {
  _id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

interface LiveAccountStats {
  liveUnrealizedPnl: number;
  liveEquity: number;
  liveAvailableCapital: number;
  liveFreeMargin: number;
  liveMarginLevel: number;
  isBelowLiquidation: boolean;
  isBelowMarginCall: boolean;
}

interface UseLiveAccountStatsParams {
  balance: number;
  usedMargin: number;
  positions: Position[];
  liquidationThreshold?: number;
  marginCallThreshold?: number;
}

/**
 * Recalculates account equity, PnL, available capital, and margin level
 * on every price tick from PriceProvider. Shared between pro and game modes.
 */
export function useLiveAccountStats({
  balance,
  usedMargin,
  positions,
  liquidationThreshold = 50,
  marginCallThreshold = 100,
}: UseLiveAccountStatsParams): LiveAccountStats {
  const { prices } = usePrices();

  return useMemo(() => {
    if (positions.length === 0) {
      return {
        liveUnrealizedPnl: 0,
        liveEquity: balance,
        liveAvailableCapital: Math.max(0, balance - usedMargin),
        liveFreeMargin: balance - usedMargin,
        liveMarginLevel: Infinity,
        isBelowLiquidation: false,
        isBelowMarginCall: false,
      };
    }

    let totalUnrealizedPnl = 0;

    for (const position of positions) {
      const currentPrice = prices.get(position.symbol as ForexSymbol);
      if (!currentPrice) {
        totalUnrealizedPnl += position.unrealizedPnl;
        continue;
      }

      const marketPrice =
        position.side === "long" ? currentPrice.bid : currentPrice.ask;
      const pnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol,
      );
      totalUnrealizedPnl += pnl;
    }

    const equity = balance + totalUnrealizedPnl;
    const availableCapital = Math.max(0, equity - usedMargin);
    const freeMargin = equity - usedMargin;
    const marginLevel =
      usedMargin > 0.01 ? (equity / usedMargin) * 100 : Infinity;

    return {
      liveUnrealizedPnl: totalUnrealizedPnl,
      liveEquity: equity,
      liveAvailableCapital: availableCapital,
      liveFreeMargin: freeMargin,
      liveMarginLevel: marginLevel,
      isBelowLiquidation: marginLevel < liquidationThreshold,
      isBelowMarginCall: marginLevel < marginCallThreshold,
    };
  }, [prices, positions, balance, usedMargin, liquidationThreshold, marginCallThreshold]);
}
