"use strict";
/**
 * Universal Ranking Utility
 *
 * Handles all ranking methods for competitions and challenges.
 * Extensible for future ranking types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTotalPnL = getTotalPnL;
exports.getTotalROI = getTotalROI;
exports.getRankingConfig = getRankingConfig;
exports.getRankingValue = getRankingValue;
exports.determineWinningStatus = determineWinningStatus;
exports.formatRankingValue = formatRankingValue;
exports.getRankingLabel = getRankingLabel;
exports.getMyStatLabel = getMyStatLabel;
exports.registerRankingMethod = registerRankingMethod;
exports.getAvailableRankingMethods = getAvailableRankingMethods;
exports.isValidRankingMethod = isValidRankingMethod;
/**
 * Calculate TOTAL P&L (realized + unrealized)
 * This is what you would have if you closed all positions now
 */
function getTotalPnL(stats) {
    const realizedPnl = stats.pnl || 0;
    const unrealizedPnl = stats.unrealizedPnl || 0;
    return realizedPnl + unrealizedPnl;
}
/**
 * Calculate TRUE ROI based on total P&L
 */
function getTotalROI(stats) {
    const totalPnl = getTotalPnL(stats);
    const startingCapital = stats.startingCapital || stats.currentCapital - totalPnl || 10000;
    if (startingCapital === 0)
        return 0;
    return (totalPnl / startingCapital) * 100;
}
// Registry of all ranking methods - easily extensible
// NOTE: P&L and ROI use TOTAL P&L (realized + unrealized) to show true position
const RANKING_REGISTRY = {
    pnl: {
        // IMPORTANT: Uses realized + unrealized P&L for accurate live status
        getValue: (stats) => getTotalPnL(stats),
        label: 'P&L',
        displayLabel: 'Total P&L', // Changed to clarify it includes open positions
        higherIsBetter: true,
        formatValue: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`,
    },
    roi: {
        // IMPORTANT: Uses total P&L for accurate ROI
        getValue: (stats) => getTotalROI(stats),
        label: 'ROI',
        displayLabel: 'Total ROI',
        higherIsBetter: true,
        formatValue: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
    },
    total_capital: {
        // Current capital already includes unrealized P&L effects
        getValue: (stats) => stats.currentCapital || 0,
        label: 'Capital',
        displayLabel: 'Your Capital',
        higherIsBetter: true,
        formatValue: (v) => `$${v.toLocaleString()}`,
    },
    win_rate: {
        getValue: (stats) => stats.winRate || 0,
        label: 'Win Rate',
        displayLabel: 'Your Win Rate',
        higherIsBetter: true,
        formatValue: (v) => `${v.toFixed(1)}%`,
    },
    total_wins: {
        getValue: (stats) => stats.winningTrades || 0,
        label: 'Wins',
        displayLabel: 'Your Wins',
        higherIsBetter: true,
        formatValue: (v) => `${Math.floor(v)} wins`,
    },
    profit_factor: {
        getValue: (stats) => {
            const wins = stats.winningTrades || 0;
            const losses = stats.losingTrades || 0;
            if (losses === 0)
                return wins > 0 ? 9999 : 0;
            return wins / losses;
        },
        label: 'Profit Factor',
        displayLabel: 'Profit Factor',
        higherIsBetter: true,
        formatValue: (v) => v >= 9999 ? '∞' : v.toFixed(2),
    },
};
/**
 * Get ranking configuration for a method
 * Returns a default config for unknown methods (forward compatible)
 */
function getRankingConfig(method) {
    const config = RANKING_REGISTRY[method];
    if (config)
        return config;
    // Default config for unknown/future methods - fallback to P&L
    console.warn(`Unknown ranking method: ${method}, falling back to P&L`);
    return RANKING_REGISTRY.pnl;
}
/**
 * Get the ranking value for a participant based on the method
 */
function getRankingValue(stats, method) {
    const config = getRankingConfig(method);
    return config.getValue(stats);
}
/**
 * Determine who is winning based on ranking method
 * Returns: 'winning' | 'losing' | 'tied'
 */
function determineWinningStatus(myStats, opponentStats, method) {
    const config = getRankingConfig(method);
    const myValue = config.getValue(myStats);
    const opponentValue = config.getValue(opponentStats);
    // Use epsilon for floating point comparison
    const epsilon = 0.001;
    if (Math.abs(myValue - opponentValue) < epsilon) {
        return 'tied';
    }
    // Check if higher is better or lower is better
    if (config.higherIsBetter) {
        return myValue > opponentValue ? 'winning' : 'losing';
    }
    else {
        return myValue < opponentValue ? 'winning' : 'losing';
    }
}
/**
 * Format a ranking value for display
 */
function formatRankingValue(value, method) {
    const config = getRankingConfig(method);
    return config.formatValue(value);
}
/**
 * Get display label for a ranking method
 */
function getRankingLabel(method) {
    const config = getRankingConfig(method);
    return config.label;
}
/**
 * Get the display label for "Your X" card
 */
function getMyStatLabel(method) {
    const config = getRankingConfig(method);
    return config.displayLabel;
}
/**
 * Register a new ranking method (for plugins/extensions)
 * Call this to add custom ranking types at runtime
 */
function registerRankingMethod(method, config) {
    RANKING_REGISTRY[method] = config;
}
/**
 * Get all available ranking methods
 */
function getAvailableRankingMethods() {
    return Object.keys(RANKING_REGISTRY);
}
/**
 * Check if a ranking method is registered
 */
function isValidRankingMethod(method) {
    return method in RANKING_REGISTRY;
}
