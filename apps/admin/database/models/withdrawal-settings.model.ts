import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Withdrawal Settings Model (Singleton)
 * Controls withdrawal behavior across the platform
 */

export interface IWithdrawalSettings extends Document {
  // Processing Mode
  processingMode: 'automatic' | 'manual';  // automatic = system processes, manual = admin processes
  
  // Withdrawal Limits
  minimumWithdrawal: number;               // Minimum EUR withdrawal amount
  maximumWithdrawal: number;               // Maximum EUR per single withdrawal
  dailyWithdrawalLimit: number;            // Maximum EUR per day per user
  monthlyWithdrawalLimit: number;          // Maximum EUR per month per user
  
  // Timing
  processingTimeHours: number;             // Expected processing time (for user display)
  cooldownHours: number;                   // Hours between withdrawal requests
  
  // Fees (if different from credit-conversion-settings)
  useCustomFees: boolean;                  // Use these fees instead of credit-conversion fees
  platformFeePercentage: number;           // Platform's withdrawal fee (%)
  platformFeeFixed: number;                // Fixed fee per withdrawal (EUR)
  
  // Requirements
  requireKYC: boolean;                     // Require KYC verification before withdrawal
  requireEmailVerification: boolean;       // Require verified email
  minimumAccountAge: number;               // Days since account creation
  minimumDepositRequired: boolean;         // User must have deposited at least once
  
  // Restrictions
  allowPartialWithdrawal: boolean;         // Allow withdrawing partial balance
  allowWithdrawalDuringActiveCompetitions: boolean;  // Allow if user has active positions
  blockWithdrawalOnActiveChallenges: boolean;        // Block if user has pending challenges
  
  // Fraud Prevention
  maxWithdrawalsPerDay: number;            // Maximum withdrawal requests per day
  maxWithdrawalsPerMonth: number;          // Maximum withdrawal requests per month
  holdPeriodAfterDeposit: number;          // Hours to wait after deposit before withdrawal
  
  // API Rate Limiting (spam protection)
  apiRateLimitRequestsPerMinute: number;   // Max API requests per minute per user (0 = unlimited)
  apiRateLimitEnabled: boolean;            // Enable/disable API rate limiting
  
  // Payout Methods
  allowedPayoutMethods: string[];          // ['stripe_refund', 'stripe_payout', 'bank_transfer', 'original_method']
  preferredPayoutMethod: string;           // Default payout method
  
  // Sandbox Mode
  sandboxEnabled: boolean;                 // Enable withdrawals in sandbox mode
  sandboxAutoApprove: boolean;             // Auto-approve sandbox withdrawals
  
  // Withdrawal Methods
  bankWithdrawalsEnabled: boolean;         // Enable bank transfer withdrawals for users
  cardWithdrawalsEnabled: boolean;         // Enable card payout/refund withdrawals for users
  
  // Nuvei Automatic Processing
  nuveiWithdrawalEnabled: boolean;         // Enable automatic processing via Nuvei
  nuveiPreferCardRefund: boolean;          // Prefer refunding to original card over bank transfer
  
  // Manual Mode with Payment Processor
  // When enabled in manual mode: User requests → Nuvei (PENDING) → Admin approves → Nuvei processes payment
  // When disabled in manual mode: User requests → Admin approves → Admin manually sends money
  usePaymentProcessorForManual: boolean;   // Use Nuvei for manual withdrawals (create pending requests in Nuvei)
  
  // Notifications
  notifyAdminOnRequest: boolean;           // Email admin on new withdrawal request
  notifyAdminOnHighValue: boolean;         // Email admin on high-value withdrawals
  highValueThreshold: number;              // EUR threshold for high-value notification
  
  // Auto-approval rules (for automatic mode)
  autoApproveEnabled: boolean;             // Enable auto-approval for qualifying withdrawals
  autoApproveMaxAmount: number;            // Maximum EUR for auto-approval
  autoApproveRequireKYC: boolean;          // Require KYC for auto-approval
  autoApproveMinAccountAge: number;        // Minimum account age (days) for auto-approval
  autoApproveMinSuccessfulWithdrawals: number;  // Minimum previous successful withdrawals
  
  // Metadata
  lastUpdated: Date;
  updatedBy: string;
}

interface IWithdrawalSettingsModel extends Model<IWithdrawalSettings> {
  getSingleton(): Promise<IWithdrawalSettings>;
  updateSingleton(updates: Partial<IWithdrawalSettings>, updatedBy?: string): Promise<IWithdrawalSettings>;
}

const WithdrawalSettingsSchema = new Schema<IWithdrawalSettings>(
  {
    _id: {
      type: Schema.Types.Mixed,
      default: 'global-withdrawal-settings',
    },
    
    // Processing Mode
    processingMode: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'manual',
    },
    
    // Withdrawal Limits
    minimumWithdrawal: {
      type: Number,
      default: 20,
      min: 1,
    },
    maximumWithdrawal: {
      type: Number,
      default: 10000,
      min: 1,
    },
    dailyWithdrawalLimit: {
      type: Number,
      default: 5000,
      min: 0,
    },
    monthlyWithdrawalLimit: {
      type: Number,
      default: 50000,
      min: 0,
    },
    
    // Timing
    processingTimeHours: {
      type: Number,
      default: 24,
      min: 0,
    },
    cooldownHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Fees
    useCustomFees: {
      type: Boolean,
      default: false,
    },
    platformFeePercentage: {
      type: Number,
      default: 2,
      min: 0,
      max: 50,
    },
    platformFeeFixed: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Requirements
    requireKYC: {
      type: Boolean,
      default: false,  // KYC optional by default, will be enabled when KYC system is ready
    },
    requireEmailVerification: {
      type: Boolean,
      default: true,
    },
    minimumAccountAge: {
      type: Number,
      default: 0,  // Days
      min: 0,
    },
    minimumDepositRequired: {
      type: Boolean,
      default: true,
    },
    
    // Restrictions
    allowPartialWithdrawal: {
      type: Boolean,
      default: true,
    },
    allowWithdrawalDuringActiveCompetitions: {
      type: Boolean,
      default: true,
    },
    blockWithdrawalOnActiveChallenges: {
      type: Boolean,
      default: true,
    },
    
    // Fraud Prevention
    maxWithdrawalsPerDay: {
      type: Number,
      default: 3,
      min: 1,
    },
    maxWithdrawalsPerMonth: {
      type: Number,
      default: 20,
      min: 1,
    },
    holdPeriodAfterDeposit: {
      type: Number,
      default: 0,  // Hours
      min: 0,
    },
    
    // API Rate Limiting (spam protection)
    apiRateLimitEnabled: {
      type: Boolean,
      default: true,  // Enabled by default for security
    },
    apiRateLimitRequestsPerMinute: {
      type: Number,
      default: 5,  // 5 requests per minute per user
      min: 1,
      max: 100,
    },
    
    // Payout Methods
    allowedPayoutMethods: {
      type: [String],
      default: ['original_method', 'stripe_payout'],
    },
    preferredPayoutMethod: {
      type: String,
      default: 'original_method',
    },
    
    // Sandbox Mode
    sandboxEnabled: {
      type: Boolean,
      default: true,
    },
    sandboxAutoApprove: {
      type: Boolean,
      default: true,
    },
    
    // Withdrawal Methods
    bankWithdrawalsEnabled: {
      type: Boolean,
      default: true,  // Bank transfers enabled by default
    },
    cardWithdrawalsEnabled: {
      type: Boolean,
      default: true,  // Card payouts enabled by default
    },
    
    // Nuvei Automatic Processing
    nuveiWithdrawalEnabled: {
      type: Boolean,
      default: false,  // Disabled by default, admin must enable
    },
    nuveiPreferCardRefund: {
      type: Boolean,
      default: true,  // Prefer refunding to original card
    },
    
    // Manual Mode with Payment Processor
    // When enabled: Withdrawal requests are sent to Nuvei, admin approval triggers Nuvei payout
    // When disabled: Pure manual mode - admin processes withdrawals outside the system
    usePaymentProcessorForManual: {
      type: Boolean,
      default: false,  // Pure manual mode by default
    },
    
    // Notifications
    notifyAdminOnRequest: {
      type: Boolean,
      default: true,
    },
    notifyAdminOnHighValue: {
      type: Boolean,
      default: true,
    },
    highValueThreshold: {
      type: Number,
      default: 1000,
      min: 0,
    },
    
    // Auto-approval rules
    autoApproveEnabled: {
      type: Boolean,
      default: false,
    },
    autoApproveMaxAmount: {
      type: Number,
      default: 100,
      min: 0,
    },
    autoApproveRequireKYC: {
      type: Boolean,
      default: true,
    },
    autoApproveMinAccountAge: {
      type: Number,
      default: 30,  // Days
      min: 0,
    },
    autoApproveMinSuccessfulWithdrawals: {
      type: Number,
      default: 1,
      min: 0,
    },
    
    // Metadata
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get or create singleton
WithdrawalSettingsSchema.statics.getSingleton = async function (): Promise<IWithdrawalSettings> {
  const SINGLETON_ID = 'global-withdrawal-settings';
  let settings = await this.findById(SINGLETON_ID);
  
  if (!settings) {
    settings = await this.create({
      _id: SINGLETON_ID,
    });
  }
  
  return settings;
};

// Static method to update singleton
WithdrawalSettingsSchema.statics.updateSingleton = async function (
  updates: Partial<IWithdrawalSettings>,
  updatedBy: string = 'system'
): Promise<IWithdrawalSettings> {
  const SINGLETON_ID = 'global-withdrawal-settings';
  
  const settings = await this.findByIdAndUpdate(
    SINGLETON_ID,
    {
      ...updates,
      lastUpdated: new Date(),
      updatedBy,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );
  
  return settings;
};

const WithdrawalSettings =
  (mongoose.models?.WithdrawalSettings as unknown as IWithdrawalSettingsModel) ||
  mongoose.model<IWithdrawalSettings, IWithdrawalSettingsModel>('WithdrawalSettings', WithdrawalSettingsSchema);

export default WithdrawalSettings;

