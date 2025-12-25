import { Schema, model, models, Document } from 'mongoose';

// Credit Wallet for users to buy credits and enter competitions/challenges
export interface ICreditWallet extends Document {
  userId: string; // Reference to Better Auth user ID
  creditBalance: number; // Current credit balance (1 credit = 1 EUR)
  totalDeposited: number; // Lifetime deposits
  totalWithdrawn: number; // Lifetime withdrawals
  totalSpentOnCompetitions: number; // Total spent on competition entries
  totalWonFromCompetitions: number; // Total winnings from competitions
  totalSpentOnChallenges: number; // Total spent on 1v1 challenges
  totalWonFromChallenges: number; // Total winnings from 1v1 challenges
  isActive: boolean; // Wallet status
  
  // KYC Fields
  kycVerified: boolean; // KYC verification status (required for withdrawals)
  kycStatus: 'none' | 'pending' | 'approved' | 'declined' | 'expired';
  kycVerifiedAt?: Date;
  kycExpiresAt?: Date;
  kycAttempts: number;
  lastKYCSessionId?: string;
  
  withdrawalEnabled: boolean; // Can user withdraw?
  createdAt: Date;
  updatedAt: Date;
}

const CreditWalletSchema = new Schema<ICreditWallet>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    creditBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalDeposited: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalWithdrawn: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalSpentOnCompetitions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalWonFromCompetitions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalSpentOnChallenges: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalWonFromChallenges: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    kycVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'declined', 'expired'],
      default: 'none',
    },
    kycVerifiedAt: {
      type: Date,
    },
    kycExpiresAt: {
      type: Date,
    },
    kycAttempts: {
      type: Number,
      default: 0,
    },
    lastKYCSessionId: {
      type: String,
    },
    withdrawalEnabled: {
      type: Boolean,
      required: true,
      default: true, // Enable by default - admin settings control actual eligibility
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
// Note: userId already has unique index from schema definition (unique: true)
CreditWalletSchema.index({ isActive: 1 });

// Virtual for total profit/loss
CreditWalletSchema.virtual('totalProfitLoss').get(function () {
  return this.totalWonFromCompetitions - this.totalSpentOnCompetitions;
});

// Virtual for ROI
CreditWalletSchema.virtual('roi').get(function () {
  if (this.totalSpentOnCompetitions === 0) return 0;
  return (
    ((this.totalWonFromCompetitions - this.totalSpentOnCompetitions) /
      this.totalSpentOnCompetitions) *
    100
  );
});

const CreditWallet =
  models?.CreditWallet || model<ICreditWallet>('CreditWallet', CreditWalletSchema);

export default CreditWallet;

