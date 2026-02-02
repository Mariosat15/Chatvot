"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePrices } from "@/contexts/PriceProvider";
import {
  calculateUnrealizedPnL,
  type ForexSymbol,
} from "@/lib/services/pnl-calculator.service";
import { TrendingUp, TrendingDown } from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";

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

interface AccountStripProps {
  balance: number;
  initialEquity: number;
  initialUnrealizedPnl: number;
  usedMargin: number;
  availableCapital: number;
  positions: Position[];
  startingCapital?: number;
  className?: string;
}

export function AccountStrip({
  balance,
  initialEquity,
  initialUnrealizedPnl,
  usedMargin,
  availableCapital,
  positions,
  startingCapital = 0,
  className,
}: AccountStripProps) {
  const { prices } = usePrices();

  // Calculate live P&L based on real-time prices
  const calculatedData = useMemo(() => {
    if (positions.length === 0) {
      return {
        totalUnrealizedPnl: 0,
        equity: balance,
        freeMargin: balance - usedMargin,
        marginLevel: usedMargin > 0.01 ? (balance / usedMargin) * 100 : Infinity,
      };
    }

    // Calculate live unrealized P&L
    let totalPnl = 0;
    for (const pos of positions) {
      const currentPrice = prices[pos.symbol as ForexSymbol];
      if (currentPrice) {
        const pnl = calculateUnrealizedPnL(
          pos.side,
          pos.quantity,
          pos.entryPrice,
          currentPrice,
          pos.symbol as ForexSymbol
        );
        totalPnl += pnl;
      } else {
        totalPnl += pos.unrealizedPnl;
      }
    }

    const equity = balance + totalPnl;
    const freeMargin = equity - usedMargin;
    const marginLevel = usedMargin > 0.01 ? (equity / usedMargin) * 100 : Infinity;

    return {
      totalUnrealizedPnl: totalPnl,
      equity,
      freeMargin,
      marginLevel,
    };
  }, [prices, positions, balance, usedMargin]);

  // Use live data or fallback to initial
  const equity = positions.length > 0 ? calculatedData.equity : initialEquity;
  const unrealizedPnl = positions.length > 0 ? calculatedData.totalUnrealizedPnl : initialUnrealizedPnl;
  const freeMargin = calculatedData.freeMargin;
  const marginLevel = calculatedData.marginLevel;

  // Calculate total P&L from starting capital
  const totalPnl = startingCapital > 0 ? balance - startingCapital : 0;
  const totalPnlPercent = startingCapital > 0 ? ((balance - startingCapital) / startingCapital) * 100 : 0;

  // Determine margin status
  const getMarginStatus = () => {
    if (marginLevel === Infinity) return "safe";
    if (marginLevel < 50) return "danger";
    if (marginLevel < 100) return "warning";
    if (marginLevel < 150) return "caution";
    return "safe";
  };

  const marginStatus = getMarginStatus();

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatMarginLevel = (level: number) => {
    if (!Number.isFinite(level)) return "∞";
    return level.toFixed(0) + "%";
  };

  return (
    <div
      className={cn(
        "bg-gradient-to-r from-dark-200 via-dark-200/95 to-dark-300/90 border-b border-dark-400/50",
        "px-4 md:px-6 py-2 shadow-lg",
        className
      )}
    >
      <div className="container-custom flex flex-wrap items-center gap-x-4 md:gap-x-6 gap-y-1.5">
        {/* Balance */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] md:text-xs font-medium text-dark-600 uppercase tracking-wide">
            Bal
          </span>
          <span className="text-xs md:text-sm font-bold text-white tabular-nums">
            ${formatNumber(balance)}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-dark-400/40" />

        {/* Equity */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] md:text-xs font-medium text-dark-600 uppercase tracking-wide">
            Eq
          </span>
          <span className="text-xs md:text-sm font-bold text-blue-400 tabular-nums">
            ${formatNumber(equity)}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-dark-400/40" />

        {/* Available */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] md:text-xs font-medium text-dark-600 uppercase tracking-wide">
            Free
          </span>
          <span className="text-xs md:text-sm font-bold text-emerald-400 tabular-nums">
            ${formatNumber(freeMargin)}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-4 bg-dark-400/40" />

        {/* Unrealized P&L */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] md:text-xs font-medium text-dark-600 uppercase tracking-wide">
            P&L
          </span>
          <div className="flex items-center gap-0.5">
            {unrealizedPnl >= 0 ? (
              <TrendingUp className="size-3 text-green-400" />
            ) : (
              <TrendingDown className="size-3 text-red-400" />
            )}
            <span
              className={cn(
                "text-xs md:text-sm font-bold tabular-nums",
                unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {unrealizedPnl >= 0 ? "+" : ""}${formatNumber(Math.abs(unrealizedPnl))}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-4 bg-dark-400/40" />

        {/* Margin Level */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] md:text-xs font-medium text-dark-600 uppercase tracking-wide">
            Margin
          </span>
          <div className="flex items-center gap-1">
            {marginStatus === "danger" && (
              <GameIcon name="warning" size={14} className="animate-pulse" />
            )}
            {marginStatus === "warning" && (
              <GameIcon name="warning2" size={14} />
            )}
            <span
              className={cn(
                "text-xs md:text-sm font-bold tabular-nums",
                marginStatus === "danger" && "text-red-400",
                marginStatus === "warning" && "text-orange-400",
                marginStatus === "caution" && "text-yellow-400",
                marginStatus === "safe" && "text-emerald-400"
              )}
            >
              {formatMarginLevel(marginLevel)}
            </span>
          </div>
        </div>

        {/* Total P&L (from starting capital) - Hidden on mobile */}
        {startingCapital > 0 && (
          <>
            <div className="hidden lg:block w-px h-4 bg-dark-400/40" />
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-xs font-medium text-dark-600 uppercase tracking-wide">
                Total
              </span>
              <div className="flex items-center gap-0.5">
                {totalPnl >= 0 ? (
                  <TrendingUp className="size-3 text-green-400" />
                ) : (
                  <TrendingDown className="size-3 text-red-400" />
                )}
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    totalPnl >= 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {totalPnl >= 0 ? "+" : ""}${formatNumber(Math.abs(totalPnl))}
                  <span className="text-xs ml-0.5 opacity-75">
                    ({totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%)
                  </span>
                </span>
              </div>
            </div>
          </>
        )}

        {/* Live indicator - pushed to right */}
        <div className="ml-auto flex items-center gap-1">
          <div className="size-1.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
          <span className="text-[10px] md:text-xs text-dark-600 font-medium hidden sm:inline">Live</span>
        </div>
      </div>
    </div>
  );
}
