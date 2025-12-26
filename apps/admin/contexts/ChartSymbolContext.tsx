'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

interface ChartSymbolContextValue {
  symbol: ForexSymbol;
  setSymbol: (symbol: ForexSymbol) => void;
}

const ChartSymbolContext = createContext<ChartSymbolContextValue | undefined>(undefined);

export const ChartSymbolProvider = ({ children }: { children: ReactNode }) => {
  const [symbol, setSymbol] = useState<ForexSymbol>('EUR/USD');

  return (
    <ChartSymbolContext.Provider value={{ symbol, setSymbol }}>
      {children}
    </ChartSymbolContext.Provider>
  );
};

export const useChartSymbol = () => {
  const context = useContext(ChartSymbolContext);
  if (!context) {
    throw new Error('useChartSymbol must be used within ChartSymbolProvider');
  }
  return context;
};

