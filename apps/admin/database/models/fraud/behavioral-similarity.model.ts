import mongoose, { Schema, model, models, Document } from 'mongoose';

/**
 * Behavioral Similarity Model
 * 
 * Stores similarity scores between pairs of users
 * Used to detect multi-accounting through trading behavior patterns
 */

export interface ISimilarityBreakdown {
  pairSimilarity: number;           // 0-1 (same pairs traded)
  timingSimilarity: number;         // 0-1 (same trading hours)
  sizeSimilarity: number;           // 0-1 (same trade sizes)
  durationSimilarity: number;       // 0-1 (same trade durations)
  riskSimilarity: number;           // 0-1 (same SL/TP patterns)
  styleScore: number;               // 0-1 (scalper/swing/day match)
  fingerprintDistance: number;      // Cosine distance of behavioral fingerprints
}

export interface IMirrorTradingEvidence {
  tradeId1: string;
  tradeId2: string;
  pair: string;
  timeDelta: number;                // Time difference in seconds
  direction1: 'buy' | 'sell';
  direction2: 'buy' | 'sell';
  isOpposite: boolean;
  isSameTime: boolean;              // Within 60 seconds
  detectedAt: Date;
}

export interface IBehavioralSimilarity extends Document {
  userId1: mongoose.Types.ObjectId;
  userId2: mongoose.Types.ObjectId;
  
  // Overall similarity
  similarityScore: number;          // 0-1 overall similarity
  
  // Detailed breakdown
  similarityBreakdown: ISimilarityBreakdown;
  
  // Mirror trading detection
  mirrorTradingDetected: boolean;
  mirrorTradingScore: number;       // 0-1 mirror trading confidence
  mirrorTradingEvidence: IMirrorTradingEvidence[];
  
  // Status
  flaggedForReview: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  
  // Timestamps
  firstDetected: Date;
  lastCalculated: Date;
  calculationCount: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const SimilarityBreakdownSchema = new Schema({
  pairSimilarity: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  timingSimilarity: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  sizeSimilarity: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  durationSimilarity: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  riskSimilarity: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  styleScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  fingerprintDistance: {
    type: Number,
    default: 0
  }
}, { _id: false });

const MirrorTradingEvidenceSchema = new Schema({
  tradeId1: {
    type: String,
    required: true
  },
  tradeId2: {
    type: String,
    required: true
  },
  pair: {
    type: String,
    required: true
  },
  timeDelta: {
    type: Number,
    required: true
  },
  direction1: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  direction2: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  isOpposite: {
    type: Boolean,
    default: false
  },
  isSameTime: {
    type: Boolean,
    default: false
  },
  detectedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const BehavioralSimilaritySchema = new Schema<IBehavioralSimilarity>({
  userId1: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  
  userId2: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  
  similarityScore: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 1,
    index: true
  },
  
  similarityBreakdown: {
    type: SimilarityBreakdownSchema,
    default: () => ({})
  },
  
  mirrorTradingDetected: {
    type: Boolean,
    default: false,
    index: true
  },
  
  mirrorTradingScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  
  mirrorTradingEvidence: {
    type: [MirrorTradingEvidenceSchema],
    default: []
  },
  
  flaggedForReview: {
    type: Boolean,
    default: false,
    index: true
  },
  
  reviewedAt: Date,
  reviewedBy: String,
  reviewNotes: String,
  
  firstDetected: {
    type: Date,
    default: Date.now
  },
  
  lastCalculated: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  calculationCount: {
    type: Number,
    default: 1
  }
  
}, {
  timestamps: true,
  collection: 'behavioralsimilarities'
});

// Compound index for unique pairs (order-independent)
BehavioralSimilaritySchema.index({ userId1: 1, userId2: 1 }, { unique: true });
BehavioralSimilaritySchema.index({ similarityScore: -1, mirrorTradingDetected: 1 });
BehavioralSimilaritySchema.index({ flaggedForReview: 1, similarityScore: -1 });

// Keep only last 20 mirror trading evidence entries
BehavioralSimilaritySchema.pre('save', function(next) {
  if (this.mirrorTradingEvidence && this.mirrorTradingEvidence.length > 20) {
    this.mirrorTradingEvidence = this.mirrorTradingEvidence.slice(-20);
  }
  next();
});

// Static method to find or create similarity record (order-independent)
BehavioralSimilaritySchema.statics.findOrCreatePair = async function(
  userId1: string, 
  userId2: string
): Promise<IBehavioralSimilarity> {
  // Ensure consistent ordering (smaller ID first)
  const [sortedId1, sortedId2] = [userId1, userId2].sort();
  
  let similarity = await this.findOne({
    userId1: sortedId1,
    userId2: sortedId2
  });
  
  if (!similarity) {
    similarity = await this.create({
      userId1: sortedId1,
      userId2: sortedId2
    });
  }
  
  return similarity;
};

// Static method to find high similarity pairs
BehavioralSimilaritySchema.statics.findHighSimilarity = function(threshold = 0.7) {
  return this.find({
    similarityScore: { $gte: threshold }
  }).sort({ similarityScore: -1 });
};

// Static method to find mirror trading pairs
BehavioralSimilaritySchema.statics.findMirrorTrading = function() {
  return this.find({
    mirrorTradingDetected: true
  }).sort({ mirrorTradingScore: -1 });
};

const BehavioralSimilarity = models.BehavioralSimilarity || 
  model<IBehavioralSimilarity>('BehavioralSimilarity', BehavioralSimilaritySchema);

export default BehavioralSimilarity;

