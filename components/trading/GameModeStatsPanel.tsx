'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, Clock, Trophy, Coins, Shield } from 'lucide-react';

interface GameModeStatsPanelProps {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  usedMargin: number;
  availableCapital: number;
  marginLevel: number;
  startingCapital: number;
  positionCount: number;
}

export default function GameModeStatsPanel({
  balance,
  equity,
  unrealizedPnl,
  usedMargin,
  availableCapital,
  marginLevel,
  startingCapital,
  positionCount,
}: GameModeStatsPanelProps) {
  const totalPnl = equity - startingCapital;
  const pnlPercent = ((totalPnl / startingCapital) * 100);
  const isProfit = totalPnl >= 0;
  
  // Health bar based on margin level
  const getHealthColor = () => {
    if (marginLevel >= 200) return 'bg-green-500';
    if (marginLevel >= 100) return 'bg-yellow-500';
    if (marginLevel >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  const healthPercent = Math.min(100, Math.max(0, marginLevel / 3));
  
  return (
    <div className="space-y-3">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Gold (Balance) */}
        <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 rounded-xl p-3 border border-yellow-600/30">
          <div className="flex items-center gap-2 mb-1">
            <Image src="/game-icons/coin.png" alt="Gold" width={20} height={20} />
            <span className="text-yellow-400 text-xs font-medium">Gold</span>
          </div>
          <div className="text-white font-bold text-lg">${balance.toFixed(2)}</div>
        </div>
        
        {/* Total Worth (Equity) */}
        <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 rounded-xl p-3 border border-purple-600/30">
          <div className="flex items-center gap-2 mb-1">
            <Image src="/game-icons/gems.png" alt="Worth" width={20} height={20} />
            <span className="text-purple-400 text-xs font-medium">Total Worth</span>
          </div>
          <div className="text-white font-bold text-lg">${equity.toFixed(2)}</div>
        </div>
      </div>
      
      {/* P&L Display */}
      <div className={cn(
        "rounded-xl p-4 border",
        isProfit 
          ? "bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-600/30"
          : "bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-600/30"
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isProfit ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <span className={cn(
              "text-sm font-medium",
              isProfit ? "text-green-400" : "text-red-400"
            )}>
              {isProfit ? '📈 Winning!' : '📉 Behind...'}
            </span>
          </div>
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded",
            isProfit ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          )}>
            {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-2xl font-bold",
            isProfit ? "text-green-400" : "text-red-400"
          )}>
            {isProfit ? '+' : ''}{totalPnl.toFixed(2)}
          </span>
          <span className="text-gray-500 text-sm">gold</span>
        </div>
      </div>
      
      {/* Health Bar (Margin Level) */}
      <div className="bg-dark-400/50 rounded-xl p-3 border border-dark-300">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-xs flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Account Health
          </span>
          <span className={cn(
            "text-xs font-bold",
            marginLevel >= 200 ? "text-green-400" :
            marginLevel >= 100 ? "text-yellow-400" :
            marginLevel >= 50 ? "text-orange-400" : "text-red-400"
          )}>
            {Number.isFinite(marginLevel) ? marginLevel.toFixed(0) : '∞'}%
          </span>
        </div>
        <div className="h-3 bg-dark-500 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-500", getHealthColor())}
            style={{ width: `${Number.isFinite(marginLevel) ? healthPercent : 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>⚠️ Danger</span>
          <span>💪 Strong</span>
        </div>
      </div>
      
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-400/50 rounded-lg p-2 text-center border border-dark-300">
          <div className="text-gray-500 text-[10px] mb-1">Unrealized</div>
          <div className={cn(
            "font-bold text-sm",
            unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
          </div>
        </div>
        <div className="bg-dark-400/50 rounded-lg p-2 text-center border border-dark-300">
          <div className="text-gray-500 text-[10px] mb-1">In Use</div>
          <div className="text-blue-400 font-bold text-sm">${usedMargin.toFixed(2)}</div>
        </div>
        <div className="bg-dark-400/50 rounded-lg p-2 text-center border border-dark-300">
          <div className="text-gray-500 text-[10px] mb-1">Battles</div>
          <div className="text-purple-400 font-bold text-sm">{positionCount}</div>
        </div>
      </div>
    </div>
  );
}
