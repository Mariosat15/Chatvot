'use client';

import GameChart from './GameChart';

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

interface GameModeChartProps {
  competitionId: string;
  positions?: Position[];
}

export default function GameModeChart({ competitionId, positions = [] }: GameModeChartProps) {
  return (
    <div className="relative">
      {/* Fun Gaming Chart */}
      <GameChart competitionId={competitionId} positions={positions} />
    </div>
  );
}

