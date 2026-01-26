import { Schema, model, models, Document } from 'mongoose';

/**
 * Game Master Subscription Model
 * Tracks users who have purchased and activated a game master package
 */

export type GameMasterStatus = 'active' | 'expired' | 'cancelled' | 'suspended';

export interface IGameMasterSubscription extends Document {
  userId: string;                       // Reference to Better Auth user ID
  userEmail: string;                    // Cached for quick lookups
  userName: string;                     // Cached for display
  
  packageId: string;                    // Reference to MarketplaceItem (gamemaster package)
  packageName: string;                  // Cached package name
  
  // Subscription Status
  status: GameMasterStatus;
  activatedAt: Date;                    // When first activated
  startDate: Date;                      // Current period start
  endDate: Date;                        // Current period end
  nextRenewalDate: Date;                // When auto-renewal will attempt
  
  // Auto-renewal settings
  autoRenew: boolean;                   // Whether to auto-renew
  renewalPrice: number;                 // Price per renewal period
  
  // Referral System
  referralCode: string;                 // Unique referral code for this game master
  referralLink?: string;                // Full referral URL (cached)
  
  // Package Limits (copied from package at activation)
  limits: {
    maxCompetitionsPerDay: number;
    maxUsersPerCompetition: number;
    referralFeePercentage: number;      // % of entry fees from referred users in competitions
    canCreateCompetitions: boolean;     // Whether package allows competition creation
    canEarnFromChallenges: boolean;     // Whether GM earns from 1v1 challenges
    challengeReferralFeePercentage?: number; // % for challenges (defaults to referralFeePercentage)
  };
  
  // Admin Override for Competition Creation
  // null = use package default, 'enabled' = force allow, 'disabled' = force deny
  competitionCreationOverride?: 'enabled' | 'disabled' | null;
  
  // Custom limits when admin enables competition creation via override
  // Only applies when competitionCreationOverride === 'enabled'
  overrideLimits?: {
    maxCompetitionsPerDay?: number;
    maxUsersPerCompetition?: number;
  };
  
  // Usage Tracking
  currentPeriodCompetitionsCreated: number;   // Reset daily
  lastCompetitionResetDate: Date;             // When competitions were last reset
  totalCompetitionsCreated: number;           // Lifetime count
  
  // Earnings & Stats
  totalEarnings: number;                // Lifetime earnings from referrals
  pendingEarnings: number;              // Earnings not yet paid out
  totalReferredUsers: number;           // Total users referred
  activeReferredUsers: number;          // Users who are still active
  
  // History
  renewalHistory: {
    date: Date;
    amount: number;
    transactionId: string;
    status: 'success' | 'failed';
    failureReason?: string;
  }[];
  
  // Pause State (user can pause to stop earning fees but keep subscription)
  isPaused: boolean;                     // If true, GM won't earn referral fees
  pausedAt?: Date;
  pauseReason?: string;
  
  // Scheduled Cancellation (user can schedule deletion after expiry)
  scheduledForDeletion: boolean;         // If true, will be deleted after expiry
  scheduledDeletionAt?: Date;            // When the schedule was set
  
  // Suspension/Cancellation
  suspendedAt?: Date;
  suspendedReason?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const GameMasterSubscriptionSchema = new Schema<IGameMasterSubscription>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,  // One game master subscription per user
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    packageId: {
      type: String,
      required: true,
    },
    packageName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'expired', 'cancelled', 'suspended'],
      default: 'active',
      index: true,
    },
    activatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    nextRenewalDate: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      required: true,
      default: true,
    },
    renewalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    referralLink: {
      type: String,
    },
    limits: {
      maxCompetitionsPerDay: {
        type: Number,
        required: true,
        default: 1,
      },
      maxUsersPerCompetition: {
        type: Number,
        required: true,
        default: 50,
      },
      referralFeePercentage: {
        type: Number,
        required: true,
        default: 5,  // 5% by default
        min: 0,
        max: 50,
      },
      canCreateCompetitions: {
        type: Boolean,
        required: true,
        default: true,  // By default, GMs can create competitions
      },
      canEarnFromChallenges: {
        type: Boolean,
        required: true,
        default: false,  // By default, GMs don't earn from challenges (backward compatible)
      },
      challengeReferralFeePercentage: {
        type: Number,
        min: 0,
        max: 50,
      },
    },
    competitionCreationOverride: {
      type: String,
      enum: ['enabled', 'disabled', null],
      default: null,  // null = use package setting
    },
    overrideLimits: {
      maxCompetitionsPerDay: {
        type: Number,
        min: 1,
      },
      maxUsersPerCompetition: {
        type: Number,
        min: 2,
      },
    },
    currentPeriodCompetitionsCreated: {
      type: Number,
      required: true,
      default: 0,
    },
    lastCompetitionResetDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    totalCompetitionsCreated: {
      type: Number,
      required: true,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      required: true,
      default: 0,
    },
    pendingEarnings: {
      type: Number,
      required: true,
      default: 0,
    },
    totalReferredUsers: {
      type: Number,
      required: true,
      default: 0,
    },
    activeReferredUsers: {
      type: Number,
      required: true,
      default: 0,
    },
    renewalHistory: [{
      date: { type: Date, required: true },
      amount: { type: Number, required: true },
      transactionId: { type: String, required: true },
      status: { type: String, enum: ['success', 'failed'], required: true },
      failureReason: { type: String },
    }],
    isPaused: {
      type: Boolean,
      required: true,
      default: false,
    },
    pausedAt: Date,
    pauseReason: String,
    scheduledForDeletion: {
      type: Boolean,
      required: true,
      default: false,
    },
    scheduledDeletionAt: Date,
    suspendedAt: Date,
    suspendedReason: String,
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
GameMasterSubscriptionSchema.index({ status: 1, nextRenewalDate: 1 });  // For renewal job
GameMasterSubscriptionSchema.index({ status: 1, endDate: 1 });  // For expiry checks
GameMasterSubscriptionSchema.index({ totalEarnings: -1 });  // For leaderboards

// Virtual for checking if subscription is currently valid (can access GM dashboard)
GameMasterSubscriptionSchema.virtual('isValid').get(function() {
  return this.status === 'active' && this.endDate > new Date();
});

// Virtual for checking if GM can earn referral fees (not paused)
GameMasterSubscriptionSchema.virtual('canEarnFees').get(function() {
  return this.status === 'active' && this.endDate > new Date() && !this.isPaused;
});

// Virtual for days remaining
GameMasterSubscriptionSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'active') return 0;
  const now = new Date();
  const diff = this.endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual to determine if GM can create competitions (considers override and package setting)
GameMasterSubscriptionSchema.virtual('canCreateCompetitions').get(function() {
  // Admin override takes precedence
  if (this.competitionCreationOverride === 'enabled') return true;
  if (this.competitionCreationOverride === 'disabled') return false;
  // Fall back to package setting
  return this.limits?.canCreateCompetitions ?? true;
});

// Static method to generate unique referral code
GameMasterSubscriptionSchema.statics.generateReferralCode = function(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // Removed confusing chars
  let code = 'GM';  // Prefix for Game Master
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const GameMasterSubscription =
  models?.GameMasterSubscription || 
  model<IGameMasterSubscription>('GameMasterSubscription', GameMasterSubscriptionSchema);

export default GameMasterSubscription;
