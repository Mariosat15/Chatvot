"use client";

import { useState, createContext, useContext } from "react";
import OrderForm from "@/components/trading/OrderForm";
import GameModeSimpleOrderForm from "@/components/trading/GameModeSimpleOrderForm";
import TradingModeSelector, {
  TradingMode,
} from "@/components/trading/TradingModeSelector";
import Watchlist from "@/components/trading/Watchlist";
import type { MarginThresholds } from "@/lib/services/margin-safety.service";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradingInterfaceProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number; // Admin-controlled leverage
  openPositionsCount: number;
  maxPositions: number;
  currentEquity: number;
  existingUsedMargin: number;
  currentBalance: number;
  startingCapital?: number; // For Game Mode P&L display
  marginThresholds?: MarginThresholds;
  disabled?: boolean; // Disable trading (e.g., when disqualified)
  disabledReason?: string; // Reason for disabling (e.g., "You are disqualified")
  userId?: string; // Current user ID for live ranking highlight
  contestType?: "competition" | "challenge"; // Challenges don't show live ranking panel
}

// Create context for trading mode
const TradingModeContext = createContext<{
  mode: TradingMode;
  setMode: (mode: TradingMode) => void;
}>({
  mode: "professional",
  setMode: () => {},
});

export const useTradingMode = () => useContext(TradingModeContext);

export function TradingModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize mode from localStorage or default to 'professional'
  const [mode, setMode] = useState<TradingMode>(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("tradingMode");
      return savedMode === "game" || savedMode === "professional"
        ? savedMode
        : "professional";
    }
    return "professional";
  });

  // Save mode to localStorage whenever it changes
  const handleSetMode = (newMode: TradingMode) => {
    setMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("tradingMode", newMode);
    }
  };

  return (
    <TradingModeContext.Provider value={{ mode, setMode: handleSetMode }}>
      {children}
    </TradingModeContext.Provider>
  );
}

export default function TradingInterface({
  competitionId,
  availableCapital,
  defaultLeverage,
  openPositionsCount,
  maxPositions,
  currentEquity,
  existingUsedMargin,
  currentBalance,
  startingCapital = 10000,
  marginThresholds,
  disabled = false,
  disabledReason,
  userId,
  contestType = "competition",
}: TradingInterfaceProps) {
  const { mode, setMode } = useTradingMode();
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector - Top with clear labels */}
      <div className="flex justify-center py-2 flex-shrink-0 border-b border-dark-400/30">
        <TradingModeSelector mode={mode} onModeChange={setMode} />
      </div>

      {/* Conditional Order Form */}
      <div className="flex-1 flex flex-col">
        {mode === "professional" ? (
          <>
            {/* Collapsible Watchlist for Professional mode */}
            <div className="flex-shrink-0 border-b border-dark-400/30">
              <button
                onClick={() => setWatchlistOpen(!watchlistOpen)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-dark-400/20 transition-colors"
              >
                <span className="text-xs font-bold text-light-900 uppercase tracking-wider flex items-center gap-2">
                  📊 Watchlist
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">
                    {watchlistOpen ? "Collapse" : "Expand"}
                  </span>
                  {watchlistOpen ? (
                    <ChevronUp className="size-4 text-dark-600" />
                  ) : (
                    <ChevronDown className="size-4 text-dark-600" />
                  )}
                </div>
              </button>
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out overflow-hidden",
                  watchlistOpen ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <Watchlist className="h-[200px]" />
              </div>
            </div>
            <div className="flex-1">
              <OrderForm
                competitionId={competitionId}
                availableCapital={availableCapital}
                defaultLeverage={defaultLeverage}
                openPositionsCount={openPositionsCount}
                maxPositions={maxPositions}
                currentEquity={currentEquity}
                existingUsedMargin={existingUsedMargin}
                currentBalance={currentBalance}
                marginThresholds={marginThresholds}
                disabled={disabled}
                disabledReason={disabledReason}
                userId={userId}
                contestType={contestType}
              />
            </div>
          </>
        ) : (
          /* Game Mode - Simplified interface for beginners */
          <GameModeSimpleOrderForm
            competitionId={competitionId}
            availableCapital={availableCapital}
            defaultLeverage={defaultLeverage}
            currentBalance={currentBalance}
            startingCapital={startingCapital}
            openPositionsCount={openPositionsCount}
            maxPositions={maxPositions}
            currentEquity={currentEquity}
            usedMargin={existingUsedMargin}
            marginThresholds={marginThresholds}
            disabled={disabled}
            disabledReason={disabledReason}
          />
        )}
      </div>
    </div>
  );
}
