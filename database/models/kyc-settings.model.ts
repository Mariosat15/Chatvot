import { Schema, model, models, Document } from 'mongoose';

export interface IKYCSettings extends Document {
  // KYC Enable/Disable
  enabled: boolean;
  
  // When KYC is required
  requiredForWithdrawal: boolean;
  requiredForDeposit: boolean;
  requiredAmount: number; // Require KYC for withdrawals above this amount (0 = always)
  
  // Veriff API Configuration
  veriffApiKey: string;
  veriffApiSecret: string;
  veriffBaseUrl: string;
  
  // Verification Options
  allowedDocumentTypes: string[];
  allowedCountries: string[];
  
  // Auto-actions
  autoApproveOnSuccess: boolean;
  autoSuspendOnFail: boolean;
  maxVerificationAttempts: number;
  
  // Expiry
  sessionExpiryMinutes: number;
  verificationValidDays: number; // How long a successful verification is valid
  
  // Messages
  kycRequiredMessage: string;
  kycPendingMessage: string;
  kycApprovedMessage: string;
  kycDeclinedMessage: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const KYCSettingsSchema = new Schema<IKYCSettings>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    requiredForWithdrawal: {
      type: Boolean,
      default: true,
    },
    requiredForDeposit: {
      type: Boolean,
      default: false,
    },
    requiredAmount: {
      type: Number,
      default: 0, // 0 means always required if enabled
    },
    veriffApiKey: {
      type: String,
      default: '',
    },
    veriffApiSecret: {
      type: String,
      default: '',
    },
    veriffBaseUrl: {
      type: String,
      default: 'https://stationapi.veriff.com',
    },
    allowedDocumentTypes: {
      type: [String],
      default: ['PASSPORT', 'ID_CARD', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT'],
    },
    allowedCountries: {
      type: [String],
      default: [], // Empty = all countries allowed
    },
    autoApproveOnSuccess: {
      type: Boolean,
      default: true,
    },
    autoSuspendOnFail: {
      type: Boolean,
      default: false,
    },
    maxVerificationAttempts: {
      type: Number,
      default: 3,
    },
    sessionExpiryMinutes: {
      type: Number,
      default: 30,
    },
    verificationValidDays: {
      type: Number,
      default: 365, // 1 year
    },
    kycRequiredMessage: {
      type: String,
      default: 'Identity verification is required to proceed with this action.',
    },
    kycPendingMessage: {
      type: String,
      default: 'Your identity verification is being processed. This usually takes a few minutes.',
    },
    kycApprovedMessage: {
      type: String,
      default: 'Your identity has been successfully verified!',
    },
    kycDeclinedMessage: {
      type: String,
      default: 'Your identity verification was declined. Please contact support for assistance.',
    },
  },
  {
    timestamps: true,
  }
);

// Singleton pattern - only one settings document
KYCSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const KYCSettings = models?.KYCSettings || model<IKYCSettings>('KYCSettings', KYCSettingsSchema);

export default KYCSettings;

