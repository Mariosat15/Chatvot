import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Withdrawal Request Model
 * Tracks all user withdrawal requests and their processing status
 */

export interface IWithdrawalRequest extends Document {
  // User Info
  userId: string;
  userEmail: string;
  userName?: string;
  
  // Amount Details
  amountCredits: number;           // Amount in credits requested
  amountEUR: number;               // Equivalent EUR amount
  exchangeRate: number;            // Credits to EUR rate at time of request
  
  // Fees
  platformFee: number;             // Platform fee (EUR)
  platformFeeCredits: number;      // Platform fee (credits)
  bankFee: number;                 // Estimated bank/provider fee (EUR)
  netAmountEUR: number;            // Final amount user receives (EUR)
  
  // Status
  status: 
    | 'pending'          // Waiting for admin review (manual) or processing (automatic)
    | 'approved'         // Admin approved, waiting for payout
    | 'processing'       // Payout in progress
    | 'completed'        // Successfully paid out
    | 'rejected'         // Admin rejected
    | 'cancelled'        // User cancelled
    | 'failed';          // Payout failed
  
  // Rejection/Failure Details
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
  failureReason?: string;
  failureDetails?: string;
  
  // Payout Details
  payoutMethod: string;            // 'stripe_refund', 'stripe_payout', 'bank_transfer', 'original_method'
  payoutProvider?: string;         // 'stripe', 'paypal', etc.
  payoutId?: string;               // External payout ID (Stripe transfer ID, etc.)
  payoutStatus?: string;           // Provider's payout status
  
  // Original Payment Reference (for refunds to original method)
  originalPaymentId?: string;      // Original Stripe payment intent ID
  originalPaymentMethod?: string;  // Original payment method type
  
  // Stripe Connect (for direct payouts to user's connected account)
  stripeConnectedAccountId?: string;  // User's Stripe Connect account ID
  
  // Payout Card (for instant payouts to debit card)
  payoutCardId?: string;              // Saved card ID for instant payouts
  payoutCardLast4?: string;           // Last 4 digits for display
  
  // Bank Details (for bank transfers)
  bankDetails?: {
    accountHolderName?: string;
    iban?: string;                 // Last 4 characters only for security
    bankName?: string;
    swiftBic?: string;
  };
  
  // Processing Info
  processedBy?: string;            // Admin ID who processed
  processedByEmail?: string;       // Admin email
  processedAt?: Date;              // When processing started
  completedAt?: Date;              // When payout completed
  
  // Company Bank Used (for tracking which bank processed the withdrawal)
  companyBankUsed?: {
    bankId?: string;               // Admin bank account ID
    accountName?: string;          // Account name/nickname
    accountHolderName?: string;    // Account holder name
    bankName?: string;             // Bank name
    iban?: string;                 // IBAN (masked)
    accountNumber?: string;        // Account number (masked)
    country?: string;              // Bank country
    currency?: string;             // Currency
  };
  
  // Auto-approval
  isAutoApproved: boolean;         // Was this auto-approved?
  autoApprovalReason?: string;     // Why it qualified for auto-approval
  
  // Wallet Transaction Reference
  walletTransactionId?: string;    // Reference to WalletTransaction
  
  // User's Wallet State at Request Time
  walletBalanceBefore: number;     // User's credit balance before request
  walletBalanceAfter: number;      // User's credit balance after request (pending: same, completed: deducted)
  
  // Fraud/Risk Info
  riskScore?: number;              // Fraud risk score (0-100)
  riskFlags?: string[];            // Any risk flags raised
  ipAddress?: string;              // IP at time of request
  userAgent?: string;              // Browser/device info
  
  // Sandbox/Production
  isSandbox: boolean;              // Is this a sandbox withdrawal?
  
  // Notes
  userNote?: string;               // User's note/reason
  adminNote?: string;              // Admin's internal note
  
  // KYC Status at Time of Request
  kycVerified: boolean;
  kycVerifiedAt?: Date;
  
  // Timestamps
  requestedAt: Date;               // When user submitted request
  expiresAt?: Date;                // Request expiration (if applicable)
  createdAt: Date;
  updatedAt: Date;
}

interface IWithdrawalRequestModel extends Model<IWithdrawalRequest> {
  getPendingCount(userId?: string): Promise<number>;
  getDailyTotal(userId: string): Promise<number>;
  getMonthlyTotal(userId: string): Promise<number>;
  getUserWithdrawalCount(userId: string, days: number): Promise<number>;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    // User Info
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: String,
    
    // Amount Details
    amountCredits: {
      type: Number,
      required: true,
      min: 0,
    },
    amountEUR: {
      type: Number,
      required: true,
      min: 0,
    },
    exchangeRate: {
      type: Number,
      required: true,
      default: 1,
    },
    
    // Fees
    platformFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    platformFeeCredits: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    bankFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmountEUR: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Status
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'cancelled', 'failed'],
      default: 'pending',
      index: true,
    },
    
    // Rejection/Failure Details
    rejectionReason: String,
    rejectedBy: String,
    rejectedAt: Date,
    failureReason: String,
    failureDetails: String,
    
    // Payout Details
    payoutMethod: {
      type: String,
      required: true,
      default: 'original_method',
    },
    payoutProvider: String,
    payoutId: String,
    payoutStatus: String,
    
    // Original Payment Reference
    originalPaymentId: String,
    originalPaymentMethod: String,
    
    // Stripe Connect
    stripeConnectedAccountId: String,
    
    // Payout Card
    payoutCardId: String,
    payoutCardLast4: String,
    
    // Bank Details
    bankDetails: {
      accountHolderName: String,
      iban: String,
      bankName: String,
      swiftBic: String,
    },
    
    // Processing Info
    processedBy: String,
    processedByEmail: String,
    processedAt: Date,
    completedAt: Date,
    
    // Company Bank Used (which company bank account processed this withdrawal)
    companyBankUsed: {
      bankId: String,
      accountName: String,
      accountHolderName: String,
      bankName: String,
      iban: String,
      accountNumber: String,
      country: String,
      currency: String,
    },
    
    // Auto-approval
    isAutoApproved: {
      type: Boolean,
      default: false,
    },
    autoApprovalReason: String,
    
    // Wallet Transaction Reference
    walletTransactionId: String,
    
    // Wallet State
    walletBalanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    walletBalanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Fraud/Risk Info
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    riskFlags: [String],
    ipAddress: String,
    userAgent: String,
    
    // Sandbox/Production
    isSandbox: {
      type: Boolean,
      default: false,
    },
    
    // Notes
    userNote: String,
    adminNote: String,
    
    // KYC Status
    kycVerified: {
      type: Boolean,
      default: false,
    },
    kycVerifiedAt: Date,
    
    // Timestamps
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
WithdrawalRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ isSandbox: 1, status: 1 });
WithdrawalRequestSchema.index({ requestedAt: -1 });
WithdrawalRequestSchema.index({ payoutId: 1 });

// Static: Get count of pending requests
WithdrawalRequestSchema.statics.getPendingCount = async function (userId?: string): Promise<number> {
  const query: any = { status: { $in: ['pending', 'approved', 'processing'] } };
  if (userId) query.userId = userId;
  return this.countDocuments(query);
};

// Static: Get user's daily withdrawal total (EUR)
WithdrawalRequestSchema.statics.getDailyTotal = async function (userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const result = await this.aggregate([
    {
      $match: {
        userId,
        status: { $in: ['pending', 'approved', 'processing', 'completed'] },
        requestedAt: { $gte: startOfDay },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amountEUR' },
      },
    },
  ]);
  
  return result[0]?.total || 0;
};

// Static: Get user's monthly withdrawal total (EUR)
WithdrawalRequestSchema.statics.getMonthlyTotal = async function (userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const result = await this.aggregate([
    {
      $match: {
        userId,
        status: { $in: ['pending', 'approved', 'processing', 'completed'] },
        requestedAt: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amountEUR' },
      },
    },
  ]);
  
  return result[0]?.total || 0;
};

// Static: Get user's withdrawal count in last N days
WithdrawalRequestSchema.statics.getUserWithdrawalCount = async function (
  userId: string,
  days: number
): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.countDocuments({
    userId,
    status: { $in: ['pending', 'approved', 'processing', 'completed'] },
    requestedAt: { $gte: startDate },
  });
};

const WithdrawalRequest =
  (mongoose.models?.WithdrawalRequest as unknown as IWithdrawalRequestModel) ||
  mongoose.model<IWithdrawalRequest, IWithdrawalRequestModel>('WithdrawalRequest', WithdrawalRequestSchema);

export default WithdrawalRequest;

