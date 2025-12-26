/**
 * P&L Calculator Service
 *
 * Handles all profit/loss calculations for Forex trading
 *
 * Key Concepts:
 * - Lot: Standard contract size (100,000 units)
 * - Pip: Smallest price move (0.0001 for most pairs, 0.01 for JPY pairs)
 * - Leverage: Multiplier for position size (1:100 = control $100k with $1k)
 * - Margin: Capital required to open position
 * - Equity: Current capital + unrealized P&L
 */
export declare const FOREX_PAIRS: {
    'EUR/USD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'GBP/USD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/CHF': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'AUD/USD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/CAD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'NZD/USD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'EUR/GBP': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'EUR/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'EUR/CHF': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'EUR/AUD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'EUR/CAD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'EUR/NZD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'GBP/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'GBP/CHF': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'GBP/AUD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'GBP/CAD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'GBP/NZD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'AUD/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'AUD/CHF': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'AUD/CAD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'AUD/NZD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'CAD/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'CAD/CHF': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'CHF/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'NZD/JPY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'NZD/CHF': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'NZD/CAD': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/MXN': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/ZAR': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/TRY': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/SEK': {
        name: string;
        pip: number;
        contractSize: number;
    };
    'USD/NOK': {
        name: string;
        pip: number;
        contractSize: number;
    };
};
export type ForexSymbol = keyof typeof FOREX_PAIRS;
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
 * @param symbol - Forex pair symbol
 * @returns Unrealized profit/loss in USD
 */
export declare function calculateUnrealizedPnL(side: 'long' | 'short', entryPrice: number, currentPrice: number, quantity: number, symbol: ForexSymbol): number;
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
export declare function calculatePnLPercentage(pnl: number, marginUsed: number): number;
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
export declare function calculateMarginRequired(quantity: number, entryPrice: number, leverage: number, symbol: ForexSymbol): number;
/**
 * Calculate maintenance margin (minimum margin to keep position open)
 *
 * Typically 50% of initial margin
 *
 * @param initialMargin - Initial margin used
 * @returns Maintenance margin
 */
export declare function calculateMaintenanceMargin(initialMargin: number): number;
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
export declare function calculateEquity(currentCapital: number, unrealizedPnL: number): number;
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
export declare function calculateMarginLevel(equity: number, usedMargin: number): number;
/**
 * Check if margin call should be triggered
 *
 * @param marginLevel - Current margin level
 * @param threshold - Margin call threshold from admin settings (default: 100%)
 * @returns True if margin call triggered
 */
export declare function isMarginCall(marginLevel: number, threshold?: number): boolean;
/**
 * Check if position should be liquidated
 *
 * @param marginLevel - Current margin level
 * @param threshold - Liquidation threshold from admin settings (default: 50%)
 * @returns True if should liquidate
 */
export declare function shouldLiquidate(marginLevel: number, threshold?: number): boolean;
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
export declare function calculateLiquidationPrice(side: 'long' | 'short', entryPrice: number, quantity: number, marginUsed: number, leverage: number, symbol: ForexSymbol): number;
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
export declare function calculatePipValue(quantity: number, symbol: ForexSymbol): number;
/**
 * Calculate number of pips moved
 *
 * @param entryPrice - Entry price
 * @param currentPrice - Current price
 * @param symbol - Forex pair symbol
 * @returns Number of pips
 */
export declare function calculatePipsMoved(entryPrice: number, currentPrice: number, symbol: ForexSymbol): number;
/**
 * Validate order quantity
 *
 * @param quantity - Position size in lots
 * @param minLot - Minimum lot size (default 0.01)
 * @param maxLot - Maximum lot size (default 100)
 * @returns True if valid
 */
export declare function validateQuantity(quantity: number, minLot?: number, maxLot?: number): {
    valid: boolean;
    error?: string;
};
/**
 * Validate stop loss / take profit levels
 *
 * @param side - 'long' or 'short'
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price (optional)
 * @param takeProfit - Take profit price (optional)
 * @returns Validation result
 */
export declare function validateSLTP(side: 'long' | 'short', entryPrice: number, stopLoss?: number, takeProfit?: number): {
    valid: boolean;
    error?: string;
};
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
export declare function calculatePotentialPnL(side: 'long' | 'short', entryPrice: number, exitPrice: number, quantity: number, symbol: ForexSymbol): number;
/**
 * Calculate risk/reward ratio
 *
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param takeProfit - Take profit price
 * @param side - 'long' or 'short'
 * @returns Risk/reward ratio (e.g., 1:2 = 2.0)
 */
export declare function calculateRiskRewardRatio(entryPrice: number, stopLoss: number, takeProfit: number, _side: 'long' | 'short'): number;
