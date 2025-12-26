'use client';

import { useTradingMode } from './TradingInterface';
import LightweightTradingChart from './LightweightTradingChart';
import GameModeChart from './GameModeChart';

interface Position {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  takeProfit?: number;
  stopLoss?: number;
  currentPrice: number;
}

interface PendingOrder {
  _id: string;
  symbol: string;
  side: 'buy' | 'sell';
  requestedPrice: number;
  quantity: number;
}

export interface TradingProps {
  availableCapital: number;
  defaultLeverage: number;
  openPositionsCount: number;
  maxPositions: number;
  currentEquity: number;
  existingUsedMargin: number;
  currentBalance: number;
  startingCapital?: number;
  dailyRealizedPnl?: number;
  marginThresholds?: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE: number;
  };
}

interface ChartWrapperProps {
  competitionId: string;
  positions?: Position[];
  pendingOrders?: PendingOrder[];
  tradingProps?: TradingProps;
}

export default function ChartWrapper({ competitionId, positions = [], pendingOrders = [], tradingProps }: ChartWrapperProps) {
  const { mode } = useTradingMode();

  return (
    <>
      {mode === 'professional' ? (
        <LightweightTradingChart 
          competitionId={competitionId} 
          positions={positions} 
          pendingOrders={pendingOrders}
          tradingProps={tradingProps}
        />
      ) : (
        <GameModeChart competitionId={competitionId} positions={positions} />
      )}
    </>
  );
}

