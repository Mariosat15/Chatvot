// ─── Arena Types ──────────────────────────────────────────────────────────────

export interface OpenPos {
  userId: string; username: string; profileImage: string | null;
  symbol: string; side: 'long' | 'short';
  entryPrice: number; currentPrice: number;
  unrealizedPnl: number; leverage: number; marginUsed: number; openedAt: string;
}

export interface Participant {
  userId: string; username: string; profileImage: string | null;
  liveEquity: number; livePnl: number; liveRoi: number;
  realizedPnl: number; unrealizedPnl: number;
  currentCapital: number; availableCapital: number; usedMargin: number;
  totalTrades: number; winningTrades: number; losingTrades: number;
  winRate: number; averageWin: number; averageLoss: number;
  largestWin: number; largestLoss: number;
  maxDrawdownPercentage: number; currentOpenPositions: number;
  status: string; isDisqualified: boolean;
  openPositions: OpenPos[];
}

export interface AEvent {
  _id: string; name: string; type: string; status: string;
  startingCapital: number; prizePool: number;
  currentParticipants: number; maxParticipants: number;
  startDate: string; endDate: string;
  description?: string; allowedAssets?: string[];
  participants: Participant[];
}

export interface PriceMap { [sym: string]: number }
export interface DashData { competitions: AEvent[] }

export type SceneKey = 'overview' | 'race' | 'spotlight' | 'h2h' | 'danger' | 'podium';

/** For the broadcast chart bubble overlay */
export interface BubbleTrade {
  side: 'long' | 'short';
  user: string;
  price: number;
  pnl: number;
  size: number;
}

/** Candle data for SVG and lightweight-charts */
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
