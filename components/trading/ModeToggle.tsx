'use client';

import { useTradingMode } from './TradingInterface';
import { cn } from '@/lib/utils';
import { Monitor, Gamepad2 } from 'lucide-react';

export default function ModeToggle() {
  const { mode, setMode } = useTradingMode();
  
  return (
    <div className="flex items-center gap-1 bg-dark-300/80 p-1 rounded-lg border border-dark-400/50">
      <button
        onClick={() => setMode('professional')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          mode === 'professional' 
            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" 
            : "text-gray-400 hover:text-white hover:bg-dark-400"
        )}
        title="Professional Mode"
      >
        <Monitor className="w-4 h-4" />
        <span className="hidden sm:inline">Professional</span>
      </button>
      <button
        onClick={() => setMode('game')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          mode === 'game' 
            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30" 
            : "text-gray-400 hover:text-white hover:bg-dark-400"
        )}
        title="Game Mode - Fun visual experience for beginners"
      >
        <Gamepad2 className="w-4 h-4" />
        <span className="hidden sm:inline">Game</span>
      </button>
    </div>
  );
}
