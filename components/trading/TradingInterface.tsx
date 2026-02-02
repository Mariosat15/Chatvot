"use client";

import { useState, createContext, useContext } from "react";
import OrderForm from "@/components/trading/OrderForm";
import GameModeSimpleOrderForm from "@/components/trading/GameModeSimpleOrderForm";
import TradingModeSelector, {
  TradingMode,
} from "@/components/trading/TradingModeSelector";
import Watchlist from "@/components/trading/Watchlist";
import type { MarginThresholds } from "@/lib/services/margin-safety.service";

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

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector - Top with clear labels */}
      <div className="flex justify-center py-3 flex-shrink-0 border-b border-dark-400/30">
        <TradingModeSelector mode={mode} onModeChange={setMode} />
      </div>

      {/* Conditional Order Form - Fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        {mode === "professional" ? (
          <>
            {/* Watchlist only for Professional mode */}
            <div className="flex-shrink-0 border-b border-dark-400/30">
              <Watchlist className="h-[140px]" />
            </div>
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
