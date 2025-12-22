"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedMarketplaceItems = seedMarketplaceItems;
exports.getMarketplaceStats = getMarketplaceStats;
exports.getAvailableIndicatorTypes = getAvailableIndicatorTypes;
const mongoose_1 = require("@/database/mongoose");
const marketplace_item_model_1 = require("@/database/models/marketplace/marketplace-item.model");
// ============================================================================
// INDICATOR TEMPLATES - Only indicators with chart implementations
// ============================================================================
const SUPPORT_RESISTANCE_INDICATOR = {
    name: 'Auto Support & Resistance',
    slug: 'auto-support-resistance',
    shortDescription: 'Automatically detects and draws key support and resistance levels.',
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
    category: 'indicator',
    price: 250,
    isFree: false,
    status: 'active',
    isPublished: true,
    isFeatured: true,
    version: '1.0.0',
    indicatorType: 'support_resistance',
    codeTemplate: JSON.stringify({
        type: 'support_resistance',
        displayType: 'overlay',
        description: 'Auto-detects support and resistance levels',
    }, null, 2),
    defaultSettings: {
        period: 20,
        strength: 2,
        color: '#3b82f6',
        lineWidth: 2,
    },
    supportedAssets: [],
    tags: ['support', 'resistance', 'levels', 'price-action'],
    riskLevel: 'low',
};
const SIMPLE_MA_INDICATOR = {
    name: 'Simple Moving Average',
    slug: 'simple-moving-average',
    shortDescription: 'Classic SMA indicator with customizable period.',
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
    category: 'indicator',
    price: 0,
    isFree: true,
    status: 'active',
    isPublished: true,
    isFeatured: false,
    version: '1.0.0',
    indicatorType: 'sma',
    codeTemplate: JSON.stringify({
        type: 'sma',
        displayType: 'overlay',
        description: 'Simple Moving Average line',
    }, null, 2),
    defaultSettings: {
        period: 20,
        color: '#3b82f6',
        lineWidth: 2,
    },
    supportedAssets: [],
    tags: ['moving-average', 'trend', 'free', 'beginner', 'sma'],
    riskLevel: 'low',
};
const EMA_INDICATOR = {
    name: 'Exponential Moving Average',
    slug: 'exponential-moving-average',
    shortDescription: 'EMA indicator - faster response to recent price changes.',
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
    category: 'indicator',
    price: 100,
    isFree: false,
    status: 'active',
    isPublished: true,
    isFeatured: false,
    version: '1.0.0',
    indicatorType: 'ema',
    codeTemplate: JSON.stringify({
        type: 'ema',
        displayType: 'overlay',
        description: 'Exponential Moving Average line',
    }, null, 2),
    defaultSettings: {
        period: 12,
        color: '#f97316',
        lineWidth: 2,
    },
    supportedAssets: [],
    tags: ['moving-average', 'trend', 'ema', 'responsive'],
    riskLevel: 'low',
};
const BOLLINGER_BANDS_INDICATOR = {
    name: 'Bollinger Bands',
    slug: 'bollinger-bands',
    shortDescription: 'Volatility bands that expand and contract with market conditions.',
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
    category: 'indicator',
    price: 200,
    isFree: false,
    status: 'active',
    isPublished: true,
    isFeatured: true,
    version: '1.0.0',
    indicatorType: 'bb',
    codeTemplate: JSON.stringify({
        type: 'bb',
        displayType: 'overlay',
        description: 'Bollinger Bands volatility indicator',
    }, null, 2),
    defaultSettings: {
        period: 20,
        stdDev: 2,
        color: '#8b5cf6',
        lineWidth: 1,
    },
    supportedAssets: [],
    tags: ['volatility', 'bollinger', 'bands', 'standard-deviation'],
    riskLevel: 'low',
};
const RSI_INDICATOR = {
    name: 'RSI Indicator',
    slug: 'rsi-indicator',
    shortDescription: 'Relative Strength Index - detect overbought/oversold conditions.',
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
    category: 'indicator',
    price: 150,
    isFree: false,
    status: 'active',
    isPublished: true,
    isFeatured: true,
    version: '1.0.0',
    indicatorType: 'rsi',
    codeTemplate: JSON.stringify({
        type: 'rsi',
        displayType: 'oscillator',
        description: 'RSI momentum oscillator',
    }, null, 2),
    defaultSettings: {
        period: 14,
        overbought: 70,
        oversold: 30,
        color: '#10b981',
        lineWidth: 2,
    },
    supportedAssets: [],
    tags: ['momentum', 'rsi', 'oscillator', 'overbought', 'oversold'],
    riskLevel: 'low',
};
const MACD_INDICATOR = {
    name: 'MACD Indicator',
    slug: 'macd-indicator',
    shortDescription: 'Moving Average Convergence Divergence for trend and momentum.',
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
    category: 'indicator',
    price: 200,
    isFree: false,
    status: 'active',
    isPublished: true,
    isFeatured: false,
    version: '1.0.0',
    indicatorType: 'macd',
    codeTemplate: JSON.stringify({
        type: 'macd',
        displayType: 'oscillator',
        description: 'MACD indicator with histogram',
    }, null, 2),
    defaultSettings: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        color: '#3b82f6',
        lineWidth: 2,
    },
    supportedAssets: [],
    tags: ['momentum', 'macd', 'trend', 'ema'],
    riskLevel: 'low',
};
// ============================================================================
// STRATEGY TEMPLATES
// ============================================================================
const MA_CROSSOVER_STRATEGY = {
    name: 'MA Crossover Strategy',
    slug: 'ma-crossover-strategy',
    shortDescription: 'Buy/sell signals when price crosses moving averages with RSI confirmation.',
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
    category: 'strategy',
    price: 500,
    isFree: false,
    status: 'active',
    isPublished: true,
    isFeatured: false, // Show in Strategies section, not just Featured
    version: '1.0.0',
    strategyConfig: {
        rules: [
            {
                id: 'buy-rule-1',
                name: 'Buy Signal',
                conditions: [
                    {
                        id: 'cond-1',
                        indicator: 'price',
                        operator: 'crosses_above',
                        compareWith: 'indicator',
                        compareIndicator: 'sma',
                        compareIndicatorParams: { period: 20 },
                    },
                    {
                        id: 'cond-2',
                        indicator: 'rsi',
                        indicatorParams: { period: 14 },
                        operator: 'below',
                        compareWith: 'value',
                        compareValue: 70,
                    },
                ],
                logic: 'AND',
                signal: 'strong_buy',
                signalStrength: 4,
            },
            {
                id: 'sell-rule-1',
                name: 'Sell Signal',
                conditions: [
                    {
                        id: 'cond-3',
                        indicator: 'price',
                        operator: 'crosses_below',
                        compareWith: 'indicator',
                        compareIndicator: 'sma',
                        compareIndicatorParams: { period: 20 },
                    },
                    {
                        id: 'cond-4',
                        indicator: 'rsi',
                        indicatorParams: { period: 14 },
                        operator: 'above',
                        compareWith: 'value',
                        compareValue: 30,
                    },
                ],
                logic: 'AND',
                signal: 'strong_sell',
                signalStrength: 4,
            },
        ],
        defaultIndicators: ['sma', 'rsi'],
        signalDisplay: {
            showOnChart: true,
            showArrows: true,
            showLabels: true,
            arrowSize: 'medium',
        },
    },
    codeTemplate: JSON.stringify({
        type: 'strategy',
        name: 'MA Crossover Strategy',
        description: 'Price crosses SMA with RSI confirmation',
    }, null, 2),
    defaultSettings: {
        smaPeriod: 20,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
    },
    supportedAssets: [],
    tags: ['strategy', 'crossover', 'sma', 'rsi', 'trend-following'],
    riskLevel: 'medium',
};
// ============================================================================
// ALL ITEMS - Indicators and Strategies
// ============================================================================
const ALL_ITEMS = [
    // Indicators
    SIMPLE_MA_INDICATOR, // Free SMA
    EMA_INDICATOR, // EMA 
    BOLLINGER_BANDS_INDICATOR, // Bollinger Bands
    SUPPORT_RESISTANCE_INDICATOR, // S/R Levels
    RSI_INDICATOR, // RSI
    MACD_INDICATOR, // MACD
    // Strategies
    MA_CROSSOVER_STRATEGY, // MA + RSI strategy
];
// ============================================================================
// SEED FUNCTION
// ============================================================================
async function seedMarketplaceItems(adminId = 'system') {
    await (0, mongoose_1.connectToDatabase)();
    const result = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (const itemData of ALL_ITEMS) {
        try {
            // Check if item already exists
            const existing = await marketplace_item_model_1.MarketplaceItem.findOne({ slug: itemData.slug });
            if (existing) {
                // Update existing item
                existing.indicatorType = itemData.indicatorType;
                existing.strategyConfig = itemData.strategyConfig;
                existing.codeTemplate = itemData.codeTemplate || existing.codeTemplate;
                existing.defaultSettings = itemData.defaultSettings || existing.defaultSettings;
                existing.fullDescription = itemData.fullDescription || existing.fullDescription;
                existing.version = itemData.version || existing.version;
                await existing.save();
                result.updated++;
                continue;
            }
            // Create new item
            await marketplace_item_model_1.MarketplaceItem.create({
                ...itemData,
                createdBy: adminId,
            });
            result.created++;
        }
        catch (error) {
            result.errors.push(`Failed to create ${itemData.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    console.log(`✅ Marketplace seeded: ${result.created} created, ${result.updated} updated`);
    return result;
}
async function getMarketplaceStats() {
    await (0, mongoose_1.connectToDatabase)();
    const [totalItems, totalIndicators, totalStrategies] = await Promise.all([
        marketplace_item_model_1.MarketplaceItem.countDocuments({ isPublished: true }),
        marketplace_item_model_1.MarketplaceItem.countDocuments({ isPublished: true, category: 'indicator' }),
        marketplace_item_model_1.MarketplaceItem.countDocuments({ isPublished: true, category: 'strategy' }),
    ]);
    const { UserPurchase } = await Promise.resolve().then(() => __importStar(require('@/database/models/marketplace/user-purchase.model')));
    const totalPurchases = await UserPurchase.countDocuments();
    return { totalItems, totalIndicators, totalStrategies, totalPurchases };
}
/**
 * Get available indicator types that have chart implementations
 */
function getAvailableIndicatorTypes() {
    return [
        { type: 'sma', name: 'SMA', description: 'Simple Moving Average', displayType: 'overlay' },
        { type: 'ema', name: 'EMA', description: 'Exponential Moving Average', displayType: 'overlay' },
        { type: 'bb', name: 'Bollinger Bands', description: 'Volatility bands', displayType: 'overlay' },
        { type: 'support_resistance', name: 'S/R Levels', description: 'Auto support/resistance', displayType: 'overlay' },
        { type: 'rsi', name: 'RSI', description: 'Relative Strength Index', displayType: 'oscillator' },
        { type: 'macd', name: 'MACD', description: 'Moving Average Convergence Divergence', displayType: 'oscillator' },
    ];
}
