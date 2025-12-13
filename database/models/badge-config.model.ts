import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBadgeConfig extends Document {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  condition: {
    type: string;
    value?: number;
    minValue?: number;
    maxValue?: number;
    comparison?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BadgeConfigSchema = new Schema<IBadgeConfig>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Competition',
        'Volume',
        'Profit',
        'Risk',
        'Speed',
        'Consistency',
        'Strategy',
        'Social',
        'Legendary',
      ],
    },
    icon: {
      type: String,
      required: true,
      default: '🏆',
    },
    rarity: {
      type: String,
      required: true,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
    condition: {
      type: {
        type: String,
        required: true,
      },
      value: Number,
      minValue: Number,
      maxValue: Number,
      comparison: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create or get the model
const BadgeConfig: Model<IBadgeConfig> =
  mongoose.models.BadgeConfig || mongoose.model<IBadgeConfig>('BadgeConfig', BadgeConfigSchema);

export default BadgeConfig;

