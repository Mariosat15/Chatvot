'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { IStrategyConfig } from '@/database/models/marketplace/marketplace-item.model';

// All supported indicator types (must match chart implementations)
export type IndicatorType = 
  | 'sma' 
  | 'ema' 
  | 'rsi' 
  | 'macd' 
  | 'bb' 
  | 'support_resistance';

// Indicator configuration that matches the chart's CustomIndicator interface
export interface ArsenalIndicator {
  id: string;
  purchaseId: string;
  itemName: string;
  type: IndicatorType;
  displayType: 'overlay' | 'oscillator';
  enabled: boolean;
  color: string;
  lineWidth: number;
  parameters: Record<string, number>;
}

// Strategy with signals
export interface ArsenalStrategy {
  id: string;
  purchaseId: string;
  itemName: string;
  config: IStrategyConfig;
  enabled: boolean;
}

// Signal type
export interface StrategySignal {
  time: number;
  type: 'buy' | 'sell' | 'strong_buy' | 'strong_sell' | 'neutral';
  strength: number;
  ruleName: string;
  ruleId: string;
  strategyId: string;
  strategyName: string;
}

interface TradingArsenalContextValue {
  // Indicators
  activeIndicators: ArsenalIndicator[];
  addIndicator: (indicator: ArsenalIndicator) => void;
  removeIndicator: (id: string) => void;
  updateIndicator: (id: string, updates: Partial<ArsenalIndicator>) => void;
  toggleIndicator: (id: string, enabled: boolean) => void;
  
  // Strategies
  activeStrategies: ArsenalStrategy[];
  addStrategy: (strategy: ArsenalStrategy) => void;
  removeStrategy: (id: string) => void;
  toggleStrategy: (id: string, enabled: boolean) => void;
  
  // Signals (computed from strategies)
  signals: StrategySignal[];
  setSignals: (signals: StrategySignal[]) => void;
  
  // Support/Resistance levels
  supportResistanceLevels: { price: number; type: 'support' | 'resistance'; strength: number }[];
  setSupportResistanceLevels: (levels: { price: number; type: 'support' | 'resistance'; strength: number }[]) => void;
}

const TradingArsenalContext = createContext<TradingArsenalContextValue | undefined>(undefined);

export const TradingArsenalProvider = ({ children }: { children: ReactNode }) => {
  const [activeIndicators, setActiveIndicators] = useState<ArsenalIndicator[]>([]);
  const [activeStrategies, setActiveStrategies] = useState<ArsenalStrategy[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [supportResistanceLevels, setSupportResistanceLevels] = useState<{ price: number; type: 'support' | 'resistance'; strength: number }[]>([]);
  
  // Indicator management
  const addIndicator = useCallback((indicator: ArsenalIndicator) => {
    setActiveIndicators(prev => {
      const existingIndex = prev.findIndex(i => i.id === indicator.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = indicator;
        return updated;
      }
      return [...prev, indicator];
    });
  }, []);
  
  const removeIndicator = useCallback((id: string) => {
    setActiveIndicators(prev => prev.filter(i => i.id !== id));
  }, []);
  
  const updateIndicator = useCallback((id: string, updates: Partial<ArsenalIndicator>) => {
    setActiveIndicators(prev => prev.map(i => 
      i.id === id ? { ...i, ...updates } : i
    ));
  }, []);
  
  const toggleIndicator = useCallback((id: string, enabled: boolean) => {
    setActiveIndicators(prev => prev.map(i => 
      i.id === id ? { ...i, enabled } : i
    ));
  }, []);
  
  // Strategy management
  const addStrategy = useCallback((strategy: ArsenalStrategy) => {
    setActiveStrategies(prev => {
      const existingIndex = prev.findIndex(s => s.id === strategy.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = strategy;
        return updated;
      }
      return [...prev, strategy];
    });
  }, []);
  
  const removeStrategy = useCallback((id: string) => {
    setActiveStrategies(prev => prev.filter(s => s.id !== id));
    // Also remove signals from this strategy
    setSignals(prev => prev.filter(s => s.strategyId !== id));
  }, []);
  
  const toggleStrategy = useCallback((id: string, enabled: boolean) => {
    setActiveStrategies(prev => prev.map(s => 
      s.id === id ? { ...s, enabled } : s
    ));
    // Clear signals if strategy is disabled
    if (!enabled) {
      setSignals(prev => prev.filter(s => s.strategyId !== id));
    }
  }, []);
  
  return (
    <TradingArsenalContext.Provider value={{
      activeIndicators,
      addIndicator,
      removeIndicator,
      updateIndicator,
      toggleIndicator,
      activeStrategies,
      addStrategy,
      removeStrategy,
      toggleStrategy,
      signals,
      setSignals,
      supportResistanceLevels,
      setSupportResistanceLevels,
    }}>
      {children}
    </TradingArsenalContext.Provider>
  );
};

export const useTradingArsenal = () => {
  const context = useContext(TradingArsenalContext);
  if (!context) {
    throw new Error('useTradingArsenal must be used within TradingArsenalProvider');
  }
  return context;
};

// Mapping of indicator slugs to types - ONLY indicators with chart implementations
const INDICATOR_TYPE_MAP: Record<string, { type: IndicatorType; displayType: 'overlay' | 'oscillator' }> = {
  // Moving Averages
  'simple moving average': { type: 'sma', displayType: 'overlay' },
  'sma': { type: 'sma', displayType: 'overlay' },
  'exponential moving average': { type: 'ema', displayType: 'overlay' },
  'ema': { type: 'ema', displayType: 'overlay' },
  
  // Momentum Oscillators
  'rsi': { type: 'rsi', displayType: 'oscillator' },
  'relative strength': { type: 'rsi', displayType: 'oscillator' },
  'macd': { type: 'macd', displayType: 'oscillator' },
  
  // Volatility
  'bollinger': { type: 'bb', displayType: 'overlay' },
  'bb': { type: 'bb', displayType: 'overlay' },
  
  // Support/Resistance
  'support': { type: 'support_resistance', displayType: 'overlay' },
  'resistance': { type: 'support_resistance', displayType: 'overlay' },
  'auto support': { type: 'support_resistance', displayType: 'overlay' },
};

// Helper to convert marketplace item to chart indicator
export function marketplaceItemToIndicator(
  purchaseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: { _id: string; name: string; category: string; indicatorType?: string; defaultSettings?: any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customSettings: any
): ArsenalIndicator | null {
  if (item.category !== 'indicator') return null;
  
  const slug = item.name.toLowerCase();
  const settings = { ...item.defaultSettings, ...customSettings };
  
  // Find matching indicator type
  let indicatorConfig: { type: IndicatorType; displayType: 'overlay' | 'oscillator' } | null = null;
  
  for (const [key, config] of Object.entries(INDICATOR_TYPE_MAP)) {
    if (slug.includes(key)) {
      indicatorConfig = config;
      break;
    }
  }
  
  // Default to SMA if no match
  if (!indicatorConfig) {
    console.warn(`⚠️ Unknown indicator type for "${item.name}", defaulting to SMA`);
    indicatorConfig = { type: 'sma', displayType: 'overlay' };
  }
  
  // Build parameters with defaults
  const params: Record<string, number> = {
    period: settings?.period || 20,
  };
  
  // Add type-specific parameters
  switch (indicatorConfig.type) {
    case 'rsi':
      params.period = settings?.period || 14;
      params.overbought = settings?.overbought || 70;
      params.oversold = settings?.oversold || 30;
      break;
    case 'bb':
      params.period = settings?.period || 20;
      params.stdDev = settings?.stdDev || 2;
      break;
    case 'macd':
      params.fast = settings?.fastPeriod || 12;
      params.slow = settings?.slowPeriod || 26;
      params.signal = settings?.signalPeriod || 9;
      break;
    case 'support_resistance':
      params.period = settings?.period || 20;
      params.strength = settings?.strength || 2;
      break;
    case 'sma':
    case 'ema':
      params.period = settings?.period || 20;
      break;
  }
  
  const result: ArsenalIndicator = {
    id: `arsenal-${purchaseId}`,
    purchaseId,
    itemName: item.name,
    type: indicatorConfig.type,
    displayType: indicatorConfig.displayType,
    enabled: true,
    color: settings?.color || '#3b82f6',
    lineWidth: settings?.lineWidth || 2,
    parameters: params,
  };
  
  return result;
}

// Helper to convert marketplace item to strategy
export function marketplaceItemToStrategy(
  purchaseId: string,
  item: { _id: string; name: string; category: string; strategyConfig?: IStrategyConfig },
): ArsenalStrategy | null {
  if (item.category !== 'strategy') return null;
  if (!item.strategyConfig) return null;
  
  return {
    id: `strategy-${purchaseId}`,
    purchaseId,
    itemName: item.name,
    config: item.strategyConfig,
    enabled: true,
  };
}
