# Advanced Fraud Detection System - Implementation Plan

## 🎯 Executive Summary

This document outlines the complete implementation plan for an advanced multi-layered fraud detection system that goes beyond device fingerprinting to include behavioral analysis, payment tracking, geographic analysis, and automated suspicion scoring.

---

## 📊 Current State (What We Have)

### ✅ **Layer 1: Device Fingerprinting** (IMPLEMENTED)
- 50+ device characteristics tracking
- Device fingerprint matching
- IP address tracking
- VPN/Proxy/Tor detection
- Same IP + Browser detection
- User restriction system (ban/suspend)
- Investigation Center workflow
- Alert suppression for investigating/restricted accounts

**Database Models:**
- `DeviceFingerprint` ✅
- `FraudAlert` ✅
- `UserRestriction` ✅
- `FraudSettings` ✅

---

## 🚀 Implementation Phases

### **PHASE 1: Suspicion Scoring System** (Foundation)
**Priority:** CRITICAL - Required for all other layers  
**Timeline:** 1-2 days  
**Complexity:** Medium

#### What It Does:
- Cumulative scoring system (0-100 points)
- Multiple detection methods contribute to score
- Automated alerts at thresholds
- Real-time score updates

#### Suspicion Score Calculation:

| Detection Method | Points | Current Status |
|-----------------|--------|----------------|
| **Device Match** (same fingerprint) | +40 | ✅ Implemented |
| **IP Match** (same IP) | +30 | ✅ Implemented |
| **Same IP + Browser** | +35 | ✅ Implemented |
| **Same City** (< 50km) | +15 | ⏳ Phase 1 |
| **Same Payment Method** | +30 | ⏳ Phase 2 |
| **Account Created Within 1 Hour** | +20 | ⏳ Phase 1 |
| **Enter Competition Within 5 Minutes** | +25 | ⏳ Phase 3 |
| **Similar Trading Patterns** (>80%) | +30 | ⏳ Phase 3 |
| **Mirror Trading Detected** | +35 | ⏳ Phase 3 |
| **Same Timezone + Language** | +10 | ✅ Implemented |
| **Unusual Device Switching** | +15 | ⏳ Phase 1 |

#### Risk Thresholds:
```
0-29:  Low Risk (Green)      → Monitor only
30-49: Medium Risk (Yellow)  → Manual review
50-69: High Risk (Orange)    → Investigation required
70+:   Critical Risk (Red)   → Auto-restrict or ban
```

#### Database Changes:

**New Model: `SuspicionScore`**
```typescript
{
  userId: ObjectId,
  totalScore: Number (0-100),
  lastUpdated: Date,
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
  
  // Score breakdown
  scoreBreakdown: {
    deviceMatch: { points: Number, evidence: String },
    ipMatch: { points: Number, evidence: String },
    ipBrowserMatch: { points: Number, evidence: String },
    sameCity: { points: Number, evidence: String },
    samePayment: { points: Number, evidence: String },
    rapidCreation: { points: Number, evidence: String },
    coordinatedEntry: { points: Number, evidence: String },
    tradingSimilarity: { points: Number, evidence: String },
    mirrorTrading: { points: Number, evidence: String },
    timezoneLanguage: { points: Number, evidence: String },
    deviceSwitching: { points: Number, evidence: String }
  },
  
  // Linked accounts contributing to score
  linkedAccounts: [{
    userId: ObjectId,
    matchType: String,
    confidence: Number,
    detectedAt: Date
  }],
  
  // History
  scoreHistory: [{
    timestamp: Date,
    score: Number,
    reason: String,
    delta: Number
  }]
}
```

**Update Model: `FraudAlert`**
```typescript
// Add new field
suspicionScore: Number (0-100)
```

#### Action Items:
1. ✅ Create `SuspicionScore` model
2. ✅ Create scoring service (`fraud-scoring.service.ts`)
3. ✅ Implement score calculation algorithm
4. ✅ Add score to fraud alert creation
5. ✅ Create admin UI to view suspicion scores
6. ✅ Add score history tracking
7. ✅ Implement auto-alerts at thresholds

---

### **PHASE 2: Payment Method Tracking** (70% Catch Rate)
**Priority:** HIGH  
**Timeline:** 2-3 days  
**Complexity:** High (Stripe integration)

#### What It Does:
- Track Stripe payment fingerprints
- Detect shared credit cards across accounts
- Cross-reference with device/IP data
- Flag multiple accounts using same payment method

#### Database Changes:

**New Model: `PaymentFingerprint`**
```typescript
{
  userId: ObjectId,
  paymentProvider: 'stripe' | 'paypal' | 'custom',
  
  // Stripe-specific
  stripePaymentMethodId: String,
  stripeFingerprint: String,        // Card fingerprint from Stripe
  stripeFingerprintDate: Date,       // When fingerprint was generated
  
  // Card details (last 4, type, country)
  cardLast4: String,
  cardBrand: String,                 // visa, mastercard, etc.
  cardCountry: String,
  cardFunding: String,               // credit, debit, prepaid
  
  // Bank account fingerprints (if ACH)
  bankFingerprint: String,
  bankLast4: String,
  bankCountry: String,
  
  // Metadata
  linkedUserIds: [ObjectId],         // Other users with same payment method
  riskScore: Number,
  firstUsed: Date,
  lastUsed: Date,
  timesUsed: Number,
  totalAmount: Number,
  
  // Detection flags
  isShared: Boolean,                 // Multiple accounts detected
  sharedWithCount: Number,
  
  // Geolocation of payment
  paymentIP: String,
  paymentCountry: String,
  paymentCity: String
}
```

**Update Model: `WalletTransaction`**
```typescript
// Add new fields
paymentFingerprintId: ObjectId,
stripeFingerprint: String,
fraudCheckScore: Number
```

#### Stripe Integration:

**Get Payment Method Fingerprint:**
```typescript
// When processing Stripe payment
const paymentMethod = await stripe.paymentMethods.retrieve(
  payment_method_id
);

const fingerprint = paymentMethod.card.fingerprint; // Unique card hash
```

**Detection Logic:**
```typescript
// Check if this card is used by another account
const existingFingerprints = await PaymentFingerprint.find({
  stripeFingerprint: fingerprint,
  userId: { $ne: currentUserId }
});

if (existingFingerprints.length > 0) {
  // FRAUD DETECTED: Shared payment method
  // Add +30 to suspicion score
  // Create fraud alert
}
```

#### Action Items:
1. ✅ Create `PaymentFingerprint` model
2. ✅ Update Stripe webhook handler to capture fingerprints
3. ✅ Create payment fraud detection service
4. ✅ Integrate with suspicion scoring system
5. ✅ Add payment fingerprint to deposit flow
6. ✅ Create admin UI to view payment fraud
7. ✅ Add "Same Payment Method" fraud alert type

---

### **PHASE 3: Behavioral Analysis** (Best for Trading Competitions)
**Priority:** HIGH  
**Timeline:** 4-5 days  
**Complexity:** Very High (ML/Statistical Analysis)

#### What It Does:
- Track trading patterns per user
- Calculate behavioral similarity between accounts
- Detect mirror trading (opposite trades)
- Flag coordinated competition entry
- Analyze trading habits and preferences

#### Database Changes:

**New Model: `TradingBehaviorProfile`**
```typescript
{
  userId: ObjectId,
  lastUpdated: Date,
  totalTrades: Number,
  
  // Trading Patterns
  patterns: {
    // Preferred instruments
    preferredPairs: [{
      symbol: String,
      frequency: Number,    // How often traded
      percentage: Number    // % of total trades
    }],
    
    // Time patterns
    tradingHours: {
      mostActiveHour: Number (0-23),
      leastActiveHour: Number (0-23),
      averageSessionDuration: Number (minutes),
      preferredDays: [String], // ['Monday', 'Friday']
    },
    
    // Trade characteristics
    averageTradeDuration: Number (seconds),
    averageLotSize: Number,
    averageRiskPerTrade: Number (percentage),
    
    // Stop loss / Take profit behavior
    usesStopLoss: Boolean,
    usesTakeProfit: Boolean,
    averageStopLoss: Number (pips),
    averageTakeProfit: Number (pips),
    stopLossTakeProfitRatio: Number,
    
    // Win rate and risk profile
    winRate: Number (percentage),
    riskRewardRatio: Number,
    maxDrawdown: Number (percentage),
    recoveryFactor: Number,
    
    // Timing patterns
    averageTimeBetweenTrades: Number (seconds),
    reactionTime: Number (seconds), // Time from entry to first action
    averageTimeToClose: Number (seconds),
    
    // Position sizing
    consistentLotSize: Boolean,
    lotSizeVariation: Number (percentage),
    maxPositionSize: Number,
    minPositionSize: Number
  },
  
  // Mirror Trading Detection
  mirrorTrading: {
    suspectedPairs: [{
      otherUserId: ObjectId,
      matchRate: Number (0-1),     // How often trades are mirrored
      oppositeDirection: Boolean,   // Trade opposite directions
      timeDelta: Number (seconds),  // Average time difference
      lotSizeCorrelation: Number,
      pnlCorrelation: Number,
      lastDetected: Date
    }]
  },
  
  // Behavioral Fingerprint (for similarity matching)
  behavioralFingerprint: {
    tradingStyle: String,          // 'scalper', 'swing', 'day_trader'
    riskProfile: String,           // 'conservative', 'moderate', 'aggressive'
    decisionSpeed: Number,         // Fast, medium, slow
    emotionalControl: Number,      // Based on reaction to losses
    consistencyScore: Number       // How consistent is their behavior
  },
  
  // Raw sequence data (for pattern matching)
  recentTradeSequence: [{
    symbol: String,
    direction: 'buy' | 'sell',
    lotSize: Number,
    openTime: Date,
    closeTime: Date,
    pnl: Number,
    duration: Number
  }], // Keep last 50 trades
  
  // Coordination detection
  coordination: {
    competitionEntryTimes: [Date],  // When they enter competitions
    nearbyEntries: [{
      competitionId: ObjectId,
      entryTime: Date,
      nearbyUsers: [ObjectId],      // Users who entered within 5 min
      timeDelta: Number
    }]
  }
}
```

**New Model: `BehavioralSimilarity`**
```typescript
{
  userId1: ObjectId,
  userId2: ObjectId,
  
  similarityScore: Number (0-1),   // Overall similarity
  
  // Similarity breakdown
  similarities: {
    preferredPairs: Number (0-1),
    tradingHours: Number (0-1),
    tradeDuration: Number (0-1),
    lotSize: Number (0-1),
    riskProfile: Number (0-1),
    stopLossBehavior: Number (0-1),
    takeProfitBehavior: Number (0-1),
    reactionTime: Number (0-1),
    decisionSpeed: Number (0-1)
  },
  
  // Evidence
  evidenceCount: Number,
  commonPatterns: [String],
  
  // Status
  isSuspicious: Boolean,           // > 70% similarity
  alertCreated: Boolean,
  
  lastCalculated: Date,
  
  // Mirror trading specific
  mirrorTradingDetected: Boolean,
  mirrorTradingScore: Number,
  oppositeDirectionRate: Number,
  timingCorrelation: Number
}
```

**Update Model: `Position`**
```typescript
// Add new fields for behavioral tracking
metadata: {
  reactionTime: Number,            // Time from open to first modification
  decisionSpeed: Number,           // How quickly they decided to close
  emotionalIndicators: {
    panicClose: Boolean,           // Closed quickly after loss
    greedHold: Boolean,            // Held too long after profit
    disciplinedExit: Boolean       // Followed plan
  }
}
```

**Update Model: `Participant`**
```typescript
// Add competition entry timing
entryMetadata: {
  entryTimestamp: Date,
  deviceUsed: ObjectId,
  ipAddress: String,
  nearbyEntries: [{
    userId: ObjectId,
    timeDelta: Number (seconds)
  }]
}
```

#### Behavioral Analysis Service:

**1. Calculate Trading Profile**
```typescript
// Service: calculateTradingProfile(userId)
// Analyzes user's trade history and builds profile
// Run: After every 10 trades or daily
```

**2. Calculate Similarity Between Accounts**
```typescript
// Service: calculateBehavioralSimilarity(userId1, userId2)
// Returns similarity score 0-100
// Run: When fraud alert is created
```

**3. Detect Mirror Trading**
```typescript
// Service: detectMirrorTrading(userId1, userId2)
// Looks for opposite trades at same time
// Run: Real-time on trade execution
```

**4. Detect Coordinated Entry**
```typescript
// Service: detectCoordinatedEntry(competitionId)
// Finds accounts entering within 5 minutes
// Run: On competition entry
```

#### Action Items:
1. ✅ Create `TradingBehaviorProfile` model
2. ✅ Create `BehavioralSimilarity` model
3. ✅ Build profile calculation service
4. ✅ Implement similarity algorithm (Cosine Similarity)
5. ✅ Build mirror trading detector
6. ✅ Add coordination detection to competition entry
7. ✅ Create admin UI for behavioral analysis
8. ✅ Integrate with suspicion scoring
9. ✅ Add "Mirror Trading" alert type
10. ✅ Add "Behavioral Similarity" alert type
11. ✅ Add real-time monitoring on trade execution

---

### **PHASE 4: Geographic & Timing Analysis**
**Priority:** MEDIUM  
**Timeline:** 2-3 days  
**Complexity:** Medium

#### What It Does:
- Track precise GPS locations (with permission)
- Calculate distance between accounts
- Flag accounts < 100m apart
- Detect timezone/location mismatches
- Analyze account creation timing

#### Database Changes:

**Update Model: `DeviceFingerprint`**
```typescript
// Add new fields
geolocation: {
  latitude: Number,
  longitude: Number,
  accuracy: Number (meters),
  timestamp: Date,
  permissionGranted: Boolean,
  
  // Calculated from IP if GPS denied
  ipBasedLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    city: String,
    region: String,
    country: String
  }
},

// Distance to other accounts
nearbyAccounts: [{
  userId: ObjectId,
  distance: Number (meters),
  detectedAt: Date
}]
```

**New Model: `GeographicPattern`**
```typescript
{
  userId: ObjectId,
  
  // Location history
  locations: [{
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date,
    deviceId: ObjectId,
    ipAddress: String,
    action: String  // 'login', 'trade', 'competition_entry'
  }],
  
  // Patterns
  patterns: {
    homeLocation: {
      latitude: Number,
      longitude: Number,
      confidenceRadius: Number (meters)
    },
    
    frequentLocations: [{
      latitude: Number,
      longitude: Number,
      frequency: Number,
      label: String  // 'home', 'work', 'cafe'
    }],
    
    travelPattern: {
      averageDailyDistance: Number (km),
      unusualJumps: [{
        from: { lat: Number, lon: Number },
        to: { lat: Number, lon: Number },
        distance: Number,
        timestamp: Date,
        suspicious: Boolean
      }]
    }
  },
  
  // Suspicion flags
  nearbyAccounts: [{
    otherUserId: ObjectId,
    minDistance: Number (meters),
    frequencyTogether: Number,
    lastSeenTogether: Date,
    locations: [{ lat: Number, lon: Number, timestamp: Date }]
  }],
  
  // Timezone analysis
  timezoneHistory: [{
    timezone: String,
    firstSeen: Date,
    lastSeen: Date,
    frequency: Number
  }],
  
  timezoneMismatches: [{
    detectedTimezone: String,
    claimedTimezone: String,
    timestamp: Date,
    suspicious: Boolean
  }]
}
```

**Update Model: `User` (Better Auth)**
```typescript
// Add new fields to Better Auth user table
metadata: {
  accountCreatedFrom: {
    ipAddress: String,
    deviceId: ObjectId,
    location: { lat: Number, lon: Number },
    timezone: String,
    timestamp: Date
  },
  
  nearbyCreations: [{
    otherUserId: ObjectId,
    timeDelta: Number (seconds),
    sameDevice: Boolean,
    sameIP: Boolean,
    sameLocation: Boolean
  }]
}
```

#### Geographic Service:

**1. Calculate Distance Between Accounts**
```typescript
// Service: calculateDistance(lat1, lon1, lat2, lon2)
// Returns distance in meters using Haversine formula
```

**2. Find Nearby Accounts**
```typescript
// Service: findNearbyAccounts(userId, radiusMeters)
// Returns accounts within specified radius
```

**3. Detect Timezone Mismatches**
```typescript
// Service: detectTimezoneMismatch(userId)
// Compares claimed timezone vs detected timezone
```

**4. Detect Rapid Account Creation**
```typescript
// Service: detectRapidCreation()
// Finds accounts created within 1 hour from same device/IP
```

#### Client-Side Geolocation:

**Add to `device-fingerprint.service.ts`:**
```typescript
async function getGeolocation(): Promise<{lat: number, lon: number} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: true }
    );
  });
}
```

#### Action Items:
1. ✅ Create `GeographicPattern` model
2. ✅ Add geolocation tracking to fingerprint service
3. ✅ Implement distance calculation (Haversine)
4. ✅ Build nearby account detector
5. ✅ Add rapid creation detector
6. ✅ Build timezone mismatch detector
7. ✅ Integrate with suspicion scoring
8. ✅ Add "Nearby Accounts" alert type
9. ✅ Add "Rapid Creation" alert type
10. ✅ Create admin UI for geographic view (map)

---

### **PHASE 5: Advanced Detection (Future)**
**Priority:** LOW  
**Timeline:** 5-7 days  
**Complexity:** Very High (Requires ML)

#### 5.1 Mouse Movement & Typing Patterns
- Track mouse movement patterns
- Analyze typing speed and rhythm
- Create biometric profile per user
- Detect bot-like behavior

#### 5.2 VPS Abuse Detection
- Track latency patterns
- Detect execution speed anomalies
- Identify VPS provider fingerprints
- Flag synchronized VPS usage

#### 5.3 Machine Learning Models
- Train ML model on historical fraud cases
- Anomaly detection for unusual behavior
- Predictive fraud scoring
- Auto-improvement from admin feedback

---

## 📋 Database Schema Summary

### New Collections/Models:
1. ✅ `SuspicionScore` - Cumulative fraud scoring
2. ✅ `PaymentFingerprint` - Payment method tracking
3. ✅ `TradingBehaviorProfile` - Trading pattern analysis
4. ✅ `BehavioralSimilarity` - Account similarity matching
5. ✅ `GeographicPattern` - Location tracking and analysis

### Updated Collections:
1. ✅ `FraudAlert` - Add suspicion score
2. ✅ `DeviceFingerprint` - Add geolocation
3. ✅ `Position` - Add behavioral metadata
4. ✅ `Participant` - Add entry timing metadata
5. ✅ `WalletTransaction` - Add payment fingerprint

---

## 🎯 Implementation Priority Order

### **IMMEDIATE (Week 1)**
1. ✅ Phase 1: Suspicion Scoring System
   - Foundation for all other detection methods
   - Required before other phases can be integrated

### **HIGH PRIORITY (Week 2-3)**
2. ✅ Phase 2: Payment Method Tracking
   - High fraud detection rate (70%)
   - Relatively straightforward Stripe integration

3. ✅ Phase 3: Behavioral Analysis
   - Best for trading competitions
   - Catches coordinated fraud and mirror trading

### **MEDIUM PRIORITY (Week 4)**
4. ✅ Phase 4: Geographic & Timing Analysis
   - Supplements other detection methods
   - Helps catch same-location fraud

### **FUTURE ENHANCEMENTS (Month 2+)**
5. ⏳ Phase 5: Advanced Detection
   - ML models require training data
   - Mouse/typing tracking requires significant UI changes
   - VPS detection requires advanced network analysis

---

## 🔧 Technical Architecture

### Services to Create:
```
lib/services/fraud/
├── suspicion-scoring.service.ts        ✅ Phase 1
├── payment-fraud.service.ts            ✅ Phase 2
├── behavioral-analysis.service.ts      ✅ Phase 3
├── mirror-trading.service.ts           ✅ Phase 3
├── coordination-detection.service.ts   ✅ Phase 3
├── geographic-analysis.service.ts      ✅ Phase 4
└── fraud-ml.service.ts                 ⏳ Phase 5
```

### API Endpoints to Create:
```
app/api/fraud/
├── suspicion-score/route.ts            ✅ Phase 1
├── payment-tracking/route.ts           ✅ Phase 2
├── behavioral-analysis/route.ts        ✅ Phase 3
├── geographic-patterns/route.ts        ✅ Phase 4
└── webhooks/
    └── stripe-fingerprint/route.ts     ✅ Phase 2
```

### Admin UI Components:
```
components/admin/fraud/
├── SuspicionScoreCard.tsx              ✅ Phase 1
├── PaymentFraudSection.tsx             ✅ Phase 2
├── BehavioralAnalysisSection.tsx       ✅ Phase 3
├── GeographicMapView.tsx               ✅ Phase 4
└── AdvancedFraudDashboard.tsx          ✅ All Phases
```

---

## 📊 Success Metrics

### Detection Rates (Expected):
- **Current (Device Fingerprinting):** ~50% of fraud
- **+ Payment Tracking:** ~70% of fraud
- **+ Behavioral Analysis:** ~85% of fraud
- **+ Geographic Analysis:** ~90% of fraud
- **+ Advanced ML:** ~95% of fraud

### Performance Targets:
- Suspicion score calculation: < 100ms
- Real-time fraud detection: < 200ms
- Behavioral similarity: < 500ms
- Admin dashboard load: < 2 seconds

### False Positive Targets:
- Critical alerts (70+ score): < 5% false positive
- High alerts (50-69): < 10% false positive
- Medium alerts (30-49): < 20% false positive

---

## ⚠️ Important Considerations

### 1. **Privacy & GDPR Compliance**
- Get explicit user consent for geolocation tracking
- Allow users to opt-out of behavioral tracking
- Anonymize data after 90 days
- Provide data deletion on request

### 2. **Performance**
- Behavioral analysis is computationally expensive
- Run heavy calculations in background jobs
- Cache suspicion scores (recalculate hourly)
- Use indexes on all query fields

### 3. **False Positives**
- Family members trading from same house
- Internet cafes with multiple users
- VPN users (not all are fraudsters)
- Shared payment cards (family)

**Solution:** Always require manual admin review before permanent bans

### 4. **Scalability**
- Current system handles ~1000 users
- Behavioral analysis: Add Redis for caching
- Payment tracking: Webhook queue with retry logic
- Geographic analysis: Use geospatial indexes

---

## 🚀 Getting Started

### To implement Phase 1 (Suspicion Scoring):

1. **Create the database model**
   ```bash
   Create: database/models/fraud/suspicion-score.model.ts
   ```

2. **Build the scoring service**
   ```bash
   Create: lib/services/fraud/suspicion-scoring.service.ts
   ```

3. **Integrate with existing alerts**
   ```bash
   Update: app/api/fraud/track-device/route.ts
   ```

4. **Create admin UI**
   ```bash
   Create: components/admin/fraud/SuspicionScoreCard.tsx
   ```

5. **Add to Investigation Center**
   ```bash
   Update: components/admin/FraudMonitoringSection.tsx
   ```

**Estimated Time:** 1-2 days for Phase 1

---

## 📝 Next Steps

**Ready to proceed?**

I can start implementing **Phase 1: Suspicion Scoring System** immediately. This will:
1. Create the foundation for all other fraud detection
2. Add cumulative scoring to existing fraud alerts
3. Implement risk thresholds (Low/Medium/High/Critical)
4. Add score breakdown visualization to admin panel
5. Track score history over time

**Would you like me to:**
- ✅ Start implementing Phase 1 now?
- 📋 Review the plan first and make adjustments?
- 🎯 Focus on a specific phase?
- 📊 See mockups of the admin UI first?

Let me know and I'll proceed! 🚀

---

**Document Version:** 1.0  
**Last Updated:** November 29, 2025  
**Status:** Planning Phase - Ready for Implementation

