import mongoose, { Document, Schema, Model } from "mongoose";

// Item Categories - Indicators, Strategies, Cosmetics, and Game Master Packages
export type ItemCategory = "indicator" | "strategy" | "cosmetic" | "gamemaster";

// Cosmetic Types
export type CosmeticType = "avatar" | "profile_frame" | "badge" | "title";

// Item Status
export type ItemStatus = "active" | "inactive" | "coming_soon" | "deprecated";

// Indicator Types (chart implementations)
export type IndicatorType =
  // Moving Averages
  | "sma" | "ema" | "wma" | "dema" | "tema" | "hma"
  | "alma" | "kama" | "zlema" | "t3" | "smma" | "lsma" | "vidya" | "mcginley"
  // Bands / Channels
  | "bb" | "keltner" | "donchian" | "ichimoku"
  | "linreg_channel" | "ma_envelope" | "price_channel" | "chandelier"
  // Oscillators
  | "rsi" | "macd" | "stoch" | "williamsR" | "cci" | "adx" | "mfi" | "atr"
  | "obv" | "roc" | "cmf" | "momentum"
  | "ultimate_osc" | "awesome_osc" | "stochrsi" | "tsi" | "ppo"
  | "fisher" | "connors_rsi" | "smi_ergodic"
  // Trend
  | "supertrend" | "aroon" | "vortex" | "trix" | "dpo" | "kst" | "coppock" | "elder_ray"
  // Volatility
  | "std_dev" | "hist_volatility" | "chaikin_volatility" | "mass_index" | "ulcer_index" | "rvi"
  // Volume
  | "vwap" | "vwma" | "ad_line" | "force_index" | "eom" | "nvi" | "pvi"
  // Other
  | "sar" | "pivots" | "support_resistance"
  // Premium Marketplace-Only Indicators (40)
  | "trend_pulse" | "market_regime" | "trend_composite" | "composite_breadth"
  | "reversal_signal" | "predictive_range" | "breakout_prob" | "sentiment_osc"
  | "whale_accumulation" | "smart_money_flow" | "volume_climax" | "net_buying_pressure"
  | "order_flow_imbalance" | "intraday_intensity" | "volume_momentum" | "liquidity_heatmap"
  | "volatility_squeeze" | "squeeze_momentum" | "volatility_ratio" | "range_expansion"
  | "choppy_market" | "fractal_dimension" | "acceleration_bands" | "adaptive_channel"
  | "alpha_momentum" | "efficiency_ratio" | "trend_persistence" | "mtf_momentum"
  | "momentum_wave" | "gap_momentum" | "heikin_ashi_trend" | "cycle_detector"
  | "adaptive_rsi" | "mean_reversion_band" | "trend_ribbon" | "relative_vigor"
  | "dynamic_pivots" | "price_action_score" | "ergodic_volume" | "anchored_vwap_bands"
  // Premium overlays
  | "nexus_trend_matrix"
  | "phantom_flow_zones"
  | "fractal_pulse_grid"
  | "vortex_drift_cloud"
  | "orion_momentum_shield"
  | "nebula_phase_bands"
  | "cipher_harmonic_veil"
  | "titan_pulse_signal"
  | "aurora_cascade_flow"
  | "eclipse_stealth_trail"
  | "wraith_convergence_engine"
  | "flux_momentum_trail"
  | "apex_predator_signal"
  | "phantom_divergence_tracker"
  | "chaos_sentinel";

// Strategy Condition Operators
export type ConditionOperator =
  | "above" // value > threshold
  | "below" // value < threshold
  | "crosses_above" // value crosses above threshold
  | "crosses_below" // value crosses below threshold
  | "between" // min < value < max
  | "equals"; // value == threshold

// Strategy Signal Types
export type SignalType =
  | "buy"
  | "sell"
  | "strong_buy"
  | "strong_sell"
  | "neutral";

// Strategy Condition - a single rule
export interface IStrategyCondition {
  id: string;
  indicator: string; // e.g., 'price', 'sma', 'ema', 'rsi', 'macd', 'bb_upper', 'bb_lower', 'bb_middle'
  indicatorParams?: Record<string, number>; // e.g., { period: 20 }
  operator: ConditionOperator;
  compareWith: "value" | "indicator"; // Compare with fixed value or another indicator
  compareValue?: number; // Fixed value to compare with
  compareIndicator?: string; // Another indicator to compare with
  compareIndicatorParams?: Record<string, number>;
}

// Strategy Rule - combines conditions with AND/OR logic
export interface IStrategyRule {
  id: string;
  name: string;
  conditions: IStrategyCondition[];
  logic: "AND" | "OR"; // How to combine conditions
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
    arrowSize: "small" | "medium" | "large";
  };
}

// Game Master Package Configuration
export interface IGameMasterConfig {
  maxCompetitionsPerDay: number; // How many competitions GM can create per day
  maxUsersPerCompetition: number; // Max participants in GM-created competitions
  referralFeePercentage: number; // % of entry fees from referred users in competitions (e.g., 5 = 5%)
  subscriptionDurationDays: number; // Subscription period (typically 30 for monthly)
  canCreateCompetitions: boolean; // Whether this package allows GM to create competitions
  canEarnFromChallenges: boolean; // Whether GM earns referral fees from 1v1 challenges
  challengeReferralFeePercentage?: number; // Optional separate % for challenges (defaults to referralFeePercentage if not set)
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

  // Image stored in DB (base64) for multi-server / deployment persistence
  imageData?: string; // base64-encoded image
  imageContentType?: string; // e.g., "image/webp"

  // Technical Details
  version: string;
  indicatorType?: IndicatorType; // For indicator items
  strategyConfig?: IStrategyConfig; // For strategy items
  cosmeticType?: CosmeticType; // For cosmetic items (avatar, frame, etc.)
  imageUrl?: string; // Image URL for any item type
  iconName?: string; // Lucide icon name for non-cosmetic items
  gameMasterConfig?: IGameMasterConfig; // For gamemaster subscription packages

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
  riskLevel: "low" | "medium" | "high" | "very_high";
  riskWarning?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const StrategyConditionSchema = new Schema(
  {
    id: { type: String, required: true },
    indicator: { type: String, required: true },
    indicatorParams: { type: Schema.Types.Mixed },
    operator: {
      type: String,
      required: true,
      enum: [
        "above",
        "below",
        "crosses_above",
        "crosses_below",
        "between",
        "equals",
      ],
    },
    compareWith: {
      type: String,
      enum: ["value", "indicator"],
      default: "value",
    },
    compareValue: { type: Number },
    compareIndicator: { type: String },
    compareIndicatorParams: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const StrategyRuleSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    conditions: [StrategyConditionSchema],
    logic: { type: String, enum: ["AND", "OR"], default: "AND" },
    signal: {
      type: String,
      required: true,
      enum: ["buy", "sell", "strong_buy", "strong_sell", "neutral"],
    },
    signalStrength: { type: Number, min: 1, max: 5, default: 3 },
  },
  { _id: false },
);

const StrategyConfigSchema = new Schema(
  {
    rules: [StrategyRuleSchema],
    defaultIndicators: [String],
    signalDisplay: {
      showOnChart: { type: Boolean, default: true },
      showArrows: { type: Boolean, default: true },
      showLabels: { type: Boolean, default: true },
      arrowSize: {
        type: String,
        enum: ["small", "medium", "large"],
        default: "medium",
      },
    },
  },
  { _id: false },
);

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
      enum: ["indicator", "strategy", "cosmetic", "gamemaster"],
      default: "indicator",
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
      enum: ["active", "inactive", "coming_soon", "deprecated"],
      default: "active",
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
      default: "1.0.0",
    },
    indicatorType: {
      type: String,
      enum: ["sma","ema","wma","dema","tema","hma","alma","kama","zlema","t3","smma","lsma","vidya","mcginley","bb","keltner","donchian","ichimoku","linreg_channel","ma_envelope","price_channel","chandelier","rsi","macd","stoch","williamsR","cci","adx","mfi","atr","obv","roc","cmf","momentum","ultimate_osc","awesome_osc","stochrsi","tsi","ppo","fisher","connors_rsi","smi_ergodic","supertrend","aroon","vortex","trix","dpo","kst","coppock","elder_ray","std_dev","hist_volatility","chaikin_volatility","mass_index","ulcer_index","rvi","vwap","vwma","ad_line","force_index","eom","nvi","pvi","sar","pivots","support_resistance","trend_pulse","market_regime","trend_composite","composite_breadth","reversal_signal","predictive_range","breakout_prob","sentiment_osc","whale_accumulation","smart_money_flow","volume_climax","net_buying_pressure","order_flow_imbalance","intraday_intensity","volume_momentum","liquidity_heatmap","volatility_squeeze","squeeze_momentum","volatility_ratio","range_expansion","choppy_market","fractal_dimension","acceleration_bands","adaptive_channel","alpha_momentum","efficiency_ratio","trend_persistence","mtf_momentum","momentum_wave","gap_momentum","heikin_ashi_trend","cycle_detector","adaptive_rsi","mean_reversion_band","trend_ribbon","relative_vigor","dynamic_pivots","price_action_score","ergodic_volume","anchored_vwap_bands","nexus_trend_matrix","phantom_flow_zones","fractal_pulse_grid","vortex_drift_cloud","orion_momentum_shield","nebula_phase_bands","cipher_harmonic_veil","titan_pulse_signal","aurora_cascade_flow","eclipse_stealth_trail","wraith_convergence_engine","flux_momentum_trail","apex_predator_signal","phantom_divergence_tracker","chaos_sentinel"],
    },
    strategyConfig: StrategyConfigSchema,
    cosmeticType: {
      type: String,
      enum: ["avatar", "profile_frame", "badge", "title"],
    },
    imageUrl: String, // Image URL for any item type
    imageData: { type: String, select: false }, // base64-encoded image (excluded from queries by default)
    imageContentType: { type: String }, // e.g., "image/webp"
    iconName: String, // Lucide icon name for non-cosmetic items
    gameMasterConfig: {
      maxCompetitionsPerDay: { type: Number, min: 1, default: 1 },
      maxUsersPerCompetition: { type: Number, min: 2, default: 50 },
      referralFeePercentage: { type: Number, min: 0, max: 50, default: 5 },
      subscriptionDurationDays: { type: Number, min: 1, default: 30 },
      canCreateCompetitions: { type: Boolean, default: true },
      canEarnFromChallenges: { type: Boolean, default: false },
      challengeReferralFeePercentage: { type: Number, min: 0, max: 50 },
    },
    codeTemplate: {
      type: String,
      required: true,
      default: "{}",
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
      enum: ["low", "medium", "high", "very_high"],
      default: "medium",
    },
    riskWarning: String,
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
// Note: slug already has unique index from schema definition (unique: true)
MarketplaceItemSchema.index({ category: 1, isPublished: 1, status: 1 });
MarketplaceItemSchema.index({ tags: 1 });
MarketplaceItemSchema.index({ isFeatured: 1 });

export const MarketplaceItem: Model<IMarketplaceItem> =
  mongoose.models.MarketplaceItem ||
  mongoose.model<IMarketplaceItem>("MarketplaceItem", MarketplaceItemSchema);
