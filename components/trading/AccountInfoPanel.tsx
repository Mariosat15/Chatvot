'use client';

import { TrendingUp, TrendingDown, DollarSign, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMarginStatus } from '@/lib/services/risk-manager.service';
import { MarginStatusIndicator } from './MarginStatusIndicator';

interface AccountInfoPanelProps {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  usedMargin: number;
  availableCapital: number;
  mode?: 'professional' | 'game';
  openPositionsCount?: number;
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

export function AccountInfoPanel({
  balance,
  equity,
  unrealizedPnl,
  usedMargin,
  availableCapital,
  mode = 'professional',
  openPositionsCount = 0,
  marginThresholds,
  startingCapital = 0,
  dailyRealizedPnl = 0,
}: AccountInfoPanelProps) {
  const isGame = mode === 'game';
  
  // Calculate metrics
  const freeMargin = equity - usedMargin;
  // Check for both zero and very small numbers to avoid huge margin levels
  const marginLevel = usedMargin > 0.01 ? (equity / usedMargin) * 100 : 0;
  const pnlPercentage = balance > 0 ? (unrealizedPnl / balance) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;
  
  // NEW: Calculate Total Competition P&L (from starting capital)
  const totalPnl = startingCapital > 0 ? balance - startingCapital : 0;
  const totalPnlPercent = startingCapital > 0 ? ((balance - startingCapital) / startingCapital) * 100 : 0;
  const isTotalProfit = totalPnl >= 0;
  
  // NEW: Calculate Daily P&L (realized + unrealized)
  const dailyTotalPnl = dailyRealizedPnl + unrealizedPnl;
  const dailyPnlPercent = startingCapital > 0 ? (dailyTotalPnl / startingCapital) * 100 : 0;
  const isDailyProfit = dailyTotalPnl >= 0;
  
  // Get margin status with admin thresholds
  const marginStatus = getMarginStatus(
    balance, 
    unrealizedPnl, 
    usedMargin,
    marginThresholds ? {
      liquidation: marginThresholds.LIQUIDATION,
      marginCall: marginThresholds.MARGIN_CALL,
      warning: marginThresholds.WARNING,
    } : undefined
  );

  // Professional Mode - Detailed Technical Display
  if (!isGame) {
    return (
      <div className="space-y-4">
        {/* Margin Alert */}
        <MarginStatusIndicator
          status={marginStatus.status}
          marginLevel={marginStatus.marginLevel}
          message={marginStatus.message}
          mode="professional"
          openPositionsCount={openPositionsCount}
        />

        {/* Enhanced Professional Account Metrics */}
        <div className="bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl border border-dark-400/30 p-4 md:p-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-light-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="size-4 text-primary" />
              Account Overview
            </h3>
            <div className="size-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
          </div>

          {/* Metrics Grid - Better Organization */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Balance Card */}
            <div className="group relative bg-gradient-to-br from-dark-300/80 to-dark-400/50 rounded-xl p-4 border border-dark-400/30 hover:border-primary/30 transition-all duration-300 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-primary/20 rounded-lg">
                    <DollarSign className="size-3.5 text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-dark-600 uppercase tracking-wide">Balance</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white tabular-nums">
                  ${balance.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Equity Card */}
            <div className="group relative bg-gradient-to-br from-dark-300/80 to-dark-400/50 rounded-xl p-4 border border-dark-400/30 hover:border-blue-500/30 transition-all duration-300 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg">
                    <Target className="size-3.5 text-blue-400" />
                  </div>
                  <p className="text-xs font-semibold text-dark-600 uppercase tracking-wide">Equity</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-blue-400 tabular-nums">
                  ${equity.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Available Card */}
            <div className="group relative bg-gradient-to-br from-dark-300/80 to-dark-400/50 rounded-xl p-4 border border-dark-400/30 hover:border-emerald-500/30 transition-all duration-300 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                    <Zap className="size-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs font-semibold text-dark-600 uppercase tracking-wide">Available</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-emerald-400 tabular-nums">
                  ${availableCapital.toFixed(2)}
                </p>
              </div>
            </div>

            {/* P&L Card */}
            <div className={cn(
              "group relative bg-gradient-to-br rounded-xl p-4 border transition-all duration-300 shadow-lg",
              isProfit
                ? "from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50"
                : "from-red-500/10 to-red-500/5 border-red-500/30 hover:border-red-500/50"
            )}>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    isProfit ? "bg-green-500/20" : "bg-red-500/20"
                  )}>
                    {isProfit ? (
                      <TrendingUp className="size-3.5 text-green-400" />
                    ) : (
                      <TrendingDown className="size-3.5 text-red-400" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-dark-600 uppercase tracking-wide">P&L</p>
                </div>
                <div className="flex flex-col">
                  <p
                    className={cn(
                      'text-xl md:text-2xl font-bold tabular-nums',
                      isProfit ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {isProfit ? '+' : ''}${unrealizedPnl.toFixed(2)}
                  </p>
                  <p
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      isProfit ? 'text-green-400/70' : 'text-red-400/70'
                    )}
                  >
                    {isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily & Total P&L Row */}
          {startingCapital > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-dark-400/30">
              {/* Daily P&L */}
              <div className={cn(
                "p-3 rounded-xl border",
                isDailyProfit 
                  ? "bg-green-500/10 border-green-500/30" 
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {isDailyProfit ? (
                    <TrendingUp className="size-3.5 text-green-400" />
                  ) : (
                    <TrendingDown className="size-3.5 text-red-400" />
                  )}
                  <p className="text-xs text-dark-600 font-medium uppercase tracking-wide">Daily P&L</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={cn(
                    "text-lg font-bold tabular-nums",
                    isDailyProfit ? "text-green-400" : "text-red-400"
                  )}>
                    {isDailyProfit ? '+' : ''}{dailyPnlPercent.toFixed(2)}%
                  </p>
                  <p className={cn(
                    "text-xs tabular-nums",
                    isDailyProfit ? "text-green-400/70" : "text-red-400/70"
                  )}>
                    ({isDailyProfit ? '+' : ''}${dailyTotalPnl.toFixed(2)})
                  </p>
                </div>
              </div>

              {/* Total Competition P&L */}
              <div className={cn(
                "p-3 rounded-xl border",
                isTotalProfit 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-rose-500/10 border-rose-500/30"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {isTotalProfit ? (
                    <TrendingUp className="size-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="size-3.5 text-rose-400" />
                  )}
                  <p className="text-xs text-dark-600 font-medium uppercase tracking-wide">Total P&L</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={cn(
                    "text-lg font-bold tabular-nums",
                    isTotalProfit ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {isTotalProfit ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                  </p>
                  <p className={cn(
                    "text-xs tabular-nums",
                    isTotalProfit ? "text-emerald-400/70" : "text-rose-400/70"
                  )}>
                    ({isTotalProfit ? '+' : ''}${totalPnl.toFixed(2)})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Secondary Metrics Row */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dark-400/30">
            {/* Margin Used */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1.5 font-medium uppercase tracking-wide">Margin Used</p>
              <p className="text-base md:text-lg font-bold text-orange-400 tabular-nums">
                ${usedMargin.toFixed(2)}
              </p>
            </div>

            {/* Free Margin */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1.5 font-medium uppercase tracking-wide">Free Margin</p>
              <p className="text-base md:text-lg font-bold text-purple-400 tabular-nums">
                ${freeMargin.toFixed(2)}
              </p>
            </div>

            {/* Margin Level */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1.5 font-medium uppercase tracking-wide">Margin Level</p>
              <p
                className={cn(
                  'text-base md:text-lg font-bold tabular-nums',
                  usedMargin <= 0.01 ? 'text-dark-600' : '',
                  marginStatus.status === 'safe' && 'text-green-400',
                  marginStatus.status === 'warning' && 'text-yellow-400',
                  marginStatus.status === 'danger' && 'text-orange-400',
                  marginStatus.status === 'liquidation' && 'text-red-400'
                )}
              >
                {usedMargin <= 0.01
                  ? 'N/A'
                  : Number.isFinite(marginLevel) && marginLevel > 0
                  ? `${marginLevel.toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Mode - Simplified Fun Display (existing code continues below)
  return (
    <div className="space-y-3">
      {/* Margin Alert for Game Mode */}
      <MarginStatusIndicator
        status={marginStatus.status}
        marginLevel={marginStatus.marginLevel}
        message={marginStatus.message}
        mode="game"
        openPositionsCount={openPositionsCount}
      />

      {/* Gaming Stats Display - Restructured */}
      <div className="relative overflow-hidden bg-gradient-to-br from-dark-200 to-dark-300 rounded-xl border border-dark-400/50 shadow-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-dark-400 p-3">
          <h3 className="text-center text-sm font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2">
            📊 Trade Stats
          </h3>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Primary Stats - Full Width */}
          <div className="grid grid-cols-2 gap-3">
            {/* Balance */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-xs text-yellow-400 font-semibold mb-1 uppercase">💰 Your Money</p>
              <p className="text-2xl font-black text-yellow-400 tabular-nums">
                ${balance.toFixed(2)}
              </p>
            </div>

            {/* Available */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-400 font-semibold mb-1 uppercase">⚡ Can Trade</p>
              <p className="text-2xl font-black text-blue-400 tabular-nums">
                ${availableCapital.toFixed(2)}
              </p>
            </div>
          </div>

          {/* P&L - Full Width Highlight */}
          <div className={cn(
            "rounded-lg p-3 border-2",
            isProfit 
              ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/50" 
              : "bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/50"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isProfit ? (
                  <TrendingUp className="size-5 text-green-400" />
                ) : (
                  <TrendingDown className="size-5 text-red-400" />
                )}
                <p className="text-sm font-bold text-white uppercase">
                  {isProfit ? '🎉 You\'re Winning!' : '💔 You\'re Losing'}
                </p>
              </div>
              <p
                className={cn(
                  'text-3xl font-black tabular-nums',
                  isProfit ? 'text-green-400' : 'text-red-400'
                )}
              >
                {isProfit ? '+' : ''}${Math.abs(unrealizedPnl).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Daily & Total P&L - Game Mode */}
          {startingCapital > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {/* Daily P&L */}
              <div className={cn(
                "rounded-lg p-3 border",
                isDailyProfit 
                  ? "bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/40" 
                  : "bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/40"
              )}>
                <p className="text-xs font-bold mb-1 uppercase">
                  {isDailyProfit ? '📈' : '📉'} Today
                </p>
                <p className={cn(
                  "text-xl font-black tabular-nums",
                  isDailyProfit ? "text-green-400" : "text-red-400"
                )}>
                  {isDailyProfit ? '+' : ''}{dailyPnlPercent.toFixed(2)}%
                </p>
                <p className={cn(
                  "text-xs font-semibold tabular-nums",
                  isDailyProfit ? "text-green-400/70" : "text-red-400/70"
                )}>
                  {isDailyProfit ? '+' : ''}${dailyTotalPnl.toFixed(2)}
                </p>
              </div>

              {/* Total Competition P&L */}
              <div className={cn(
                "rounded-lg p-3 border",
                isTotalProfit 
                  ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/40" 
                  : "bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/40"
              )}>
                <p className="text-xs font-bold mb-1 uppercase">
                  {isTotalProfit ? '🏆' : '💸'} Total
                </p>
                <p className={cn(
                  "text-xl font-black tabular-nums",
                  isTotalProfit ? "text-emerald-400" : "text-rose-400"
                )}>
                  {isTotalProfit ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                </p>
                <p className={cn(
                  "text-xs font-semibold tabular-nums",
                  isTotalProfit ? "text-emerald-400/70" : "text-rose-400/70"
                )}>
                  {isTotalProfit ? '+' : ''}${totalPnl.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Used Margin */}
            <div className="bg-dark-400/50 rounded-lg p-3 border border-dark-500">
              <p className="text-xs text-dark-600 font-semibold mb-1 uppercase">🎲 In Play</p>
              <p className="text-lg font-bold text-purple-400 tabular-nums">
                ${usedMargin.toFixed(2)}
              </p>
            </div>

            {/* Free Margin */}
            <div className="bg-dark-400/50 rounded-lg p-3 border border-dark-500">
              <p className="text-xs text-dark-600 font-semibold mb-1 uppercase">🆓 Free Cash</p>
              <p className="text-lg font-bold text-cyan-400 tabular-nums">
                ${freeMargin.toFixed(2)}
              </p>
            </div>

            {/* Equity */}
            <div className="bg-dark-400/50 rounded-lg p-3 border border-dark-500">
              <p className="text-xs text-dark-600 font-semibold mb-1 uppercase">💎 Total Value</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums">
                ${equity.toFixed(2)}
              </p>
            </div>

            {/* Safety Level */}
            <div className={cn(
              "rounded-lg p-3 border",
              usedMargin <= 0.01 ? 'bg-dark-400/50 border-dark-500' : '',
              marginStatus.status === 'safe' && 'bg-green-500/10 border-green-500/50',
              marginStatus.status === 'warning' && 'bg-yellow-500/10 border-yellow-500/50',
              marginStatus.status === 'danger' && 'bg-orange-500/10 border-orange-500/50',
              marginStatus.status === 'liquidation' && 'bg-red-500/10 border-red-500/50'
            )}>
              <p className="text-xs text-dark-600 font-semibold mb-1 uppercase">🛡️ Health</p>
              <p
                className={cn(
                  'text-lg font-bold tabular-nums',
                  usedMargin <= 0.01 ? 'text-dark-600' : '',
                  marginStatus.status === 'safe' && 'text-green-400',
                  marginStatus.status === 'warning' && 'text-yellow-400',
                  marginStatus.status === 'danger' && 'text-orange-400',
                  marginStatus.status === 'liquidation' && 'text-red-400'
                )}
              >
                {usedMargin <= 0.01 
                  ? 'N/A' 
                  : Number.isFinite(marginLevel) && marginLevel > 0
                  ? `${marginLevel.toFixed(2)}%` 
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Simplified Explanation */}
          <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
            <p className="text-center text-xs text-purple-200 font-semibold">
              {usedMargin > 0 ? (
                <>
                  💡 You&apos;re using <span className="text-white font-bold">${Math.floor(usedMargin)}</span> for open trades.
                  {marginStatus.status === 'liquidation' && (
                    <span className="block mt-1 text-red-300">
                      ⚠️ All positions will close automatically!
                    </span>
                  )}
                  {marginStatus.status === 'danger' && (
                    <span className="block mt-1 text-orange-300">
                      🚨 Margin Call! Close some trades now!
                    </span>
                  )}
                  {marginStatus.status === 'warning' && (
                    <span className="block mt-1 text-yellow-300">
                      ⚠️ Close some trades or add more money to be safe!
                    </span>
                  )}
                  {marginStatus.status === 'safe' && (
                    <span className="block mt-1 text-green-300">
                      ✅ You're safe! Keep trading!
                    </span>
                  )}
                </>
              ) : (
                <>
                  ✨ No open trades yet! Your Safety Level is perfect!
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

