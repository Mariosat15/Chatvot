/**
 * Marketplace Seed Service
 *
 * Seeds default marketplace indicator items
 *
 * SUPPORTED INDICATOR TYPES (matching chart implementations):
 * - sma: Simple Moving Average (overlay)
 * - ema: Exponential Moving Average (overlay)
 * - bb: Bollinger Bands (overlay)
 * - support_resistance: Auto Support & Resistance levels (overlay)
 * - rsi: Relative Strength Index (oscillator)
 * - macd: MACD (oscillator)
 */

import { connectToDatabase } from "@/database/mongoose";
import {
  MarketplaceItem,
  IMarketplaceItem,
} from "@/database/models/marketplace/marketplace-item.model";

// ============================================================================
// INDICATOR TEMPLATES - Only indicators with chart implementations
// ============================================================================

const SUPPORT_RESISTANCE_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Auto Support & Resistance",
  slug: "auto-support-resistance",
  shortDescription:
    "Automatically detects and draws key support and resistance levels.",
  fullDescription: `# Auto Support & Resistance

## Overview
Automatically identifies and plots significant support and resistance levels based on price action.

## How It Works
- Scans price history for swing highs and lows
- Groups similar price levels together
- Draws horizontal lines at significant levels (green = support, red = resistance)

## Settings
- **Period**: Lookback period for swing detection (default: 20)
- **Strength**: Minimum touches to validate level (default: 2)

## Best Used For
- Entry and exit planning
- Stop loss placement
- Target setting`,
  category: "indicator",
  price: 250,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "support_resistance",
  codeTemplate: JSON.stringify(
    {
      type: "support_resistance",
      displayType: "overlay",
      description: "Auto-detects support and resistance levels",
    },
    null,
    2,
  ),
  defaultSettings: {
    period: 20,
    strength: 2,
    color: "#3b82f6",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["support", "resistance", "levels", "price-action"],
  riskLevel: "low",
};

const SIMPLE_MA_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Simple Moving Average",
  slug: "simple-moving-average",
  shortDescription: "Classic SMA indicator with customizable period.",
  fullDescription: `# Simple Moving Average (SMA)

## Overview
The most essential indicator - plots a simple moving average line on your chart.

## How It Works
Calculates the average price over the specified period and plots it as a smooth line.

## Settings
- **Period**: Number of candles to average (default: 20)
- **Color**: Line color
- **Line Width**: Thickness of the line

## Use Cases
- Identify trend direction
- Dynamic support/resistance
- Entry/exit confirmation

## Free Indicator!`,
  category: "indicator",
  price: 0,
  isFree: true,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "sma",
  codeTemplate: JSON.stringify(
    {
      type: "sma",
      displayType: "overlay",
      description: "Simple Moving Average line",
    },
    null,
    2,
  ),
  defaultSettings: {
    period: 20,
    color: "#3b82f6",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["moving-average", "trend", "free", "beginner", "sma"],
  riskLevel: "low",
};

const EMA_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Exponential Moving Average",
  slug: "exponential-moving-average",
  shortDescription: "EMA indicator - faster response to recent price changes.",
  fullDescription: `# Exponential Moving Average (EMA)

## Overview
The EMA gives more weight to recent prices, making it more responsive than SMA.

## How It Works
Uses an exponential weighting formula where recent prices have more impact.

## Settings
- **Period**: EMA period (default: 12)
- **Color**: Line color
- **Line Width**: Thickness

## EMA vs SMA
- EMA reacts faster to price changes
- Better for short-term trading
- More popular among active traders`,
  category: "indicator",
  price: 100,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "ema",
  codeTemplate: JSON.stringify(
    {
      type: "ema",
      displayType: "overlay",
      description: "Exponential Moving Average line",
    },
    null,
    2,
  ),
  defaultSettings: {
    period: 12,
    color: "#f97316",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["moving-average", "trend", "ema", "responsive"],
  riskLevel: "low",
};

const BOLLINGER_BANDS_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Bollinger Bands",
  slug: "bollinger-bands",
  shortDescription:
    "Volatility bands that expand and contract with market conditions.",
  fullDescription: `# Bollinger Bands

## Overview
Three bands showing volatility - a middle band (SMA) and two outer bands at standard deviation levels.

## Components
- **Middle Band**: 20-period SMA
- **Upper Band**: Middle + (2 × Std Dev)
- **Lower Band**: Middle - (2 × Std Dev)

## Settings
- **Period**: Calculation period (default: 20)
- **Std Dev**: Standard deviation multiplier (default: 2)

## Trading Signals
- Price at upper band = potentially overbought
- Price at lower band = potentially oversold
- Bands squeezing = low volatility, potential breakout`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "bb",
  codeTemplate: JSON.stringify(
    {
      type: "bb",
      displayType: "overlay",
      description: "Bollinger Bands volatility indicator",
    },
    null,
    2,
  ),
  defaultSettings: {
    period: 20,
    stdDev: 2,
    color: "#8b5cf6",
    lineWidth: 1,
  },
  supportedAssets: [],
  tags: ["volatility", "bollinger", "bands", "standard-deviation"],
  riskLevel: "low",
};

const RSI_INDICATOR: Partial<IMarketplaceItem> = {
  name: "RSI Indicator",
  slug: "rsi-indicator",
  shortDescription:
    "Relative Strength Index - detect overbought/oversold conditions.",
  fullDescription: `# Relative Strength Index (RSI)

## Overview
RSI is a momentum oscillator measuring the speed and magnitude of price movements.

## How It Works
- RSI oscillates between 0 and 100
- Above 70 = Overbought (potential sell)
- Below 30 = Oversold (potential buy)

## Settings
- **Period**: RSI calculation period (default: 14)
- **Overbought**: Upper threshold (default: 70)
- **Oversold**: Lower threshold (default: 30)

## Best Practices
- Use with other indicators for confirmation
- Look for divergences between price and RSI
- Works best in ranging markets`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "rsi",
  codeTemplate: JSON.stringify(
    {
      type: "rsi",
      displayType: "oscillator",
      description: "RSI momentum oscillator",
    },
    null,
    2,
  ),
  defaultSettings: {
    period: 14,
    overbought: 70,
    oversold: 30,
    color: "#10b981",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["momentum", "rsi", "oscillator", "overbought", "oversold"],
  riskLevel: "low",
};

const MACD_INDICATOR: Partial<IMarketplaceItem> = {
  name: "MACD Indicator",
  slug: "macd-indicator",
  shortDescription:
    "Moving Average Convergence Divergence for trend and momentum.",
  fullDescription: `# MACD (Moving Average Convergence Divergence)

## Overview
MACD is a trend-following momentum indicator showing the relationship between two EMAs.

## Components
- **MACD Line**: 12-period EMA minus 26-period EMA
- **Signal Line**: 9-period EMA of MACD Line
- **Histogram**: MACD Line minus Signal Line

## Settings
- **Fast Period**: Fast EMA (default: 12)
- **Slow Period**: Slow EMA (default: 26)
- **Signal Period**: Signal line (default: 9)

## Trading Signals
- MACD crosses above Signal = Bullish
- MACD crosses below Signal = Bearish
- Histogram shows momentum strength`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "macd",
  codeTemplate: JSON.stringify(
    {
      type: "macd",
      displayType: "oscillator",
      description: "MACD indicator with histogram",
    },
    null,
    2,
  ),
  defaultSettings: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    color: "#3b82f6",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["momentum", "macd", "trend", "ema"],
  riskLevel: "low",
};

// ============================================================================
// NEW INDICATOR TEMPLATES (20 Advanced Indicators)
// ============================================================================

const WMA_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Weighted Moving Average",
  slug: "weighted-moving-average",
  shortDescription:
    "WMA gives linearly increasing weight to recent prices for faster signals.",
  fullDescription: `# Weighted Moving Average (WMA)

## Overview
The WMA assigns progressively higher weights to recent prices, making it more responsive than SMA while being smoother than EMA.

## How It Works
Each price is multiplied by a weight (most recent = highest). The sum of weighted prices is divided by the sum of weights.

## Settings
- **Period**: Lookback period (default: 20)

## Advantages over SMA
- Faster signal generation
- Less lag in trending markets
- Good for short-term trend identification`,
  category: "indicator",
  price: 100,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "wma",
  codeTemplate: JSON.stringify(
    { type: "wma", displayType: "overlay", description: "Weighted Moving Average line" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#06b6d4", lineWidth: 2 },
  supportedAssets: [],
  tags: ["moving-average", "trend", "wma", "weighted"],
  riskLevel: "low",
};

const DEMA_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Double Exponential Moving Average",
  slug: "double-exponential-moving-average",
  shortDescription:
    "DEMA reduces lag by applying EMA twice for faster trend detection.",
  fullDescription: `# Double Exponential Moving Average (DEMA)

## Overview
DEMA is a smoother and faster-responding moving average that reduces the lag found in traditional EMAs.

## How It Works
DEMA = 2 × EMA(n) − EMA(EMA(n)). This double-smoothing technique eliminates much of the inherent lag.

## Settings
- **Period**: Calculation period (default: 20)

## Best Used For
- Fast trend identification
- Reducing false signals in choppy markets
- Crossover strategies with SMA or EMA`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "dema",
  codeTemplate: JSON.stringify(
    { type: "dema", displayType: "overlay", description: "Double Exponential Moving Average" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#a855f7", lineWidth: 2 },
  supportedAssets: [],
  tags: ["moving-average", "trend", "dema", "double-exponential", "advanced"],
  riskLevel: "low",
};

const TEMA_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Triple Exponential Moving Average",
  slug: "triple-exponential-moving-average",
  shortDescription:
    "TEMA applies triple smoothing for minimal lag and maximum responsiveness.",
  fullDescription: `# Triple Exponential Moving Average (TEMA)

## Overview
TEMA provides even less lag than DEMA by applying EMA three times. Ideal for fast-moving markets.

## How It Works
TEMA = 3×EMA − 3×EMA(EMA) + EMA(EMA(EMA)). Triple smoothing virtually eliminates lag.

## Settings
- **Period**: Calculation period (default: 20)

## Best Used For
- Scalping and day trading
- Very fast trend detection
- Catching reversals early`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "tema",
  codeTemplate: JSON.stringify(
    { type: "tema", displayType: "overlay", description: "Triple Exponential Moving Average" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#ec4899", lineWidth: 2 },
  supportedAssets: [],
  tags: ["moving-average", "trend", "tema", "triple-exponential", "scalping"],
  riskLevel: "medium",
};

const HMA_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Hull Moving Average",
  slug: "hull-moving-average",
  shortDescription:
    "HMA eliminates lag almost completely while maintaining smoothness.",
  fullDescription: `# Hull Moving Average (HMA)

## Overview
Created by Alan Hull, the HMA uses weighted moving averages and square root calculations to nearly eliminate lag while staying smooth.

## How It Works
HMA = WMA(2×WMA(n/2) − WMA(n), √n). Combines half-period and full-period WMAs for superior responsiveness.

## Settings
- **Period**: Calculation period (default: 20)

## Why Use HMA
- Almost zero lag
- Smooth output (no jitter)
- Excellent for trend following
- Color changes can signal reversals`,
  category: "indicator",
  price: 250,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "hma",
  codeTemplate: JSON.stringify(
    { type: "hma", displayType: "overlay", description: "Hull Moving Average" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#f59e0b", lineWidth: 2 },
  supportedAssets: [],
  tags: ["moving-average", "trend", "hma", "hull", "zero-lag", "advanced"],
  riskLevel: "low",
};

const KELTNER_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Keltner Channels",
  slug: "keltner-channels",
  shortDescription:
    "ATR-based volatility channels around an EMA center line.",
  fullDescription: `# Keltner Channels

## Overview
Similar to Bollinger Bands but uses ATR instead of standard deviation, producing more stable bands.

## Components
- **Middle**: EMA (default 20-period)
- **Upper**: EMA + (Multiplier × ATR)
- **Lower**: EMA − (Multiplier × ATR)

## Settings
- **Period**: EMA and ATR period (default: 20)
- **Multiplier**: ATR multiplier (default: 2)

## Trading Ideas
- Breakout trading when price moves outside channels
- Mean reversion when price returns to center
- Squeeze detection combined with Bollinger Bands`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "keltner",
  codeTemplate: JSON.stringify(
    { type: "keltner", displayType: "overlay", description: "Keltner Channels with ATR bands" },
    null,
    2,
  ),
  defaultSettings: { period: 20, multiplier: 2, color: "#14b8a6", lineWidth: 1 },
  supportedAssets: [],
  tags: ["volatility", "keltner", "channels", "atr", "bands"],
  riskLevel: "low",
};

const DONCHIAN_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Donchian Channel",
  slug: "donchian-channel",
  shortDescription:
    "Breakout channel based on highest high and lowest low over N periods.",
  fullDescription: `# Donchian Channel

## Overview
The Donchian Channel plots the highest high and lowest low over N periods. A classic breakout indicator used by Turtle Traders.

## Components
- **Upper**: Highest high of last N periods
- **Middle**: Average of upper and lower
- **Lower**: Lowest low of last N periods

## Settings
- **Period**: Lookback period (default: 20)

## Famous Strategy
Richard Dennis's Turtle Trading system used 20-period Donchian breakouts to generate millions in profits.`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "donchian",
  codeTemplate: JSON.stringify(
    { type: "donchian", displayType: "overlay", description: "Donchian Channel breakout bands" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#3b82f6", lineWidth: 1 },
  supportedAssets: [],
  tags: ["breakout", "donchian", "channel", "turtle-trading", "trend"],
  riskLevel: "medium",
};

const ICHIMOKU_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Ichimoku Cloud",
  slug: "ichimoku-cloud",
  shortDescription:
    "Complete trading system showing support, resistance, trend, and momentum at a glance.",
  fullDescription: `# Ichimoku Cloud (Ichimoku Kinko Hyo)

## Overview
A complete trading system from Japan that shows trend direction, support/resistance, and momentum in one view.

## Components
- **Tenkan-sen** (Conversion): (9-period high + low) / 2
- **Kijun-sen** (Base): (26-period high + low) / 2
- **Senkou Span A**: (Tenkan + Kijun) / 2
- **Senkou Span B**: (52-period high + low) / 2
- **Cloud**: Area between Senkou A and B

## Settings
- **Tenkan Period**: Conversion line (default: 9)
- **Kijun Period**: Base line (default: 26)
- **Senkou B Period**: Cloud span (default: 52)

## Trading Signals
- Price above cloud = Bullish
- Price below cloud = Bearish
- Tenkan crosses Kijun = Signal
- Cloud color change = Trend shift`,
  category: "indicator",
  price: 350,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "ichimoku",
  codeTemplate: JSON.stringify(
    { type: "ichimoku", displayType: "overlay", description: "Ichimoku Cloud complete trading system" },
    null,
    2,
  ),
  defaultSettings: {
    tenkanPeriod: 9,
    kijunPeriod: 26,
    senkouBPeriod: 52,
    color: "#2962ff",
    lineWidth: 1,
  },
  supportedAssets: [],
  tags: ["ichimoku", "cloud", "trend", "japanese", "complete-system", "advanced"],
  riskLevel: "medium",
};

const STOCHASTIC_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Stochastic Oscillator",
  slug: "stochastic-oscillator",
  shortDescription:
    "Momentum indicator comparing closing price to the high-low range.",
  fullDescription: `# Stochastic Oscillator

## Overview
Compares the closing price to the price range over a given period. Shows momentum and potential reversals.

## Components
- **%K Line**: Fast stochastic (raw calculation)
- **%D Line**: Slow stochastic (SMA of %K)

## Settings
- **%K Period**: Lookback period (default: 14)
- **%D Period**: Smoothing period (default: 3)

## Trading Rules
- Above 80 = Overbought zone
- Below 20 = Oversold zone
- %K crosses %D = Trade signal
- Divergences signal potential reversals`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "stoch",
  codeTemplate: JSON.stringify(
    { type: "stoch", displayType: "oscillator", description: "Stochastic momentum oscillator" },
    null,
    2,
  ),
  defaultSettings: { kPeriod: 14, dPeriod: 3, color: "#3b82f6", lineWidth: 2 },
  supportedAssets: [],
  tags: ["momentum", "stochastic", "oscillator", "overbought", "oversold"],
  riskLevel: "low",
};

const WILLIAMS_R_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Williams %R",
  slug: "williams-percent-r",
  shortDescription:
    "Momentum oscillator measuring overbought/oversold levels (inverted scale).",
  fullDescription: `# Williams %R

## Overview
Similar to Stochastic but with an inverted scale (0 to -100). Measures how close the closing price is to the highest high.

## How It Works
- 0 to -20 = Overbought
- -80 to -100 = Oversold
- Readings reflect momentum strength

## Settings
- **Period**: Lookback period (default: 14)

## Trading Tips
- Use in ranging markets for mean reversion
- Look for divergences
- Combine with trend indicators for confirmation`,
  category: "indicator",
  price: 100,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "williamsR",
  codeTemplate: JSON.stringify(
    { type: "williamsR", displayType: "oscillator", description: "Williams %R momentum oscillator" },
    null,
    2,
  ),
  defaultSettings: { period: 14, color: "#f97316", lineWidth: 2 },
  supportedAssets: [],
  tags: ["momentum", "williams", "oscillator", "overbought", "oversold"],
  riskLevel: "low",
};

const CCI_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Commodity Channel Index",
  slug: "commodity-channel-index",
  shortDescription:
    "CCI measures price deviation from its statistical mean for trend strength.",
  fullDescription: `# Commodity Channel Index (CCI)

## Overview
CCI measures the deviation of price from its mean. Values above +100 indicate strong uptrend, below -100 indicate strong downtrend.

## How It Works
CCI = (Typical Price − SMA) / (0.015 × Mean Deviation). Oscillates without bounds.

## Settings
- **Period**: Calculation period (default: 20)

## Trading Strategies
- Above +100 = Strong bullish trend
- Below -100 = Strong bearish trend
- Zero-line crossovers signal trend changes
- Use for divergence detection`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "cci",
  codeTemplate: JSON.stringify(
    { type: "cci", displayType: "oscillator", description: "CCI trend strength oscillator" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#8b5cf6", lineWidth: 2 },
  supportedAssets: [],
  tags: ["momentum", "cci", "oscillator", "trend-strength"],
  riskLevel: "low",
};

const ADX_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Average Directional Index",
  slug: "average-directional-index",
  shortDescription:
    "ADX measures trend strength regardless of direction (0-100 scale).",
  fullDescription: `# Average Directional Index (ADX)

## Overview
ADX quantifies trend strength from 0 to 100. It doesn't show direction — only how strong the current trend is.

## How It Works
ADX is derived from the Directional Movement indicators (+DI and -DI).

## Settings
- **Period**: Smoothing period (default: 14)

## Reading ADX
- 0-20 = Weak/no trend (range-bound)
- 20-40 = Emerging trend
- 40-60 = Strong trend
- 60+ = Very strong trend

## Trading Tips
- ADX rising = Trend strengthening
- ADX falling = Trend weakening
- Use with +DI/-DI for direction`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "adx",
  codeTemplate: JSON.stringify(
    { type: "adx", displayType: "oscillator", description: "ADX trend strength indicator" },
    null,
    2,
  ),
  defaultSettings: { period: 14, color: "#ef4444", lineWidth: 2 },
  supportedAssets: [],
  tags: ["trend", "adx", "directional", "strength", "advanced"],
  riskLevel: "low",
};

const MFI_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Money Flow Index",
  slug: "money-flow-index",
  shortDescription:
    "Volume-weighted RSI that incorporates both price and volume data.",
  fullDescription: `# Money Flow Index (MFI)

## Overview
MFI is like RSI but weighted by volume. It helps identify buying/selling pressure with volume confirmation.

## How It Works
Uses typical price × volume to calculate money flow, then applies RSI-like formula.

## Settings
- **Period**: Calculation period (default: 14)

## Key Levels
- Above 80 = Overbought (with volume confirmation)
- Below 20 = Oversold (with volume confirmation)
- Divergences between MFI and price = Strong reversal signals`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "mfi",
  codeTemplate: JSON.stringify(
    { type: "mfi", displayType: "oscillator", description: "Money Flow Index volume-weighted RSI" },
    null,
    2,
  ),
  defaultSettings: { period: 14, color: "#10b981", lineWidth: 2 },
  supportedAssets: [],
  tags: ["volume", "mfi", "oscillator", "money-flow", "overbought"],
  riskLevel: "low",
};

const ATR_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Average True Range",
  slug: "average-true-range",
  shortDescription:
    "Measures market volatility by averaging the true range of price movement.",
  fullDescription: `# Average True Range (ATR)

## Overview
ATR measures pure volatility by calculating the average range of price movement including gaps.

## How It Works
True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|). ATR is the moving average of True Range.

## Settings
- **Period**: Smoothing period (default: 14)

## Uses
- Set stop-loss distances (e.g., 2× ATR)
- Determine position sizing
- Identify volatility expansion/contraction
- Trail stops with ATR multiplier`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "atr",
  codeTemplate: JSON.stringify(
    { type: "atr", displayType: "oscillator", description: "ATR volatility indicator" },
    null,
    2,
  ),
  defaultSettings: { period: 14, color: "#f59e0b", lineWidth: 2 },
  supportedAssets: [],
  tags: ["volatility", "atr", "range", "stop-loss", "position-sizing"],
  riskLevel: "low",
};

const VWAP_INDICATOR: Partial<IMarketplaceItem> = {
  name: "VWAP",
  slug: "volume-weighted-average-price",
  shortDescription:
    "Volume Weighted Average Price — the institutional benchmark for fair value.",
  fullDescription: `# VWAP (Volume Weighted Average Price)

## Overview
VWAP is the gold standard for institutional traders. It shows the average price weighted by volume throughout the trading session.

## How It Works
VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume). Resets each session.

## Why It Matters
- Institutional traders use VWAP as a benchmark
- Price above VWAP = Bullish bias
- Price below VWAP = Bearish bias

## Trading Tips
- Buy near or below VWAP for long entries
- Sell near or above VWAP for short entries
- Acts as dynamic support/resistance`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "vwap",
  codeTemplate: JSON.stringify(
    { type: "vwap", displayType: "overlay", description: "VWAP institutional benchmark" },
    null,
    2,
  ),
  defaultSettings: { color: "#06b6d4", lineWidth: 2 },
  supportedAssets: [],
  tags: ["volume", "vwap", "institutional", "benchmark", "intraday"],
  riskLevel: "low",
};

const PARABOLIC_SAR_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Parabolic SAR",
  slug: "parabolic-sar",
  shortDescription:
    "Stop And Reverse — trailing dots that signal trend direction and potential reversals.",
  fullDescription: `# Parabolic SAR (Stop And Reverse)

## Overview
Parabolic SAR places dots above or below price to indicate trend direction. When dots flip, it signals a potential reversal.

## How It Works
Uses an acceleration factor that increases as the trend extends, creating the parabolic shape.

## Settings
- **Acceleration**: Starting AF (default: 0.02)
- **Maximum**: Max AF cap (default: 0.2)

## Trading Rules
- Dots below price = Uptrend (go long)
- Dots above price = Downtrend (go short)
- Dot flip = Potential exit/reversal signal
- Great for trailing stop losses`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "sar",
  codeTemplate: JSON.stringify(
    { type: "sar", displayType: "overlay", description: "Parabolic SAR trailing indicator" },
    null,
    2,
  ),
  defaultSettings: { acceleration: 0.02, maximum: 0.2, color: "#f97316", lineWidth: 1 },
  supportedAssets: [],
  tags: ["trend", "sar", "parabolic", "stop-loss", "reversal"],
  riskLevel: "low",
};

const PIVOT_POINTS_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Pivot Points",
  slug: "pivot-points",
  shortDescription:
    "Classic floor trader pivots — key support and resistance levels from prior session.",
  fullDescription: `# Pivot Points

## Overview
Pivot Points calculate key price levels from the previous session's high, low, and close. Used by floor traders for decades.

## Components
- **Pivot**: (High + Low + Close) / 3
- **R1/R2/R3**: Resistance levels above
- **S1/S2/S3**: Support levels below

## Trading
- Price above pivot = Bullish bias
- Price below pivot = Bearish bias
- S1/S2/S3 = Support targets
- R1/R2/R3 = Resistance targets
- Most activity occurs around Pivot, S1, and R1`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "pivots",
  codeTemplate: JSON.stringify(
    { type: "pivots", displayType: "overlay", description: "Classic pivot point levels" },
    null,
    2,
  ),
  defaultSettings: { color: "#3b82f6", lineWidth: 1 },
  supportedAssets: [],
  tags: ["support", "resistance", "pivots", "floor-trader", "levels"],
  riskLevel: "low",
};

const OBV_INDICATOR: Partial<IMarketplaceItem> = {
  name: "On Balance Volume",
  slug: "on-balance-volume",
  shortDescription:
    "Cumulative volume indicator that confirms trends through volume flow.",
  fullDescription: `# On Balance Volume (OBV)

## Overview
OBV tracks cumulative volume flow. Volume is added on up days and subtracted on down days. Rising OBV confirms uptrends.

## How It Works
- Price up → OBV += Volume
- Price down → OBV -= Volume
- Price flat → OBV unchanged

## Why Use OBV
- Volume leads price — OBV often breaks out before price does
- Divergences signal potential reversals
- Confirms trend strength with volume

## Trading Tips
- OBV rising + Price rising = Strong trend
- OBV falling + Price rising = Weak trend (potential reversal)
- OBV breakouts can precede price breakouts`,
  category: "indicator",
  price: 150,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "obv",
  codeTemplate: JSON.stringify(
    { type: "obv", displayType: "oscillator", description: "On Balance Volume cumulative indicator" },
    null,
    2,
  ),
  defaultSettings: { color: "#22c55e", lineWidth: 2 },
  supportedAssets: [],
  tags: ["volume", "obv", "cumulative", "trend-confirmation"],
  riskLevel: "low",
};

const ROC_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Rate of Change",
  slug: "rate-of-change",
  shortDescription:
    "Measures the percentage change in price over a specified period.",
  fullDescription: `# Rate of Change (ROC)

## Overview
ROC measures the percentage change between the current price and the price N periods ago. A pure momentum indicator.

## How It Works
ROC = ((Current Price − Price N periods ago) / Price N periods ago) × 100

## Settings
- **Period**: Lookback period (default: 12)

## Interpretation
- Positive ROC = Upward momentum
- Negative ROC = Downward momentum
- ROC crossing zero = Momentum shift
- Extreme readings = Potential reversal zones`,
  category: "indicator",
  price: 100,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "roc",
  codeTemplate: JSON.stringify(
    { type: "roc", displayType: "oscillator", description: "Rate of Change momentum oscillator" },
    null,
    2,
  ),
  defaultSettings: { period: 12, color: "#6366f1", lineWidth: 2 },
  supportedAssets: [],
  tags: ["momentum", "roc", "rate-of-change", "percentage"],
  riskLevel: "low",
};

const CMF_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Chaikin Money Flow",
  slug: "chaikin-money-flow",
  shortDescription:
    "Measures buying/selling pressure based on where price closes within its range.",
  fullDescription: `# Chaikin Money Flow (CMF)

## Overview
CMF measures the amount of Money Flow Volume over a period. Shows whether smart money is accumulating or distributing.

## How It Works
Uses the Close Location Value (CLV) × Volume. CLV measures where the close is relative to the high-low range.

## Settings
- **Period**: Lookback period (default: 20)

## Reading CMF
- Positive (above 0) = Buying pressure (accumulation)
- Negative (below 0) = Selling pressure (distribution)
- Strong readings (> 0.25 or < -0.25) = Strong conviction

## Trading Tips
- Use to confirm breakout direction
- Divergences between CMF and price signal reversals
- Zero-line crossovers indicate shift in money flow`,
  category: "indicator",
  price: 200,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "cmf",
  codeTemplate: JSON.stringify(
    { type: "cmf", displayType: "oscillator", description: "Chaikin Money Flow buying/selling pressure" },
    null,
    2,
  ),
  defaultSettings: { period: 20, color: "#0ea5e9", lineWidth: 2 },
  supportedAssets: [],
  tags: ["volume", "cmf", "chaikin", "money-flow", "accumulation"],
  riskLevel: "low",
};

const MOMENTUM_INDICATOR: Partial<IMarketplaceItem> = {
  name: "Momentum Oscillator",
  slug: "momentum-oscillator",
  shortDescription:
    "Pure price momentum — the raw difference between current and past price.",
  fullDescription: `# Momentum Oscillator

## Overview
The simplest momentum indicator. Measures the raw price change over N periods. No normalization — just pure momentum.

## How It Works
Momentum = Current Close − Close N periods ago

## Settings
- **Period**: Lookback period (default: 10)

## Interpretation
- Positive = Price is higher than N periods ago
- Negative = Price is lower than N periods ago
- Crossing zero = Momentum shift
- Rate of change in momentum reveals acceleration/deceleration

## Simple Yet Powerful
Sometimes the simplest indicator is the best. Momentum shows you pure price velocity.`,
  category: "indicator",
  price: 0,
  isFree: true,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  indicatorType: "momentum",
  codeTemplate: JSON.stringify(
    { type: "momentum", displayType: "oscillator", description: "Pure price momentum oscillator" },
    null,
    2,
  ),
  defaultSettings: { period: 10, color: "#ef4444", lineWidth: 2 },
  supportedAssets: [],
  tags: ["momentum", "oscillator", "simple", "free", "beginner"],
  riskLevel: "low",
};

// ============================================================================
// STRATEGY TEMPLATES
// ============================================================================

const MA_CROSSOVER_STRATEGY: Partial<IMarketplaceItem> = {
  name: "MA Crossover Strategy",
  slug: "ma-crossover-strategy",
  shortDescription:
    "Buy/sell signals when price crosses moving averages with RSI confirmation.",
  fullDescription: `# MA Crossover Strategy

## Overview
This strategy generates buy and sell signals based on price crossing moving averages, with RSI confirmation to filter out false signals.

## Buy Signal (Strong Buy)
- Price crosses ABOVE the 20-period SMA
- AND RSI is below 70 (not overbought)

## Sell Signal (Strong Sell)
- Price crosses BELOW the 20-period SMA
- AND RSI is above 30 (not oversold)

## How It Works
1. Monitors price relative to the Simple Moving Average
2. Uses RSI to confirm the signal strength
3. Displays arrows on the chart when conditions are met

## Best Used For
- Trend following
- Swing trading
- Entry/exit timing

## Risk Level
Medium - Moving average crossovers can lag, but RSI helps filter signals.`,
  category: "strategy",
  price: 500,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false, // Show in Strategies section, not just Featured
  version: "1.0.0",
  strategyConfig: {
    rules: [
      {
        id: "buy-rule-1",
        name: "Buy Signal",
        conditions: [
          {
            id: "cond-1",
            indicator: "price",
            operator: "crosses_above",
            compareWith: "indicator",
            compareIndicator: "sma",
            compareIndicatorParams: { period: 20 },
          },
          {
            id: "cond-2",
            indicator: "rsi",
            indicatorParams: { period: 14 },
            operator: "below",
            compareWith: "value",
            compareValue: 70,
          },
        ],
        logic: "AND",
        signal: "strong_buy",
        signalStrength: 4,
      },
      {
        id: "sell-rule-1",
        name: "Sell Signal",
        conditions: [
          {
            id: "cond-3",
            indicator: "price",
            operator: "crosses_below",
            compareWith: "indicator",
            compareIndicator: "sma",
            compareIndicatorParams: { period: 20 },
          },
          {
            id: "cond-4",
            indicator: "rsi",
            indicatorParams: { period: 14 },
            operator: "above",
            compareWith: "value",
            compareValue: 30,
          },
        ],
        logic: "AND",
        signal: "strong_sell",
        signalStrength: 4,
      },
    ],
    defaultIndicators: ["sma", "rsi"],
    signalDisplay: {
      showOnChart: true,
      showArrows: true,
      showLabels: true,
      arrowSize: "medium",
    },
  },
  codeTemplate: JSON.stringify(
    {
      type: "strategy",
      name: "MA Crossover Strategy",
      description: "Price crosses SMA with RSI confirmation",
    },
    null,
    2,
  ),
  defaultSettings: {
    smaPeriod: 20,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
  },
  supportedAssets: [],
  tags: ["strategy", "crossover", "sma", "rsi", "trend-following"],
  riskLevel: "medium",
};

// ============================================================================
// COSMETIC AVATARS
// ============================================================================

const AVATAR_SHADOW_TRADER: Partial<IMarketplaceItem> = {
  name: "Shadow Trader",
  slug: "avatar-shadow-trader",
  shortDescription:
    "A mysterious hooded figure wielding a flaming Bitcoin and katana.",
  fullDescription: `# Shadow Trader

## Origin Story
Once a legendary samurai in feudal Japan, Kuro Yamazaki discovered a portal through time while meditating at a sacred temple. Transported to the digital age, he found his warrior skills perfectly suited for the volatile crypto markets. Now known as the Shadow Trader, he strikes with precision, his ancient katana replaced with algorithmic insights, and the flames of his Bitcoin coin representing his burning passion for profitable trades.

## Symbolism
- **The Katana**: Precision and decisive action in trading
- **Flaming Bitcoin**: Mastery over volatile assets
- **Red Eyes**: Seeing through market manipulation
- **Trading Charts Background**: Always analyzing, always watching

*"In the shadows of the charts, opportunity awaits the patient warrior."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/shadow-trader.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "ninja", "crypto", "legendary"],
  riskLevel: "low",
};

const AVATAR_PHANTOM_OPERATIVE: Partial<IMarketplaceItem> = {
  name: "Phantom Operative",
  slug: "avatar-phantom-operative",
  shortDescription:
    "Elite tactical trader with advanced combat gear and glowing red optics.",
  fullDescription: `# Phantom Operative

## Origin Story
Former special forces commander Victor "Ghost" Reyes was recruited by a secretive hedge fund after his military career. His tactical expertise translated seamlessly to high-frequency trading. Equipped with cutting-edge neural interfaces and combat-grade analysis tools, he executes trades with military precision. His signature red eye implant processes market data faster than any human could naturally perceive.

## Symbolism
- **Tactical Gear**: Prepared for any market condition
- **Red Eye Glow**: Enhanced pattern recognition
- **Weapon**: Armed with data and analysis
- **Dark Hood**: Operating in the shadows of the market

*"Every trade is a mission. Every profit is victory."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/phantom-operative.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "tactical", "military", "elite"],
  riskLevel: "low",
};

const AVATAR_CYBER_RONIN: Partial<IMarketplaceItem> = {
  name: "Cyber Ronin",
  slug: "avatar-cyber-ronin",
  shortDescription:
    "Futuristic samurai warrior with neon-lit crimson armor and dual katanas.",
  fullDescription: `# Cyber Ronin

## Origin Story
In Neo-Tokyo 2087, the legendary trader Akira Takeshi refused to serve the corporate megacorps that controlled the markets. Cast out as a ronin—a masterless samurai—he forged his own path. His armor, infused with quantum processors, glows with the energy of a thousand calculations. Each trade he makes honors the code of the ancient warriors: discipline, patience, and unwavering focus.

## Symbolism
- **Neon Armor**: Technology fused with tradition
- **Blue Energy Halo**: Enlightened market understanding
- **Dual Katanas**: Balance in trading strategy
- **Red Accents**: Warning to market manipulators

*"Honor in profit. Discipline in loss. The way of the Cyber Ronin."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/cyber-ronin.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "samurai", "cyber", "futuristic"],
  riskLevel: "low",
};

const AVATAR_CRYPTO_ORACLE: Partial<IMarketplaceItem> = {
  name: "Crypto Oracle",
  slug: "avatar-crypto-oracle",
  shortDescription:
    "Mystical tech-mage who channels market wisdom through arcane algorithms.",
  fullDescription: `# Crypto Oracle

## Origin Story
Dr. Elena Voss was a quantum physicist who discovered that market patterns mirrored ancient mystical formulas. Abandoning academia, she merged her scientific knowledge with esoteric wisdom. Now known as the Crypto Oracle, she wields a holographic grimoire containing algorithms that seem to predict the future. The Bitcoin orb floating above her hand channels pure market energy into actionable insights.

## Symbolism
- **Holographic Book**: Ancient wisdom meets modern technology
- **Bitcoin Orb**: Mastery over digital currencies
- **Blue Energy**: Calm, calculated decision making
- **Hooded Robe**: Keeper of trading secrets

*"The markets speak to those who listen with both logic and intuition."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/crypto-oracle.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "mage", "oracle", "mystical"],
  riskLevel: "low",
};

const AVATAR_NEBULA_SNIPER: Partial<IMarketplaceItem> = {
  name: "Nebula Sniper",
  slug: "avatar-nebula-sniper",
  shortDescription:
    "Cosmic marksman who targets opportunities across the market universe.",
  fullDescription: `# Nebula Sniper

## Origin Story
Commander Zara Chen was Earth's finest long-range specialist before the Galactic Trading Federation recruited her. In the vastness of space, she learned that patience was the ultimate weapon. Her plasma rifle now fires precision trades instead of energy bolts. The swirling nebula around her represents the chaos of markets she has learned to navigate with deadly accuracy.

## Symbolism
- **Plasma Rifle**: Precision entry and exit points
- **Cosmic Background**: Global market perspective
- **Glowing Eyes**: Enhanced market vision
- **Battle Armor**: Protection against volatility

*"One shot. One trade. Maximum impact."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/nebula-sniper.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "sniper", "space", "precision"],
  riskLevel: "low",
};

const AVATAR_BLOOD_SHOGUN: Partial<IMarketplaceItem> = {
  name: "Blood Shogun",
  slug: "avatar-blood-shogun",
  shortDescription:
    "Battle-scarred warrior whose crimson scarf tells tales of market conquests.",
  fullDescription: `# Blood Shogun

## Origin Story
General Ryu Matsumoto earned his title on countless battlefields before discovering the ultimate war—the financial markets. Each scar on his armor represents a lesson learned from devastating losses. His crimson scarf, stained with the "blood" of failed positions, reminds him that survival requires sacrifice. Now a trading legend, he leads armies of followers into profitable campaigns.

## Symbolism
- **Scarred Armor**: Lessons from past losses
- **Crimson Scarf**: Sacrifice and determination
- **Glowing Red Eyes**: Seeing through fear and greed
- **Battle-worn Katana**: Sharpened by experience

*"Every scar is a lesson. Every loss, a teacher."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/blood-shogun.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "warrior", "shogun", "battle"],
  riskLevel: "low",
};

const AVATAR_VOID_HUNTER: Partial<IMarketplaceItem> = {
  name: "Void Hunter",
  slug: "avatar-void-hunter",
  shortDescription:
    "Interdimensional trader who harvests profits from market anomalies.",
  fullDescription: `# Void Hunter

## Origin Story
When scientist Dr. Marcus Webb opened a portal to another dimension, he discovered markets that existed outside of time. Now transformed by void energy, he hunts for price anomalies and arbitrage opportunities that others cannot perceive. His weapon fires concentrated void matter that isolates and captures fleeting market inefficiencies before they disappear.

## Symbolism
- **Void Energy Weapon**: Capturing fleeting opportunities
- **Blue Void Portal**: Access to hidden market data
- **Dark Armor**: Protection from market noise
- **Glowing Visor**: Seeing patterns in chaos

*"In the void between candles, fortunes are made."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/void-hunter.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "void", "hunter", "cosmic"],
  riskLevel: "low",
};

const AVATAR_INFERNO_LORD: Partial<IMarketplaceItem> = {
  name: "Inferno Lord",
  slug: "avatar-inferno-lord",
  shortDescription: "Demonic titan who thrives in the flames of market chaos.",
  fullDescription: `# Inferno Lord

## Origin Story
Once a mortal trader consumed by greed, Azaroth was transformed by the fires of a spectacular market crash. Rather than being destroyed, he emerged as the Inferno Lord—a being who draws power from market volatility. When others flee from red candles, he advances. His molten axe cleaves through panic selling, and his fiery form grows stronger with each bout of market fear.

## Symbolism
- **Molten Axe**: Cutting through market panic
- **Fire Aura**: Thriving in volatility
- **Demonic Form**: Embracing what others fear
- **Glowing Core**: Inner conviction

*"Let the markets burn. I am reborn in every crash."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/inferno-lord.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "demon", "fire", "chaos"],
  riskLevel: "low",
};

const AVATAR_ALCHEMIST_PRIME: Partial<IMarketplaceItem> = {
  name: "Alchemist Prime",
  slug: "avatar-alchemist-prime",
  shortDescription: "Master of transformation who turns market lead into gold.",
  fullDescription: `# Alchemist Prime

## Origin Story
Aldric Goldweaver was a medieval alchemist who finally discovered the secret of transmutation—not of metals, but of value itself. Transported through time by his experiments, he found the modern markets to be the ultimate alchemical laboratory. His green elixirs represent risk management, while the golden Bitcoin in his palm shows his mastery over digital gold.

## Symbolism
- **Green Elixir**: Calculated risk-taking
- **Golden Bitcoin**: Successful transformation
- **Mystical Symbols**: Pattern recognition
- **Blue Eyes**: Clarity of vision

*"The philosopher's stone was never about gold. It was about understanding value."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/alchemist-prime.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "alchemist", "mystical", "gold"],
  riskLevel: "low",
};

const AVATAR_STORM_CENTURION: Partial<IMarketplaceItem> = {
  name: "Storm Centurion",
  slug: "avatar-storm-centurion",
  shortDescription:
    "Lightning-wielding gladiator who commands the arena of trading.",
  fullDescription: `# Storm Centurion

## Origin Story
Marcus Aurelius Volt was the champion of the Colosseum trading pits before they were automated. When algorithms replaced human traders, he refused to be obsolete. Augmenting himself with cybernetic enhancements, he now fights in digital arenas. His spear channels lightning—the same speed at which he executes trades—and his armor is forged from the remains of failed trading bots he has defeated.

## Symbolism
- **Lightning Spear**: Speed of execution
- **Gladiator Armor**: Battle-tested strategy
- **Glowing Energy Nodes**: Powered by conviction
- **Red Plume**: Leadership and visibility

*"In the arena of markets, only the swift survive."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/storm-centurion.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "gladiator", "lightning", "warrior"],
  riskLevel: "low",
};

const AVATAR_QUANTUM_SAGE: Partial<IMarketplaceItem> = {
  name: "Quantum Sage",
  slug: "avatar-quantum-sage",
  shortDescription:
    "Enlightened master who sees all possible market outcomes simultaneously.",
  fullDescription: `# Quantum Sage

## Origin Story
Professor Thaddeus Quark achieved the impossible—he merged his consciousness with a quantum computer. Now existing in a state of superposition, he can perceive multiple market timelines simultaneously. The glowing flask he carries contains probability essence, while the Bitcoin hovering near him exists in a state of both profit and loss until observed. His trading decisions collapse reality into favorable outcomes.

## Symbolism
- **Probability Flask**: Managing multiple scenarios
- **Floating Bitcoin**: Quantum state of trades
- **Ethereal Energy**: Connection to market consciousness
- **Wise Countenance**: Centuries of market wisdom

*"In every trade, infinite outcomes. The sage chooses wisely."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/quantum-sage.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "sage", "quantum", "wisdom"],
  riskLevel: "low",
};

const AVATAR_DIGITAL_ASSASSIN: Partial<IMarketplaceItem> = {
  name: "Digital Assassin",
  slug: "avatar-digital-assassin",
  shortDescription:
    "Silent killer of bad trades with plasma-powered precision.",
  fullDescription: `# Digital Assassin

## Origin Story
Known only by her codename "Zero," this elite operative was trained by a clandestine organization of market makers. Her mission: eliminate inefficiencies and punish bad actors. Her plasma rifle can "assassinate" poorly performing positions instantly, and her neural implants process market data faster than institutional algorithms. She leaves no trace—only profits in her wake.

## Symbolism
- **Plasma Rifle**: Instant position execution
- **Pink/Red Energy**: Aggressive profit-taking
- **Sleek Armor**: Efficiency and speed
- **Masked Face**: Anonymous trading

*"Every bad trade has a weakness. I find it."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/digital-assassin.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "assassin", "digital", "precision"],
  riskLevel: "low",
};

// ============================================================================
// GAME MASTER PACKAGES
// ============================================================================

const GAMEMASTER_STARTER_PACKAGE: Partial<IMarketplaceItem> = {
  name: "Game Master Starter",
  slug: "game-master-starter",
  shortDescription:
    "Begin your Game Master journey! Create daily competitions, earn 5% from referrals, and build your trading community.",
  fullDescription: `# Welcome to Your Game Master Journey

The **Starter Package** is your gateway to becoming a Game Master on ChartVolt. Perfect for traders who want to dip their toes into community building while earning passive income.

## What You Get

- **1 Competition per Day** - Host daily trading battles for your community
- **Up to 30 Participants** - Perfect size for intimate, competitive events
- **5% Referral Earnings** - Earn from every entry fee your referred users pay
- **30 Days Duration** - Full month of Game Master privileges

## How Referral Earnings Work

When users sign up using your unique referral link and join ANY competition on the platform:
- They pay the entry fee as normal
- You automatically receive 5% of their entry fee
- Earnings are credited instantly to your wallet

## Perfect For

- New community builders testing the waters
- Traders with small but loyal followings
- Anyone wanting to start earning from referrals

*"Every Game Master empire started somewhere. Start yours today."*`,
  category: "gamemaster",
  price: 299,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["gamemaster", "starter", "referral", "beginner", "affordable"],
  riskLevel: "low",
  gameMasterConfig: {
    maxCompetitionsPerDay: 1,
    maxUsersPerCompetition: 30,
    referralFeePercentage: 5,
    subscriptionDurationDays: 30,
    canCreateCompetitions: true,
    canEarnFromChallenges: false, // Starter package doesn't include challenge earnings
  },
};

const GAMEMASTER_PRO_PACKAGE: Partial<IMarketplaceItem> = {
  name: "Game Master Pro",
  slug: "game-master-pro",
  shortDescription:
    "Level up your Game Master game! 3 daily competitions, 75 participants, and 7.5% referral earnings. The choice of serious community builders.",
  fullDescription: `# The Professional's Choice

The **Pro Package** is designed for Game Masters who are serious about building a thriving trading community. More competitions, bigger events, better earnings.

## What You Get

- **3 Competitions per Day** - Run morning, afternoon, and evening events
- **Up to 75 Participants** - Scale your competitions for bigger prize pools
- **7.5% Referral Earnings** - 50% more earnings than Starter tier
- **30 Days Duration** - Full month of enhanced privileges

## Why Upgrade to Pro?

**More Events = More Engagement**
Keep your community active with multiple daily competitions. Different timeframes attract different traders.

**Bigger Competitions = Bigger Prizes**
With 75 participant capacity, your events can have prize pools that truly excite traders.

**Higher Earnings = Better ROI**
At 7.5% referral rate, just 8,000 credits in entry fees from your referrals pays back your subscription.

## Ideal For

- Growing Discord/Telegram trading communities
- Social media influencers with engaged audiences
- Active traders looking to monetize their network

*"Pro isn't just a tier—it's a statement. You're here to build something real."*`,
  category: "gamemaster",
  price: 599,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["gamemaster", "pro", "referral", "popular", "recommended"],
  riskLevel: "low",
  gameMasterConfig: {
    maxCompetitionsPerDay: 3,
    maxUsersPerCompetition: 75,
    referralFeePercentage: 7.5,
    subscriptionDurationDays: 30,
    canCreateCompetitions: true,
    canEarnFromChallenges: true, // Pro package includes challenge earnings
    challengeReferralFeePercentage: 5, // 5% for challenges
  },
};

const GAMEMASTER_ELITE_PACKAGE: Partial<IMarketplaceItem> = {
  name: "Game Master Elite",
  slug: "game-master-elite",
  shortDescription:
    "The ultimate Game Master experience. 10 daily competitions, 150 participants, and maximum 10% referral earnings. For those who dominate.",
  fullDescription: `# Dominate the Arena

The **Elite Package** is for Game Masters who refuse to compromise. Maximum power. Maximum earnings. Maximum respect.

## What You Get

- **10 Competitions per Day** - Run events around the clock
- **Up to 150 Participants** - Host massive tournaments with huge prize pools
- **10% Referral Earnings** - The highest referral rate available
- **30 Days Duration** - Full month of elite privileges

## The Elite Advantage

**Unlimited Potential**
10 competitions per day means you can run specialized events:
- Morning scalp battles
- Lunch break quick trades
- Evening swing competitions
- Weekend tournaments

**Massive Scale**
150 participants per competition enables:
- Prize pools worth thousands of credits
- Tournament-style bracket competitions
- Community-wide events that go viral

**Maximum Earnings**
At 10% referral rate, your passive income potential is unmatched:
- 10,000 credits in referral entry fees = 1,000 credits earned
- Your subscription pays for itself with just one successful referral push

## Built For

- Professional trading community managers
- Large Discord servers (1000+ members)
- Influencers with substantial followings
- Trading educators and course creators

## Elite Perks

👑 Priority support for event issues
👑 Higher visibility in platform promotions
👑 Exclusive Elite badge on your profile

*"At the top, there's only one tier. Welcome to Elite."*`,
  category: "gamemaster",
  price: 999,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: [
    "gamemaster",
    "elite",
    "referral",
    "premium",
    "unlimited",
    "best-value",
  ],
  riskLevel: "low",
  gameMasterConfig: {
    maxCompetitionsPerDay: 10,
    maxUsersPerCompetition: 150,
    referralFeePercentage: 10,
    subscriptionDurationDays: 30,
    canCreateCompetitions: true,
    canEarnFromChallenges: true, // Elite package includes challenge earnings
    challengeReferralFeePercentage: 7, // 7% for challenges (higher tier)
  },
};

// ============================================================================
// ALL ITEMS - Indicators, Strategies, Cosmetics, and Game Master Packages
// ============================================================================

const ALL_ITEMS = [
  // Indicators (Original 6)
  SIMPLE_MA_INDICATOR, // Free SMA
  EMA_INDICATOR, // EMA
  BOLLINGER_BANDS_INDICATOR, // Bollinger Bands
  SUPPORT_RESISTANCE_INDICATOR, // S/R Levels
  RSI_INDICATOR, // RSI
  MACD_INDICATOR, // MACD
  // New Indicators (20 Advanced)
  WMA_INDICATOR, // Weighted Moving Average
  DEMA_INDICATOR, // Double Exponential MA
  TEMA_INDICATOR, // Triple Exponential MA
  HMA_INDICATOR, // Hull Moving Average
  KELTNER_INDICATOR, // Keltner Channels
  DONCHIAN_INDICATOR, // Donchian Channel
  ICHIMOKU_INDICATOR, // Ichimoku Cloud
  STOCHASTIC_INDICATOR, // Stochastic Oscillator
  WILLIAMS_R_INDICATOR, // Williams %R
  CCI_INDICATOR, // Commodity Channel Index
  ADX_INDICATOR, // Average Directional Index
  MFI_INDICATOR, // Money Flow Index
  ATR_INDICATOR, // Average True Range
  VWAP_INDICATOR, // VWAP
  PARABOLIC_SAR_INDICATOR, // Parabolic SAR
  PIVOT_POINTS_INDICATOR, // Pivot Points
  OBV_INDICATOR, // On Balance Volume
  ROC_INDICATOR, // Rate of Change
  CMF_INDICATOR, // Chaikin Money Flow
  MOMENTUM_INDICATOR, // Momentum Oscillator (Free)
  // Strategies
  MA_CROSSOVER_STRATEGY, // MA + RSI strategy
  // Cosmetic Avatars
  AVATAR_SHADOW_TRADER,
  AVATAR_PHANTOM_OPERATIVE,
  AVATAR_CYBER_RONIN,
  AVATAR_CRYPTO_ORACLE,
  AVATAR_NEBULA_SNIPER,
  AVATAR_BLOOD_SHOGUN,
  AVATAR_VOID_HUNTER,
  AVATAR_INFERNO_LORD,
  AVATAR_ALCHEMIST_PRIME,
  AVATAR_STORM_CENTURION,
  AVATAR_QUANTUM_SAGE,
  AVATAR_DIGITAL_ASSASSIN,
  // Game Master Packages
  GAMEMASTER_STARTER_PACKAGE,
  GAMEMASTER_PRO_PACKAGE,
  GAMEMASTER_ELITE_PACKAGE,
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

export async function seedMarketplaceItems(
  adminId: string = "system",
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  await connectToDatabase();

  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const itemData of ALL_ITEMS) {
    try {
      // Check if item already exists
      const existing = await MarketplaceItem.findOne({ slug: itemData.slug });

      if (existing) {
        // Update existing item - ensure all required fields are set
        // BUT preserve admin-uploaded data (images, custom descriptions, etc.)
        existing.indicatorType = itemData.indicatorType;
        existing.strategyConfig = itemData.strategyConfig as any;
        existing.cosmeticType = itemData.cosmeticType as any;
        // PRESERVE existing imageUrl if admin has uploaded one - only set if empty
        if (!existing.imageUrl && itemData.imageUrl) {
          existing.imageUrl = itemData.imageUrl;
        }
        // PRESERVE existing iconName if admin has selected one
        if (!existing.iconName && itemData.iconName) {
          existing.iconName = itemData.iconName;
        }
        existing.codeTemplate = itemData.codeTemplate || existing.codeTemplate;
        existing.defaultSettings =
          itemData.defaultSettings || existing.defaultSettings;
        // PRESERVE existing descriptions if admin has customized them
        if (!existing.fullDescription && itemData.fullDescription) {
          existing.fullDescription = itemData.fullDescription;
        }
        if (!existing.shortDescription && itemData.shortDescription) {
          existing.shortDescription = itemData.shortDescription;
        }
        existing.version = itemData.version || existing.version;
        // CRITICAL: Ensure these are set correctly for items to appear
        existing.isPublished = itemData.isPublished ?? true;
        existing.status = itemData.status || "active";
        existing.category = itemData.category || existing.category;
        // PRESERVE existing price if admin has customized it (only update if 0 or undefined)
        if (existing.price === 0 || existing.price === undefined) {
          existing.price = itemData.price ?? existing.price;
        }
        existing.isFree = itemData.isFree ?? existing.isFree;
        // ALWAYS sync isFeatured from template to ensure consistency
        // Admin can still change it manually after seeding
        if (itemData.isFeatured !== undefined) {
          existing.isFeatured = itemData.isFeatured;
        }
        // PRESERVE existing tags, merge if needed
        if (!existing.tags || existing.tags.length === 0) {
          existing.tags = itemData.tags || existing.tags;
        }
        // Update Game Master config if present
        if (itemData.gameMasterConfig) {
          existing.gameMasterConfig = itemData.gameMasterConfig as any;
        }
        await existing.save();
        result.updated++;
        continue;
      }

      // Create new item
      await MarketplaceItem.create({
        ...itemData,
        createdBy: adminId,
      });
      result.created++;
    } catch (error) {
      result.errors.push(
        `Failed to create ${itemData.slug}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  console.log(
    `✅ Marketplace seeded: ${result.created} created, ${result.updated} updated`,
  );

  return result;
}

export async function getMarketplaceStats(): Promise<{
  totalItems: number;
  totalIndicators: number;
  totalStrategies: number;
  totalCosmetics: number;
  totalGameMasterPackages: number;
  totalPurchases: number;
}> {
  await connectToDatabase();

  const [
    totalItems,
    totalIndicators,
    totalStrategies,
    totalCosmetics,
    totalGameMasterPackages,
  ] = await Promise.all([
    MarketplaceItem.countDocuments({ isPublished: true }),
    MarketplaceItem.countDocuments({
      isPublished: true,
      category: "indicator",
    }),
    MarketplaceItem.countDocuments({ isPublished: true, category: "strategy" }),
    MarketplaceItem.countDocuments({ isPublished: true, category: "cosmetic" }),
    MarketplaceItem.countDocuments({
      isPublished: true,
      category: "gamemaster",
    }),
  ]);

  const { UserPurchase } =
    await import("@/database/models/marketplace/user-purchase.model");
  const totalPurchases = await UserPurchase.countDocuments();

  return {
    totalItems,
    totalIndicators,
    totalStrategies,
    totalCosmetics,
    totalGameMasterPackages,
    totalPurchases,
  };
}

/**
 * Get available indicator types that have chart implementations
 */
export function getAvailableIndicatorTypes() {
  return [
    {
      type: "sma",
      name: "SMA",
      description: "Simple Moving Average",
      displayType: "overlay",
    },
    {
      type: "ema",
      name: "EMA",
      description: "Exponential Moving Average",
      displayType: "overlay",
    },
    {
      type: "bb",
      name: "Bollinger Bands",
      description: "Volatility bands",
      displayType: "overlay",
    },
    {
      type: "support_resistance",
      name: "S/R Levels",
      description: "Auto support/resistance",
      displayType: "overlay",
    },
    {
      type: "rsi",
      name: "RSI",
      description: "Relative Strength Index",
      displayType: "oscillator",
    },
    {
      type: "macd",
      name: "MACD",
      description: "Moving Average Convergence Divergence",
      displayType: "oscillator",
    },
  ];
}
