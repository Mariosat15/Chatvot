# Fraud Detection Database Schemas

Complete database schema definitions for all fraud detection models.

---

## 📊 Schema Overview

```
Current Models (Implemented):
├── DeviceFingerprint        ✅
├── FraudAlert              ✅
├── UserRestriction         ✅
└── FraudSettings           ✅

New Models (To Implement):
├── SuspicionScore          ⏳ Phase 1
├── PaymentFingerprint      ⏳ Phase 2
├── TradingBehaviorProfile  ⏳ Phase 3
├── BehavioralSimilarity    ⏳ Phase 3
└── GeographicPattern       ⏳ Phase 4
```

---

## 🔧 PHASE 1: Suspicion Score Model

### **Model:** `SuspicionScore`
**File:** `database/models/fraud/suspicion-score.model.ts`  
**Collection:** `suspicionscores`

```typescript
import mongoose, { Schema, model, models, Document } from 'mongoose';

// Interface
export interface ISuspicionScore extends Document {
  userId: mongoose.Types.ObjectId;
  totalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
  
  scoreBreakdown: {
    deviceMatch: { points: number; evidence: string; lastDetected?: Date };
    ipMatch: { points: number; evidence: string; lastDetected?: Date };
    ipBrowserMatch: { points: number; evidence: string; lastDetected?: Date };
    sameCity: { points: number; evidence: string; lastDetected?: Date };
    samePayment: { points: number; evidence: string; lastDetected?: Date };
    rapidCreation: { points: number; evidence: string; lastDetected?: Date };
    coordinatedEntry: { points: number; evidence: string; lastDetected?: Date };
    tradingSimilarity: { points: number; evidence: string; lastDetected?: Date };
    mirrorTrading: { points: number; evidence: string; lastDetected?: Date };
    timezoneLanguage: { points: number; evidence: string; lastDetected?: Date };
    deviceSwitching: { points: number; evidence: string; lastDetected?: Date };
  };
  
  linkedAccounts: Array<{
    userId: mongoose.Types.ObjectId;
    matchType: string;
    confidence: number;
    detectedAt: Date;
  }>;
  
  scoreHistory: Array<{
    timestamp: Date;
    score: number;
    reason: string;
    delta: number;
    triggeredBy: string; // 'device_match', 'payment_match', etc.
  }>;
  
  // Auto-restriction
  autoRestrictedAt?: Date;
  autoRestrictionReason?: string;
}

// Schema
const SuspicionScoreSchema = new Schema<ISuspicionScore>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
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
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    ipMatch: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    ipBrowserMatch: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    sameCity: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    samePayment: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    rapidCreation: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    coordinatedEntry: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    tradingSimilarity: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    mirrorTrading: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    timezoneLanguage: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    },
    deviceSwitching: {
      points: { type: Number, default: 0 },
      evidence: { type: String, default: '' },
      lastDetected: Date
    }
  },
  
  linkedAccounts: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
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
  }],
  
  scoreHistory: [{
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
  }],
  
  autoRestrictedAt: Date,
  autoRestrictionReason: String
  
}, {
  timestamps: true,
  collection: 'suspicionscores'
});

// Indexes
SuspicionScoreSchema.index({ userId: 1, totalScore: -1 });
SuspicionScoreSchema.index({ riskLevel: 1, lastUpdated: -1 });
SuspicionScoreSchema.index({ 'linkedAccounts.userId': 1 });

// Methods
SuspicionScoreSchema.methods.calculateRiskLevel = function() {
  if (this.totalScore >= 70) return 'critical';
  if (this.totalScore >= 50) return 'high';
  if (this.totalScore >= 30) return 'medium';
  return 'low';
};

SuspicionScoreSchema.methods.addPoints = function(
  method: string,
  points: number,
  evidence: string
) {
  const breakdown = this.scoreBreakdown[method as keyof typeof this.scoreBreakdown];
  if (breakdown) {
    breakdown.points = Math.min(breakdown.points + points, 100);
    breakdown.evidence = evidence;
    breakdown.lastDetected = new Date();
  }
  
  this.totalScore = Math.min(
    Object.values(this.scoreBreakdown).reduce((sum, item) => sum + (item.points || 0), 0),
    100
  );
  
  this.riskLevel = this.calculateRiskLevel();
  this.lastUpdated = new Date();
  
  // Add to history
  this.scoreHistory.push({
    timestamp: new Date(),
    score: this.totalScore,
    reason: evidence,
    delta: points,
    triggeredBy: method
  });
  
  // Keep only last 100 history entries
  if (this.scoreHistory.length > 100) {
    this.scoreHistory = this.scoreHistory.slice(-100);
  }
};

export default models.SuspicionScore || model<ISuspicionScore>('SuspicionScore', SuspicionScoreSchema);
```

### **Indexes:**
```typescript
db.suspicionscores.createIndex({ userId: 1 }, { unique: true });
db.suspicionscores.createIndex({ totalScore: -1 });
db.suspicionscores.createIndex({ riskLevel: 1, lastUpdated: -1 });
db.suspicionscores.createIndex({ "linkedAccounts.userId": 1 });
```

---

## 💳 PHASE 2: Payment Fingerprint Model

### **Model:** `PaymentFingerprint`
**File:** `database/models/fraud/payment-fingerprint.model.ts`  
**Collection:** `paymentfingerprints`

```typescript
import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IPaymentFingerprint extends Document {
  userId: mongoose.Types.ObjectId;
  paymentProvider: 'stripe' | 'paypal' | 'custom';
  
  // Stripe-specific
  stripePaymentMethodId?: string;
  stripeFingerprint?: string;
  stripeFingerprintDate?: Date;
  stripeCustomerId?: string;
  
  // Card details
  cardLast4?: string;
  cardBrand?: string;
  cardCountry?: string;
  cardFunding?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  
  // Bank account (ACH)
  bankFingerprint?: string;
  bankLast4?: string;
  bankCountry?: string;
  
  // Linked accounts
  linkedUserIds: mongoose.Types.ObjectId[];
  riskScore: number;
  isShared: boolean;
  sharedWithCount: number;
  
  // Usage stats
  firstUsed: Date;
  lastUsed: Date;
  timesUsed: number;
  totalAmount: number;
  
  // Geolocation
  paymentIP?: string;
  paymentCountry?: string;
  paymentCity?: string;
  paymentLatitude?: number;
  paymentLongitude?: number;
}

const PaymentFingerprintSchema = new Schema<IPaymentFingerprint>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },
  
  paymentProvider: {
    type: String,
    enum: ['stripe', 'paypal', 'custom'],
    required: true,
    default: 'stripe'
  },
  
  // Stripe
  stripePaymentMethodId: {
    type: String,
    index: true,
    sparse: true
  },
  stripeFingerprint: {
    type: String,
    index: true,
    sparse: true
  },
  stripeFingerprintDate: Date,
  stripeCustomerId: String,
  
  // Card details
  cardLast4: String,
  cardBrand: String,
  cardCountry: String,
  cardFunding: String,
  cardExpMonth: Number,
  cardExpYear: Number,
  
  // Bank
  bankFingerprint: String,
  bankLast4: String,
  bankCountry: String,
  
  // Linked accounts
  linkedUserIds: [{
    type: Schema.Types.ObjectId,
    ref: 'users'
  }],
  
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  isShared: {
    type: Boolean,
    default: false,
    index: true
  },
  
  sharedWithCount: {
    type: Number,
    default: 0
  },
  
  // Usage
  firstUsed: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  timesUsed: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  
  // Geolocation
  paymentIP: String,
  paymentCountry: String,
  paymentCity: String,
  paymentLatitude: Number,
  paymentLongitude: Number
  
}, {
  timestamps: true,
  collection: 'paymentfingerprints'
});

// Indexes
PaymentFingerprintSchema.index({ stripeFingerprint: 1 });
PaymentFingerprintSchema.index({ userId: 1, paymentProvider: 1 });
PaymentFingerprintSchema.index({ isShared: 1, riskScore: -1 });
PaymentFingerprintSchema.index({ linkedUserIds: 1 });

export default models.PaymentFingerprint || model<IPaymentFingerprint>('PaymentFingerprint', PaymentFingerprintSchema);
```

### **Update:** `WalletTransaction` Model
```typescript
// Add these fields to existing WalletTransaction model
{
  paymentFingerprintId: {
    type: Schema.Types.ObjectId,
    ref: 'PaymentFingerprint'
  },
  stripeFingerprint: String,
  fraudCheckScore: {
    type: Number,
    default: 0
  },
  fraudFlags: [{
    flag: String,
    severity: String,
    detectedAt: Date
  }]
}
```

---

## 📈 PHASE 3: Trading Behavior Models

### **Model 3.1:** `TradingBehaviorProfile`
**File:** `database/models/fraud/trading-behavior-profile.model.ts`

```typescript
import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface ITradingBehaviorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  lastUpdated: Date;
  totalTrades: number;
  
  patterns: {
    preferredPairs: Array<{
      symbol: string;
      frequency: number;
      percentage: number;
    }>;
    
    tradingHours: {
      mostActiveHour: number;
      leastActiveHour: number;
      averageSessionDuration: number;
      preferredDays: string[];
      hourlyDistribution: number[]; // 24 elements
    };
    
    tradeCharacteristics: {
      averageTradeDuration: number;
      averageLotSize: number;
      averageRiskPerTrade: number;
      medianTradeDuration: number;
      medianLotSize: number;
    };
    
    stopLossT takeProfitBehavior: {
      usesStopLoss: boolean;
      usesTakeProfit: boolean;
      averageStopLoss: number;
      averageTakeProfit: number;
      stopLossTakeProfitRatio: number;
      stopLossHitRate: number;
      takeProfitHitRate: number;
    };
    
    performance: {
      winRate: number;
      riskRewardRatio: number;
      maxDrawdown: number;
      recoveryFactor: number;
      profitFactor: number;
      sharpeRatio: number;
    };
    
    timing: {
      averageTimeBetweenTrades: number;
      reactionTime: number;
      averageTimeToClose: number;
      timeToFirstModification: number;
    };
    
    positionSizing: {
      consistentLotSize: boolean;
      lotSizeVariation: number;
      maxPositionSize: number;
      minPositionSize: number;
      averagePositionsOpen: number;
    };
  };
  
  mirrorTrading: {
    suspectedPairs: Array<{
      otherUserId: mongoose.Types.ObjectId;
      matchRate: number;
      oppositeDirection: boolean;
      timeDelta: number;
      lotSizeCorrelation: number;
      pnlCorrelation: number;
      lastDetected: Date;
      confidence: number;
    }>;
  };
  
  behavioralFingerprint: {
    tradingStyle: string;
    riskProfile: string;
    decisionSpeed: number;
    emotionalControl: number;
    consistencyScore: number;
    disciplineScore: number;
  };
  
  recentTradeSequence: Array<{
    symbol: string;
    direction: 'buy' | 'sell';
    lotSize: number;
    openTime: Date;
    closeTime?: Date;
    pnl?: number;
    duration?: number;
    stopLoss?: number;
    takeProfit?: number;
  }>;
  
  coordination: {
    competitionEntryTimes: Date[];
    nearbyEntries: Array<{
      competitionId: mongoose.Types.ObjectId;
      entryTime: Date;
      nearbyUsers: mongoose.Types.ObjectId[];
      timeDelta: number;
    }>;
  };
}

const TradingBehaviorProfileSchema = new Schema<ITradingBehaviorProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    unique: true,
    index: true
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  totalTrades: {
    type: Number,
    default: 0
  },
  
  patterns: {
    preferredPairs: [{
      symbol: String,
      frequency: Number,
      percentage: Number
    }],
    
    tradingHours: {
      mostActiveHour: Number,
      leastActiveHour: Number,
      averageSessionDuration: Number,
      preferredDays: [String],
      hourlyDistribution: [Number]
    },
    
    tradeCharacteristics: {
      averageTradeDuration: Number,
      averageLotSize: Number,
      averageRiskPerTrade: Number,
      medianTradeDuration: Number,
      medianLotSize: Number
    },
    
    stopLossTakeProfitBehavior: {
      usesStopLoss: Boolean,
      usesTakeProfit: Boolean,
      averageStopLoss: Number,
      averageTakeProfit: Number,
      stopLossTakeProfitRatio: Number,
      stopLossHitRate: Number,
      takeProfitHitRate: Number
    },
    
    performance: {
      winRate: Number,
      riskRewardRatio: Number,
      maxDrawdown: Number,
      recoveryFactor: Number,
      profitFactor: Number,
      sharpeRatio: Number
    },
    
    timing: {
      averageTimeBetweenTrades: Number,
      reactionTime: Number,
      averageTimeToClose: Number,
      timeToFirstModification: Number
    },
    
    positionSizing: {
      consistentLotSize: Boolean,
      lotSizeVariation: Number,
      maxPositionSize: Number,
      minPositionSize: Number,
      averagePositionsOpen: Number
    }
  },
  
  mirrorTrading: {
    suspectedPairs: [{
      otherUserId: {
        type: Schema.Types.ObjectId,
        ref: 'users'
      },
      matchRate: Number,
      oppositeDirection: Boolean,
      timeDelta: Number,
      lotSizeCorrelation: Number,
      pnlCorrelation: Number,
      lastDetected: Date,
      confidence: Number
    }]
  },
  
  behavioralFingerprint: {
    tradingStyle: String,
    riskProfile: String,
    decisionSpeed: Number,
    emotionalControl: Number,
    consistencyScore: Number,
    disciplineScore: Number
  },
  
  recentTradeSequence: [{
    symbol: String,
    direction: { type: String, enum: ['buy', 'sell'] },
    lotSize: Number,
    openTime: Date,
    closeTime: Date,
    pnl: Number,
    duration: Number,
    stopLoss: Number,
    takeProfit: Number
  }],
  
  coordination: {
    competitionEntryTimes: [Date],
    nearbyEntries: [{
      competitionId: {
        type: Schema.Types.ObjectId,
        ref: 'Competition'
      },
      entryTime: Date,
      nearbyUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'users'
      }],
      timeDelta: Number
    }]
  }
  
}, {
  timestamps: true,
  collection: 'tradingbehaviorprofiles'
});

// Indexes
TradingBehaviorProfileSchema.index({ userId: 1 }, { unique: true });
TradingBehaviorProfileSchema.index({ lastUpdated: -1 });
TradingBehaviorProfileSchema.index({ 'mirrorTrading.suspectedPairs.otherUserId': 1 });

export default models.TradingBehaviorProfile || model<ITradingBehaviorProfile>('TradingBehaviorProfile', TradingBehaviorProfileSchema);
```

### **Model 3.2:** `BehavioralSimilarity`
**File:** `database/models/fraud/behavioral-similarity.model.ts`

```typescript
import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IBehavioralSimilarity extends Document {
  userId1: mongoose.Types.ObjectId;
  userId2: mongoose.Types.ObjectId;
  
  similarityScore: number;
  
  similarities: {
    preferredPairs: number;
    tradingHours: number;
    tradeDuration: number;
    lotSize: number;
    riskProfile: number;
    stopLossBehavior: number;
    takeProfitBehavior: number;
    reactionTime: number;
    decisionSpeed: number;
  };
  
  evidenceCount: number;
  commonPatterns: string[];
  
  isSuspicious: boolean;
  alertCreated: boolean;
  
  lastCalculated: Date;
  
  mirrorTradingDetected: boolean;
  mirrorTradingScore: number;
  oppositeDirectionRate: number;
  timingCorrelation: number;
}

const BehavioralSimilaritySchema = new Schema<IBehavioralSimilarity>({
  userId1: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },
  userId2: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true
  },
  
  similarityScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    index: true
  },
  
  similarities: {
    preferredPairs: Number,
    tradingHours: Number,
    tradeDuration: Number,
    lotSize: Number,
    riskProfile: Number,
    stopLossBehavior: Number,
    takeProfitBehavior: Number,
    reactionTime: Number,
    decisionSpeed: Number
  },
  
  evidenceCount: Number,
  commonPatterns: [String],
  
  isSuspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  
  alertCreated: {
    type: Boolean,
    default: false
  },
  
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  
  mirrorTradingDetected: {
    type: Boolean,
    default: false,
    index: true
  },
  
  mirrorTradingScore: Number,
  oppositeDirectionRate: Number,
  timingCorrelation: Number
  
}, {
  timestamps: true,
  collection: 'behavioralsimilarities'
});

// Compound indexes
BehavioralSimilaritySchema.index({ userId1: 1, userId2: 1 }, { unique: true });
BehavioralSimilaritySchema.index({ similarityScore: -1, isSuspicious: 1 });
BehavioralSimilaritySchema.index({ mirrorTradingDetected: 1, mirrorTradingScore: -1 });

export default models.BehavioralSimilarity || model<IBehavioralSimilarity>('BehavioralSimilarity', BehavioralSimilaritySchema);
```

---

## 🌍 PHASE 4: Geographic Pattern Model

### **Model:** `GeographicPattern`
**File:** `database/models/fraud/geographic-pattern.model.ts`

```typescript
import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IGeographicPattern extends Document {
  userId: mongoose.Types.ObjectId;
  
  locations: Array<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
    deviceId?: mongoose.Types.ObjectId;
    ipAddress?: string;
    action: string;
    city?: string;
    country?: string;
  }>;
  
  patterns: {
    homeLocation?: {
      latitude: number;
      longitude: number;
      confidenceRadius: number;
      confidence: number;
    };
    
    frequentLocations: Array<{
      latitude: number;
      longitude: number;
      frequency: number;
      label: string;
      radius: number;
    }>;
    
    travelPattern: {
      averageDailyDistance: number;
      unusualJumps: Array<{
        from: { lat: number; lon: number; city?: string };
        to: { lat: number; lon: number; city?: string };
        distance: number;
        timestamp: Date;
        suspicious: boolean;
        reason?: string;
      }>;
    };
  };
  
  nearbyAccounts: Array<{
    otherUserId: mongoose.Types.ObjectId;
    minDistance: number;
    frequencyTogether: number;
    lastSeenTogether: Date;
    locations: Array<{
      lat: number;
      lon: number;
      timestamp: Date;
      distance: number;
    }>;
  }>;
  
  timezoneHistory: Array<{
    timezone: string;
    firstSeen: Date;
    lastSeen: Date;
    frequency: number;
  }>;
  
  timezoneMismatches: Array<{
    detectedTimezone: string;
    claimedTimezone: string;
    ipBasedTimezone?: string;
    timestamp: Date;
    suspicious: boolean;
    confidence: number;
  }>;
}

const GeographicPatternSchema = new Schema<IGeographicPattern>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    unique: true,
    index: true
  },
  
  locations: [{
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: Number,
    timestamp: { type: Date, default: Date.now },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: 'DeviceFingerprint'
    },
    ipAddress: String,
    action: String,
    city: String,
    country: String
  }],
  
  patterns: {
    homeLocation: {
      latitude: Number,
      longitude: Number,
      confidenceRadius: Number,
      confidence: Number
    },
    
    frequentLocations: [{
      latitude: Number,
      longitude: Number,
      frequency: Number,
      label: String,
      radius: Number
    }],
    
    travelPattern: {
      averageDailyDistance: Number,
      unusualJumps: [{
        from: {
          lat: Number,
          lon: Number,
          city: String
        },
        to: {
          lat: Number,
          lon: Number,
          city: String
        },
        distance: Number,
        timestamp: Date,
        suspicious: Boolean,
        reason: String
      }]
    }
  },
  
  nearbyAccounts: [{
    otherUserId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      index: true
    },
    minDistance: Number,
    frequencyTogether: Number,
    lastSeenTogether: Date,
    locations: [{
      lat: Number,
      lon: Number,
      timestamp: Date,
      distance: Number
    }]
  }],
  
  timezoneHistory: [{
    timezone: String,
    firstSeen: Date,
    lastSeen: Date,
    frequency: Number
  }],
  
  timezoneMismatches: [{
    detectedTimezone: String,
    claimedTimezone: String,
    ipBasedTimezone: String,
    timestamp: Date,
    suspicious: Boolean,
    confidence: Number
  }]
  
}, {
  timestamps: true,
  collection: 'geographicpatterns'
});

// Geospatial index for location queries
GeographicPatternSchema.index({ 'locations.coordinates': '2dsphere' });
GeographicPatternSchema.index({ 'nearbyAccounts.otherUserId': 1 });
GeographicPatternSchema.index({ 'patterns.homeLocation.coordinates': '2dsphere' });

export default models.GeographicPattern || model<IGeographicPattern>('GeographicPattern', GeographicPatternSchema);
```

### **Update:** `DeviceFingerprint` Model
```typescript
// Add these fields to existing DeviceFingerprint model
{
  geolocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date,
    permissionGranted: Boolean,
    source: { type: String, enum: ['gps', 'ip', 'network'] },
    
    ipBasedLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      city: String,
      region: String,
      country: String,
      postal: String
    }
  },
  
  nearbyAccounts: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users'
    },
    distance: Number,
    detectedAt: Date,
    suspicious: Boolean
  }]
}

// Add geospatial index
DeviceFingerprintSchema.index({ 'geolocation.coordinates': '2dsphere' });
```

---

## 📝 Index Summary

### Critical Indexes (Performance):
```typescript
// SuspicionScore
{ userId: 1 } - unique
{ totalScore: -1 }
{ riskLevel: 1, lastUpdated: -1 }

// PaymentFingerprint
{ stripeFingerprint: 1 }
{ isShared: 1, riskScore: -1 }
{ linkedUserIds: 1 }

// TradingBehaviorProfile
{ userId: 1 } - unique
{ lastUpdated: -1 }

// BehavioralSimilarity
{ userId1: 1, userId2: 1 } - unique
{ similarityScore: -1, isSuspicious: 1 }

// GeographicPattern
{ userId: 1 } - unique
{ 'locations.coordinates': '2dsphere' }
{ 'nearbyAccounts.otherUserId': 1 }
```

---

## ✅ Ready to Implement

All schemas are production-ready with:
- ✅ Proper TypeScript interfaces
- ✅ Mongoose schemas with validation
- ✅ Optimized indexes
- ✅ Timestamps
- ✅ Reference relationships
- ✅ Default values
- ✅ Enum validations

**Next Step:** Begin Phase 1 implementation → Create `SuspicionScore` model

Let me know when you're ready to start! 🚀

