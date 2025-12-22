"use strict";
/**
 * Limit Order Validation Utility
 * Validates limit order prices according to trading rules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPipValue = getPipValue;
exports.validateLimitOrderPrice = validateLimitOrderPrice;
exports.getValidLimitPriceRange = getValidLimitPriceRange;
// Minimum distance from market price (in pips)
// Adjusted based on currency pair type
const getMinimumPips = (symbol) => {
    // JPY pairs typically have larger spreads, require more pips
    if (symbol.includes('JPY')) {
        return 10; // 10 pips for JPY pairs (remember JPY pip = 0.01)
    }
    // Major pairs (EUR/USD, GBP/USD, etc.)
    return 10; // 10 pips for major pairs
};
/**
 * Calculate pip value based on currency pair
 * Most major pairs use 0.0001 (4 decimals)
 * JPY pairs use 0.01 (2 decimals)
 */
function getPipValue(symbol) {
    if (symbol.includes('JPY')) {
        return 0.01;
    }
    return 0.0001;
}
/**
 * Validate limit order price
 */
function validateLimitOrderPrice(side, limitPrice, currentPrice, symbol) {
    const pipValue = getPipValue(symbol);
    const minPips = getMinimumPips(symbol);
    const minDistance = minPips * pipValue;
    // ========================================
    // 1. DIRECTION VALIDATION (CRITICAL)
    // ========================================
    if (side === 'buy') {
        // Buy limit MUST be BELOW current ASK price
        if (limitPrice >= currentPrice.ask) {
            return {
                valid: false,
                error: 'Buy limit must be BELOW current market price',
                explanation: `🚫 Buy limit must be below the current ASK price.\n\n` +
                    `📊 Your limit: ${limitPrice.toFixed(5)}\n` +
                    `📈 Current ASK: ${currentPrice.ask.toFixed(5)}\n\n` +
                    `✅ Place your buy limit BELOW ${currentPrice.ask.toFixed(5)}`
            };
        }
    }
    else {
        // Sell limit MUST be ABOVE current BID price
        if (limitPrice <= currentPrice.bid) {
            return {
                valid: false,
                error: 'Sell limit must be ABOVE current market price',
                explanation: `🚫 Sell limit must be above the current BID price.\n\n` +
                    `📊 Your limit: ${limitPrice.toFixed(5)}\n` +
                    `📉 Current BID: ${currentPrice.bid.toFixed(5)}\n\n` +
                    `✅ Place your sell limit ABOVE ${currentPrice.bid.toFixed(5)}`
            };
        }
    }
    // ========================================
    // 2. MINIMUM DISTANCE VALIDATION
    // ========================================
    if (side === 'buy') {
        const distance = currentPrice.ask - limitPrice;
        const pipsAway = distance / pipValue;
        if (distance < minDistance) {
            return {
                valid: false,
                error: `Buy limit must be at least ${minPips} pips below market`,
                explanation: `🚫 Your buy limit is only ${pipsAway.toFixed(1)} pips away from market.\n\n` +
                    `💡 Minimum distance: ${minPips} pips\n` +
                    `   • Prevents accidental immediate execution\n` +
                    `   • Allows for spread fluctuations\n\n` +
                    `✅ Minimum valid price: ${(currentPrice.ask - minDistance).toFixed(5)}\n` +
                    `📊 Your price: ${limitPrice.toFixed(5)}\n` +
                    `📈 Current ASK: ${currentPrice.ask.toFixed(5)}`
            };
        }
    }
    else {
        const distance = limitPrice - currentPrice.bid;
        const pipsAway = distance / pipValue;
        if (distance < minDistance) {
            return {
                valid: false,
                error: `Sell limit must be at least ${minPips} pips above market`,
                explanation: `🚫 Your sell limit is only ${pipsAway.toFixed(1)} pips away from market.\n\n` +
                    `💡 Minimum distance: ${minPips} pips\n` +
                    `   • Prevents accidental immediate execution\n` +
                    `   • Allows for spread fluctuations\n\n` +
                    `✅ Minimum valid price: ${(currentPrice.bid + minDistance).toFixed(5)}\n` +
                    `📊 Your price: ${limitPrice.toFixed(5)}\n` +
                    `📉 Current BID: ${currentPrice.bid.toFixed(5)}`
            };
        }
    }
    // ========================================
    // ✅ ALL VALIDATIONS PASSED
    // ========================================
    return {
        valid: true
    };
}
/**
 * Get valid price range for limit orders
 */
function getValidLimitPriceRange(side, currentPrice, symbol) {
    const pipValue = getPipValue(symbol);
    const minPips = getMinimumPips(symbol);
    const minDistance = minPips * pipValue;
    if (side === 'buy') {
        return {
            min: 0, // No minimum (can be as low as user wants)
            max: currentPrice.ask - minDistance,
            minLabel: 'Any price',
            maxLabel: `${minPips} pips below ASK`
        };
    }
    else {
        return {
            min: currentPrice.bid + minDistance,
            max: Infinity, // No maximum (can be as high as user wants)
            minLabel: `${minPips} pips above BID`,
            maxLabel: 'Any price'
        };
    }
}
