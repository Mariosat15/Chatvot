import { Schema, model, models, Document } from 'mongoose';

export interface IPaymentProviderCredential {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

export interface IPaymentProvider extends Document {
  name: string;
  slug: string; // clerk, stripe, polar, paddle, etc.
  displayName: string;
  logo?: string;
  isActive: boolean;
  isBuiltIn: boolean; // true for Clerk, Stripe, Polar, Paddle
  saveToEnv: boolean; // whether to write credentials to .env file
  credentials: IPaymentProviderCredential[];
  webhookUrl?: string;
  testMode: boolean;
  processingFee: number; // percentage (e.g., 1.5 for 1.5%)
  priority: number; // for ordering
  createdAt: Date;
  updatedAt: Date;
}

const PaymentProviderSchema = new Schema<IPaymentProvider>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true, // Explicitly set index here, remove duplicate below
    },
    displayName: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isBuiltIn: {
      type: Boolean,
      default: false,
    },
    saveToEnv: {
      type: Boolean,
      default: true,
    },
    credentials: [
      {
        key: { type: String, required: true },
        value: { type: String, default: '' },
        isSecret: { type: Boolean, default: true },
        description: { type: String, default: '' },
      },
    ],
    webhookUrl: {
      type: String,
      default: '',
    },
    testMode: {
      type: Boolean,
      default: true,
    },
    processingFee: {
      type: Number,
      default: 0,
      min: 0,
      max: 100, // Max 100%
    },
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index only (slug index is already created by unique: true)
PaymentProviderSchema.index({ isActive: 1, priority: -1 });

const PaymentProvider =
  models?.PaymentProvider ||
  model<IPaymentProvider>('PaymentProvider', PaymentProviderSchema);

export default PaymentProvider;

