import { Schema, model, models, Document } from 'mongoose';

// Track participants in 1v1 challenges
export interface IChallengeParticipant extends Document {
  challengeId: string;
  userId: string;
  username: string;
  email: string;
  role: 'challenger' | 'challenged';
  
  // Capital & Performance
  startingCapital: number;
  currentCapital: number;
  availableCapital: number;
  usedMargin: number;
  
  // P&L Metrics
  pnl: number;
  pnlPercentage: number;
  realizedPnl: number;
  unrealizedPnl: number;
  
  // Trading Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  
  // Position Stats
  currentOpenPositions: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  
  // Status
  status: 'active' | 'liquidated' | 'completed' | 'disqualified';
  liquidationReason?: string;
  disqualificationReason?: string;
  
  // Risk Management
  marginCallWarnings: number;
  lastMarginCallAt?: Date;
  
  // Result
  isWinner: boolean;
  prizeReceived: number;
  
  // Timing
  joinedAt: Date;
  lastTradeAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeParticipantSchema = new Schema<IChallengeParticipant>(
  {
    challengeId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['challenger', 'challenged'],
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
    status: {
      type: String,
      required: true,
      enum: ['active', 'liquidated', 'completed', 'disqualified'],
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
    isWinner: {
      type: Boolean,
      required: true,
      default: false,
    },
    prizeReceived: {
      type: Number,
      required: true,
      default: 0,
    },
    joinedAt: {
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

// Indexes
ChallengeParticipantSchema.index({ challengeId: 1, userId: 1 }, { unique: true });
ChallengeParticipantSchema.index({ userId: 1, status: 1 });
ChallengeParticipantSchema.index({ challengeId: 1, pnl: -1 });

const ChallengeParticipant =
  models?.ChallengeParticipant ||
  model<IChallengeParticipant>('ChallengeParticipant', ChallengeParticipantSchema);

export default ChallengeParticipant;

