import { Schema, model, models, Document } from 'mongoose';

// 1v1 Challenge Structure
export interface IChallenge extends Document {
  // Challenge ID for URL
  slug: string;
  
  // Participants
  challengerId: string; // User who created the challenge
  challengerName: string;
  challengerEmail: string;
  challengedId: string; // User who was challenged
  challengedName: string;
  challengedEmail: string;
  
  // Entry & Capital
  entryFee: number; // Credits each player pays
  startingCapital: number; // Trading points (virtual capital)
  prizePool: number; // Total pool (entryFee * 2)
  platformFeePercentage: number; // % taken by platform
  platformFeeAmount: number; // Actual fee amount
  winnerPrize: number; // What winner receives (prizePool - platformFee)
  
  // Timing
  createdAt: Date;
  acceptDeadline: Date; // Time limit to accept challenge
  startTime?: Date; // When challenge starts (after acceptance)
  endTime?: Date; // When challenge ends
  duration: number; // Duration in minutes
  
  // Status
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'active' | 'completed' | 'cancelled';
  acceptedAt?: Date;
  declinedAt?: Date;
  
  // Trading Rules
  assetClasses: ('stocks' | 'forex' | 'crypto' | 'indices')[];
  allowedSymbols: string[];
  blockedSymbols: string[];
  leverage: {
    enabled: boolean;
    min: number;
    max: number;
  };
  
  // Challenge Rules (same as competitions)
  rules: {
    rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
    tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
    tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
    minimumTrades: number; // Default: 1
    disqualifyOnLiquidation: boolean;
  };
  
  // Risk Limits
  maxPositionSize: number;
  maxOpenPositions: number;
  allowShortSelling: boolean;
  marginCallThreshold: number;
  
  // Margin Settings (copied from trading risk settings at creation time)
  marginSettings?: {
    liquidation: number; // Stopout level %
    call: number; // Margin call level %
    warning: number; // Warning level %
    safe: number; // Safe level %
  };
  
  // Results
  winnerId?: string;
  winnerName?: string;
  winnerPnL?: number;
  loserId?: string;
  loserName?: string;
  loserPnL?: number;
  isTie?: boolean;
  
  // Final Stats
  challengerFinalStats?: {
    finalCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winRate: number;
    isDisqualified: boolean;
    disqualificationReason?: string;
  };
  challengedFinalStats?: {
    finalCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winRate: number;
    isDisqualified: boolean;
    disqualificationReason?: string;
  };
  
  updatedAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    challengerId: {
      type: String,
      required: true,
      index: true,
    },
    challengerName: {
      type: String,
      required: true,
    },
    challengerEmail: {
      type: String,
      required: true,
    },
    challengedId: {
      type: String,
      required: true,
      index: true,
    },
    challengedName: {
      type: String,
      required: true,
    },
    challengedEmail: {
      type: String,
      required: true,
    },
    entryFee: {
      type: Number,
      required: true,
      min: 1,
    },
    startingCapital: {
      type: Number,
      required: true,
      min: 100,
    },
    prizePool: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFeePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    platformFeeAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    winnerPrize: {
      type: Number,
      required: true,
      default: 0,
    },
    acceptDeadline: {
      type: Date,
      required: true,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
      required: true,
      min: 1, // Minimum 1 minute
      max: 10080, // Maximum 7 days (in minutes)
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'accepted', 'declined', 'expired', 'active', 'completed', 'cancelled'],
      default: 'pending',
    },
    acceptedAt: {
      type: Date,
    },
    declinedAt: {
      type: Date,
    },
    assetClasses: [
      {
        type: String,
        enum: ['stocks', 'forex', 'crypto', 'indices'],
      },
    ],
    allowedSymbols: [String],
    blockedSymbols: [String],
    leverage: {
      enabled: { type: Boolean, default: false },
      min: { type: Number, default: 1, min: 1 },
      max: { type: Number, default: 10, min: 1, max: 500 }, // Same as competitions
    },
    rules: {
      rankingMethod: {
        type: String,
        enum: ['pnl', 'roi', 'total_capital', 'win_rate', 'total_wins', 'profit_factor'],
        required: true,
        default: 'pnl',
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
      minimumTrades: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
      },
      disqualifyOnLiquidation: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    maxPositionSize: {
      type: Number,
      required: true,
      default: 50,
      min: 1,
      max: 100,
    },
    maxOpenPositions: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
      max: 50,
    },
    allowShortSelling: {
      type: Boolean,
      required: true,
      default: false,
    },
    marginCallThreshold: {
      type: Number,
      required: true,
      default: 50,
      min: 10,
      max: 90,
    },
    marginSettings: {
      type: {
        liquidation: { type: Number, default: 50 },
        call: { type: Number, default: 100 },
        warning: { type: Number, default: 150 },
        safe: { type: Number, default: 200 },
      },
      required: false,
    },
    winnerId: String,
    winnerName: String,
    winnerPnL: Number,
    loserId: String,
    loserName: String,
    loserPnL: Number,
    isTie: Boolean,
    challengerFinalStats: {
      finalCapital: Number,
      pnl: Number,
      pnlPercentage: Number,
      totalTrades: Number,
      winRate: Number,
      isDisqualified: Boolean,
      disqualificationReason: String,
    },
    challengedFinalStats: {
      finalCapital: Number,
      pnl: Number,
      pnlPercentage: Number,
      totalTrades: Number,
      winRate: Number,
      isDisqualified: Boolean,
      disqualificationReason: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes - Optimized for common queries
ChallengeSchema.index({ status: 1, createdAt: -1 });
ChallengeSchema.index({ challengerId: 1, status: 1 });
ChallengeSchema.index({ challengedId: 1, status: 1 });
ChallengeSchema.index({ status: 1, acceptDeadline: 1 });
ChallengeSchema.index({ status: 1, endTime: 1 });
// Compound index for cooldown check query (challengerId + challengedId + createdAt)
ChallengeSchema.index({ challengerId: 1, challengedId: 1, createdAt: -1 });
// Combined $or query optimization for active challenges count
ChallengeSchema.index({ challengerId: 1, challengedId: 1, status: 1 });

const Challenge = models?.Challenge || model<IChallenge>('Challenge', ChallengeSchema);

// Drop stale index on model load (challengeCode_1 was removed from schema)
// This runs once when the model is first imported
(async () => {
  try {
    if (Challenge.collection) {
      const indexes = await Challenge.collection.indexes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasStaleIndex = indexes.some((idx: any) => idx.name === 'challengeCode_1');
      if (hasStaleIndex) {
        await Challenge.collection.dropIndex('challengeCode_1');
        console.log('Dropped stale challengeCode_1 index');
      }
    }
  } catch (error) {
    // Index might not exist or connection might not be ready - that's OK
  }
})();

export default Challenge;

