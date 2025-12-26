import { Schema, model, models, Document } from 'mongoose';

// Closed trades for historical analysis
export interface ITradeHistory extends Document {
  competitionId: string;
  userId: string;
  participantId: string; // Reference to CompetitionParticipant
  
  // Trade Details
  symbol: string; // EUR/USD, GBP/USD, etc.
  side: 'long' | 'short';
  quantity: number; // Lot size
  orderType: 'market' | 'limit'; // How order was placed
  limitPrice?: number; // Requested limit price (if orderType is limit)
  
  // Entry & Exit
  entryPrice: number; // Actual execution price
  exitPrice: number;
  priceChange: number; // Exit - Entry
  priceChangePercentage: number;
  
  // P&L
  realizedPnl: number; // Actual profit/loss
  realizedPnlPercentage: number; // ROI %
  
  // Timing
  openedAt: Date;
  closedAt: Date;
  holdingTimeSeconds: number; // Duration
  
  // How Trade Closed
  closeReason: 'user' | 'stop_loss' | 'take_profit' | 'margin_call' | 'competition_end' | 'challenge_end';
  
  // Leverage & Margin
  leverage: number;
  marginUsed: number;
  
  // Stop Loss / Take Profit
  hadStopLoss: boolean;
  stopLossPrice?: number;
  hadTakeProfit: boolean;
  takeProfitPrice?: number;
  
  // Related Records
  openOrderId: string;
  closeOrderId: string;
  positionId: string;
  
  // Trade Quality Metrics
  isWinner: boolean; // Profitable or not
  riskRewardRatio?: number; // Potential reward / potential risk
  
  // Market Conditions at Entry
  entrySpread?: number; // Bid-ask spread
  entryVolatility?: number; // Market volatility
  
  // Market Conditions at Exit
  exitSpread?: number;
  exitVolatility?: number;
  
  // Fees & Costs
  commission?: number;
  swap?: number; // Overnight holding cost
  totalCosts?: number;
  netPnl?: number; // P&L after costs
  
  createdAt: Date;
  updatedAt: Date;
}

const TradeHistorySchema = new Schema<ITradeHistory>(
  {
    competitionId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    participantId: {
      type: String,
      required: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
    },
    side: {
      type: String,
      required: true,
      enum: ['long', 'short'],
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    orderType: {
      type: String,
      required: true,
      enum: ['market', 'limit'],
      default: 'market',
    },
    limitPrice: {
      type: Number,
      min: 0,
    },
    entryPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    exitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    priceChange: {
      type: Number,
      required: true,
    },
    priceChangePercentage: {
      type: Number,
      required: true,
    },
    realizedPnl: {
      type: Number,
      required: true,
    },
    realizedPnlPercentage: {
      type: Number,
      required: true,
    },
    openedAt: {
      type: Date,
      required: true,
    },
    closedAt: {
      type: Date,
      required: true,
    },
    holdingTimeSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    closeReason: {
      type: String,
      required: true,
      enum: ['user', 'stop_loss', 'take_profit', 'margin_call', 'competition_end', 'challenge_end'],
    },
    leverage: {
      type: Number,
      required: true,
      min: 1,
    },
    marginUsed: {
      type: Number,
      required: true,
      min: 0,
    },
    hadStopLoss: {
      type: Boolean,
      required: true,
      default: false,
    },
    stopLossPrice: {
      type: Number,
      min: 0,
    },
    hadTakeProfit: {
      type: Boolean,
      required: true,
      default: false,
    },
    takeProfitPrice: {
      type: Number,
      min: 0,
    },
    openOrderId: {
      type: String,
      required: true,
    },
    closeOrderId: {
      type: String,
      required: true,
    },
    positionId: {
      type: String,
      required: true,
    },
    isWinner: {
      type: Boolean,
      required: true,
    },
    riskRewardRatio: {
      type: Number,
      min: 0,
    },
    entrySpread: {
      type: Number,
      min: 0,
    },
    entryVolatility: {
      type: Number,
      min: 0,
    },
    exitSpread: {
      type: Number,
      min: 0,
    },
    exitVolatility: {
      type: Number,
      min: 0,
    },
    commission: {
      type: Number,
      default: 0,
      min: 0,
    },
    swap: {
      type: Number,
      default: 0,
    },
    totalCosts: {
      type: Number,
      default: 0,
      min: 0,
    },
    netPnl: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
TradeHistorySchema.index({ competitionId: 1, closedAt: -1 });
TradeHistorySchema.index({ userId: 1, closedAt: -1 });
TradeHistorySchema.index({ participantId: 1, closedAt: -1 });
TradeHistorySchema.index({ symbol: 1, closedAt: -1 });
TradeHistorySchema.index({ competitionId: 1, isWinner: 1 });
TradeHistorySchema.index({ userId: 1, isWinner: 1 });
// PERFORMANCE: Additional indexes for analytics and reporting
TradeHistorySchema.index({ userId: 1, competitionId: 1, closedAt: -1 }); // User's trades in competition
TradeHistorySchema.index({ competitionId: 1, realizedPnl: -1 }); // Top trades leaderboard
TradeHistorySchema.index({ closeReason: 1, closedAt: -1 }); // Analyzing close reasons

// Virtual for trade duration (human readable)
TradeHistorySchema.virtual('holdingTimeDuration').get(function () {
  const seconds = this.holdingTimeSeconds;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
});

// Virtual for was stopped out
TradeHistorySchema.virtual('wasStoppedOut').get(function () {
  return this.closeReason === 'stop_loss';
});

// Virtual for hit take profit
TradeHistorySchema.virtual('hitTakeProfit').get(function () {
  return this.closeReason === 'take_profit';
});

const TradeHistory =
  models?.TradeHistory || model<ITradeHistory>('TradeHistory', TradeHistorySchema);

export default TradeHistory;

