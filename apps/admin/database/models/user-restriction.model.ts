import { Schema, model, models, Document } from 'mongoose';

export type RestrictionType = 'banned' | 'suspended';
export type RestrictionReason = 
  | 'multi_accounting'
  | 'fraud'
  | 'terms_violation'
  | 'payment_fraud'
  | 'suspicious_activity'
  | 'admin_decision'
  | 'automated_fraud_detection'
  | 'kyc_failed'
  | 'kyc_fraud'
  | 'other';

export interface IUserRestriction extends Document {
  userId: string;
  
  // Restriction details
  restrictionType: RestrictionType;
  reason: RestrictionReason;
  customReason?: string; // Admin's custom explanation
  
  // What actions are blocked
  canTrade: boolean;
  canEnterCompetitions: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  
  // Time-based restrictions (for suspensions)
  restrictedAt: Date;
  expiresAt?: Date; // Undefined = permanent ban
  
  // Admin tracking
  restrictedBy: string; // Admin user ID
  relatedFraudAlertId?: string; // Link to fraud alert
  relatedUserIds?: string[]; // Other accounts in same fraud case
  
  // Status
  isActive: boolean; // False if manually unrestricted
  unrestrictedAt?: Date;
  unrestrictedBy?: string; // Admin who unrestricted
  
  createdAt: Date;
  updatedAt: Date;
}

const UserRestrictionSchema = new Schema<IUserRestriction>({
  userId: { type: String, required: true, index: true },
  
  restrictionType: { 
    type: String, 
    required: true,
    enum: ['banned', 'suspended']
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'multi_accounting',
      'fraud',
      'terms_violation',
      'payment_fraud',
      'suspicious_activity',
      'admin_decision',
      'automated_fraud_detection',
      'kyc_failed',
      'kyc_fraud',
      'other'
    ]
  },
  customReason: String,
  
  // What actions are blocked
  canTrade: { type: Boolean, default: false },
  canEnterCompetitions: { type: Boolean, default: false },
  canDeposit: { type: Boolean, default: false },
  canWithdraw: { type: Boolean, default: false },
  
  // Time-based restrictions
  restrictedAt: { type: Date, default: Date.now },
  expiresAt: Date,
  
  // Admin tracking
  restrictedBy: { type: String, required: true },
  relatedFraudAlertId: String,
  relatedUserIds: [String],
  
  // Status
  isActive: { type: Boolean, default: true },
  unrestrictedAt: Date,
  unrestrictedBy: String,
}, {
  timestamps: true
});

// Indexes for fast queries
UserRestrictionSchema.index({ userId: 1, isActive: 1 });
UserRestrictionSchema.index({ expiresAt: 1, isActive: 1 });
UserRestrictionSchema.index({ restrictedBy: 1 });
UserRestrictionSchema.index({ relatedFraudAlertId: 1 });

const UserRestriction = models.UserRestriction || model<IUserRestriction>('UserRestriction', UserRestrictionSchema);

export default UserRestriction;

