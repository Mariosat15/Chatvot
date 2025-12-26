import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Admin/Company Bank Account Model
 * Stores company bank accounts used for processing withdrawals/payouts
 * 
 * These are the company's bank accounts (not user accounts)
 * Used to track which bank account processes user withdrawals
 */

export interface IAdminBankAccount extends Document {
  // Bank Account Details
  accountName: string;              // Friendly name (e.g., "Main Business Account")
  accountHolderName: string;        // Full name on bank account
  
  // Bank Details
  bankName: string;                 // Bank name
  country: string;                  // ISO 3166-1 alpha-2 country code
  currency: string;                 // Currency code (e.g., 'eur', 'usd')
  
  // Account Numbers
  iban?: string;                    // IBAN (for SEPA countries)
  accountNumber?: string;           // Account number (for non-SEPA)
  routingNumber?: string;           // Routing/sort code
  swiftBic?: string;                // SWIFT/BIC code
  
  // Status
  isDefault: boolean;               // Is this the default withdrawal account?
  isActive: boolean;                // Is this account active?
  
  // Usage Statistics
  totalWithdrawals: number;         // Total withdrawals processed
  totalAmount: number;              // Total amount processed
  lastUsedAt?: Date;                // Last time this account was used
  
  // Metadata
  notes?: string;                   // Internal notes
  addedBy?: string;                 // Admin who added this account
  
  createdAt: Date;
  updatedAt: Date;
}

interface IAdminBankAccountModel extends Model<IAdminBankAccount> {
  getDefaultAccount(): Promise<IAdminBankAccount | null>;
  getActiveAccounts(): Promise<IAdminBankAccount[]>;
}

const AdminBankAccountSchema = new Schema<IAdminBankAccount>(
  {
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
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
    iban: {
      type: String,
      trim: true,
      uppercase: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    routingNumber: {
      type: String,
      trim: true,
    },
    swiftBic: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalWithdrawals: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: Date,
    notes: String,
    addedBy: String,
  },
  {
    timestamps: true,
  }
);

// Static method to get default account
AdminBankAccountSchema.statics.getDefaultAccount = async function(): Promise<IAdminBankAccount | null> {
  return this.findOne({ isDefault: true, isActive: true });
};

// Static method to get all active accounts
AdminBankAccountSchema.statics.getActiveAccounts = async function(): Promise<IAdminBankAccount[]> {
  return this.find({ isActive: true }).sort({ isDefault: -1, accountName: 1 });
};

// Ensure only one default account
AdminBankAccountSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Unset default on all other accounts
    await mongoose.model('AdminBankAccount').updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

const AdminBankAccount = 
  mongoose.models?.AdminBankAccount || 
  mongoose.model<IAdminBankAccount, IAdminBankAccountModel>('AdminBankAccount', AdminBankAccountSchema);

export default AdminBankAccount;

