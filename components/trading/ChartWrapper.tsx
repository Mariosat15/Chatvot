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

interface ChartWrapperProps {
  competitionId: string;
  positions?: Position[];
  pendingOrders?: PendingOrder[];
}

export default function ChartWrapper({ competitionId, positions = [], pendingOrders = [] }: ChartWrapperProps) {
  const { mode } = useTradingMode();

  return (
    <>
      {mode === 'professional' ? (
        <LightweightTradingChart competitionId={competitionId} positions={positions} pendingOrders={pendingOrders} />
      ) : (
        <GameModeChart competitionId={competitionId} positions={positions} />
      )}
    </>
  );
}

