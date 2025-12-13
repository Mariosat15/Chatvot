'use client';

import { AlertTriangle, TrendingDown, Shield, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarginStatus } from '@/lib/services/risk-manager.service';

interface MarginStatusIndicatorProps {
  status: MarginStatus;
  marginLevel: number;
  message: string;
  mode?: 'professional' | 'game';
  openPositionsCount?: number;
}

export function MarginStatusIndicator({
  status,
  marginLevel,
  message,
  mode = 'professional',
  openPositionsCount = 0,
}: MarginStatusIndicatorProps) {
  // Don't show anything if margin is safe
  if (status === 'safe') return null;
  
  // Don't show warnings if there are no open positions
  if (openPositionsCount === 0) return null;

  const isGame = mode === 'game';

  // Professional mode - technical display
  if (!isGame) {
    return (
      <div
        className={cn(
          'rounded-lg border-2 p-4 mb-4',
          status === 'liquidation' &&
            'bg-red-500/20 border-red-500 animate-pulse',
          status === 'danger' && 'bg-red-500/10 border-red-500/50',
          status === 'warning' && 'bg-yellow-500/10 border-yellow-500/50'
        )}
      >
        <div className="flex items-center gap-3">
          {status === 'liquidation' && (
            <Skull className="size-8 text-red-500 animate-bounce" />
          )}
          {status === 'danger' && (
            <AlertTriangle className="size-7 text-red-500" />
          )}
          {status === 'warning' && (
            <AlertTriangle className="size-6 text-yellow-500" />
          )}
          <div className="flex-1">
            <p
              className={cn(
                'font-bold text-lg',
                status === 'liquidation' && 'text-red-400',
                status === 'danger' && 'text-red-400',
                status === 'warning' && 'text-yellow-400'
              )}
            >
              {status === 'liquidation' && '⚠️ LIQUIDATION IMMINENT'}
              {status === 'danger' && '🚨 MARGIN CALL'}
              {status === 'warning' && '⚠️ Low Margin Warning'}
            </p>
            <p className="text-sm text-dark-600 mt-1">{message}</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-dark-600">Margin Level:</p>
              <p
                className={cn(
                  'text-sm font-mono font-bold',
                  status === 'liquidation' && 'text-red-400',
                  status === 'danger' && 'text-red-400',
                  status === 'warning' && 'text-yellow-400'
                )}
              >
                {Number.isFinite(marginLevel)
                  ? `${marginLevel.toFixed(2)}%`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        {status === 'liquidation' && (
          <div className="mt-3 bg-red-500/30 border border-red-500 rounded p-2">
            <p className="text-sm font-semibold text-red-200">
              ⚠️ Your positions will be automatically closed soon to prevent
              further losses! Close some trades now to prevent this!
            </p>
          </div>
        )}
        {status === 'danger' && (
          <div className="mt-3 bg-red-500/20 border border-red-500/50 rounded p-2">
            <p className="text-sm font-semibold text-red-300">
              Close some trades to prevent automatic liquidation!
            </p>
          </div>
        )}
      </div>
    );
  }

  // Game mode - gamified display
  return (
    <div
      className={cn(
        'rounded-xl border-2 p-4 mb-4 relative overflow-hidden',
        status === 'liquidation' &&
          'bg-gradient-to-r from-red-900/40 to-orange-900/40 border-red-500 animate-pulse',
        status === 'danger' &&
          'bg-gradient-to-r from-red-900/30 to-pink-900/30 border-red-500/70',
        status === 'warning' &&
          'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/70'
      )}
    >
      {/* Animated background for liquidation */}
      {status === 'liquidation' && (
        <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
      )}

      <div className="relative z-10 flex items-center gap-3">
        {status === 'liquidation' && (
          <div className="animate-bounce">
            <Skull className="size-10 text-red-500" />
          </div>
        )}
        {status === 'danger' && (
          <TrendingDown className="size-9 text-red-500 animate-pulse" />
        )}
        {status === 'warning' && (
          <Shield className="size-8 text-yellow-500" />
        )}

        <div className="flex-1">
          <p
            className={cn(
              'font-black text-xl tracking-tight',
              status === 'liquidation' && 'text-red-400',
              status === 'danger' && 'text-red-400',
              status === 'warning' && 'text-yellow-400'
            )}
          >
            {status === 'liquidation' && '💀 GAME OVER WARNING! 💀'}
            {status === 'danger' && '🚨 DANGER ZONE! 🚨'}
            {status === 'warning' && '⚠️ Running Low!'}
          </p>
          <p className="text-sm text-white font-semibold mt-1">
            {status === 'liquidation' &&
              'Your trades will be closed automatically! Close some trades now to prevent this!'}
            {status === 'danger' &&
              'Close some trades to prevent automatic liquidation!'}
            {status === 'warning' &&
              "You're running out of room! Close some trades or be careful with new positions."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="bg-dark-400/50 rounded-lg px-3 py-1">
              <p className="text-xs text-dark-600">Safety Level</p>
              <p
                className={cn(
                  'text-lg font-black font-mono',
                  status === 'liquidation' && 'text-red-400',
                  status === 'danger' && 'text-red-400',
                  status === 'warning' && 'text-yellow-400'
                )}
              >
                {Number.isFinite(marginLevel)
                  ? `${marginLevel.toFixed(0)}%`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

