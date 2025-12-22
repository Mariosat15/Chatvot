"use strict";
/**
 * P&L Calculator Service
 *
 * Handles all profit/loss calculations for Forex and Crypto trading
 *
 * Key Concepts:
 * - Lot: Standard contract size (100,000 units for forex, 1 unit for crypto)
 * - Pip: Smallest price move (0.0001 for most forex, varies for crypto)
 * - Leverage: Multiplier for position size (1:100 = control $100k with $1k)
 * - Margin: Capital required to open position
 * - Equity: Current capital + unrealized P&L
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_TRADING_PAIRS = exports.CRYPTO_PAIRS = exports.FOREX_PAIRS = void 0;
exports.isCryptoSymbol = isCryptoSymbol;
exports.isForexSymbol = isForexSymbol;
exports.getAssetClass = getAssetClass;
exports.calculateUnrealizedPnL = calculateUnrealizedPnL;
exports.calculatePnLPercentage = calculatePnLPercentage;
exports.calculateMarginRequired = calculateMarginRequired;
exports.calculateMaintenanceMargin = calculateMaintenanceMargin;
exports.calculateEquity = calculateEquity;
exports.calculateMarginLevel = calculateMarginLevel;
exports.isMarginCall = isMarginCall;
exports.shouldLiquidate = shouldLiquidate;
exports.calculateLiquidationPrice = calculateLiquidationPrice;
exports.calculatePipValue = calculatePipValue;
exports.calculatePipsMoved = calculatePipsMoved;
exports.validateQuantity = validateQuantity;
exports.validateSLTP = validateSLTP;
exports.calculatePotentialPnL = calculatePotentialPnL;
exports.calculateRiskRewardRatio = calculateRiskRewardRatio;
// Forex pair configurations
exports.FOREX_PAIRS = {
    // Major Pairs
    'EUR/USD': { name: 'Euro vs US Dollar', pip: 0.0001, contractSize: 100000 },
    'GBP/USD': { name: 'British Pound vs US Dollar', pip: 0.0001, contractSize: 100000 },
    'USD/JPY': { name: 'US Dollar vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'USD/CHF': { name: 'US Dollar vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
    'AUD/USD': { name: 'Australian Dollar vs US Dollar', pip: 0.0001, contractSize: 100000 },
    'USD/CAD': { name: 'US Dollar vs Canadian Dollar', pip: 0.0001, contractSize: 100000 },
    'NZD/USD': { name: 'New Zealand Dollar vs US Dollar', pip: 0.0001, contractSize: 100000 },
    // Cross Pairs
    'EUR/GBP': { name: 'Euro vs British Pound', pip: 0.0001, contractSize: 100000 },
    'EUR/JPY': { name: 'Euro vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'EUR/CHF': { name: 'Euro vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
    'EUR/AUD': { name: 'Euro vs Australian Dollar', pip: 0.0001, contractSize: 100000 },
    'EUR/CAD': { name: 'Euro vs Canadian Dollar', pip: 0.0001, contractSize: 100000 },
    'EUR/NZD': { name: 'Euro vs New Zealand Dollar', pip: 0.0001, contractSize: 100000 },
    'GBP/JPY': { name: 'British Pound vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'GBP/CHF': { name: 'British Pound vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
    'GBP/AUD': { name: 'British Pound vs Australian Dollar', pip: 0.0001, contractSize: 100000 },
    'GBP/CAD': { name: 'British Pound vs Canadian Dollar', pip: 0.0001, contractSize: 100000 },
    'GBP/NZD': { name: 'British Pound vs New Zealand Dollar', pip: 0.0001, contractSize: 100000 },
    'AUD/JPY': { name: 'Australian Dollar vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'AUD/CHF': { name: 'Australian Dollar vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
    'AUD/CAD': { name: 'Australian Dollar vs Canadian Dollar', pip: 0.0001, contractSize: 100000 },
    'AUD/NZD': { name: 'Australian Dollar vs New Zealand Dollar', pip: 0.0001, contractSize: 100000 },
    'CAD/JPY': { name: 'Canadian Dollar vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'CAD/CHF': { name: 'Canadian Dollar vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
    'CHF/JPY': { name: 'Swiss Franc vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'NZD/JPY': { name: 'New Zealand Dollar vs Japanese Yen', pip: 0.01, contractSize: 100000 },
    'NZD/CHF': { name: 'New Zealand Dollar vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
    'NZD/CAD': { name: 'New Zealand Dollar vs Canadian Dollar', pip: 0.0001, contractSize: 100000 },
    // Exotic Pairs
    'USD/MXN': { name: 'US Dollar vs Mexican Peso', pip: 0.0001, contractSize: 100000 },
    'USD/ZAR': { name: 'US Dollar vs South African Rand', pip: 0.0001, contractSize: 100000 },
    'USD/TRY': { name: 'US Dollar vs Turkish Lira', pip: 0.0001, contractSize: 100000 },
    'USD/SEK': { name: 'US Dollar vs Swedish Krona', pip: 0.0001, contractSize: 100000 },
    'USD/NOK': { name: 'US Dollar vs Norwegian Krone', pip: 0.0001, contractSize: 100000 },
};
/**
 * Crypto pair configurations
 * Documentation: https://massive.com/docs/websocket/crypto/overview
 *
 * Crypto trades 24/7, 365 days a year
 * Contract size is 1 unit (1 BTC, 1 ETH, etc.)
 */
exports.CRYPTO_PAIRS = {
    // Major Crypto vs USD
    'BTC/USD': { name: 'Bitcoin vs US Dollar', pip: 0.01, contractSize: 1 },
    'ETH/USD': { name: 'Ethereum vs US Dollar', pip: 0.01, contractSize: 1 },
    'LTC/USD': { name: 'Litecoin vs US Dollar', pip: 0.01, contractSize: 1 },
    'XRP/USD': { name: 'Ripple vs US Dollar', pip: 0.0001, contractSize: 1 },
    'BCH/USD': { name: 'Bitcoin Cash vs US Dollar', pip: 0.01, contractSize: 1 },
    'DOGE/USD': { name: 'Dogecoin vs US Dollar', pip: 0.0001, contractSize: 1 },
    'SOL/USD': { name: 'Solana vs US Dollar', pip: 0.01, contractSize: 1 },
    'ADA/USD': { name: 'Cardano vs US Dollar', pip: 0.0001, contractSize: 1 },
    'AVAX/USD': { name: 'Avalanche vs US Dollar', pip: 0.01, contractSize: 1 },
    'DOT/USD': { name: 'Polkadot vs US Dollar', pip: 0.01, contractSize: 1 },
    'MATIC/USD': { name: 'Polygon vs US Dollar', pip: 0.0001, contractSize: 1 },
    'LINK/USD': { name: 'Chainlink vs US Dollar', pip: 0.01, contractSize: 1 },
    'UNI/USD': { name: 'Uniswap vs US Dollar', pip: 0.01, contractSize: 1 },
    'ATOM/USD': { name: 'Cosmos vs US Dollar', pip: 0.01, contractSize: 1 },
    'XLM/USD': { name: 'Stellar vs US Dollar', pip: 0.0001, contractSize: 1 },
    'ALGO/USD': { name: 'Algorand vs US Dollar', pip: 0.0001, contractSize: 1 },
    // Major Crypto vs EUR
    'BTC/EUR': { name: 'Bitcoin vs Euro', pip: 0.01, contractSize: 1 },
    'ETH/EUR': { name: 'Ethereum vs Euro', pip: 0.01, contractSize: 1 },
};
// Combined pairs for validation
exports.ALL_TRADING_PAIRS = { ...exports.FOREX_PAIRS, ...exports.CRYPTO_PAIRS };
/**
 * Check if a symbol is a crypto pair
 */
function isCryptoSymbol(symbol) {
    return symbol in exports.CRYPTO_PAIRS;
}
/**
 * Check if a symbol is a forex pair
 */
function isForexSymbol(symbol) {
    return symbol in exports.FOREX_PAIRS;
}
/**
 * Get the asset class for a symbol
 */
function getAssetClass(symbol) {
    if (isForexSymbol(symbol))
        return 'forex';
    if (isCryptoSymbol(symbol))
        return 'crypto';
    return null;
}
/**
 * Calculate unrealized P&L for an open position
 *
 * Formula:
 * Long (Buy):  P&L = (Current Price - Entry Price) × Quantity × Contract Size
 * Short (Sell): P&L = (Entry Price - Current Price) × Quantity × Contract Size
 *
 * @param side - 'long' or 'short'
 * @param entryPrice - Price when position was opened
 * @param currentPrice - Current market price
 * @param quantity - Position size in lots
 * @param symbol - Trading pair symbol (forex or crypto)
 * @returns Unrealized profit/loss in USD
 */
function calculateUnrealizedPnL(side, entryPrice, currentPrice, quantity, symbol) {
    const pairConfig = exports.ALL_TRADING_PAIRS[symbol];
    if (!pairConfig) {
        throw new Error(`Unknown trading pair: ${symbol}`);
    }
    const { contractSize } = pairConfig;
    const priceChange = side === 'long'
        ? currentPrice - entryPrice
        : entryPrice - currentPrice;
    const pnl = priceChange * quantity * contractSize;
    return Number(pnl.toFixed(2));
}
/**
 * Calculate unrealized P&L percentage (ROI)
 *
 * Formula:
 * P&L % = (P&L / Margin Used) × 100
 *
 * @param pnl - Unrealized P&L in USD
 * @param marginUsed - Margin used for position
 * @returns P&L percentage
 */
function calculatePnLPercentage(pnl, marginUsed) {
    if (marginUsed === 0)
        return 0;
    return Number(((pnl / marginUsed) * 100).toFixed(2));
}
/**
 * Calculate margin required to open a position
 *
 * Formula:
 * Margin = (Quantity × Contract Size × Entry Price) / Leverage
 *
 * @param quantity - Position size in lots
 * @param entryPrice - Entry price
 * @param leverage - Leverage ratio (e.g., 100 for 1:100)
 * @param symbol - Forex pair symbol
 * @returns Required margin in USD
 */
function calculateMarginRequired(quantity, entryPrice, leverage, symbol) {
    const pairConfig = exports.FOREX_PAIRS[symbol];
    if (!pairConfig) {
        throw new Error(`Unknown forex pair: ${symbol}`);
    }
    const { contractSize } = pairConfig;
    const positionValue = quantity * contractSize * entryPrice;
    const margin = positionValue / leverage;
    return Number(margin.toFixed(2));
}
/**
 * Calculate maintenance margin (minimum margin to keep position open)
 *
 * Typically 50% of initial margin
 *
 * @param initialMargin - Initial margin used
 * @returns Maintenance margin
 */
function calculateMaintenanceMargin(initialMargin) {
    return Number((initialMargin * 0.5).toFixed(2));
}
/**
 * Calculate current equity
 *
 * Formula:
 * Equity = Current Capital + Total Unrealized P&L
 *
 * @param currentCapital - Available capital
 * @param unrealizedPnL - Total unrealized P&L from all positions
 * @returns Current equity
 */
function calculateEquity(currentCapital, unrealizedPnL) {
    return Number((currentCapital + unrealizedPnL).toFixed(2));
}
/**
 * Calculate margin level
 *
 * Formula:
 * Margin Level = (Equity / Used Margin) × 100
 *
 * Levels:
 * - 100%+: Safe
 * - 50-100%: Margin Call Warning
 * - <50%: Liquidation
 *
 * @param equity - Current equity
 * @param usedMargin - Total margin used for all positions
 * @returns Margin level percentage
 */
function calculateMarginLevel(equity, usedMargin) {
    if (usedMargin === 0)
        return Infinity;
    return Number(((equity / usedMargin) * 100).toFixed(2));
}
/**
 * Check if margin call should be triggered
 *
 * @param marginLevel - Current margin level
 * @param threshold - Margin call threshold from admin settings (default: 100%)
 * @returns True if margin call triggered
 */
function isMarginCall(marginLevel, threshold = 100) {
    return marginLevel < threshold;
}
/**
 * Check if position should be liquidated
 *
 * @param marginLevel - Current margin level
 * @param threshold - Liquidation threshold from admin settings (default: 50%)
 * @returns True if should liquidate
 */
function shouldLiquidate(marginLevel, threshold = 50) {
    return marginLevel < threshold;
}
/**
 * Calculate liquidation price for a position
 *
 * Price at which position will be automatically closed due to insufficient margin
 *
 * Formula (Long):
 * Liquidation Price = Entry Price - (Available Capital / (Quantity × Contract Size))
 *
 * Formula (Short):
 * Liquidation Price = Entry Price + (Available Capital / (Quantity × Contract Size))
 *
 * @param side - 'long' or 'short'
 * @param entryPrice - Entry price
 * @param quantity - Position size in lots
 * @param marginUsed - Margin used for position
 * @param leverage - Leverage ratio
 * @param symbol - Forex pair symbol
 * @returns Liquidation price
 */
function calculateLiquidationPrice(side, entryPrice, quantity, marginUsed, leverage, symbol) {
    const pairConfig = exports.FOREX_PAIRS[symbol];
    if (!pairConfig) {
        throw new Error(`Unknown forex pair: ${symbol}`);
    }
    const { contractSize } = pairConfig;
    // Maximum loss before liquidation (margin used)
    const maxLoss = marginUsed;
    // Price move that would cause this loss
    const priceMove = maxLoss / (quantity * contractSize);
    const liquidationPrice = side === 'long'
        ? entryPrice - priceMove
        : entryPrice + priceMove;
    return Number(liquidationPrice.toFixed(5));
}
/**
 * Calculate pip value
 *
 * Formula:
 * Pip Value = (Pip Size × Quantity × Contract Size)
 *
 * @param quantity - Position size in lots
 * @param symbol - Forex pair symbol
 * @returns Pip value in USD
 */
function calculatePipValue(quantity, symbol) {
    const pairConfig = exports.FOREX_PAIRS[symbol];
    if (!pairConfig) {
        throw new Error(`Unknown forex pair: ${symbol}`);
    }
    const { pip, contractSize } = pairConfig;
    const pipValue = pip * quantity * contractSize;
    return Number(pipValue.toFixed(2));
}
/**
 * Calculate number of pips moved
 *
 * @param entryPrice - Entry price
 * @param currentPrice - Current price
 * @param symbol - Forex pair symbol
 * @returns Number of pips
 */
function calculatePipsMoved(entryPrice, currentPrice, symbol) {
    const pairConfig = exports.FOREX_PAIRS[symbol];
    if (!pairConfig) {
        throw new Error(`Unknown forex pair: ${symbol}`);
    }
    const { pip } = pairConfig;
    const priceChange = Math.abs(currentPrice - entryPrice);
    const pips = priceChange / pip;
    return Number(pips.toFixed(1));
}
/**
 * Validate order quantity
 *
 * @param quantity - Position size in lots
 * @param minLot - Minimum lot size (default 0.01)
 * @param maxLot - Maximum lot size (default 100)
 * @returns True if valid
 */
function validateQuantity(quantity, minLot = 0.01, maxLot = 100) {
    if (quantity < minLot) {
        return { valid: false, error: `Minimum lot size is ${minLot}` };
    }
    if (quantity > maxLot) {
        return { valid: false, error: `Maximum lot size is ${maxLot}` };
    }
    // Check if quantity is a valid increment (0.01)
    // Use tolerance for floating-point precision (0.07 * 100 might give 7.0000000001)
    const scaledQuantity = quantity * 100;
    const remainder = Math.abs(scaledQuantity - Math.round(scaledQuantity));
    if (remainder > 0.0001) { // Allow tiny floating-point errors
        return { valid: false, error: 'Lot size must be in increments of 0.01' };
    }
    return { valid: true };
}
/**
 * Validate stop loss / take profit levels
 *
 * @param side - 'long' or 'short'
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price (optional)
 * @param takeProfit - Take profit price (optional)
 * @returns Validation result
 */
function validateSLTP(side, entryPrice, stopLoss, takeProfit) {
    if (side === 'long') {
        // For long: SL must be below entry, TP must be above entry
        if (stopLoss && stopLoss >= entryPrice) {
            return { valid: false, error: 'Stop loss must be below entry price for long positions' };
        }
        if (takeProfit && takeProfit <= entryPrice) {
            return { valid: false, error: 'Take profit must be above entry price for long positions' };
        }
    }
    else {
        // For short: SL must be above entry, TP must be below entry
        if (stopLoss && stopLoss <= entryPrice) {
            return { valid: false, error: 'Stop loss must be above entry price for short positions' };
        }
        if (takeProfit && takeProfit >= entryPrice) {
            return { valid: false, error: 'Take profit must be below entry price for short positions' };
        }
    }
    return { valid: true };
}
/**
 * Calculate potential profit/loss at take profit/stop loss
 *
 * @param side - 'long' or 'short'
 * @param entryPrice - Entry price
 * @param exitPrice - Exit price (SL or TP)
 * @param quantity - Position size in lots
 * @param symbol - Forex pair symbol
 * @returns Potential P&L
 */
function calculatePotentialPnL(side, entryPrice, exitPrice, quantity, symbol) {
    return calculateUnrealizedPnL(side, entryPrice, exitPrice, quantity, symbol);
}
/**
 * Calculate risk/reward ratio
 *
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param takeProfit - Take profit price
 * @param side - 'long' or 'short'
 * @returns Risk/reward ratio (e.g., 1:2 = 2.0)
 */
function calculateRiskRewardRatio(entryPrice, stopLoss, takeProfit, _side) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    if (risk === 0)
        return 0;
    return Number((reward / risk).toFixed(2));
}
