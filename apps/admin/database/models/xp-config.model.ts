import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IXPConfig extends Document {
  configType: 'badge_xp' | 'level_progression';
  data: {
    // For badge_xp type
    common?: number;
    rare?: number;
    epic?: number;
    legendary?: number;
    
    // For level_progression type
    levels?: Array<{
      level: number;
      title: string;
      minXP: number;
      maxXP: number;
      icon: string;
      color: string;
      description: string;
    }>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const XPConfigSchema = new Schema<IXPConfig>(
  {
    configType: {
      type: String,
      required: true,
      enum: ['badge_xp', 'level_progression'],
      unique: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
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
const XPConfig: Model<IXPConfig> =
  mongoose.models.XPConfig || mongoose.model<IXPConfig>('XPConfig', XPConfigSchema);

export default XPConfig;

