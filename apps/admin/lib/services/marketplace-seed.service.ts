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
import { readFile } from "fs/promises";
import path from "path";

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
// BATCH 3: 40 MORE ADVANCED INDICATORS
// ============================================================================

// Helper to create indicator items compactly
function mkIndicator(
  name: string, slug: string, shortDesc: string, fullDesc: string,
  indicatorType: string, displayType: "overlay" | "oscillator",
  price: number, defaultSettings: Record<string, unknown>,
  tags: string[], opts?: { isFeatured?: boolean; isFree?: boolean },
): Partial<IMarketplaceItem> {
  return {
    name, slug, shortDescription: shortDesc, fullDescription: fullDesc,
    category: "indicator", price, isFree: opts?.isFree ?? price === 0,
    status: "active", isPublished: true, isFeatured: opts?.isFeatured ?? false,
    version: "1.0.0", indicatorType: indicatorType as any,
    codeTemplate: JSON.stringify({ type: indicatorType, displayType, description: shortDesc }, null, 2),
    defaultSettings: { color: "#3b82f6", lineWidth: 2, ...defaultSettings },
    supportedAssets: [], tags, riskLevel: "low",
  };
}

const ALMA_IND = mkIndicator("Arnaud Legoux Moving Average", "arnaud-legoux-ma",
  "ALMA uses Gaussian distribution for ultra-smooth, low-lag price tracking.",
  `# Arnaud Legoux Moving Average (ALMA)\n\nUses a Gaussian-weighted window that can be shifted along the price series. Produces an incredibly smooth line with adjustable lag via the offset parameter.\n\n## Settings\n- **Period**: Window size (default: 20)\n- **Offset**: Shift factor 0-1 (default: 0.85)\n- **Sigma**: Gaussian width (default: 6)\n\n## Why Use ALMA\n- Smoother than EMA with less lag\n- Customizable via offset/sigma\n- Excellent for trend identification`,
  "alma", "overlay", 200, { period: 20, offset: 0.85, sigma: 6, color: "#8b5cf6" },
  ["moving-average", "alma", "gaussian", "smooth", "advanced"]);

const KAMA_IND = mkIndicator("Kaufman Adaptive Moving Average", "kaufman-adaptive-ma",
  "KAMA automatically adjusts speed based on market noise — fast in trends, slow in ranges.",
  `# Kaufman Adaptive Moving Average (KAMA)\n\nAdapts its smoothing constant based on the Efficiency Ratio (direction vs noise). In strong trends it acts fast; in choppy markets it barely moves.\n\n## Settings\n- **Period**: ER lookback (default: 10)\n\n## Key Advantage\nSelf-adjusting — no need to switch between fast/slow MAs.`,
  "kama", "overlay", 250, { period: 10, color: "#06b6d4" },
  ["moving-average", "kama", "adaptive", "smart", "advanced"], { isFeatured: true });

const ZLEMA_IND = mkIndicator("Zero-Lag EMA", "zero-lag-ema",
  "ZLEMA removes inherent EMA lag by pre-adjusting price data.",
  `# Zero-Lag Exponential Moving Average\n\nSubtracts the lag component from the data before applying EMA, resulting in a line that tracks current price more closely.\n\n## Settings\n- **Period**: EMA period (default: 20)\n\n## Best For\n- Scalping where every bar matters\n- Faster crossover signals`,
  "zlema", "overlay", 150, { period: 20, color: "#f97316" },
  ["moving-average", "zlema", "zero-lag", "fast"]);

const T3_IND = mkIndicator("Tillson T3", "tillson-t3",
  "T3 applies six-pass EMA smoothing for an incredibly smooth, responsive line.",
  `# Tillson T3 Moving Average\n\nSix cascaded EMAs with volume factor control produce one of the smoothest moving averages available while maintaining good responsiveness.\n\n## Settings\n- **Period**: EMA period (default: 5)\n- **Volume Factor**: Smoothing control 0-1 (default: 0.7)\n\n## Why Traders Love T3\n- Ultra-smooth output\n- Very little overshoot\n- Great for trend determination`,
  "t3", "overlay", 250, { period: 5, vFactor: 0.7, color: "#ec4899" },
  ["moving-average", "t3", "tillson", "ultra-smooth", "advanced"], { isFeatured: true });

const SMMA_IND = mkIndicator("Smoothed Moving Average", "smoothed-ma",
  "SMMA provides extra smoothing compared to SMA with a unique recursive formula.",
  `# Smoothed Moving Average (SMMA)\n\nSimilar to EMA but with a different smoothing approach: SMMA(n) = (SMMA(n-1) × (period-1) + close) / period.\n\n## Settings\n- **Period**: Lookback (default: 20)`,
  "smma", "overlay", 100, { period: 20, color: "#22c55e" },
  ["moving-average", "smma", "smooth"]);

const LSMA_IND = mkIndicator("Least Squares Moving Average", "least-squares-ma",
  "LSMA fits a regression line to price — shows where price should be mathematically.",
  `# Least Squares Moving Average (LSMA)\n\nAlso called Linear Regression Value. Fits a straight line via least-squares and uses the endpoint as the current value.\n\n## Settings\n- **Period**: Regression window (default: 25)\n\n## Advantage\nShows the mathematical trend direction with no lag at the current bar.`,
  "lsma", "overlay", 150, { period: 25, color: "#6366f1" },
  ["moving-average", "lsma", "regression", "linear"]);

const VIDYA_IND = mkIndicator("Variable Index Dynamic Average", "vidya",
  "VIDYA adapts smoothing using the Chande Momentum Oscillator for volatility awareness.",
  `# Variable Index Dynamic Average (VIDYA)\n\nUses CMO to gauge volatility and dynamically adjust EMA speed. High volatility = fast response; low volatility = smooth.\n\n## Settings\n- **Period**: Smoothing period (default: 20)`,
  "vidya", "overlay", 200, { period: 20, color: "#a855f7" },
  ["moving-average", "vidya", "adaptive", "volatility-aware"]);

const MCGINLEY_IND = mkIndicator("McGinley Dynamic", "mcginley-dynamic",
  "Self-adjusting MA that automatically speeds up in downtrends and slows in uptrends.",
  `# McGinley Dynamic\n\nCreated by John McGinley, this indicator self-adjusts its speed based on the ratio of price to its current value. It virtually eliminates whipsaws.\n\n## Settings\n- **Period**: Base period (default: 14)\n\n## Why It's Special\n- Automatically adjusts speed\n- No parameter optimization needed\n- Stays close to price without whipsaws`,
  "mcginley", "overlay", 200, { period: 14, color: "#0ea5e9" },
  ["moving-average", "mcginley", "self-adjusting", "dynamic"]);

const VWMA_IND = mkIndicator("Volume Weighted Moving Average", "volume-weighted-ma",
  "VWMA weights each price bar by its volume — high-volume bars have more influence.",
  `# Volume Weighted Moving Average (VWMA)\n\nLike SMA but each price is multiplied by its volume before averaging. High-volume bars dominate the calculation.\n\n## Settings\n- **Period**: Lookback (default: 20)\n\n## VWMA vs SMA\n- VWMA above SMA = buying pressure\n- VWMA below SMA = selling pressure`,
  "vwma", "overlay", 150, { period: 20, color: "#14b8a6" },
  ["moving-average", "vwma", "volume", "weighted"]);

const SUPERTREND_IND = mkIndicator("Supertrend", "supertrend",
  "Supertrend uses ATR to create a dynamic trailing stop that flips with trend changes.",
  `# Supertrend\n\nOne of the most popular trend-following indicators. Uses ATR bands around the median price. When price crosses the band, the trend flips.\n\n## Settings\n- **Period**: ATR period (default: 10)\n- **Multiplier**: ATR multiplier (default: 3)\n\n## Trading\n- Green line below price = Uptrend (buy)\n- Red line above price = Downtrend (sell)\n- Band flip = Entry/exit signal`,
  "supertrend", "overlay", 300, { period: 10, multiplier: 3, color: "#00e676" },
  ["trend", "supertrend", "atr", "trailing-stop", "popular"], { isFeatured: true });

const AROON_IND = mkIndicator("Aroon Oscillator", "aroon-oscillator",
  "Aroon measures time since the highest high and lowest low to identify trends early.",
  `# Aroon Oscillator\n\nAroon Up measures bars since highest high; Aroon Down measures bars since lowest low. Both scale 0-100.\n\n## Settings\n- **Period**: Lookback (default: 25)\n\n## Reading\n- Aroon Up > 70 + Down < 30 = Strong uptrend\n- Aroon Down > 70 + Up < 30 = Strong downtrend\n- Crossovers signal trend changes`,
  "aroon", "oscillator", 200, { period: 25, color: "#00e676" },
  ["trend", "aroon", "oscillator", "timing"]);

const VORTEX_IND = mkIndicator("Vortex Indicator", "vortex-indicator",
  "Vortex measures positive and negative trend movement to identify trend direction.",
  `# Vortex Indicator\n\nCompares upward and downward price movement distances relative to true range. VI+ crossing above VI- signals bullish; below signals bearish.\n\n## Settings\n- **Period**: Smoothing (default: 14)`,
  "vortex", "oscillator", 200, { period: 14, color: "#00e676" },
  ["trend", "vortex", "directional"]);

const TRIX_IND = mkIndicator("TRIX", "trix-indicator",
  "TRIX is a triple-smoothed EMA rate of change — eliminates noise, shows pure momentum.",
  `# TRIX (Triple Exponential Average)\n\nApplies EMA three times, then calculates the percentage change. The triple smoothing eliminates virtually all noise.\n\n## Settings\n- **Period**: EMA period (default: 15)\n\n## Signals\n- TRIX above zero = Bullish momentum\n- TRIX below zero = Bearish momentum\n- Zero crossovers = Trade signals`,
  "trix", "oscillator", 200, { period: 15, color: "#8b5cf6" },
  ["momentum", "trix", "triple-smoothed", "noise-free"]);

const DPO_IND = mkIndicator("Detrended Price Oscillator", "detrended-price-osc",
  "DPO removes the trend to show underlying cycles in price data.",
  `# Detrended Price Oscillator (DPO)\n\nRemoves the longer-term trend from prices, leaving only the cyclical patterns. Useful for identifying cycle peaks and troughs.\n\n## Settings\n- **Period**: Detrending period (default: 20)`,
  "dpo", "oscillator", 150, { period: 20, color: "#f59e0b" },
  ["momentum", "dpo", "cycles", "detrended"]);

const KST_IND = mkIndicator("Know Sure Thing", "know-sure-thing",
  "KST combines four weighted ROC smoothings for a reliable momentum oscillator.",
  `# Know Sure Thing (KST)\n\nDeveloped by Martin Pring. Combines smoothed ROC at 4 different timeframes (10,15,20,30) weighted 1:2:3:4.\n\n## Signals\n- KST above zero = Bullish\n- KST below zero = Bearish\n- Excellent for confirming trend changes`,
  "kst", "oscillator", 250, { color: "#6366f1" },
  ["momentum", "kst", "multi-timeframe", "weighted-roc"], { isFeatured: true });

const COPPOCK_IND = mkIndicator("Coppock Curve", "coppock-curve",
  "Coppock Curve identifies long-term buying opportunities after market bottoms.",
  `# Coppock Curve\n\nDesigned to identify major market bottoms. Combines long-term and short-term ROC smoothed by WMA.\n\n## Settings\n- **WMA Period**: Smoothing (default: 10)\n- **Long ROC**: Long rate of change (default: 14)\n- **Short ROC**: Short rate of change (default: 11)\n\n## Use\nBuy signal when Coppock turns up from below zero.`,
  "coppock", "oscillator", 200, { wmaPeriod: 10, longROC: 14, shortROC: 11, color: "#0ea5e9" },
  ["momentum", "coppock", "long-term", "bottoms"]);

const ELDER_RAY_IND = mkIndicator("Elder Ray", "elder-ray",
  "Elder Ray shows bull and bear power — the strength of buyers vs sellers.",
  `# Elder Ray (Bull/Bear Power)\n\nCreated by Dr. Alexander Elder. Bull Power = High - EMA; Bear Power = Low - EMA.\n\n## Settings\n- **Period**: EMA period (default: 13)\n\n## Trading\n- Both positive = Strong uptrend\n- Both negative = Strong downtrend\n- Divergences signal reversals`,
  "elder_ray", "oscillator", 200, { period: 13, color: "#00e676" },
  ["trend", "elder-ray", "bull-bear", "power"]);

const STDDEV_IND = mkIndicator("Standard Deviation", "standard-deviation",
  "Measures price volatility — how much price deviates from its mean.",
  `# Standard Deviation\n\nThe foundation of volatility measurement. Shows how dispersed prices are from their average.\n\n## Settings\n- **Period**: Lookback (default: 20)\n\n## Use\n- Rising = Increasing volatility\n- Falling = Decreasing volatility\n- Used to determine position sizing and stop distances`,
  "std_dev", "oscillator", 100, { period: 20, color: "#f59e0b" },
  ["volatility", "std-dev", "statistics"]);

const HISTVOL_IND = mkIndicator("Historical Volatility", "historical-volatility",
  "Annualized volatility from log returns — the professional measure of market risk.",
  `# Historical Volatility\n\nCalculates standard deviation of log returns, annualized to show volatility as a percentage.\n\n## Settings\n- **Period**: Lookback (default: 20)\n\n## Reading\n- 10-15% = Low volatility\n- 20-30% = Normal\n- 40%+ = High volatility`,
  "hist_volatility", "oscillator", 200, { period: 20, color: "#ef4444" },
  ["volatility", "historical", "risk", "professional"]);

const CHKVOL_IND = mkIndicator("Chaikin Volatility", "chaikin-volatility",
  "Measures the rate of change in the high-low spread — shows volatility acceleration.",
  `# Chaikin Volatility\n\nCalculates the ROC of an EMA of the High-Low range. Shows whether volatility is expanding or contracting.\n\n## Settings\n- **EMA Period**: Smoothing (default: 10)\n- **ROC Period**: Change period (default: 10)`,
  "chaikin_volatility", "oscillator", 150, { emaPeriod: 10, rocPeriod: 10, color: "#a855f7" },
  ["volatility", "chaikin", "range"]);

const MASSIDX_IND = mkIndicator("Mass Index", "mass-index",
  "Mass Index detects trend reversals by measuring high-low range narrowing and widening.",
  `# Mass Index\n\nLooks for a \"reversal bulge\" pattern where the EMA ratio sum rises above 27 then falls below 26.5.\n\n## Settings\n- **EMA Period**: (default: 9)\n- **Sum Period**: (default: 25)\n\n## Signal\nBulge above 27 followed by drop below 26.5 = Potential reversal.`,
  "mass_index", "oscillator", 200, { emaPeriod: 9, sumPeriod: 25, color: "#ec4899" },
  ["volatility", "mass-index", "reversal"]);

const ULCER_IND = mkIndicator("Ulcer Index", "ulcer-index",
  "Ulcer Index measures downside risk — how much drawdown investors experience.",
  `# Ulcer Index\n\nUnlike standard deviation (which measures both up and down), Ulcer Index only measures downside volatility — the pain of drawdowns.\n\n## Settings\n- **Period**: Lookback (default: 14)\n\n## Why Use It\n- Measures real investor pain\n- Better risk metric than standard deviation\n- Used in the Ulcer Performance Index (Martin Ratio)`,
  "ulcer_index", "oscillator", 150, { period: 14, color: "#f23645" },
  ["volatility", "ulcer", "drawdown", "risk"]);

const RVI_IND = mkIndicator("Relative Volatility Index", "relative-volatility-index",
  "RVI applies RSI logic to standard deviation — shows directional volatility.",
  `# Relative Volatility Index (RVI)\n\nApplies RSI-style smoothing to standard deviation values instead of price. Shows whether volatility is rising on up days or down days.\n\n## Settings\n- **Period**: Std Dev period (default: 10)\n\n## Reading\n- Above 50 = Volatility increasing on up moves\n- Below 50 = Volatility increasing on down moves`,
  "rvi", "oscillator", 200, { period: 10, color: "#14b8a6" },
  ["volatility", "rvi", "directional"]);

const ADLINE_IND = mkIndicator("Accumulation/Distribution Line", "ad-line",
  "A/D Line tracks cumulative money flow based on where price closes within its range.",
  `# Accumulation/Distribution Line\n\nCumulative indicator: adds (close near high) or subtracts (close near low) volume-weighted values.\n\n## No Parameters\nUses the Close Location Value × Volume cumulatively.\n\n## Divergence Trading\n- Price making new highs + A/D not = Distribution (bearish)\n- Price making new lows + A/D not = Accumulation (bullish)`,
  "ad_line", "oscillator", 150, { color: "#22c55e" },
  ["volume", "accumulation", "distribution", "a-d-line"]);

const FORCEIDX_IND = mkIndicator("Force Index", "force-index",
  "Force Index combines price change and volume to measure buying/selling pressure.",
  `# Force Index\n\nForce = (Close - Previous Close) × Volume, then smoothed with EMA.\n\n## Settings\n- **Period**: EMA smoothing (default: 13)\n\n## Signals\n- Positive = Buying force\n- Negative = Selling force\n- Zero-line crossovers = Shift in control`,
  "force_index", "oscillator", 150, { period: 13, color: "#3b82f6" },
  ["volume", "force", "buying-selling"]);

const EOM_IND = mkIndicator("Ease of Movement", "ease-of-movement",
  "EOM measures how easily price moves — combines range and volume efficiency.",
  `# Ease of Movement\n\nMeasures the relationship between price movement and volume. High values = price moves easily on low volume.\n\n## Settings\n- **Period**: SMA smoothing (default: 14)\n\n## Reading\n- Above zero = Buyers have it easy\n- Below zero = Sellers have it easy`,
  "eom", "oscillator", 150, { period: 14, color: "#f97316" },
  ["volume", "ease-of-movement", "efficiency"]);

const NVI_IND = mkIndicator("Negative Volume Index", "negative-volume-index",
  "NVI only changes on low-volume days — tracks what smart money does quietly.",
  `# Negative Volume Index\n\nOnly updates when today's volume is LOWER than yesterday's. Theory: smart money trades on quiet days.\n\n## No Parameters\nStarts at 1000 and accumulates.\n\n## Classic Signal\nNVI above its 255-day MA = 96% chance of a bull market (per Norman Fosback).`,
  "nvi", "oscillator", 200, { color: "#6366f1" },
  ["volume", "nvi", "smart-money"]);

const PVI_IND = mkIndicator("Positive Volume Index", "positive-volume-index",
  "PVI only changes on high-volume days — tracks crowd/emotional trading activity.",
  `# Positive Volume Index\n\nOnly updates when today's volume is HIGHER than yesterday's. Theory: the crowd is most active on high-volume days.\n\n## No Parameters\nStarts at 1000 and accumulates.`,
  "pvi", "oscillator", 200, { color: "#0ea5e9" },
  ["volume", "pvi", "crowd"]);

const ULTOSC_IND = mkIndicator("Ultimate Oscillator", "ultimate-oscillator",
  "Combines three timeframes to reduce false signals that plague single-period oscillators.",
  `# Ultimate Oscillator\n\nCreated by Larry Williams. Uses buying pressure across 7, 14, and 28-period timeframes, weighted 4:2:1.\n\n## Settings\n- **Period 1**: Fast (default: 7)\n- **Period 2**: Medium (default: 14)\n- **Period 3**: Slow (default: 28)\n\n## Signals\n- Above 70 = Overbought\n- Below 30 = Oversold\n- Divergences are the primary signal`,
  "ultimate_osc", "oscillator", 200, { period1: 7, period2: 14, period3: 28, color: "#8b5cf6" },
  ["oscillator", "ultimate", "multi-timeframe"]);

const AWEOSC_IND = mkIndicator("Awesome Oscillator", "awesome-oscillator",
  "Bill Williams' AO shows market momentum using the difference between 5 and 34-period SMAs.",
  `# Awesome Oscillator\n\nSimply: SMA(5) of median price minus SMA(34) of median price. Created by Bill Williams.\n\n## No Parameters\nFixed 5 and 34-period SMAs of (High+Low)/2.\n\n## Signals\n- Zero-line crossover = Trend change\n- Twin peaks (saucer) = Continuation\n- Above zero = Bullish momentum`,
  "awesome_osc", "oscillator", 150, { color: "#22c55e" },
  ["momentum", "awesome", "bill-williams"]);

const STOCHRSI_IND = mkIndicator("Stochastic RSI", "stochastic-rsi",
  "StochRSI applies Stochastic formula to RSI — more sensitive and extreme readings.",
  `# Stochastic RSI\n\nApplies the Stochastic oscillator formula to RSI values instead of price. Creates a more sensitive oscillator with faster signals.\n\n## Settings\n- **RSI Period**: (default: 14)\n- **Stoch Period**: (default: 14)\n- **K Smooth**: (default: 3)\n- **D Smooth**: (default: 3)\n\n## Signals\n- Above 80 = Overbought\n- Below 20 = Oversold\n- K/D crossovers`,
  "stochrsi", "oscillator", 250, { rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3, color: "#3b82f6" },
  ["oscillator", "stochrsi", "stochastic", "rsi", "sensitive"], { isFeatured: true });

const TSI_IND = mkIndicator("True Strength Index", "true-strength-index",
  "TSI double-smooths price momentum to show clean trend direction and strength.",
  `# True Strength Index (TSI)\n\nDouble-smooths momentum (price change) using two EMAs. The result is a clean oscillator between -100 and +100.\n\n## Settings\n- **Long Period**: Slow smoothing (default: 25)\n- **Short Period**: Fast smoothing (default: 13)\n\n## Trading\n- Above zero = Bullish\n- Below zero = Bearish\n- Divergences signal reversals`,
  "tsi", "oscillator", 200, { longPeriod: 25, shortPeriod: 13, color: "#ef4444" },
  ["momentum", "tsi", "double-smoothed"]);

const PPO_IND = mkIndicator("Percentage Price Oscillator", "percentage-price-osc",
  "PPO is MACD expressed as a percentage — enables comparison across different assets.",
  `# Percentage Price Oscillator (PPO)\n\nLike MACD but expressed as a percentage of the slow EMA. This allows comparison between assets with different price levels.\n\n## Settings\n- **Fast**: Fast EMA (default: 12)\n- **Slow**: Slow EMA (default: 26)\n- **Signal**: Signal line (default: 9)\n\n## PPO vs MACD\n- PPO = (Fast EMA - Slow EMA) / Slow EMA × 100\n- Comparable across different priced assets`,
  "ppo", "oscillator", 200, { fast: 12, slow: 26, signal: 9, color: "#f97316" },
  ["momentum", "ppo", "percentage", "comparable"]);

const FISHER_IND = mkIndicator("Fisher Transform", "fisher-transform",
  "Fisher Transform converts prices to Gaussian distribution for sharp turning point signals.",
  `# Fisher Transform\n\nApplies mathematical transformation that forces price into a Gaussian distribution, creating sharp peaks at turning points.\n\n## Settings\n- **Period**: Lookback (default: 9)\n\n## Key Benefit\nClear, sharp reversal signals — the Fisher Transform peaks are more defined than RSI or Stochastic extremes.`,
  "fisher", "oscillator", 250, { period: 9, color: "#a855f7" },
  ["oscillator", "fisher", "gaussian", "turning-points"], { isFeatured: true });

const CRSI_IND = mkIndicator("Connors RSI", "connors-rsi",
  "Connors RSI combines 3 components for a statistically robust mean-reversion signal.",
  `# Connors RSI\n\nCombines: (1) Short-term RSI, (2) RSI of up/down streak length, (3) Percentile rank of recent returns.\n\n## Settings\n- **RSI Period**: (default: 3)\n- **Streak Period**: (default: 2)\n- **Rank Period**: (default: 100)\n\n## Trading\n- Below 10 = Strong buy signal\n- Above 90 = Strong sell signal\n- Developed by Larry Connors with backtested edge`,
  "connors_rsi", "oscillator", 300, { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100, color: "#ec4899" },
  ["oscillator", "connors", "mean-reversion", "statistical"], { isFeatured: true });

const SMI_IND = mkIndicator("SMI Ergodic Oscillator", "smi-ergodic",
  "SMI Ergodic uses TSI with a signal line for clean momentum crossover signals.",
  `# SMI Ergodic Oscillator\n\nBased on the True Strength Index with an added signal line. Produces cleaner crossover signals than MACD.\n\n## Settings\n- **Short Period**: Fast (default: 5)\n- **Long Period**: Slow (default: 20)\n- **Signal Period**: Signal EMA (default: 5)\n\n## Signals\n- Main crosses above signal = Buy\n- Main crosses below signal = Sell`,
  "smi_ergodic", "oscillator", 200, { shortPeriod: 5, longPeriod: 20, signalPeriod: 5, color: "#0ea5e9" },
  ["oscillator", "smi", "ergodic", "crossover"]);

const LINREG_IND = mkIndicator("Linear Regression Channel", "linear-regression-channel",
  "Statistical channel with regression line center and standard error bands.",
  `# Linear Regression Channel\n\nFits a regression line to price data and adds standard error bands above/below.\n\n## Settings\n- **Period**: Regression window (default: 100)\n- **Deviations**: Band width (default: 2)\n\n## Trading\n- Price at upper band = Potential short\n- Price at lower band = Potential long\n- Slope shows mathematical trend direction`,
  "linreg_channel", "overlay", 250, { period: 100, deviations: 2, color: "#6366f1" },
  ["channel", "regression", "statistical", "bands"]);

const ENVELOPE_IND = mkIndicator("Moving Average Envelope", "ma-envelope",
  "Fixed-percentage bands around SMA — simple but effective support/resistance zones.",
  `# Moving Average Envelope\n\nPlaces bands at a fixed percentage above and below a simple moving average.\n\n## Settings\n- **Period**: SMA period (default: 20)\n- **Percentage**: Band distance (default: 2.5%)\n\n## Use Cases\n- Mean reversion trading at band boundaries\n- Identifying overextended price moves\n- Position sizing based on distance from MA`,
  "ma_envelope", "overlay", 150, { period: 20, percentage: 2.5, color: "#14b8a6" },
  ["channel", "envelope", "bands", "mean-reversion"]);

const PRICECH_IND = mkIndicator("Price Channel", "price-channel",
  "Breakout channel using prior period's highest high and lowest low.",
  `# Price Channel\n\nUpper band = highest high of prior N periods. Lower band = lowest low of prior N periods. Similar to Donchian but uses prior period only.\n\n## Settings\n- **Period**: Lookback (default: 20)\n\n## Trading\n- Price breaks above upper = Bullish breakout\n- Price breaks below lower = Bearish breakout`,
  "price_channel", "overlay", 150, { period: 20, color: "#f59e0b" },
  ["channel", "breakout", "price-channel"]);

const CHANDELIER_IND = mkIndicator("Chandelier Exit", "chandelier-exit",
  "ATR-based trailing stop designed to keep you in trends and exit on reversals.",
  `# Chandelier Exit\n\nTrailing stop: Exit Long = Highest High - (Multiplier × ATR). Exit Short = Lowest Low + (Multiplier × ATR).\n\n## Settings\n- **Period**: ATR/High-Low period (default: 22)\n- **Multiplier**: ATR multiple (default: 3)\n\n## Created by Charles Le Beau\n- Hangs from the highest high like a chandelier\n- Drops with the trend but never rises (for longs)\n- Excellent for trend-following exits`,
  "chandelier", "overlay", 250, { period: 22, multiplier: 3, color: "#ef4444" },
  ["channel", "chandelier", "exit", "trailing-stop", "atr"]);

// ============================================================================
// PREMIUM MARKETPLACE-ONLY INDICATORS (40 unique, creative - NOT in free chart)
// ============================================================================

const PREM_TREND_PULSE = mkIndicator("Trend Pulse", "trend-pulse",
  "AI-style composite: blends ADX strength with RSI direction into a single health score.",
  `# Trend Pulse\n\nCombines the directional strength from ADX with the momentum bias from RSI into one clean 0-100 score.\n\n- **Above 70**: Strong bullish trend\n- **Below 30**: Strong bearish trend\n- **40-60**: Choppy / no clear trend\n\nPerfect for quick trend assessment without multiple indicators.`,
  "trend_pulse", "oscillator", 500, { adxPeriod: 14, rsiPeriod: 14, color: "#8b5cf6" },
  ["premium", "composite", "ai", "trend", "smart"], { isFeatured: true });

const PREM_MARKET_REGIME = mkIndicator("Market Regime Detector", "market-regime-detector",
  "Automatically classifies market into trending, ranging, or volatile states.",
  `# Market Regime Detector\n\nUses ADX + ATR expansion/contraction to determine market state:\n\n- **0-30**: Ranging market (avoid trend strategies)\n- **30-60**: Transitioning (prepare for breakout)\n- **60-100**: Strong trend (ride the wave)\n\nKnow your market before you trade.`,
  "market_regime", "oscillator", 600, { period: 20, color: "#06b6d4" },
  ["premium", "regime", "state", "classification", "smart"], { isFeatured: true });

const PREM_TREND_COMPOSITE = mkIndicator("Trend Strength Composite", "trend-strength-composite",
  "Multi-factor trend scoring: EMA slope × ADX power × momentum consensus.",
  `# Trend Strength Composite\n\nThree-dimensional trend analysis:\n1. **EMA Slope** - Is the trend accelerating or decelerating?\n2. **ADX Power** - How strong is the directional movement?\n3. **Momentum** - Does momentum confirm the trend?\n\nAll three must agree for a strong signal.`,
  "trend_composite", "oscillator", 450, { period: 14, color: "#22c55e" },
  ["premium", "composite", "multi-factor", "trend"]);

const PREM_BREADTH = mkIndicator("Composite Breadth Score", "composite-breadth-score",
  "Consensus meter: counts how many indicators agree on market direction.",
  `# Composite Breadth Score\n\nPolls 5 different indicators (RSI, MACD, Stochastic, CCI, EMA) and scores their consensus:\n\n- **80-100**: All bullish (strong buy zone)\n- **0-20**: All bearish (strong sell zone)\n- **40-60**: Mixed signals (stay cautious)\n\nThe more indicators agree, the stronger the signal.`,
  "composite_breadth", "oscillator", 400, { color: "#3b82f6" },
  ["premium", "breadth", "consensus", "multi-indicator"]);

const PREM_REVERSAL = mkIndicator("Reversal Signal Detector", "reversal-signal-detector",
  "Catches reversals by combining RSI extremes, volume spikes, and candlestick patterns.",
  `# Reversal Signal Detector\n\nComposite reversal detection that scores:\n- RSI oversold/overbought extremes\n- Hammer/shooting star candle patterns\n- Volume spike confirmation\n- Bullish/bearish engulfing patterns\n\n**Above 70**: Bullish reversal likely\n**Below 30**: Bearish reversal likely`,
  "reversal_signal", "oscillator", 550, { rsiPeriod: 14, color: "#f59e0b" },
  ["premium", "reversal", "patterns", "signals"], { isFeatured: true });

const PREM_PREDICT = mkIndicator("Predictive Range", "predictive-range",
  "Projects next-bar expected price range using ATR and momentum analysis.",
  `# Predictive Range\n\nForward-looking channel that projects where price is likely to go next:\n- Uses ATR for range estimation\n- Adjusts center based on current momentum\n- Upper/lower bands show expected price envelope\n\nGreat for setting profit targets and stop losses.`,
  "predictive_range", "overlay", 600, { period: 14, color: "#a855f7" },
  ["premium", "predictive", "forecast", "range", "targets"], { isFeatured: true });

const PREM_BREAKOUT = mkIndicator("Breakout Probability", "breakout-probability",
  "Measures energy build-up during BB/Keltner squeeze — signals imminent breakouts.",
  `# Breakout Probability\n\nDetects when Bollinger Bands contract inside Keltner Channels (the \"squeeze\"). The longer the squeeze, the higher the breakout probability:\n\n- **0-30%**: No squeeze, normal market\n- **30-70%**: Building energy\n- **70-100%**: Imminent breakout!\n\nDoesn't predict direction, only probability.`,
  "breakout_prob", "oscillator", 500, { bbPeriod: 20, keltPeriod: 20, color: "#ef4444" },
  ["premium", "breakout", "squeeze", "probability"]);

const PREM_SENTIMENT = mkIndicator("Sentiment Oscillator", "sentiment-oscillator",
  "Scores candlestick patterns numerically — hammers, engulfings, dojis, and more.",
  `# Sentiment Oscillator\n\nReads candle patterns like a pro trader:\n- Bullish engulfing: +3\n- Hammer/pin bar: +3\n- Strong body candles: ±2\n- Shooting star: -3\n- Bearish engulfing: -3\n\nSmoothed for clean signals. Positive = bullish sentiment, negative = bearish.`,
  "sentiment_osc", "oscillator", 400, { smooth: 5, color: "#ec4899" },
  ["premium", "sentiment", "candle-patterns", "price-action"]);

const PREM_WHALE = mkIndicator("Whale Accumulation", "whale-accumulation",
  "Tracks only large-volume blocks — reveals what institutional traders are doing.",
  `# Whale Accumulation\n\nFilters out retail noise by only counting volume bars that exceed the average by a threshold. Rising line = institutions buying, falling = selling.\n\n## Settings\n- **Threshold**: Volume multiple (default: 1.5x average)\n\nSee what the big players are doing.`,
  "whale_accumulation", "oscillator", 700, { threshold: 1.5, color: "#0ea5e9" },
  ["premium", "whale", "institutional", "smart-money", "volume"], { isFeatured: true });

const PREM_SMART_FLOW = mkIndicator("Smart Money Flow", "smart-money-flow",
  "Volume-weighted money flow emphasizing institutional-sized bars for true accumulation.",
  `# Smart Money Flow\n\nLike regular Money Flow but weights each bar by its relative volume. High-volume bars (institutional) dominate the calculation.\n\nRising = Smart money accumulating\nFalling = Smart money distributing`,
  "smart_money_flow", "oscillator", 550, { period: 14, color: "#14b8a6" },
  ["premium", "smart-money", "institutional", "accumulation"]);

const PREM_VOL_CLIMAX = mkIndicator("Volume Climax", "volume-climax",
  "Detects extreme volume spikes that often mark tops, bottoms, and capitulation events.",
  `# Volume Climax\n\nSpikes when volume exceeds the average by a threshold (default 2x). Shows positive spikes for bullish climax and negative for bearish.\n\n- Large positive spike = potential buying climax (top)\n- Large negative spike = potential selling climax (bottom)`,
  "volume_climax", "oscillator", 400, { period: 20, color: "#f97316" },
  ["premium", "volume", "climax", "extremes", "reversals"]);

const PREM_NET_BUYING = mkIndicator("Net Buying Pressure", "net-buying-pressure",
  "Estimates buyer vs seller aggression from within-bar price action and volume.",
  `# Net Buying Pressure\n\nFor each bar: how much of the range was \"won\" by buyers vs sellers, weighted by volume.\n\n- Positive = Buyers dominating\n- Negative = Sellers dominating\n- Divergence with price = Potential reversal`,
  "net_buying_pressure", "oscillator", 450, { period: 14, color: "#22c55e" },
  ["premium", "buying-pressure", "volume", "order-flow"]);

const PREM_ORDER_FLOW = mkIndicator("Order Flow Imbalance", "order-flow-imbalance",
  "Approximates buy vs sell volume from candlestick structure — no Level 2 needed.",
  `# Order Flow Imbalance\n\nEstimates the buy/sell volume split from each candle's close position within its range:\n\n- **+50 to +100**: Strong buying imbalance\n- **-50 to -100**: Strong selling imbalance\n- **-20 to +20**: Balanced (ranging)`,
  "order_flow_imbalance", "oscillator", 500, { period: 10, color: "#6366f1" },
  ["premium", "order-flow", "buy-sell", "imbalance"]);

const PREM_INTRADAY = mkIndicator("Intraday Intensity Index", "intraday-intensity-index",
  "Measures accumulation/distribution within each bar — where did price close in its range?",
  `# Intraday Intensity Index\n\nCalculates (2×Close - High - Low) / (High - Low) × Volume, then sums over a period.\n\n- Positive = Closing near highs (accumulation)\n- Negative = Closing near lows (distribution)`,
  "intraday_intensity", "oscillator", 350, { period: 21, color: "#a855f7" },
  ["premium", "intensity", "accumulation", "intraday"]);

const PREM_VOL_MOM = mkIndicator("Volume Momentum", "volume-momentum",
  "Rate of change of volume — shows whether trading activity is accelerating or decelerating.",
  `# Volume Momentum\n\nVolume ROC: compares current volume to volume N bars ago.\n\n- Positive spikes = Activity surging (breakout potential)\n- Negative = Activity dying (consolidation)\n\nConfirm price breakouts with volume momentum.`,
  "volume_momentum", "oscillator", 300, { period: 14, color: "#ef4444" },
  ["premium", "volume", "momentum", "acceleration"]);

const PREM_LIQUIDITY = mkIndicator("Liquidity Heatmap", "liquidity-heatmap",
  "Volume-at-price proxy showing distance from where most trading occurred.",
  `# Liquidity Heatmap\n\nCalculates the Volume Point of Control (VPOC) — the price level with the most trading activity — then shows price distance from it.\n\n- **Near zero**: Price at high-liquidity zone\n- **Far from zero**: Price extended from support\n\nMean reversion opportunities when price deviates far from VPOC.`,
  "liquidity_heatmap", "oscillator", 500, { period: 50, color: "#0ea5e9" },
  ["premium", "liquidity", "vpoc", "volume-profile"]);

const PREM_VOL_SQUEEZE = mkIndicator("Volatility Squeeze", "volatility-squeeze",
  "TTM-style squeeze: detects BB inside Keltner and shows momentum direction.",
  `# Volatility Squeeze\n\nThe famous TTM Squeeze concept:\n1. When BB contracts inside Keltner = Squeeze is ON (energy building)\n2. Momentum shows which direction the breakout will go\n3. Squeeze release = Explosive move\n\nMomentum is dampened during squeeze, amplified on release.`,
  "volatility_squeeze", "oscillator", 550, { period: 20, color: "#f59e0b" },
  ["premium", "squeeze", "ttm", "volatility", "breakout"], { isFeatured: true });

const PREM_SQZ_MOM = mkIndicator("Squeeze Momentum", "squeeze-momentum",
  "Linear regression momentum measured relative to Keltner midline during squeeze events.",
  `# Squeeze Momentum\n\nMeasures momentum as the linear regression slope of price deviation from Keltner midline.\n\n- Positive slope = Upward momentum building\n- Negative slope = Downward momentum building\n\nBest used alongside Volatility Squeeze.`,
  "squeeze_momentum", "oscillator", 400, { period: 20, color: "#8b5cf6" },
  ["premium", "squeeze", "momentum", "regression"]);

const PREM_VOL_RATIO = mkIndicator("Volatility Ratio", "volatility-ratio",
  "Current vs historical volatility — detects regime changes and expansion events.",
  `# Volatility Ratio\n\nCompares short-term ATR to long-term ATR:\n\n- **Ratio > 1.5**: Volatility expanding (breakout)\n- **Ratio < 0.5**: Volatility contracting (squeeze)\n- **Around 1.0**: Normal conditions\n\nRegime change detector — know when the market shifts gears.`,
  "volatility_ratio", "oscillator", 350, { shortPeriod: 5, longPeriod: 20, color: "#06b6d4" },
  ["premium", "volatility", "ratio", "regime"]);

const PREM_RANGE_EXP = mkIndicator("Range Expansion Index", "range-expansion-index",
  "Measures today's range vs average — catches breakout bars and unusual activity.",
  `# Range Expansion Index\n\nShows how much the current bar's range exceeds (or falls below) the recent average:\n\n- **+100%**: Range is 2x normal (breakout bar)\n- **0%**: Normal range\n- **-50%**: Range is half normal (tight consolidation)`,
  "range_expansion", "oscillator", 300, { period: 14, color: "#22c55e" },
  ["premium", "range", "expansion", "breakout"]);

const PREM_CHOPPY = mkIndicator("Choppy Market Index", "choppy-market-index",
  "Detects ranging/choppy conditions — avoid false signals in trendless markets.",
  `# Choppy Market Index\n\nMathematically measures choppiness using the Choppiness Index formula:\n\n- **Above 60**: Very choppy (avoid trend trades)\n- **38-60**: Transitioning\n- **Below 38**: Strong trend (use trend strategies)\n\nSave money by not trading in choppy conditions.`,
  "choppy_market", "oscillator", 400, { period: 14, color: "#f23645" },
  ["premium", "choppy", "choppiness", "filter", "ranging"]);

const PREM_FRACTAL = mkIndicator("Fractal Dimension", "fractal-dimension",
  "Measures market complexity: 1.0 = perfectly trending, 2.0 = completely random.",
  `# Fractal Dimension\n\nBased on fractal geometry. Approximates the Hurst exponent:\n\n- **1.0-1.3**: Strongly trending (predictable)\n- **1.3-1.5**: Mildly trending\n- **1.5**: Random walk (unpredictable)\n- **1.5-2.0**: Mean-reverting\n\nQuantify market predictability.`,
  "fractal_dimension", "oscillator", 500, { period: 30, color: "#a855f7" },
  ["premium", "fractal", "complexity", "hurst", "quantitative"]);

const PREM_ACCEL_BANDS = mkIndicator("Acceleration Bands", "acceleration-bands",
  "Bands that widen/narrow based on price acceleration — dynamic breakout levels.",
  `# Acceleration Bands\n\nBands calculated from High × (1 + 2 × H-L/H) and Low × (1 - 2 × H-L/L).\n\nBand width responds to acceleration (rate of range change):\n- Wider during volatile moves\n- Tighter during consolidation\n\nBreakout above upper band = Strong bullish acceleration.`,
  "acceleration_bands", "overlay", 400, { period: 20, color: "#14b8a6" },
  ["premium", "bands", "acceleration", "dynamic"]);

const PREM_ADAPT_CH = mkIndicator("Adaptive Channel", "adaptive-channel",
  "ATR-based channel that automatically adjusts width to current volatility regime.",
  `# Adaptive Channel\n\nEMA center line with ATR-scaled bands that auto-adjust:\n- In calm markets: Tight channel\n- In volatile markets: Wide channel\n\nPrice touching bands in calm markets is significant.\nPrice touching bands in volatile markets is normal.`,
  "adaptive_channel", "overlay", 450, { period: 20, color: "#f97316" },
  ["premium", "channel", "adaptive", "volatility"]);

const PREM_ALPHA_MOM = mkIndicator("Alpha Momentum", "alpha-momentum",
  "Risk-adjusted momentum: return divided by volatility. Sharpe-ratio style scoring.",
  `# Alpha Momentum\n\nMomentum / Volatility = Risk-adjusted return score.\n\n- High positive = Strong risk-adjusted upside\n- High negative = Strong risk-adjusted downside\n- Near zero = No edge\n\nBetter than raw momentum because it accounts for risk.`,
  "alpha_momentum", "oscillator", 500, { period: 20, color: "#6366f1" },
  ["premium", "alpha", "risk-adjusted", "sharpe", "quantitative"]);

const PREM_EFFICIENCY = mkIndicator("Efficiency Ratio Oscillator", "efficiency-ratio-oscillator",
  "Direction vs noise ratio — shows how efficiently price is moving in a direction.",
  `# Efficiency Ratio Oscillator\n\nMeasures directional efficiency:\n- +100%: Perfect uptrend (all bars contributing)\n- -100%: Perfect downtrend\n- 0%: Random noise (no directional movement)\n\nKaufman's ER as a signed oscillator.`,
  "efficiency_ratio", "oscillator", 350, { period: 10, color: "#0ea5e9" },
  ["premium", "efficiency", "noise", "directional"]);

const PREM_PERSIST = mkIndicator("Trend Persistence", "trend-persistence",
  "Measures what percentage of recent bars closed higher — trend duration meter.",
  `# Trend Persistence\n\nCounts the percentage of bars that closed up in the last N periods:\n\n- **Above 70%**: Strong persistent uptrend\n- **Below 30%**: Strong persistent downtrend\n- **Around 50%**: No persistence (choppy)\n\nSimple but powerful trend filter.`,
  "trend_persistence", "oscillator", 300, { period: 20, color: "#22c55e" },
  ["premium", "persistence", "trend", "duration"]);

const PREM_MTF = mkIndicator("Multi-TF Momentum", "multi-timeframe-momentum",
  "Combines momentum from 5, 10, and 20-period views weighted by timeframe importance.",
  `# Multi-Timeframe Momentum\n\nBlends ROC from three timeframes:\n- 5-period ROC × 50% (short-term)\n- 10-period ROC × 30% (medium-term)\n- 20-period ROC × 20% (long-term)\n\nWhen all three align, the signal is strongest.`,
  "mtf_momentum", "oscillator", 450, { color: "#ec4899" },
  ["premium", "multi-timeframe", "momentum", "weighted"]);

const PREM_WAVE = mkIndicator("Momentum Wave", "momentum-wave",
  "Sine-wave fitted cycle momentum — reveals the rhythm of market oscillations.",
  `# Momentum Wave\n\nFits a sine wave to recent price changes using Fourier analysis.\n\nReveals the dominant cycle's:\n- **Amplitude**: How strong the cycle is\n- **Phase**: Where we are in the cycle\n\nPredicts the next cycle swing.`,
  "momentum_wave", "oscillator", 550, { period: 20, color: "#8b5cf6" },
  ["premium", "wave", "cycle", "fourier", "sine"], { isFeatured: true });

const PREM_GAP = mkIndicator("Gap Momentum", "gap-momentum",
  "Cumulative overnight gap impact — tracks the hidden momentum from gap opens.",
  `# Gap Momentum\n\nSums the open-to-previous-close gaps over N periods.\n\n- Positive sum = Persistent gap-up pressure\n- Negative sum = Persistent gap-down pressure\n\nGaps often reveal overnight institutional activity that intraday traders miss.`,
  "gap_momentum", "oscillator", 350, { period: 14, color: "#f59e0b" },
  ["premium", "gap", "overnight", "institutional"]);

const PREM_HA_TREND = mkIndicator("Heikin Ashi Trend", "heikin-ashi-trend",
  "Trend direction from Heikin Ashi candle analysis — smoothed trend signal 0-100.",
  `# Heikin Ashi Trend\n\nConverts to Heikin Ashi candles and counts bullish percentage:\n\n- **Above 70**: Strong HA uptrend (all candles green)\n- **Below 30**: Strong HA downtrend (all candles red)\n- **40-60**: Indecision\n\nHeikin Ashi removes noise that standard candles show.`,
  "heikin_ashi_trend", "oscillator", 400, { period: 10, color: "#06b6d4" },
  ["premium", "heikin-ashi", "trend", "smoothed"]);

const PREM_CYCLE = mkIndicator("Cycle Detector", "cycle-detector",
  "Finds the dominant market cycle period using autocorrelation analysis.",
  `# Cycle Detector\n\nUses autocorrelation to detect the dominant cycle length (in bars):\n\n- Rising value = Cycle lengthening (market slowing)\n- Falling value = Cycle shortening (market accelerating)\n\nUse the detected period to optimize other indicator settings dynamically.`,
  "cycle_detector", "oscillator", 600, { maxPeriod: 50, color: "#a855f7" },
  ["premium", "cycle", "autocorrelation", "period-detection", "quantitative"]);

const PREM_ADAPT_RSI = mkIndicator("Adaptive RSI", "adaptive-rsi",
  "RSI that automatically adjusts its period based on current market volatility.",
  `# Adaptive RSI\n\nDynamic RSI that adapts:\n- In volatile markets: Shorter RSI period (faster signals)\n- In calm markets: Longer RSI period (fewer false signals)\n\nThe period adjusts between 5-30 based on the volatility ratio. No more choosing between fast and slow RSI.`,
  "adaptive_rsi", "oscillator", 500, { period: 14, color: "#ef4444" },
  ["premium", "adaptive", "rsi", "dynamic", "volatility-adjusted"], { isFeatured: true });

const PREM_MEAN_REV = mkIndicator("Mean Reversion Bands", "mean-reversion-bands",
  "Z-score based bands showing statistically extreme price deviations from the mean.",
  `# Mean Reversion Bands\n\nStatistical bands at ±2 standard deviations from the moving average:\n\n- Price at upper band = 2σ above mean (statistically expensive)\n- Price at lower band = 2σ below mean (statistically cheap)\n- Mean reversion probability increases at extremes\n\nQuantitative approach to overbought/oversold.`,
  "mean_reversion_band", "overlay", 450, { period: 20, color: "#3b82f6" },
  ["premium", "mean-reversion", "z-score", "statistical", "bands"]);

const PREM_RIBBON = mkIndicator("Trend Ribbon", "trend-ribbon",
  "8 Fibonacci-period EMAs creating a visual ribbon — green spread = bull, red = bear.",
  `# Trend Ribbon\n\n8 EMAs at Fibonacci periods (5, 8, 13, 21, 34, 55, 89, 144):\n\n- **Ribbon expanding upward (green)**: Strong bullish trend\n- **Ribbon expanding downward (red)**: Strong bearish trend\n- **Ribbon twisted/crossed**: Trend change in progress\n\nAlso known as Guppy Multiple Moving Average (GMMA). Visual trend strength at a glance.`,
  "trend_ribbon", "overlay", 500, { color: "#22c55e" },
  ["premium", "ribbon", "guppy", "multiple-ema", "visual"], { isFeatured: true });

const PREM_REL_VIGOR = mkIndicator("Relative Vigor Index", "relative-vigor-index",
  "Measures conviction by comparing close-open distance to high-low range.",
  `# Relative Vigor Index\n\nMeasures the \"vigor\" of price moves:\n- Strong closes near highs = High vigor (conviction)\n- Weak closes near opens = Low vigor (indecision)\n\nUses a 4-bar smoothing kernel for noise reduction. Positive = bullish conviction, negative = bearish.`,
  "relative_vigor", "oscillator", 350, { period: 10, color: "#14b8a6" },
  ["premium", "vigor", "conviction", "close-open"]);

const PREM_DYN_PIVOTS = mkIndicator("Dynamic Pivot Zones", "dynamic-pivot-zones",
  "Auto-calculated support/resistance from fractal swing highs and lows.",
  `# Dynamic Pivot Zones\n\nFinds fractal swing points (local highs/lows) and projects them forward as dynamic S/R:\n\n- Upper line: Nearest confirmed resistance (swing high)\n- Lower line: Nearest confirmed support (swing low)\n- Middle: Fair value zone\n\nUpdates automatically as new pivots form.`,
  "dynamic_pivots", "overlay", 500, { lookback: 5, color: "#f97316" },
  ["premium", "pivots", "support-resistance", "fractal", "dynamic"]);

const PREM_PA_SCORE = mkIndicator("Price Action Score", "price-action-score",
  "Numeric scoring of bullish/bearish price action — higher highs, body size, direction.",
  `# Price Action Score\n\nScores each bar on multiple price action criteria:\n- Higher highs / higher lows: ±2\n- Body-to-range ratio: up to ±2\n- Consecutive direction: ±1\n- Three-bar breakout: ±1.5\n\nSmoothed for clean signals. Positive = bullish structure, negative = bearish.`,
  "price_action_score", "oscillator", 400, { period: 10, color: "#6366f1" },
  ["premium", "price-action", "scoring", "structure"]);

const PREM_ERGO_VOL = mkIndicator("Ergodic Volume Oscillator", "ergodic-volume-oscillator",
  "TSI applied to volume-weighted candle bodies — reveals true buying/selling conviction.",
  `# Ergodic Volume Oscillator\n\nApplies the True Strength Index calculation to (Close-Open)×Volume instead of price.\n\n- Positive = Volume-confirmed buying\n- Negative = Volume-confirmed selling\n- Near zero = No conviction\n\nUnlike regular oscillators, this weights by both direction AND volume.`,
  "ergodic_volume", "oscillator", 500, { shortPeriod: 5, longPeriod: 20, color: "#ec4899" },
  ["premium", "ergodic", "volume", "conviction", "tsi"]);

const PREM_AVWAP = mkIndicator("Anchored VWAP Bands", "anchored-vwap-bands",
  "VWAP with standard deviation bands — institutional price levels with volatility zones.",
  `# Anchored VWAP Bands\n\nVWAP (Volume Weighted Average Price) with rolling standard deviation bands:\n\n- **VWAP line**: Fair value based on volume\n- **Upper band**: +2σ (statistically expensive)\n- **Lower band**: -2σ (statistically cheap)\n\nInstitutional traders use VWAP as their benchmark. Now you can too.`,
  "anchored_vwap_bands", "overlay", 550, { deviations: 2, color: "#0ea5e9" },
  ["premium", "vwap", "bands", "institutional", "statistical"]);

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
  // Batch 3: 40 Advanced Indicators
  ALMA_IND, KAMA_IND, ZLEMA_IND, T3_IND, SMMA_IND, LSMA_IND, VIDYA_IND, MCGINLEY_IND, VWMA_IND,
  SUPERTREND_IND, AROON_IND, VORTEX_IND, TRIX_IND, DPO_IND, KST_IND, COPPOCK_IND, ELDER_RAY_IND,
  STDDEV_IND, HISTVOL_IND, CHKVOL_IND, MASSIDX_IND, ULCER_IND, RVI_IND,
  ADLINE_IND, FORCEIDX_IND, EOM_IND, NVI_IND, PVI_IND,
  ULTOSC_IND, AWEOSC_IND, STOCHRSI_IND, TSI_IND, PPO_IND, FISHER_IND, CRSI_IND, SMI_IND,
  LINREG_IND, ENVELOPE_IND, PRICECH_IND, CHANDELIER_IND,
  // Premium Marketplace-Only Indicators (40) - NOT available in free chart panel
  PREM_TREND_PULSE, PREM_MARKET_REGIME, PREM_TREND_COMPOSITE, PREM_BREADTH,
  PREM_REVERSAL, PREM_PREDICT, PREM_BREAKOUT, PREM_SENTIMENT,
  PREM_WHALE, PREM_SMART_FLOW, PREM_VOL_CLIMAX, PREM_NET_BUYING,
  PREM_ORDER_FLOW, PREM_INTRADAY, PREM_VOL_MOM, PREM_LIQUIDITY,
  PREM_VOL_SQUEEZE, PREM_SQZ_MOM, PREM_VOL_RATIO, PREM_RANGE_EXP,
  PREM_CHOPPY, PREM_FRACTAL, PREM_ACCEL_BANDS, PREM_ADAPT_CH,
  PREM_ALPHA_MOM, PREM_EFFICIENCY, PREM_PERSIST, PREM_MTF,
  PREM_WAVE, PREM_GAP, PREM_HA_TREND, PREM_CYCLE,
  PREM_ADAPT_RSI, PREM_MEAN_REV, PREM_RIBBON, PREM_REL_VIGOR,
  PREM_DYN_PIVOTS, PREM_PA_SCORE, PREM_ERGO_VOL, PREM_AVWAP,
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

  // ---- Load saved defaults JSON (contains imageUrl and admin-customized data) ----
  let savedDefaults: Record<string, any> = {};
  try {
    const possiblePaths = [
      path.join(process.cwd(), "lib", "data", "marketplace-defaults.json"),
      path.join(process.cwd(), "..", "..", "apps", "admin", "lib", "data", "marketplace-defaults.json"),
      path.join(process.cwd(), "apps", "admin", "lib", "data", "marketplace-defaults.json"),
    ];

    for (const jsonPath of possiblePaths) {
      try {
        const raw = await readFile(jsonPath, "utf-8");
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.slug) {
              savedDefaults[item.slug] = item;
            }
          }
          console.log(`📄 [Seed] Loaded ${items.length} saved defaults from ${jsonPath}`);
        }
        break;
      } catch {
        continue;
      }
    }

    if (Object.keys(savedDefaults).length === 0) {
      console.log(`📄 [Seed] No marketplace-defaults.json found, using hardcoded data only`);
    }
  } catch (err) {
    console.warn(`⚠️ [Seed] Could not load defaults JSON:`, err);
  }

  // ---- Build merged item list: hardcoded + JSON defaults (JSON wins for admin-customized fields) ----
  // Start with ALL_ITEMS as base
  const mergedItems: any[] = [];
  const processedSlugs = new Set<string>();

  for (const hardcoded of ALL_ITEMS) {
    const slug = hardcoded.slug as string;
    if (!slug) { mergedItems.push(hardcoded); continue; }
    const jsonData = savedDefaults[slug];
    if (jsonData) {
      // Merge: hardcoded provides structure (codeTemplate, indicatorType etc.)
      // JSON provides admin-customized fields (imageUrl, descriptions, price, tags)
      mergedItems.push({
        ...hardcoded,
        imageUrl: jsonData.imageUrl || hardcoded.imageUrl,
        iconName: jsonData.iconName || hardcoded.iconName,
        fullDescription: jsonData.fullDescription || hardcoded.fullDescription,
        shortDescription: jsonData.shortDescription || hardcoded.shortDescription,
        price: jsonData.price ?? hardcoded.price,
        originalPrice: jsonData.originalPrice ?? hardcoded.originalPrice,
        tags: (jsonData.tags && jsonData.tags.length > 0) ? jsonData.tags : hardcoded.tags,
        isFeatured: jsonData.isFeatured ?? hardcoded.isFeatured,
      });
    } else {
      mergedItems.push(hardcoded);
    }
    processedSlugs.add(slug);
  }

  // Also add any items from JSON that are NOT in the hardcoded list
  // (these are items created manually by admin and saved as defaults)
  for (const [slug, jsonData] of Object.entries(savedDefaults)) {
    if (!processedSlugs.has(slug)) {
      mergedItems.push(jsonData);
      processedSlugs.add(slug);
    }
  }

  console.log(`📦 [Seed] Processing ${mergedItems.length} items (${ALL_ITEMS.length} hardcoded + ${Object.keys(savedDefaults).length} from JSON)`);

  for (const itemData of mergedItems) {
    try {
      // Check if item already exists
      const existing = await MarketplaceItem.findOne({ slug: itemData.slug });

      if (existing) {
        // Update existing item - ensure all required fields are set
        // BUT preserve admin-uploaded data (images, custom descriptions, etc.)
        existing.indicatorType = itemData.indicatorType;
        existing.strategyConfig = itemData.strategyConfig as any;
        existing.cosmeticType = itemData.cosmeticType as any;
        // RESTORE imageUrl from defaults if existing is empty, or if it points to a missing file
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
        // RESTORE descriptions from defaults if existing is empty
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

      // Create new item (includes imageUrl from merged data)
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
