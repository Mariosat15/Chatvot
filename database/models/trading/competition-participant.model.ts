import { Schema, model, models, Document } from 'mongoose';

// Track participants in each competition
export interface ICompetitionParticipant extends Document {
  competitionId: string;
  userId: string; // Reference to Better Auth user
  username: string; // For leaderboard display
  email: string; // For notifications
  
  // Capital & Performance
  startingCapital: number; // Initial trading points
  currentCapital: number; // Updated real-time
  availableCapital: number; // Not tied up in positions
  usedMargin: number; // Capital tied in open positions
  
  // P&L Metrics
  pnl: number; // Total profit/loss
  pnlPercentage: number; // ROI percentage
  realizedPnl: number; // From closed positions
  unrealizedPnl: number; // From open positions
  
  // Trading Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // Percentage
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  
  // Position Stats
  currentOpenPositions: number;
  maxDrawdown: number; // Worst decline from peak
  maxDrawdownPercentage: number;
  
  // Ranking
  currentRank: number;
  highestRank: number; // Best rank achieved
  
  // Status
  status: 'active' | 'liquidated' | 'completed' | 'disqualified' | 'refunded';
  liquidationReason?: string;
  disqualificationReason?: string;
  
  // Risk Management
  marginCallWarnings: number; // How many times warned
  lastMarginCallAt?: Date;
  
  // Timing
  enteredAt: Date;
  lastTradeAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const CompetitionParticipantSchema = new Schema<ICompetitionParticipant>(
  {
    competitionId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    startingCapital: {
      type: Number,
      required: true,
      min: 0,
    },
    currentCapital: {
      type: Number,
      required: true,
      min: 0,
    },
    availableCapital: {
      type: Number,
      required: true,
      min: 0,
    },
    usedMargin: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    pnl: {
      type: Number,
      required: true,
      default: 0,
    },
    pnlPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    realizedPnl: {
      type: Number,
      required: true,
      default: 0,
    },
    unrealizedPnl: {
      type: Number,
      required: true,
      default: 0,
    },
    totalTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    winningTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    losingTrades: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    winRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    averageWin: {
      type: Number,
      required: true,
      default: 0,
    },
    averageLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    largestWin: {
      type: Number,
      required: true,
      default: 0,
    },
    largestLoss: {
      type: Number,
      required: true,
      default: 0,
    },
    currentOpenPositions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maxDrawdown: {
      type: Number,
      required: true,
      default: 0,
    },
    maxDrawdownPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    currentRank: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    highestRank: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'liquidated', 'completed', 'disqualified', 'refunded'],
      default: 'active',
    },
    liquidationReason: {
      type: String,
    },
    disqualificationReason: {
      type: String,
    },
    marginCallWarnings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastMarginCallAt: {
      type: Date,
    },
    enteredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastTradeAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
CompetitionParticipantSchema.index({ competitionId: 1, userId: 1 }, { unique: true });
CompetitionParticipantSchema.index({ competitionId: 1, currentRank: 1 });
CompetitionParticipantSchema.index({ competitionId: 1, pnl: -1 }); // For leaderboard
CompetitionParticipantSchema.index({ userId: 1, status: 1 });
// PERFORMANCE: Additional indexes for common queries
CompetitionParticipantSchema.index({ competitionId: 1, status: 1, pnl: -1 }); // Active participants leaderboard
CompetitionParticipantSchema.index({ userId: 1, enteredAt: -1 }); // User's competition history
CompetitionParticipantSchema.index({ competitionId: 1, currentCapital: -1 }); // Capital-based ranking

// Virtual for profit factor (average win / average loss)
CompetitionParticipantSchema.virtual('profitFactor').get(function () {
  if (this.averageLoss === 0) return 0;
  return Math.abs(this.averageWin / this.averageLoss);
});

// Virtual for is at risk (close to margin call)
CompetitionParticipantSchema.virtual('isAtRisk').get(function () {
  const capitalPercentage = (this.currentCapital / this.startingCapital) * 100;
  return capitalPercentage < 60; // Below 60% of starting capital
});

const CompetitionParticipant =
  models?.CompetitionParticipant ||
  model<ICompetitionParticipant>('CompetitionParticipant', CompetitionParticipantSchema);

export default CompetitionParticipant;

