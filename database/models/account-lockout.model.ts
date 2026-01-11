import { Schema, model, models, Document } from 'mongoose';

export type LockoutReason = 
  | 'failed_login' // Too many failed login attempts
  | 'suspicious_activity' // Suspicious behavior detected
  | 'rate_limit' // Rate limit exceeded
  | 'admin_action' // Manually locked by admin
  | 'fraud_detection'; // Automated fraud detection

export interface IAccountLockout extends Document {
  // Identification
  userId?: string; // User ID if known
  email: string; // Email (always known)
  ipAddress?: string; // IP that triggered lockout
  
  // Lockout details
  reason: LockoutReason;
  failedAttempts: number;
  lastAttemptAt: Date;
  
  // Lockout timing
  lockedAt: Date;
  lockedUntil?: Date; // Undefined = permanent until manual unlock
  
  // Status
  isActive: boolean;
  unlockedAt?: Date;
  unlockedBy?: string; // Admin who unlocked
  unlockedReason?: string;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

const AccountLockoutSchema = new Schema<IAccountLockout>({
  userId: { type: String, index: true },
  email: { type: String, required: true, index: true },
  ipAddress: { type: String, index: true },
  
  reason: { 
    type: String, 
    required: true,
    enum: ['failed_login', 'suspicious_activity', 'rate_limit', 'admin_action', 'fraud_detection']
  },
  failedAttempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: Date.now },
  
  lockedAt: { type: Date, default: Date.now },
  lockedUntil: { type: Date },
  
  isActive: { type: Boolean, default: true, index: true },
  unlockedAt: { type: Date },
  unlockedBy: { type: String },
  unlockedReason: { type: String },
}, {
  timestamps: true
});

// Compound indexes for common queries
AccountLockoutSchema.index({ email: 1, isActive: 1 });
AccountLockoutSchema.index({ userId: 1, isActive: 1 });
AccountLockoutSchema.index({ lockedUntil: 1, isActive: 1 });
AccountLockoutSchema.index({ createdAt: -1 });

// Static method to check if account is locked
AccountLockoutSchema.statics.isAccountLocked = async function(email: string): Promise<{ locked: boolean; lockout?: IAccountLockout }> {
  const now = new Date();
  
  const lockout = await this.findOne({
    email,
    isActive: true,
    $or: [
      { lockedUntil: { $gt: now } }, // Temporary lockout not expired
      { lockedUntil: null } // Permanent lockout
    ]
  }).sort({ lockedAt: -1 });
  
  return { locked: !!lockout, lockout };
};

// Static method to unlock expired lockouts
AccountLockoutSchema.statics.unlockExpired = async function(): Promise<number> {
  const now = new Date();
  const result = await this.updateMany(
    {
      isActive: true,
      lockedUntil: { $lte: now, $ne: null }
    },
    {
      $set: {
        isActive: false,
        unlockedAt: now,
        unlockedReason: 'Lockout expired'
      }
    }
  );
  return result.modifiedCount;
};

const AccountLockout = models.AccountLockout || model<IAccountLockout>('AccountLockout', AccountLockoutSchema);

export default AccountLockout;

