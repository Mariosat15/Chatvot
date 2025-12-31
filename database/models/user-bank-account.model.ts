import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * User Bank Account Model
 * Stores user's bank account details for withdrawals/payouts
 * 
 * Stripe requires bank accounts for payouts (not cards!)
 * We store the details and optionally create Stripe external accounts
 */

export interface IUserBankAccount extends Document {
  // User Reference
  userId: string;
  
  // Bank Account Details
  accountHolderName: string;           // Full name on bank account
  accountHolderType: 'individual' | 'company';
  
  // Bank Details
  bankName?: string;                   // Bank name (optional)
  country: string;                     // ISO 3166-1 alpha-2 country code (e.g., 'DE', 'NL')
  currency: string;                    // Currency code (e.g., 'eur', 'usd')
  
  // Account Numbers (encrypted/masked in display)
  iban?: string;                       // IBAN (for SEPA countries)
  ibanLast4?: string;                  // Last 4 characters for display
  accountNumber?: string;              // Account number (for non-SEPA)
  accountNumberLast4?: string;         // Last 4 digits for display
  routingNumber?: string;              // Routing/sort code (for some countries)
  swiftBic?: string;                   // SWIFT/BIC code
  
  // Stripe Integration
  stripeExternalAccountId?: string;    // Stripe's external account ID (ba_xxx)
  stripeConnectedAccountId?: string;   // If using Stripe Connect
  stripeAccountStatus?: string;        // Stripe account verification status
  
  // Nuvei Integration (for automatic bank payouts)
  nuveiUpoId?: string;                 // Nuvei's UPO ID from addSepaUpo
  nuveiStatus?: string;                // 'active', 'pending', or error message
  nuveiUserPaymentOptionId?: string;   // Legacy: Nuvei's UPO ID from /accountCapture
  nuveiRegistrationDate?: string;      // When UPO was created
  
  // Verification
  isVerified: boolean;                 // Has this account been verified?
  verifiedAt?: Date;
  verificationMethod?: string;         // How it was verified
  
  // Status
  isDefault: boolean;                  // Is this the default payout account?
  isActive: boolean;                   // Is this account active for withdrawals?
  
  // Metadata
  nickname?: string;                   // User-friendly name (e.g., "My Main Account")
  addedAt: Date;
  lastUsedAt?: Date;
  lastPayoutId?: string;               // Last successful payout ID
  totalPayouts: number;                // Number of successful payouts
  totalPayoutAmount: number;           // Total amount paid out (EUR)
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

interface IUserBankAccountModel extends Model<IUserBankAccount> {
  getDefaultAccount(userId: string): Promise<IUserBankAccount | null>;
  getUserAccounts(userId: string): Promise<IUserBankAccount[]>;
}

const UserBankAccountSchema = new Schema<IUserBankAccount>(
  {
    // User Reference
    userId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Account Holder Details
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    accountHolderType: {
      type: String,
      enum: ['individual', 'company'],
      default: 'individual',
    },
    
    // Bank Details
    bankName: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      default: 'eur',
    },
    
    // Account Numbers (store full values - display masked)
    iban: {
      type: String,
      trim: true,
      uppercase: true,
    },
    ibanLast4: String,
    accountNumber: {
      type: String,
      trim: true,
    },
    accountNumberLast4: String,
    routingNumber: {
      type: String,
      trim: true,
    },
    swiftBic: {
      type: String,
      trim: true,
      uppercase: true,
    },
    
    // Stripe Integration
    stripeExternalAccountId: String,
    stripeConnectedAccountId: String,
    stripeAccountStatus: String,
    
    // Nuvei Integration (for automatic bank payouts)
    nuveiUpoId: String,
    nuveiStatus: {
      type: String,
      default: 'pending',
    },
    nuveiUserPaymentOptionId: String,  // Legacy
    nuveiRegistrationDate: String,
    
    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    verificationMethod: String,
    
    // Status
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Metadata
    nickname: String,
    addedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: Date,
    lastPayoutId: String,
    totalPayouts: {
      type: Number,
      default: 0,
    },
    totalPayoutAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserBankAccountSchema.index({ userId: 1, isDefault: 1 });
UserBankAccountSchema.index({ userId: 1, isActive: 1 });
UserBankAccountSchema.index({ stripeExternalAccountId: 1 });

// Pre-save: Generate last4 values and ensure only one default
UserBankAccountSchema.pre('save', async function (next) {
  // Generate last4 values
  if (this.iban && this.isModified('iban')) {
    this.ibanLast4 = this.iban.slice(-4);
  }
  if (this.accountNumber && this.isModified('accountNumber')) {
    this.accountNumberLast4 = this.accountNumber.slice(-4);
  }
  
  // If setting as default, unset other defaults for this user
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('UserBankAccount').updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  
  next();
});

// Static: Get user's default bank account
UserBankAccountSchema.statics.getDefaultAccount = async function (
  userId: string
): Promise<IUserBankAccount | null> {
  return this.findOne({ userId, isDefault: true, isActive: true });
};

// Static: Get all user's active bank accounts
UserBankAccountSchema.statics.getUserAccounts = async function (
  userId: string
): Promise<IUserBankAccount[]> {
  return this.find({ userId, isActive: true }).sort({ isDefault: -1, addedAt: -1 });
};

const UserBankAccount =
  (mongoose.models?.UserBankAccount as unknown as IUserBankAccountModel) ||
  mongoose.model<IUserBankAccount, IUserBankAccountModel>('UserBankAccount', UserBankAccountSchema);

export default UserBankAccount;

