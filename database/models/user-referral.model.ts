import { Schema, model, models, Document } from 'mongoose';

/**
 * User Referral Model
 * Tracks which users were referred by which Game Master
 */

export interface IUserReferral extends Document {
  userId: string;                   // The user who was referred (Better Auth user ID)
  userEmail: string;                // Cached email
  userName?: string;                // Cached name
  
  gameMasterId: string;             // The Game Master who referred them
  gameMasterEmail: string;          // Cached GM email
  referralCode: string;             // The code that was used
  
  // Attribution
  referredAt: Date;                 // When they signed up
  signupIP?: string;                // IP at signup (for fraud detection)
  signupUserAgent?: string;         // Browser info (for fraud detection)
  
  // Activity tracking
  isActive: boolean;                // Is the referred user still active?
  lastActivityAt?: Date;            // Last time they participated in competition/challenge
  totalEntryFees: number;           // Total entry fees this user has paid
  totalGMEarnings: number;          // Total earnings generated for their GM
  competitionsEntered: number;      // Number of competitions entered
  challengesEntered: number;        // Number of challenges entered
  
  createdAt: Date;
  updatedAt: Date;
}

const UserReferralSchema = new Schema<IUserReferral>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
    },
    gameMasterId: {
      type: String,
      required: true,
      index: true,
    },
    gameMasterEmail: {
      type: String,
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      index: true,
    },
    referredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    signupIP: String,
    signupUserAgent: String,
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    lastActivityAt: Date,
    totalEntryFees: {
      type: Number,
      required: true,
      default: 0,
    },
    totalGMEarnings: {
      type: Number,
      required: true,
      default: 0,
    },
    competitionsEntered: {
      type: Number,
      required: true,
      default: 0,
    },
    challengesEntered: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
UserReferralSchema.index({ gameMasterId: 1, referredAt: -1 });  // GM's referred users sorted by date
UserReferralSchema.index({ gameMasterId: 1, isActive: 1 });  // GM's active referred users
UserReferralSchema.index({ gameMasterId: 1, totalGMEarnings: -1 });  // GM's top earners

const UserReferral =
  models?.UserReferral || 
  model<IUserReferral>('UserReferral', UserReferralSchema);

export default UserReferral;
