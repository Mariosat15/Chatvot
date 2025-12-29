import { Schema, model, models, Document } from 'mongoose';

// Competition Structure
export interface ICompetition extends Document {
  name: string; // "Weekly Forex Challenge"
  description: string;
  slug: string; // URL-friendly name
  
  // Entry & Capital
  entryFee: number; // Credits required to enter
  startingCapital: number; // Trading points (virtual capital)
  minParticipants: number; // Minimum to start
  maxParticipants: number; // Maximum allowed
  currentParticipants: number; // Current count
  
  // Timing
  startTime: Date;
  endTime: Date;
  registrationDeadline: Date;
  
  // Status
  status: 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';
  cancellationReason?: string; // Reason if cancelled (e.g., "Did not meet minimum participants")
  
  // Trading Rules
  assetClasses: ('stocks' | 'forex' | 'crypto' | 'indices')[];
  allowedSymbols: string[]; // Whitelist (empty = all allowed)
  blockedSymbols: string[]; // Blacklist
  leverage: {
    enabled: boolean;
    min: number;
    max: number;
    default: number;
  };
  
  // Competition Type
  competitionType: 'time_based' | 'goal_based' | 'hybrid';
  goalConfig?: {
    targetReturn: number; // First to reach X% wins
    targetCapital: number; // First to reach X capital wins
  };
  
  // Prize Distribution
  prizePool: number; // Total credits in pool
  platformFeePercentage: number; // % taken by platform
  prizeDistribution: {
    rank: number;
    percentage: number;
  }[]; // e.g., [{ rank: 1, percentage: 70 }, { rank: 2, percentage: 20 }, ...]
  
  // Competition Rules & Ranking
  rules: {
    rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
    tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
    tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
    minimumTrades: number;
    minimumWinRate?: number;
    tiePrizeDistribution: 'split_equally' | 'split_weighted' | 'first_gets_all';
    disqualifyOnLiquidation: boolean;
  };
  
  // Level Requirements
  levelRequirement: {
    enabled: boolean;
    minLevel: number; // 1-10 (1=Novice, 10=Trading God)
    maxLevel?: number; // Optional max level (for beginner-only competitions)
  };
  
  // Difficulty Settings
  difficulty?: {
    mode: 'auto' | 'manual';
    manualLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'extreme';
  };
  
  // Restrictions
  maxPositionSize: number; // Max % of capital per position
  maxOpenPositions: number; // Max simultaneous positions
  allowShortSelling: boolean;
  marginCallThreshold: number; // % of capital before forced close
  
  // Margin Settings (copied from trading risk settings at creation time)
  marginSettings?: {
    liquidation: number; // Stopout level %
    call: number; // Margin call level %
    warning: number; // Warning level %
    safe: number; // Safe level %
  };
  
  // Risk Limits (per-competition)
  riskLimits: {
    maxDrawdownPercent: number; // Max drawdown from starting capital before trading blocked
    dailyLossLimitPercent: number; // Max daily loss before trading blocked for the day
    equityDrawdownPercent: number; // Max equity drawdown (includes unrealized PnL) - anti-fraud
    equityCheckEnabled: boolean; // Enable equity-based checks (anti-mirror trading)
    enabled: boolean; // Whether to enforce these limits
  };
  
  // Results
  winnerId?: string;
  winnerPnL?: number;
  finalLeaderboard?: {
    rank: number;
    userId: string;
    username: string;
    finalCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winRate: number;
    prizeAmount: number;
  }[];
  
  // Admin
  createdBy: string; // Admin ID
  imageUrl?: string;
  tags: string[]; // 'beginner', 'advanced', 'forex', etc.
  
  createdAt: Date;
  updatedAt: Date;
}

const CompetitionSchema = new Schema<ICompetition>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    entryFee: {
      type: Number,
      required: true,
      min: 0,
    },
    startingCapital: {
      type: Number,
      required: true,
      min: 100,
    },
    minParticipants: {
      type: Number,
      required: true,
      default: 2,
      min: 2,
    },
    maxParticipants: {
      type: Number,
      required: true,
      default: 100,
      min: 2,
    },
    currentParticipants: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    registrationDeadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'upcoming', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    cancellationReason: {
      type: String,
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
      max: { type: Number, default: 10, min: 1, max: 500 },
      default: { type: Number, default: 1, min: 1 },
    },
    competitionType: {
      type: String,
      required: true,
      enum: ['time_based', 'goal_based', 'hybrid'],
      default: 'time_based',
    },
    goalConfig: {
      targetReturn: { type: Number },
      targetCapital: { type: Number },
    },
    prizePool: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    platformFeePercentage: {
      type: Number,
      required: true,
      default: 20,
      min: 0,
      max: 50,
    },
    prizeDistribution: [
      {
        rank: { type: Number, required: true },
        percentage: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
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
        default: 0,
        min: 0,
      },
      minimumWinRate: {
        type: Number,
        min: 0,
        max: 100,
      },
      tiePrizeDistribution: {
        type: String,
        enum: ['split_equally', 'split_weighted', 'first_gets_all'],
        required: true,
        default: 'split_equally',
      },
      disqualifyOnLiquidation: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    levelRequirement: {
      enabled: {
        type: Boolean,
        required: true,
        default: false,
      },
      minLevel: {
        type: Number,
        min: 1,
        max: 10,
        default: 1,
      },
      maxLevel: {
        type: Number,
        min: 1,
        max: 10,
      },
    },
    difficulty: {
      mode: {
        type: String,
        enum: ['auto', 'manual'],
        default: 'auto',
      },
      manualLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert', 'extreme'],
      },
    },
    maxPositionSize: {
      type: Number,
      required: true,
      default: 20, // 20% of capital per position
      min: 1,
      max: 100,
    },
    maxOpenPositions: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
      max: 100,
    },
    allowShortSelling: {
      type: Boolean,
      required: true,
      default: false,
    },
    marginCallThreshold: {
      type: Number,
      required: true,
      default: 50, // 50% of starting capital
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
    riskLimits: {
      maxDrawdownPercent: {
        type: Number,
        default: 50, // 50% max drawdown by default
        min: 1,
        max: 100,
      },
      dailyLossLimitPercent: {
        type: Number,
        default: 20, // 20% daily loss limit by default
        min: 1,
        max: 100,
      },
      equityDrawdownPercent: {
        type: Number,
        default: 30, // 30% equity drawdown by default (stricter than balance)
        min: 1,
        max: 100,
      },
      equityCheckEnabled: {
        type: Boolean,
        default: false, // Equity check disabled by default
      },
      enabled: {
        type: Boolean,
        default: false, // Disabled by default
      },
    },
    winnerId: {
      type: String,
    },
    winnerPnL: {
      type: Number,
    },
    finalLeaderboard: [
      {
        rank: Number,
        userId: String,
        username: String,
        finalCapital: Number,
        pnl: Number,
        pnlPercentage: Number,
        totalTrades: Number,
        winRate: Number,
        prizeAmount: Number,
      },
    ],
    createdBy: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
CompetitionSchema.index({ status: 1, startTime: -1 });
// Note: slug already has unique index from schema definition (unique: true)
CompetitionSchema.index({ createdBy: 1 });
CompetitionSchema.index({ status: 1, registrationDeadline: 1 });
// PERFORMANCE: Additional indexes for common queries
CompetitionSchema.index({ status: 1, endTime: 1 }); // Finding active/ending competitions
CompetitionSchema.index({ status: 1, currentParticipants: 1 }); // Finding competitions with spots
CompetitionSchema.index({ tags: 1, status: 1 }); // Tag-based filtering

// Virtual for days until start
CompetitionSchema.virtual('daysUntilStart').get(function () {
  if (this.status !== 'upcoming') return 0;
  const now = new Date();
  const diff = this.startTime.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for competition duration
CompetitionSchema.virtual('durationDays').get(function () {
  const diff = this.endTime.getTime() - this.startTime.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for is registration open
CompetitionSchema.virtual('isRegistrationOpen').get(function () {
  const now = new Date();
  return (
    this.status === 'upcoming' &&
    now < this.registrationDeadline &&
    this.currentParticipants < this.maxParticipants
  );
});

const Competition =
  models?.Competition || model<ICompetition>('Competition', CompetitionSchema);

export default Competition;

