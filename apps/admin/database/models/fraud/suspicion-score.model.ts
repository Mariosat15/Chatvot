import mongoose, { Schema, model, models, Document } from 'mongoose';

/**
 * Fraud Detection Score Model
 * 
 * Tracks cumulative fraud score for each user (0-100%)
 * Multiple detection methods contribute to the overall score
 * Automatic risk level calculation and alert triggering
 * 
 * Each method contributes a percentage (e.g., device match = 40%)
 * Total score = sum of all method percentages (capped at 100%)
 */

export interface IScoreBreakdown {
  percentage: number; // 0-100% contribution from this detection method
  evidence: string;
  lastDetected?: Date;
}

export interface ILinkedAccount {
  userId: mongoose.Types.ObjectId;
  matchType: string;
  confidence: number;
  detectedAt: Date;
}

export interface IScoreHistory {
  timestamp: Date;
  score: number;
  reason: string;
  delta: number;
  triggeredBy: string;
}

export interface ISuspicionScore extends Document {
  userId: mongoose.Types.ObjectId;
  totalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
  
  scoreBreakdown: {
    deviceMatch: IScoreBreakdown;
    ipMatch: IScoreBreakdown;
    ipBrowserMatch: IScoreBreakdown;
    sameCity: IScoreBreakdown;
    samePayment: IScoreBreakdown;
    rapidCreation: IScoreBreakdown;
    coordinatedEntry: IScoreBreakdown;
    tradingSimilarity: IScoreBreakdown;
    mirrorTrading: IScoreBreakdown;
    timezoneLanguage: IScoreBreakdown;
    deviceSwitching: IScoreBreakdown;
    kycDuplicate: IScoreBreakdown;
    bruteForce: IScoreBreakdown;       // Brute force login attempts
    rateLimitExceeded: IScoreBreakdown; // Rate limit violations
  };
  
  linkedAccounts: ILinkedAccount[];
  scoreHistory: IScoreHistory[];
  
  // Auto-restriction
  autoRestrictedAt?: Date;
  autoRestrictionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculateRiskLevel(): 'low' | 'medium' | 'high' | 'critical';
  addPercentage(method: keyof ISuspicionScore['scoreBreakdown'], percentage: number, evidence: string): void;
  addPoints(method: keyof ISuspicionScore['scoreBreakdown'], percentage: number, evidence: string): void;
  addLinkedAccount(linkedUserId: mongoose.Types.ObjectId, matchType: string, confidence: number): void;
  resetScore(): void;
}

const ScoreBreakdownSchema = new Schema({
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  evidence: {
    type: String,
    default: ''
  },
  lastDetected: Date
}, { _id: false });

const LinkedAccountSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  matchType: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  detectedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const ScoreHistorySchema = new Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  score: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  delta: {
    type: Number,
    required: true
  },
  triggeredBy: {
    type: String,
    required: true
  }
}, { _id: false });

const SuspicionScoreSchema = new Schema<ISuspicionScore>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    unique: true,
    index: true
  },
  
  totalScore: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    default: 'low',
    index: true
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  scoreBreakdown: {
    deviceMatch: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    ipMatch: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    ipBrowserMatch: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    sameCity: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    samePayment: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    rapidCreation: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    coordinatedEntry: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    tradingSimilarity: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    mirrorTrading: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    timezoneLanguage: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    deviceSwitching: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    kycDuplicate: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    bruteForce: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    },
    rateLimitExceeded: {
      type: ScoreBreakdownSchema,
      default: () => ({ percentage: 0, evidence: '' })
    }
  },
  
  linkedAccounts: [LinkedAccountSchema],
  scoreHistory: [ScoreHistorySchema],
  
  autoRestrictedAt: Date,
  autoRestrictionReason: String
  
}, {
  timestamps: true,
  collection: 'suspicionscores'
});

// Indexes for performance
SuspicionScoreSchema.index({ userId: 1, totalScore: -1 });
SuspicionScoreSchema.index({ riskLevel: 1, lastUpdated: -1 });
SuspicionScoreSchema.index({ 'linkedAccounts.userId': 1 });
SuspicionScoreSchema.index({ totalScore: -1, riskLevel: 1 });

// Methods
SuspicionScoreSchema.methods.calculateRiskLevel = function(): 'low' | 'medium' | 'high' | 'critical' {
  if (this.totalScore >= 70) return 'critical';
  if (this.totalScore >= 50) return 'high';
  if (this.totalScore >= 30) return 'medium';
  return 'low';
};

SuspicionScoreSchema.methods.addPercentage = function(
  method: keyof ISuspicionScore['scoreBreakdown'],
  percentage: number,
  evidence: string
): void {
  const breakdown = this.scoreBreakdown[method];
  
  if (breakdown) {
    // Don't exceed max percentage per method (prevent stacking same fraud multiple times)
    const maxPercentagePerMethod: Record<string, number> = {
      deviceMatch: 40,
      ipMatch: 30,
      ipBrowserMatch: 35,
      sameCity: 15,
      samePayment: 30,
      rapidCreation: 20,
      coordinatedEntry: 25,
      tradingSimilarity: 30,
      mirrorTrading: 35,
      timezoneLanguage: 10,
      deviceSwitching: 15,
      kycDuplicate: 50,
      bruteForce: 35,         // Brute force login attempts
      rateLimitExceeded: 25,  // Rate limit violations
    };
    
    const maxPercentage = maxPercentagePerMethod[method] || 50;
    const oldPercentage = breakdown.percentage;
    breakdown.percentage = Math.min(breakdown.percentage + percentage, maxPercentage);
    breakdown.evidence = evidence;
    breakdown.lastDetected = new Date();
    
    const actualDelta = breakdown.percentage - oldPercentage;
    
    // Recalculate total score
    this.totalScore = Math.min(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(this.scoreBreakdown).reduce((sum: number, item: any) => {
        return sum + (item?.percentage || 0);
      }, 0),
      100
    );
    
    // Update risk level
    this.riskLevel = this.calculateRiskLevel();
    this.lastUpdated = new Date();
    
    // Add to history (only if percentage actually changed)
    if (actualDelta > 0) {
      this.scoreHistory.push({
        timestamp: new Date(),
        score: this.totalScore,
        reason: evidence,
        delta: actualDelta,
        triggeredBy: method
      });
      
      // Keep only last 100 history entries
      if (this.scoreHistory.length > 100) {
        this.scoreHistory = this.scoreHistory.slice(-100);
      }
    }
  }
};

// Backward compatibility: Keep addPoints as an alias
SuspicionScoreSchema.methods.addPoints = SuspicionScoreSchema.methods.addPercentage;

SuspicionScoreSchema.methods.addLinkedAccount = function(
  linkedUserId: mongoose.Types.ObjectId,
  matchType: string,
  confidence: number
): void {
  // Check if already linked
  const exists = this.linkedAccounts.some((acc: ILinkedAccount) => 
    acc.userId.toString() === linkedUserId.toString()
  );
  
  if (!exists) {
    this.linkedAccounts.push({
      userId: linkedUserId,
      matchType,
      confidence,
      detectedAt: new Date()
    });
  }
};

SuspicionScoreSchema.methods.resetScore = function(): void {
  this.totalScore = 0;
  this.riskLevel = 'low';
  this.lastUpdated = new Date();
  
  // Reset all breakdown percentages
  Object.keys(this.scoreBreakdown).forEach(key => {
    const breakdown = this.scoreBreakdown[key as keyof ISuspicionScore['scoreBreakdown']];
    if (breakdown) {
      breakdown.percentage = 0;
      breakdown.evidence = '';
      breakdown.lastDetected = undefined;
    }
  });
  
  // Clear linked accounts
  this.linkedAccounts = [];
  
  // Add to history
  this.scoreHistory.push({
    timestamp: new Date(),
    score: 0,
    reason: 'Manual reset by admin',
    delta: -this.totalScore,
    triggeredBy: 'admin_reset'
  });
};

// Statics
SuspicionScoreSchema.statics.findHighRisk = function() {
  return this.find({
    riskLevel: { $in: ['high', 'critical'] }
  }).sort({ totalScore: -1 });
};

SuspicionScoreSchema.statics.findByRiskLevel = function(level: string) {
  return this.find({ riskLevel: level }).sort({ totalScore: -1 });
};

const SuspicionScore = models.SuspicionScore || model<ISuspicionScore>('SuspicionScore', SuspicionScoreSchema);

export default SuspicionScore;

