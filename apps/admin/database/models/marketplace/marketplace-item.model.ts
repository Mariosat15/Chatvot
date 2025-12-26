import mongoose, { Document, Schema, Model } from 'mongoose';

// Item Categories - Indicators and Strategies
export type ItemCategory = 'indicator' | 'strategy';

// Item Status
export type ItemStatus = 'active' | 'inactive' | 'coming_soon' | 'deprecated';

// Indicator Types (chart implementations)
export type IndicatorType = 
  | 'sma' 
  | 'ema' 
  | 'bb'
  | 'rsi'
  | 'macd'
  | 'support_resistance';

// Strategy Condition Operators
export type ConditionOperator = 
  | 'above'       // value > threshold
  | 'below'       // value < threshold
  | 'crosses_above' // value crosses above threshold
  | 'crosses_below' // value crosses below threshold
  | 'between'     // min < value < max
  | 'equals';     // value == threshold

// Strategy Signal Types
export type SignalType = 'buy' | 'sell' | 'strong_buy' | 'strong_sell' | 'neutral';

// Strategy Condition - a single rule
export interface IStrategyCondition {
  id: string;
  indicator: string;        // e.g., 'price', 'sma', 'ema', 'rsi', 'macd', 'bb_upper', 'bb_lower', 'bb_middle'
  indicatorParams?: Record<string, number>; // e.g., { period: 20 }
  operator: ConditionOperator;
  compareWith: 'value' | 'indicator'; // Compare with fixed value or another indicator
  compareValue?: number;    // Fixed value to compare with
  compareIndicator?: string; // Another indicator to compare with
  compareIndicatorParams?: Record<string, number>;
}

// Strategy Rule - combines conditions with AND/OR logic
export interface IStrategyRule {
  id: string;
  name: string;
  conditions: IStrategyCondition[];
  logic: 'AND' | 'OR'; // How to combine conditions
  signal: SignalType;
  signalStrength: number; // 1-5, used for arrow size
}

// Full Strategy Configuration
export interface IStrategyConfig {
  rules: IStrategyRule[];
  defaultIndicators: string[]; // Which indicators to auto-enable
  signalDisplay: {
    showOnChart: boolean;
    showArrows: boolean;
    showLabels: boolean;
    arrowSize: 'small' | 'medium' | 'large';
  };
}

export interface IMarketplaceItem extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Basic Info
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  category: ItemCategory;
  
  // Pricing
  price: number; // In credits
  originalPrice?: number; // For showing discounts
  isFree: boolean;
  
  // Status & Visibility
  status: ItemStatus;
  isPublished: boolean;
  isFeatured: boolean;
  
  // Media
  iconUrl?: string;
  thumbnailUrl?: string;
  screenshots?: string[];
  
  // Technical Details
  version: string;
  indicatorType?: IndicatorType; // For indicator items
  strategyConfig?: IStrategyConfig; // For strategy items
  
  // The actual code/configuration (JSON string)
  codeTemplate: string;
  defaultSettings: Record<string, any>;
  
  // Supported assets (empty = all)
  supportedAssets: string[];
  
  // Stats
  totalPurchases: number;
  totalActiveUsers: number;
  averageRating: number;
  totalRatings: number;
  
  // Tags for search/filter
  tags: string[];
  
  // Risk info
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  riskWarning?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const StrategyConditionSchema = new Schema({
  id: { type: String, required: true },
  indicator: { type: String, required: true },
  indicatorParams: { type: Schema.Types.Mixed },
  operator: { 
    type: String, 
    required: true,
    enum: ['above', 'below', 'crosses_above', 'crosses_below', 'between', 'equals']
  },
  compareWith: { type: String, enum: ['value', 'indicator'], default: 'value' },
  compareValue: { type: Number },
  compareIndicator: { type: String },
  compareIndicatorParams: { type: Schema.Types.Mixed },
}, { _id: false });

const StrategyRuleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  conditions: [StrategyConditionSchema],
  logic: { type: String, enum: ['AND', 'OR'], default: 'AND' },
  signal: { 
    type: String, 
    required: true,
    enum: ['buy', 'sell', 'strong_buy', 'strong_sell', 'neutral']
  },
  signalStrength: { type: Number, min: 1, max: 5, default: 3 },
}, { _id: false });

const StrategyConfigSchema = new Schema({
  rules: [StrategyRuleSchema],
  defaultIndicators: [String],
  signalDisplay: {
    showOnChart: { type: Boolean, default: true },
    showArrows: { type: Boolean, default: true },
    showLabels: { type: Boolean, default: true },
    arrowSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
  },
}, { _id: false });

const MarketplaceItemSchema = new Schema<IMarketplaceItem>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: true,
      maxlength: 200,
    },
    fullDescription: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      enum: ['indicator', 'strategy'],
      default: 'indicator',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    isFree: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'coming_soon', 'deprecated'],
      default: 'active',
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    iconUrl: String,
    thumbnailUrl: String,
    screenshots: [String],
    version: {
      type: String,
      default: '1.0.0',
    },
    indicatorType: {
      type: String,
      enum: ['sma', 'ema', 'bb', 'rsi', 'macd', 'support_resistance'],
    },
    strategyConfig: StrategyConfigSchema,
    codeTemplate: {
      type: String,
      required: true,
      default: '{}',
    },
    defaultSettings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    supportedAssets: {
      type: [String],
      default: [],
    },
    totalPurchases: {
      type: Number,
      default: 0,
    },
    totalActiveUsers: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'very_high'],
      default: 'medium',
    },
    riskWarning: String,
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: slug already has unique index from schema definition (unique: true)
MarketplaceItemSchema.index({ category: 1, isPublished: 1, status: 1 });
MarketplaceItemSchema.index({ tags: 1 });
MarketplaceItemSchema.index({ isFeatured: 1 });

export const MarketplaceItem: Model<IMarketplaceItem> =
  mongoose.models.MarketplaceItem || mongoose.model<IMarketplaceItem>('MarketplaceItem', MarketplaceItemSchema);
