import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Nuvei User Payment Option (UPO) Model
 * Stores user payment options from Nuvei for card refunds
 * 
 * When a user makes a deposit with Nuvei, their card is tokenized and stored as a UPO.
 * This UPO can be used later for withdrawals (card refunds).
 */

export interface INuveiUserPaymentOption extends Document {
  userId: string;
  userPaymentOptionId: string;  // Nuvei's UPO ID
  cardBrand?: string;           // Visa, Mastercard, etc.
  cardLast4?: string;           // Last 4 digits
  expMonth?: string;            // Expiration month
  expYear?: string;             // Expiration year
  uniqueCC?: string;            // Unique card identifier (fingerprint)
  lastUsed: Date;               // Last time this UPO was used
  createdFromTransactionId?: string;  // Transaction that created this UPO
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
    cardBrand: String,
    cardLast4: String,
    expMonth: String,
    expYear: String,
    uniqueCC: String,
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    createdFromTransactionId: String,
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

