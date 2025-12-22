/**
 * Margin Safety Service (Client-Safe)
 * Calculates safe trade limits to prevent margin calls and liquidation
 *
 * NOTE: This file must remain client-safe (no database imports)
 * Use server actions to load thresholds from database
 */
export declare const DEFAULT_MARGIN_THRESHOLDS: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE: number;
};
export type MarginThresholds = typeof DEFAULT_MARGIN_THRESHOLDS;
export declare const MARGIN_THRESHOLDS: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE: number;
};
/**
 * Calculate maximum safe amount for a new trade
 * Ensures margin level stays above minimum threshold after the trade
 *
 * Formula:
 * New Margin Level = Equity / (Existing Used Margin + New Margin Required)
 * We want: New Margin Level >= Target Margin Level (e.g., 150%)
 *
 * Solving for max new margin:
 * Max New Margin = (Equity / Target Margin Level) - Existing Used Margin
 *
 * @param equity - Current equity (balance + unrealized P&L)
 * @param existingUsedMargin - Margin already tied up in open positions
 * @param availableCapital - Free capital available for new trades
 * @param leverage - Leverage for the new trade
 * @param targetMarginLevel - Minimum margin level to maintain (uses WARNING threshold from settings)
 * @param thresholds - Optional margin thresholds (uses cached or default if not provided)
 * @returns Maximum safe amount to use for a new trade
 */
export declare function calculateMaxSafeTradeAmount(equity: number, existingUsedMargin: number, availableCapital: number, leverage: number, targetMarginLevel?: number, thresholds?: typeof DEFAULT_MARGIN_THRESHOLDS): {
    maxSafeAmount: number;
    reason: 'safe' | 'margin_limit' | 'capital_limit';
    projectedMarginLevel: number;
};
/**
 * Calculate what margin level would be after placing a trade
 *
 * @param equity - Current equity
 * @param existingUsedMargin - Current margin in use
 * @param newMarginRequired - Margin needed for new trade
 * @returns Projected margin level after trade
 */
export declare function calculateProjectedMarginLevel(equity: number, existingUsedMargin: number, newMarginRequired: number): number;
/**
 * Get margin safety status and message
 *
 * @param marginLevel - Current or projected margin level
 * @param mode - Display mode (professional or game)
 * @param thresholds - Optional margin thresholds (uses cached or default if not provided)
 * @returns Status and user-friendly message
 */
export declare function getMarginSafetyMessage(marginLevel: number, mode?: 'professional' | 'game', thresholds?: typeof DEFAULT_MARGIN_THRESHOLDS): {
    status: 'safe' | 'warning' | 'danger' | 'critical';
    message: string;
    canTrade: boolean;
};
//# sourceMappingURL=margin-safety.service.d.ts.map