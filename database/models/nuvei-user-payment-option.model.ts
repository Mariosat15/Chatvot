import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Nuvei User Payment Option (UPO) Model
 * Stores user payment options from Nuvei for both:
 * - Card refunds (from deposits)
 * - Bank payouts (from /accountCapture)
 * 
 * When a user makes a deposit with Nuvei, their card is tokenized and stored as a UPO.
 * When a user adds a bank account via /accountCapture, it's also stored as a UPO.
 * These UPOs can be used later for withdrawals.
 */

export interface INuveiUserPaymentOption extends Document {
  userId: string;
  userPaymentOptionId: string;  // Nuvei's UPO ID
  type: 'card' | 'bank';        // Type of payment option
  
  // Card-specific fields
  cardBrand?: string;           // Visa, Mastercard, etc.
  cardLast4?: string;           // Last 4 digits
  expMonth?: string;            // Expiration month
  expYear?: string;             // Expiration year
  uniqueCC?: string;            // Unique card identifier (fingerprint)
  
  // Bank-specific fields
  paymentMethod?: string;       // e.g., 'apmgw_BankPayouts'
  bankName?: string;            // Bank name if available
  ibanLast4?: string;           // Last 4 digits of IBAN
  accountHolderName?: string;   // Account holder name
  countryCode?: string;         // Country code (CY, DE, etc.)
  currencyCode?: string;        // Currency code (EUR, USD, etc.)
  
  lastUsed: Date;               // Last time this UPO was used
  createdFromTransactionId?: string;  // Transaction that created this UPO
  registrationDate?: string;    // From Nuvei's upoRegistrationDate
  isActive: boolean;            // Whether this UPO is still valid
  createdAt: Date;
  updatedAt: Date;
}

interface INuveiUserPaymentOptionModel extends Model<INuveiUserPaymentOption> {
  getActiveUPOs(userId: string): Promise<INuveiUserPaymentOption[]>;
  getMostRecentUPO(userId: string): Promise<INuveiUserPaymentOption | null>;
}

const NuveiUserPaymentOptionSchema = new Schema<INuveiUserPaymentOption>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userPaymentOptionId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['card', 'bank'],
      default: 'card',
    },
    // Card-specific fields
    cardBrand: String,
    cardLast4: String,
    expMonth: String,
    expYear: String,
    uniqueCC: String,
    // Bank-specific fields
    paymentMethod: String,
    bankName: String,
    ibanLast4: String,
    accountHolderName: String,
    countryCode: String,
    currencyCode: String,
    // Common fields
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    createdFromTransactionId: String,
    registrationDate: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
NuveiUserPaymentOptionSchema.index({ userId: 1, userPaymentOptionId: 1 }, { unique: true });
NuveiUserPaymentOptionSchema.index({ userId: 1, isActive: 1, lastUsed: -1 });

// Static: Get all active UPOs for a user
NuveiUserPaymentOptionSchema.statics.getActiveUPOs = async function (
  userId: string
): Promise<INuveiUserPaymentOption[]> {
  return this.find({ userId, isActive: true }).sort({ lastUsed: -1 });
};

// Static: Get the most recently used UPO for a user
NuveiUserPaymentOptionSchema.statics.getMostRecentUPO = async function (
  userId: string
): Promise<INuveiUserPaymentOption | null> {
  return this.findOne({ userId, isActive: true }).sort({ lastUsed: -1 });
};

const NuveiUserPaymentOption =
  (mongoose.models?.NuveiUserPaymentOption as unknown as INuveiUserPaymentOptionModel) ||
  mongoose.model<INuveiUserPaymentOption, INuveiUserPaymentOptionModel>(
    'NuveiUserPaymentOption',
    NuveiUserPaymentOptionSchema
  );

export default NuveiUserPaymentOption;

