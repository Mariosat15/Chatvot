import mongoose, { Schema, model, models, Document } from 'mongoose';

/**
 * Trading Behavior Profile Model
 * 
 * Tracks individual user's trading patterns for fraud detection
 * Used to identify multi-accounting through similar trading behaviors
 */

export interface ITradingPattern {
  preferredPairs: string[];           // Top traded pairs (e.g., ['EUR/USD', 'GBP/USD'])
  tradingHoursDistribution: number[]; // 24-element array for hour distribution
  avgTradeSize: number;               // Average position size (lot)
  avgTradeDuration: number;           // Average trade duration in minutes
  avgStopLoss: number;                // Average SL distance in pips
  avgTakeProfit: number;              // Average TP distance in pips
  winRate: number;                    // Win rate 0-1
  profitFactor: number;               // Profit factor
  avgTradesPerDay: number;            // Average trades per day
  maxConcurrentPositions: number;     // Max concurrent positions
  riskPerTrade: number;               // Risk % per trade
  scalperScore: number;               // 0-1 (1 = scalper)
  swingScore: number;                 // 0-1 (1 = swing trader)
  dayTraderScore: number;             // 0-1 (1 = day trader)
}

export interface IRecentTrade {
  tradeId: string;
  pair: string;
  direction: 'buy' | 'sell';
  openTime: Date;
  closeTime?: Date;
  duration?: number;                  // Duration in minutes
  lotSize: number;
  pnl?: number;
  pips?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface IMirrorTradingSuspect {
  pairedUserId: mongoose.Types.ObjectId;
  detectedAt: Date;
  matchingTrades: number;
  timingCorrelation: number;          // 0-1 (1 = exact timing match)
  directionCorrelation: number;       // -1 to 1 (-1 = opposite, 1 = same)
  confidence: number;                 // 0-1 overall confidence
}

export interface ITradingBehaviorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  lastUpdated: Date;
  totalTradesAnalyzed: number;
  
  // Trading patterns
  patterns: ITradingPattern;
  
  // Behavioral fingerprint (for quick similarity matching)
  behavioralFingerprint: number[];    // 32-dimension vector
  
  // Recent trade sequence (for mirror trading detection)
  recentTradeSequence: IRecentTrade[];
  
  // Mirror trading suspects
  mirrorTradingSuspects: IMirrorTradingSuspect[];
  
  // Coordination patterns
  competitionEntryTimes: Date[];      // Last 20 competition entries
  avgTimeToFirstTrade: number;        // Avg time from competition start to first trade
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const TradingPatternSchema = new Schema({
  preferredPairs: {
    type: [String],
    default: []
  },
  tradingHoursDistribution: {
    type: [Number],
    default: () => Array(24).fill(0)
  },
  avgTradeSize: {
    type: Number,
    default: 0
  },
  avgTradeDuration: {
    type: Number,
    default: 0
  },
  avgStopLoss: {
    type: Number,
    default: 0
  },
  avgTakeProfit: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  profitFactor: {
    type: Number,
    default: 0
  },
  avgTradesPerDay: {
    type: Number,
    default: 0
  },
  maxConcurrentPositions: {
    type: Number,
    default: 0
  },
  riskPerTrade: {
    type: Number,
    default: 0
  },
  scalperScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  swingScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  dayTraderScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  }
}, { _id: false });

const RecentTradeSchema = new Schema({
  tradeId: {
    type: String,
    required: true
  },
  pair: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  openTime: {
    type: Date,
    required: true
  },
  closeTime: Date,
  duration: Number,
  lotSize: {
    type: Number,
    required: true
  },
  pnl: Number,
  pips: Number,
  stopLoss: Number,
  takeProfit: Number
}, { _id: false });

const MirrorTradingSuspectSchema = new Schema({
  pairedUserId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  matchingTrades: {
    type: Number,
    default: 0
  },
  timingCorrelation: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  directionCorrelation: {
    type: Number,
    default: 0,
    min: -1,
    max: 1
  },
  confidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  }
}, { _id: false });

const TradingBehaviorProfileSchema = new Schema<ITradingBehaviorProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    unique: true,
    index: true
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  totalTradesAnalyzed: {
    type: Number,
    default: 0
  },
  
  patterns: {
    type: TradingPatternSchema,
    default: () => ({})
  },
  
  behavioralFingerprint: {
    type: [Number],
    default: () => Array(32).fill(0)
  },
  
  recentTradeSequence: {
    type: [RecentTradeSchema],
    default: []
  },
  
  mirrorTradingSuspects: {
    type: [MirrorTradingSuspectSchema],
    default: []
  },
  
  competitionEntryTimes: {
    type: [Date],
    default: []
  },
  
  avgTimeToFirstTrade: {
    type: Number,
    default: 0
  }
  
}, {
  timestamps: true,
  collection: 'tradingbehaviorprofiles'
});

// Indexes
TradingBehaviorProfileSchema.index({ 'patterns.preferredPairs': 1 });
TradingBehaviorProfileSchema.index({ 'mirrorTradingSuspects.pairedUserId': 1 });
TradingBehaviorProfileSchema.index({ totalTradesAnalyzed: -1 });

// Keep only last 50 trades
TradingBehaviorProfileSchema.pre('save', function(next) {
  if (this.recentTradeSequence && this.recentTradeSequence.length > 50) {
    this.recentTradeSequence = this.recentTradeSequence.slice(-50);
  }
  if (this.competitionEntryTimes && this.competitionEntryTimes.length > 20) {
    this.competitionEntryTimes = this.competitionEntryTimes.slice(-20);
  }
  next();
});

const TradingBehaviorProfile = models.TradingBehaviorProfile || 
  model<ITradingBehaviorProfile>('TradingBehaviorProfile', TradingBehaviorProfileSchema);

export default TradingBehaviorProfile;

