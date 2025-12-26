import { Schema, model, models, Document } from 'mongoose';

export interface IUserBadge extends Document {
  userId: string;
  badgeId: string;
  earnedAt: Date;
  progress: number; // 0-100 for partially completed badges
  metadata?: {
    competitionId?: string;
    tradeId?: string;
    value?: number;
    [key: string]: unknown;
  };
}

const UserBadgeSchema = new Schema<IUserBadge>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    badgeId: {
      type: String,
      required: true,
      index: true,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for userId + badgeId to prevent duplicates
UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

const UserBadge = models.UserBadge || model<IUserBadge>('UserBadge', UserBadgeSchema);

export default UserBadge;

