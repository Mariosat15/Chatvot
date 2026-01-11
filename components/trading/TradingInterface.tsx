'use client';

import { useState, createContext, useContext } from 'react';
import OrderForm from '@/components/trading/OrderForm';
import GameModeOrderForm from '@/components/trading/GameModeOrderForm';
import TradingModeSelector, { TradingMode } from '@/components/trading/TradingModeSelector';
import Watchlist from '@/components/trading/Watchlist';
import type { MarginThresholds } from '@/lib/services/margin-safety.service';

interface TradingInterfaceProps {
  competitionId: string;
  availableCapital: number;
  defaultLeverage: number; // Admin-controlled leverage
  openPositionsCount: number;
  maxPositions: number;
  currentEquity: number;
  existingUsedMargin: number;
  currentBalance: number;
  marginThresholds?: MarginThresholds;
  disabled?: boolean; // Disable trading (e.g., when disqualified)
  disabledReason?: string; // Reason for disabling (e.g., "You are disqualified")
}

// Create context for trading mode
const TradingModeContext = createContext<{
  mode: TradingMode;
  setMode: (mode: TradingMode) => void;
}>({
  mode: 'professional',
  setMode: () => {},
});

export const useTradingMode = () => useContext(TradingModeContext);

export function TradingModeProvider({ children }: { children: React.ReactNode }) {
  // Initialize mode from localStorage or default to 'professional'
  const [mode, setMode] = useState<TradingMode>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('tradingMode');
      return (savedMode === 'game' || savedMode === 'professional') ? savedMode : 'professional';
    }
    return 'professional';
  });

  // Save mode to localStorage whenever it changes
  const handleSetMode = (newMode: TradingMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradingMode', newMode);
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
  marginThresholds,
  disabled = false,
  disabledReason,
}: TradingInterfaceProps) {
  const { mode, setMode } = useTradingMode();

  return (
    <div className="space-y-4">
      {/* Watchlist - Above Order Form */}
      <Watchlist className="h-[260px]" />
      
      {/* Mode Selector */}
      <div className="flex justify-center">
        <TradingModeSelector mode={mode} onModeChange={setMode} />
      </div>

      {/* Mode Description */}
      <div className="text-center">
        {mode === 'professional' ? (
          <p className="text-xs text-dark-600">
            Advanced trading interface with full control
          </p>
        ) : (
          <p className="text-xs text-purple-400 font-medium">
            ✨ Simplified trading with gaming elements - Perfect for beginners! 🎮
          </p>
        )}
      </div>

      {/* Conditional Order Form */}
      {mode === 'professional' ? (
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
        />
      ) : (
        <GameModeOrderForm
          competitionId={competitionId}
          availableCapital={availableCapital}
          defaultLeverage={defaultLeverage}
          openPositionsCount={openPositionsCount}
          maxPositions={maxPositions}
          currentEquity={currentEquity}
          existingUsedMargin={existingUsedMargin}
          marginThresholds={marginThresholds}
          disabled={disabled}
          disabledReason={disabledReason}
        />
      )}
    </div>
  );
}

