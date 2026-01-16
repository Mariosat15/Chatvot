'use client';

import { useTradingMode } from './TradingInterface';
import GameModeTradingPage from './GameModeTradingPage';
import { ReactNode } from 'react';

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

interface Competition {
  _id: string;
  name: string;
  endTime: Date;
  currentParticipants: number;
  prizePool: number;
}

interface Participant {
  currentCapital: number;
  availableCapital: number;
  unrealizedPnl: number;
  usedMargin: number;
  currentOpenPositions: number;
}

interface TradingPageContentProps {
  // Props for game mode
  competition: Competition;
  participant: Participant;
  positions: Position[];
  competitionId: string;
  defaultLeverage: number;
  startingCapital: number;
  isDisqualified?: boolean;
  // Children for professional mode (existing layout)
  children: ReactNode;
}

export default function TradingPageContent({
  competition,
  participant,
  positions,
  competitionId,
  defaultLeverage,
  startingCapital,
  isDisqualified,
  children,
}: TradingPageContentProps) {
  const { mode } = useTradingMode();
  
  // In game mode, use the gaming-styled layout
  if (mode === 'game') {
    return (
      <GameModeTradingPage
        competition={competition}
        participant={participant}
        positions={positions}
        competitionId={competitionId}
        defaultLeverage={defaultLeverage}
        startingCapital={startingCapital}
        isDisqualified={isDisqualified}
      />
    );
  }
  
  // In professional mode, render the existing layout (passed as children)
  return <>{children}</>;
}
