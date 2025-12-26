import mongoose, { Schema, model, models, Document } from 'mongoose';

/**
 * Payment Fingerprint Model
 * 
 * Tracks payment methods across users to detect shared cards/accounts
 * Works with ALL payment providers (Stripe, PayPal, custom, etc.)
 * Contributes +30% to fraud score when shared payment detected
 */

export interface IPaymentFingerprint extends Document {
  // User Info
  userId: mongoose.Types.ObjectId;
  
  // Payment Provider
  paymentProvider: 'stripe' | 'paypal' | 'custom' | string; // Extensible for any provider
  
  // Payment Method Fingerprint (unique identifier across providers)
  paymentFingerprint: string; // Card hash, PayPal account ID, etc.
  
  // Card Details (for Stripe/credit cards)
  cardLast4?: string;
  cardBrand?: string; // visa, mastercard, amex, etc.
  cardCountry?: string;
  cardFunding?: string; // credit, debit, prepaid
  
  // PayPal Details (for PayPal)
  paypalEmail?: string;
  paypalAccountId?: string;
  
  // Other Provider Details
  providerAccountId?: string;
  providerMetadata?: Record<string, any>;
  
  // Fraud Detection
  linkedUserIds: mongoose.Types.ObjectId[]; // Other users with same payment method
  isShared: boolean; // True if used by multiple accounts
  riskScore: number; // 0-100
  firstUsed: Date;
  lastUsed: Date;
  timesUsed: number;
  
  // Fraud Alerts
  fraudAlertIds: mongoose.Types.ObjectId[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const PaymentFingerprintSchema = new Schema<IPaymentFingerprint>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  
  paymentProvider: {
    type: String,
    required: true,
    enum: ['stripe', 'paypal', 'custom'],
    default: 'stripe',
    index: true
  },
  
  paymentFingerprint: {
    type: String,
    required: true,
    index: true // Important: Index for fast lookup of shared payments
  },
  
  // Card Details
  cardLast4: String,
  cardBrand: String,
  cardCountry: String,
  cardFunding: String,
  
  // PayPal Details
  paypalEmail: String,
  paypalAccountId: String,
  
  // Other Provider Details
  providerAccountId: String,
  providerMetadata: Schema.Types.Mixed,
  
  // Fraud Detection
  linkedUserIds: [{
    type: Schema.Types.ObjectId,
    ref: 'user'
  }],
  
  isShared: {
    type: Boolean,
    default: false,
    index: true
  },
  
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  firstUsed: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  lastUsed: {
    type: Date,
    default: Date.now
  },
  
  timesUsed: {
    type: Number,
    default: 1
  },
  
  fraudAlertIds: [{
    type: Schema.Types.ObjectId,
    ref: 'FraudAlert'
  }]
  
}, {
  timestamps: true,
  collection: 'paymentfingerprints'
});

// Compound Indexes for Performance
PaymentFingerprintSchema.index({ paymentFingerprint: 1, paymentProvider: 1 }); // Find same payment across providers
PaymentFingerprintSchema.index({ userId: 1, paymentProvider: 1 }); // User's payment methods
PaymentFingerprintSchema.index({ isShared: 1, riskScore: -1 }); // High-risk shared payments
PaymentFingerprintSchema.index({ linkedUserIds: 1 }); // Find users sharing payment

// Methods
PaymentFingerprintSchema.methods.addLinkedUser = function(linkedUserId: mongoose.Types.ObjectId): void {
  // Check if already linked
  const exists = this.linkedUserIds.some((id: mongoose.Types.ObjectId) => 
    id.toString() === linkedUserId.toString()
  );
  
  if (!exists && linkedUserId.toString() !== this.userId.toString()) {
    this.linkedUserIds.push(linkedUserId);
    this.isShared = this.linkedUserIds.length > 0;
    
    // Calculate risk score based on number of linked accounts
    this.riskScore = Math.min(30 + (this.linkedUserIds.length * 10), 100);
  }
};

PaymentFingerprintSchema.methods.updateUsage = function(): void {
  this.lastUsed = new Date();
  this.timesUsed += 1;
};

// Statics
PaymentFingerprintSchema.statics.findSharedPayments = function() {
  return this.find({ isShared: true }).sort({ riskScore: -1 });
};

PaymentFingerprintSchema.statics.findByFingerprint = function(fingerprint: string, provider: string) {
  return this.find({ 
    paymentFingerprint: fingerprint,
    paymentProvider: provider
  });
};

PaymentFingerprintSchema.statics.findHighRisk = function() {
  return this.find({
    isShared: true,
    riskScore: { $gte: 50 }
  }).sort({ riskScore: -1 });
};

const PaymentFingerprint = models.PaymentFingerprint || model<IPaymentFingerprint>('PaymentFingerprint', PaymentFingerprintSchema);

export default PaymentFingerprint;

