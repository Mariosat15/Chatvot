import { Schema, model, models, Document } from 'mongoose';

/**
 * Platform Financials Model
 * Tracks all platform earnings, unclaimed pools, admin withdrawals, and financial metrics
 */

// Individual platform earning/withdrawal transaction
export interface IPlatformTransaction extends Document {
  transactionType: 
    | 'unclaimed_pool'           // Competition pool with no winners
    | 'platform_fee'             // Fee from competition winnings
    | 'challenge_platform_fee'   // Fee from 1v1 challenge
    | 'deposit_fee'              // Fee from user deposits
    | 'withdrawal_fee'           // Fee from user withdrawals
    | 'admin_withdrawal'         // Admin withdrawing platform earnings to bank
    | 'admin_adjustment'         // Manual adjustment
    | 'refund_clawback'          // Refund that returns funds to platform
    | 'incident_compensation'    // Platform expense for compensating users due to incidents
    | 'admin_balance_add'        // Admin adding funds to operating balance
    | 'custom_expense';          // Custom expense (e.g., marketing, software, etc.)
  
  amount: number;                 // Amount in credits (positive = platform gains, negative = platform pays out)
  amountEUR: number;              // EUR equivalent at time of transaction
  
  // Source reference
  sourceType?: 'competition' | 'challenge' | 'user_deposit' | 'user_withdrawal' | 'manual' | 'incident';
  sourceId?: string;              // Competition ID, Transaction ID, Incident ID, etc.
  sourceName?: string;            // Competition name, user email, incident title, etc.
  
  // For unclaimed pools
  unclaimedReason?: 
    | 'no_participants'
    | 'all_disqualified'
    | 'no_qualified_winners'
    | 'partial_unclaimed'         // Some prize positions unfilled
    | 'competition_cancelled';
  originalPoolAmount?: number;
  winnersCount?: number;
  expectedWinnersCount?: number;
  
  // For admin withdrawals
  bankDetails?: {
    accountNumber?: string;       // Last 4 digits only
    bankName?: string;
    reference?: string;
    withdrawnBy?: string;         // Admin who withdrew
  };
  
  // For deposit/withdrawal fees
  userId?: string;                // User who triggered the fee
  feeDetails?: {
    depositAmount?: number;       // Original deposit amount
    withdrawalAmount?: number;    // Original withdrawal amount
    platformFee: number;          // What platform charged user
    bankFee: number;              // What bank/Stripe charged platform
    netEarning: number;           // Platform's actual earning (platform fee - bank fee)
  };
  
  // For incident compensations (platform expense)
  compensationDetails?: {
    incidentId: string;           // Reference to the incident
    incidentType: string;         // Type of incident (price_feed_failure, etc.)
    affectedUsersCount: number;   // Number of users compensated
    compensationPerUser?: number; // Amount per user (if uniform)
    resolutionType: string;       // partial_refund, full_refund, etc.
    competitionId?: string;       // Related competition if any
    competitionName?: string;
  };
  
  // For admin balance additions
  balanceAddDetails?: {
    source: string;               // Where the money came from (e.g., "Bank transfer", "Personal funds")
    reference?: string;           // Transfer reference number
  };
  
  // For custom expenses
  expenseDetails?: {
    category: string;             // Expense category (marketing, software, legal, etc.)
    vendor?: string;              // Who was paid (if applicable)
    invoiceNumber?: string;       // Invoice/receipt number
    paymentMethod?: string;       // How it was paid
  };
  
  description: string;
  notes?: string;
  
  // Metadata
  processedBy?: string;           // Admin ID who processed
  processedByEmail?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Aggregated platform balance snapshot (updated periodically)
export interface IPlatformBalanceSnapshot extends Document {
  snapshotDate: Date;
  
  // User Liabilities (what platform owes users)
  totalUserCredits: number;       // Sum of all user wallet balances
  totalUserCreditsEUR: number;
  
  // Platform Earnings
  totalUnclaimedPools: number;    // Cumulative unclaimed pool earnings
  totalPlatformFees: number;      // Cumulative platform fees (competition, deposit, withdrawal)
  totalDepositFees: number;
  totalWithdrawalFees: number;
  
  // Admin Withdrawals
  totalAdminWithdrawals: number;  // How much admin has withdrawn to bank
  
  // Net Calculations
  platformNetBalance: number;     // Earnings - Withdrawals
  theoreticalBankBalance: number; // What should be in bank: Deposits - UserWithdrawals - AdminWithdrawals
  
  // Risk Metrics
  coverageRatio: number;          // Platform assets / User liabilities (should be >= 1)
  
  createdAt: Date;
}

const PlatformTransactionSchema = new Schema<IPlatformTransaction>(
  {
    transactionType: {
      type: String,
      required: true,
      enum: [
        'unclaimed_pool',
        'platform_fee',
        'challenge_platform_fee',
        'deposit_fee',
        'withdrawal_fee',
        'admin_withdrawal',
        'admin_adjustment',
        'refund_clawback',
        'incident_compensation',
        'admin_balance_add',
        'custom_expense',
      ],
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    amountEUR: {
      type: Number,
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['competition', 'challenge', 'user_deposit', 'user_withdrawal', 'manual', 'incident'],
    },
    sourceId: String,
    sourceName: String,
    unclaimedReason: {
      type: String,
      enum: [
        'no_participants',
        'all_disqualified',
        'no_qualified_winners',
        'partial_unclaimed',
        'competition_cancelled',
      ],
    },
    originalPoolAmount: Number,
    winnersCount: Number,
    expectedWinnersCount: Number,
    bankDetails: {
      accountNumber: String,
      bankName: String,
      reference: String,
      withdrawnBy: String,
    },
    userId: {
      type: String,
      index: true,
    },
    feeDetails: {
      depositAmount: Number,
      withdrawalAmount: Number,
      platformFee: Number,
      bankFee: Number,
      netEarning: Number,
    },
    compensationDetails: {
      incidentId: String,
      incidentType: String,
      affectedUsersCount: Number,
      compensationPerUser: Number,
      resolutionType: String,
      competitionId: String,
      competitionName: String,
    },
    balanceAddDetails: {
      source: String,
      reference: String,
    },
    expenseDetails: {
      category: String,
      vendor: String,
      invoiceNumber: String,
      paymentMethod: String,
    },
    description: {
      type: String,
      required: true,
    },
    notes: String,
    processedBy: String,
    processedByEmail: String,
  },
  {
    timestamps: true,
  }
);

const PlatformBalanceSnapshotSchema = new Schema<IPlatformBalanceSnapshot>(
  {
    snapshotDate: {
      type: Date,
      required: true,
      index: true,
    },
    totalUserCredits: {
      type: Number,
      required: true,
      default: 0,
    },
    totalUserCreditsEUR: {
      type: Number,
      required: true,
      default: 0,
    },
    totalUnclaimedPools: {
      type: Number,
      required: true,
      default: 0,
    },
    totalPlatformFees: {
      type: Number,
      required: true,
      default: 0,
    },
    totalDepositFees: {
      type: Number,
      required: true,
      default: 0,
    },
    totalWithdrawalFees: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAdminWithdrawals: {
      type: Number,
      required: true,
      default: 0,
    },
    platformNetBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    theoreticalBankBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    coverageRatio: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PlatformTransactionSchema.index({ transactionType: 1, createdAt: -1 });
PlatformTransactionSchema.index({ sourceType: 1, sourceId: 1 });
PlatformTransactionSchema.index({ createdAt: -1 });

PlatformBalanceSnapshotSchema.index({ snapshotDate: -1 });

export const PlatformTransaction =
  models?.PlatformTransaction ||
  model<IPlatformTransaction>('PlatformTransaction', PlatformTransactionSchema);

export const PlatformBalanceSnapshot =
  models?.PlatformBalanceSnapshot ||
  model<IPlatformBalanceSnapshot>('PlatformBalanceSnapshot', PlatformBalanceSnapshotSchema);

export default PlatformTransaction;

