import { Schema, model, models, Document, Model } from 'mongoose';

// Interface for the static methods
interface IChallengeSettingsModel extends Model<IChallengeSettings> {
  getSingleton(): Promise<IChallengeSettings>;
}

// Admin settings for 1v1 Challenges - Only challenge-specific settings
// Trading settings (leverage, position size, margin) come from TradingRiskSettings (universal)
// Ranking rules come from competition rules (universal)
export interface IChallengeSettings extends Document {
  // Platform Fee
  platformFeePercentage: number; // % taken by platform from prize pool
  
  // Entry Fee Limits
  minEntryFee: number; // Minimum entry fee in credits
  maxEntryFee: number; // Maximum entry fee in credits
  
  // Starting Capital Options
  defaultStartingCapital: number;
  minStartingCapital: number;
  maxStartingCapital: number;
  
  // Duration Limits
  minDurationMinutes: number; // Minimum challenge duration
  maxDurationMinutes: number; // Maximum challenge duration
  defaultDurationMinutes: number;
  
  // Accept Deadline
  acceptDeadlineMinutes: number; // How long challenged user has to accept
  
  // Asset Classes allowed in challenges
  defaultAssetClasses: ('stocks' | 'forex' | 'crypto' | 'indices')[];
  
  // Feature Toggles
  challengesEnabled: boolean; // Master switch to enable/disable challenges
  requireBothOnline: boolean; // Both users must be online to start
  allowChallengeWhileInCompetition: boolean; // Allow users in competitions to challenge
  
  // Cooldowns
  challengeCooldownMinutes: number; // Cooldown between sending challenges to same user
  maxPendingChallenges: number; // Max pending challenges a user can have
  maxActiveChallenges: number; // Max active challenges at once
  
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeSettingsSchema = new Schema<IChallengeSettings>(
  {
    platformFeePercentage: {
      type: Number,
      required: true,
      default: 10, // 10% platform fee
      min: 0,
      max: 50,
    },
    minEntryFee: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
    },
    maxEntryFee: {
      type: Number,
      required: true,
      default: 1000,
      min: 1,
    },
    defaultStartingCapital: {
      type: Number,
      required: true,
      default: 10000,
      min: 100,
    },
    minStartingCapital: {
      type: Number,
      required: true,
      default: 1000,
      min: 100,
    },
    maxStartingCapital: {
      type: Number,
      required: true,
      default: 100000,
      min: 100,
    },
    minDurationMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 1,
    },
    maxDurationMinutes: {
      type: Number,
      required: true,
      default: 1440, // 24 hours
      min: 1,
    },
    defaultDurationMinutes: {
      type: Number,
      required: true,
      default: 60,
      min: 1,
    },
    acceptDeadlineMinutes: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
    },
    defaultAssetClasses: [
      {
        type: String,
        enum: ['stocks', 'forex', 'crypto', 'indices'],
      },
    ],
    challengesEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    requireBothOnline: {
      type: Boolean,
      required: true,
      default: false,
    },
    allowChallengeWhileInCompetition: {
      type: Boolean,
      required: true,
      default: true,
    },
    challengeCooldownMinutes: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },
    maxPendingChallenges: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
    },
    maxActiveChallenges: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Singleton pattern - only one settings document
ChallengeSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      defaultAssetClasses: ['stocks', 'forex', 'crypto', 'indices'],
    });
  }
  return settings;
};

const ChallengeSettings =
  (models?.ChallengeSettings as IChallengeSettingsModel) ||
  model<IChallengeSettings, IChallengeSettingsModel>('ChallengeSettings', ChallengeSettingsSchema);

export default ChallengeSettings;
