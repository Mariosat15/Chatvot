/**
 * Risk Manager Service
 *
 * Monitors margin levels and manages liquidations
 * Prevents users from losing more than their capital
 */
export declare const RISK_THRESHOLDS: {
    MARGIN_CALL: number;
    LIQUIDATION: number;
    MAX_POSITION_SIZE: number;
    MAX_OPEN_POSITIONS: number;
    MAX_LEVERAGE: number;
};
export type MarginStatus = 'safe' | 'warning' | 'danger' | 'liquidation';
/**
 * Calculate margin status for a participant
 *
 * @param currentCapital - Current capital
 * @param totalUnrealizedPnL - Sum of all unrealized P&L
 * @param totalUsedMargin - Sum of all used margin
 * @returns Margin status and level
 */
export declare function getMarginStatus(currentCapital: number, totalUnrealizedPnL: number, totalUsedMargin: number, thresholds?: {
    liquidation: number;
    marginCall: number;
    warning: number;
}): {
    status: MarginStatus;
    marginLevel: number;
    equity: number;
    message: string;
};
/**
 * Validate if a new order can be placed
 *
 * Checks:
 * - Sufficient available capital
 * - Position size limits
 * - Max open positions
 * - Competition rules
 *
 * @param availableCapital - Capital not tied in positions
 * @param marginRequired - Margin needed for new order
 * @param currentOpenPositions - Number of open positions
 * @param quantity - Order quantity in lots
 * @param leverage - Leverage for order
 * @param maxPositions - Max positions allowed (competition rule)
 * @param maxLeverage - Max leverage allowed (competition rule)
 * @returns Validation result
 */
export declare function validateNewOrder(availableCapital: number, marginRequired: number, currentOpenPositions: number, quantity: number, leverage: number, maxPositions?: number, maxLeverage?: number): {
    valid: boolean;
    error?: string;
};
/**
 * Calculate maximum position size given available capital
 *
 * @param availableCapital - Capital not tied in positions
 * @param entryPrice - Price to enter at
 * @param leverage - Leverage to use
 * @returns Maximum lot size
 */
export declare function calculateMaxPositionSize(availableCapital: number, entryPrice: number, leverage: number): number;
/**
 * Calculate recommended stop loss distance based on risk percentage
 *
 * @param entryPrice - Entry price
 * @param side - 'long' or 'short'
 * @param riskPercentage - Percentage of capital willing to risk (e.g., 2 for 2%)
 * @param capital - Total capital
 * @param quantity - Position size in lots
 * @returns Recommended stop loss price
 */
export declare function calculateRecommendedStopLoss(entryPrice: number, side: 'long' | 'short', riskPercentage: number, capital: number, quantity: number): number;
/**
 * Calculate position risk as percentage of capital
 *
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param quantity - Position size in lots
 * @param capital - Total capital
 * @returns Risk percentage
 */
export declare function calculatePositionRisk(entryPrice: number, stopLoss: number, quantity: number, capital: number): number;
/**
 * Check if total risk across all positions is within acceptable limits
 *
 * @param positions - Array of open positions with risk data
 * @param capital - Total capital
 * @param maxTotalRisk - Max total risk percentage (default 10%)
 * @returns Validation result
 */
export declare function validateTotalRisk(positions: Array<{
    entryPrice: number;
    stopLoss?: number;
    quantity: number;
}>, capital: number, maxTotalRisk?: number): {
    valid: boolean;
    totalRisk: number;
    error?: string;
};
/**
 * Generate risk warnings based on participant status
 *
 * @param marginStatus - Current margin status
 * @param openPositions - Number of open positions
 * @param maxPositions - Max allowed positions
 * @returns Array of warning messages
 */
export declare function getRiskWarnings(marginStatus: MarginStatus, openPositions: number, maxPositions: number): string[];
declare const _default: {
    getMarginStatus: typeof getMarginStatus;
    validateNewOrder: typeof validateNewOrder;
    calculateMaxPositionSize: typeof calculateMaxPositionSize;
    calculateRecommendedStopLoss: typeof calculateRecommendedStopLoss;
    calculatePositionRisk: typeof calculatePositionRisk;
    validateTotalRisk: typeof validateTotalRisk;
    getRiskWarnings: typeof getRiskWarnings;
    RISK_THRESHOLDS: {
        MARGIN_CALL: number;
        LIQUIDATION: number;
        MAX_POSITION_SIZE: number;
        MAX_OPEN_POSITIONS: number;
        MAX_LEVERAGE: number;
    };
};
export default _default;
