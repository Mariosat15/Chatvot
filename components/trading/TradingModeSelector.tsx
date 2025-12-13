'use client';

import { useState } from 'react';
import { Gamepad2, TrendingUp, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TradingMode = 'professional' | 'game';

interface TradingModeSelectorProps {
  mode: TradingMode;
  onModeChange: (mode: TradingMode) => void;
}

export default function TradingModeSelector({ mode, onModeChange }: TradingModeSelectorProps) {
  return (
    <div className="flex items-center gap-2 bg-dark-200 rounded-lg p-1 border-2 border-dark-300">
      {/* Professional Mode */}
      <button
        onClick={() => onModeChange('professional')}
        className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md transition-all text-xs sm:text-sm font-bold border-2",
          mode === 'professional'
            ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/50 border-blue-400"
            : "text-dark-600 hover:text-light-900 hover:bg-dark-300 border-transparent"
        )}
      >
        <TrendingUp className="size-4" />
        <span className="hidden sm:inline">Professional</span>
        <span className="sm:hidden">Pro</span>
      </button>

      {/* Game Mode */}
      <button
        onClick={() => onModeChange('game')}
        className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md transition-all text-xs sm:text-sm font-bold relative overflow-hidden border-2",
          mode === 'game'
            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 border-purple-400"
            : "text-dark-600 hover:text-light-900 hover:bg-dark-300 border-transparent"
        )}
      >
        {mode === 'game' && (
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/50 to-pink-600/50 animate-pulse" />
        )}
        <Gamepad2 className="size-4 relative z-10" />
        <span className="hidden sm:inline relative z-10">Game Mode</span>
        <span className="sm:hidden relative z-10">Game</span>
        {mode === 'game' && <Zap className="size-3 relative z-10 animate-bounce" />}
      </button>
    </div>
  );
}

