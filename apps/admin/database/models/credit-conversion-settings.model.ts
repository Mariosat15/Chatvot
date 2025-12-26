import mongoose, { Document, Model, Schema } from 'mongoose';

// Interface for the static methods
interface ICreditConversionSettingsModel extends Model<ICreditConversionSettings> {
  getSingleton(): Promise<ICreditConversionSettings>;
}

export interface ICreditConversionSettings extends Document {
  eurToCreditsRate: number; // How many credits for 1 EUR (e.g., 100 credits = 1 EUR)
  minimumDeposit: number; // Minimum EUR deposit amount
  minimumWithdrawal: number; // Minimum EUR withdrawal amount
  
  // Platform Fees (what platform charges users)
  platformDepositFeePercentage: number; // Fee platform charges on deposits (e.g., 2%)
  platformWithdrawalFeePercentage: number; // Fee platform charges on withdrawals (e.g., 2%)
  
  // Bank/Provider Fees (what payment providers charge platform)
  bankDepositFeePercentage: number; // What Stripe/provider charges for deposits (e.g., 2.9%)
  bankDepositFeeFixed: number; // Fixed fee per deposit in EUR (e.g., 0.30)
  bankWithdrawalFeePercentage: number; // What bank charges for payouts (e.g., 0.25%)
  bankWithdrawalFeeFixed: number; // Fixed fee per withdrawal in EUR (e.g., 0.25)
  
  // Legacy field for backward compatibility
  withdrawalFeePercentage: number; // Deprecated - use platformWithdrawalFeePercentage
  
  lastUpdated: Date;
  updatedBy: string;
}

const CreditConversionSettingsSchema = new Schema<ICreditConversionSettings>(
  {
    _id: {
      type: Schema.Types.Mixed,
      default: 'global-credit-conversion',
    },
    eurToCreditsRate: {
      type: Number,
      required: true,
      default: 100, // 100 credits = 1 EUR
      min: 1,
      max: 10000,
    },
    minimumDeposit: {
      type: Number,
      required: true,
      default: 10, // 10 EUR minimum
      min: 1,
    },
    minimumWithdrawal: {
      type: Number,
      required: true,
      default: 20, // 20 EUR minimum
      min: 1,
    },
    
    // Platform Fees (what platform charges users)
    platformDepositFeePercentage: {
      type: Number,
      required: true,
      default: 2, // 2% platform deposit fee
      min: 0,
      max: 50,
    },
    platformWithdrawalFeePercentage: {
      type: Number,
      required: true,
      default: 2, // 2% platform withdrawal fee
      min: 0,
      max: 50,
    },
    
    // Bank/Provider Fees (what payment providers charge platform)
    bankDepositFeePercentage: {
      type: Number,
      required: true,
      default: 2.9, // Stripe typically charges 2.9%
      min: 0,
      max: 20,
    },
    bankDepositFeeFixed: {
      type: Number,
      required: true,
      default: 0.30, // Stripe charges €0.30 fixed
      min: 0,
      max: 10,
    },
    bankWithdrawalFeePercentage: {
      type: Number,
      required: true,
      default: 0.25, // Bank payout fees
      min: 0,
      max: 20,
    },
    bankWithdrawalFeeFixed: {
      type: Number,
      required: true,
      default: 0.25, // Fixed per payout
      min: 0,
      max: 10,
    },
    
    // Legacy field for backward compatibility
    withdrawalFeePercentage: {
      type: Number,
      required: true,
      default: 2, // Deprecated - use platformWithdrawalFeePercentage
      min: 0,
      max: 20,
    },
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
CreditConversionSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findById('global-credit-conversion');
  
  if (!settings) {
    settings = await this.create({
      _id: 'global-credit-conversion',
      eurToCreditsRate: 100,
      minimumDeposit: 10,
      minimumWithdrawal: 20,
      // Platform fees
      platformDepositFeePercentage: 2,
      platformWithdrawalFeePercentage: 2,
      // Bank fees (Stripe defaults)
      bankDepositFeePercentage: 2.9,
      bankDepositFeeFixed: 0.30,
      bankWithdrawalFeePercentage: 0.25,
      bankWithdrawalFeeFixed: 0.25,
      // Legacy
      withdrawalFeePercentage: 2,
    });
  }
  
  return settings;
};

const CreditConversionSettings =
  (mongoose.models?.CreditConversionSettings as unknown as ICreditConversionSettingsModel) ||
  mongoose.model<ICreditConversionSettings, ICreditConversionSettingsModel>('CreditConversionSettings', CreditConversionSettingsSchema);

export default CreditConversionSettings;

