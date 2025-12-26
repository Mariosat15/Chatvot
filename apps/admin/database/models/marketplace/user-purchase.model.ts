import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUserPurchase extends Document {
  _id: mongoose.Types.ObjectId;
  
  userId: string;
  itemId: mongoose.Types.ObjectId;
  
  // Purchase details
  pricePaid: number; // Credits paid
  purchasedAt: Date;
  transactionId?: string; // Reference to WalletTransaction
  
  // Status
  isEnabled: boolean; // User can enable/disable purchased items
  
  // User's custom settings for this item
  customSettings: Record<string, any>;
  
  // Usage stats
  totalUsageTime: number; // In minutes
  lastUsedAt?: Date;
  totalTradesExecuted: number; // For bots
  
  // Rating given by user
  userRating?: number;
  userReview?: string;
  reviewedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserPurchaseSchema = new Schema<IUserPurchase>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'MarketplaceItem',
      required: true,
    },
    pricePaid: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    transactionId: String,
    isEnabled: {
      type: Boolean,
      default: true,
    },
    customSettings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    totalUsageTime: {
      type: Number,
      default: 0,
    },
    lastUsedAt: Date,
    totalTradesExecuted: {
      type: Number,
      default: 0,
    },
    userRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    userReview: {
      type: String,
      maxlength: 1000,
    },
    reviewedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index for user + item (each user can only purchase an item once)
UserPurchaseSchema.index({ userId: 1, itemId: 1 }, { unique: true });
UserPurchaseSchema.index({ userId: 1, isEnabled: 1 });

export const UserPurchase: Model<IUserPurchase> =
  mongoose.models.UserPurchase || mongoose.model<IUserPurchase>('UserPurchase', UserPurchaseSchema);

