"use client";

import { Gamepad2, TrendingUp, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type TradingMode = "professional" | "game";

interface TradingModeSelectorProps {
  mode: TradingMode;
  onModeChange: (mode: TradingMode) => void;
}

export default function TradingModeSelector({
  mode,
  onModeChange,
}: TradingModeSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-md">
      {/* Mode Toggle Buttons */}
      <div className="flex items-center gap-1 bg-dark-300/50 rounded-xl p-1.5 border border-dark-400/50 w-full">
        {/* Professional Mode */}
        <button
          onClick={() => onModeChange("professional")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-bold",
            mode === "professional"
              ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30"
              : "text-gray-400 hover:text-white hover:bg-dark-400/50",
          )}
        >
          <TrendingUp className="size-4" />
          <span>Pro</span>
        </button>

        {/* Game Mode - Beginner Friendly */}
        <button
          onClick={() => onModeChange("game")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-bold relative overflow-hidden",
            mode === "game"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
              : "text-gray-400 hover:text-white hover:bg-dark-400/50",
          )}
        >
          {mode === "game" && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-pink-600/30 animate-pulse" />
          )}
          <Gamepad2 className="size-4 relative z-10" />
          <span className="relative z-10">Easy</span>
          {mode === "game" && (
            <Sparkles className="size-3 relative z-10 text-yellow-300" />
          )}
        </button>
      </div>

      {/* Description based on selected mode */}
      <div className="text-center">
        {mode === "professional" ? (
          <p className="text-[10px] text-gray-500">
            Full control • Lot sizes • TP/SL pips • Advanced
          </p>
        ) : (
          <p className="text-[10px] text-purple-300">
            <span className="text-yellow-400">★</span> Simple • One-click • Auto-protection • Perfect for beginners
          </p>
        )}
      </div>
    </div>
  );
}
