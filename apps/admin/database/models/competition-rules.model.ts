import mongoose, { Document, Schema } from 'mongoose';

export interface ICompetitionRules extends Document {
  // Ranking Criteria
  rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
  rankingDescription: string;
  
  // Tie-Breaking Rules
  tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  tieBreaker3?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  
  // Qualification Requirements
  minimumTrades: number; // Minimum trades to qualify for prizes
  minimumWinRate?: number; // Optional: Minimum win rate % to qualify
  minimumPnl?: number; // Optional: Minimum P&L to qualify (can be negative to exclude big losers)
  
  // Prize Distribution for Ties
  tiePrizeDistribution: 'split_equally' | 'split_weighted' | 'first_gets_all' | 'higher_rank_gets_more';
  
  // Additional Rules
  disqualifyOnLiquidation: boolean; // Disqualify if liquidated
  requireAllPositionsClosed: boolean; // Must close all positions to qualify
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const CompetitionRulesSchema = new Schema<ICompetitionRules>(
  {
    rankingMethod: {
      type: String,
      enum: ['pnl', 'roi', 'total_capital', 'win_rate', 'total_wins', 'profit_factor'],
      required: true,
      default: 'pnl',
    },
    rankingDescription: {
      type: String,
      default: 'Highest Profit/Loss wins',
    },
    tieBreaker1: {
      type: String,
      enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
      required: true,
      default: 'trades_count',
    },
    tieBreaker2: {
      type: String,
      enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
    },
    tieBreaker3: {
      type: String,
      enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
    },
    minimumTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minimumWinRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    minimumPnl: {
      type: Number,
    },
    tiePrizeDistribution: {
      type: String,
      enum: ['split_equally', 'split_weighted', 'first_gets_all', 'higher_rank_gets_more'],
      required: true,
      default: 'split_equally',
    },
    disqualifyOnLiquidation: {
      type: Boolean,
      required: true,
      default: true,
    },
    requireAllPositionsClosed: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const CompetitionRules =
  mongoose.models?.CompetitionRules ||
  mongoose.model<ICompetitionRules>('CompetitionRules', CompetitionRulesSchema);

export default CompetitionRules;

// Helper function to get ranking descriptions
export const getRankingMethodDescription = (method: string): string => {
  const descriptions = {
    pnl: 'Highest Profit/Loss (P&L) wins',
    roi: 'Highest Return on Investment (ROI %) wins',
    total_capital: 'Highest Total Capital (Balance + P&L) wins',
    win_rate: 'Highest Win Rate % wins',
    total_wins: 'Most Winning Trades wins',
    profit_factor: 'Best Profit Factor (Total Wins / Total Losses) wins',
  };
  return descriptions[method as keyof typeof descriptions] || 'Custom ranking';
};

// Helper function to get tiebreaker descriptions
export const getTieBreakerDescription = (tieBreaker: string): string => {
  const descriptions = {
    trades_count: 'Fewer trades (more efficient)',
    win_rate: 'Higher win rate',
    total_capital: 'Higher total capital',
    roi: 'Higher ROI %',
    join_time: 'Who joined first',
    split_prize: 'Split prize equally',
  };
  return descriptions[tieBreaker as keyof typeof descriptions] || tieBreaker;
};

