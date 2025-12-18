/**
 * Margin Safety Service (Client-Safe)
 * Calculates safe trade limits to prevent margin calls and liquidation
 * 
 * NOTE: This file must remain client-safe (no database imports)
 * Use server actions to load thresholds from database
 */

// Default margin level thresholds (used as fallback)
export const DEFAULT_MARGIN_THRESHOLDS = {
  LIQUIDATION: 50, // Stopout happens here
  MARGIN_CALL: 100, // Warning - positions at risk
  WARNING: 150, // Recommended minimum
  SAFE: 200, // Ideal level
};

// Type for margin thresholds
export type MarginThresholds = typeof DEFAULT_MARGIN_THRESHOLDS;

// Export for immediate use with defaults
export const MARGIN_THRESHOLDS = DEFAULT_MARGIN_THRESHOLDS;

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
export function calculateMaxSafeTradeAmount(
  equity: number,
  existingUsedMargin: number,
  availableCapital: number,
  leverage: number,
  targetMarginLevel?: number,
  thresholds?: typeof DEFAULT_MARGIN_THRESHOLDS
): {
  maxSafeAmount: number;
  reason: 'safe' | 'margin_limit' | 'capital_limit';
  projectedMarginLevel: number;
} {
  const marginThresholds = thresholds || MARGIN_THRESHOLDS;
  const target = targetMarginLevel || marginThresholds.WARNING;
  // If no existing positions, we can use available capital freely
  if (existingUsedMargin === 0) {
    return {
      maxSafeAmount: availableCapital * 0.95, // 95% buffer
      reason: 'safe',
      projectedMarginLevel: Infinity,
    };
  }

  // Calculate max margin we can add while staying above target margin level
  // Target: marginLevel = (equity / totalUsedMargin) × 100 >= target
  // Solve: maxTotalMargin = equity / (target / 100)
  const maxTotalMargin = equity / (target / 100);
  const maxNewMargin = maxTotalMargin - existingUsedMargin;

  // Margin for a trade ≈ amount (at 1:1) when considering leverage properly
  // But to be safe, we limit to this calculated max
  const marginLimitedAmount = Math.max(0, maxNewMargin * 0.9); // 90% of max for safety buffer

  // Also can't exceed available capital
  const maxSafeAmount = Math.min(marginLimitedAmount, availableCapital * 0.95);

  // Calculate projected margin level if we use this amount
  const projectedUsedMargin = existingUsedMargin + maxSafeAmount;
  const projectedMarginLevel = projectedUsedMargin > 0 
    ? (equity / projectedUsedMargin) * 100 
    : Infinity;

  const reason = marginLimitedAmount < availableCapital 
    ? 'margin_limit' 
    : 'capital_limit';

  return {
    maxSafeAmount: Math.max(10, maxSafeAmount), // Minimum $10
    reason,
    projectedMarginLevel,
  };
}

/**
 * Calculate what margin level would be after placing a trade
 * 
 * @param equity - Current equity
 * @param existingUsedMargin - Current margin in use
 * @param newMarginRequired - Margin needed for new trade
 * @returns Projected margin level after trade
 */
export function calculateProjectedMarginLevel(
  equity: number,
  existingUsedMargin: number,
  newMarginRequired: number
): number {
  const totalUsedMargin = existingUsedMargin + newMarginRequired;
  if (totalUsedMargin === 0) return Infinity;
  return (equity / totalUsedMargin) * 100;
}

/**
 * Get margin safety status and message
 * 
 * @param marginLevel - Current or projected margin level
 * @param mode - Display mode (professional or game)
 * @param thresholds - Optional margin thresholds (uses cached or default if not provided)
 * @returns Status and user-friendly message
 */
export function getMarginSafetyMessage(
  marginLevel: number,
  mode: 'professional' | 'game' = 'professional',
  thresholds?: typeof DEFAULT_MARGIN_THRESHOLDS
): {
  status: 'safe' | 'warning' | 'danger' | 'critical';
  message: string;
  canTrade: boolean;
} {
  const marginThresholds = thresholds || MARGIN_THRESHOLDS;
  
  if (marginLevel < marginThresholds.LIQUIDATION) {
    return {
      status: 'critical',
      message: mode === 'game'
        ? '💀 STOPOUT! All trades will close automatically!'
        : '⚠️ LIQUIDATION: Margin level below 50% - positions will be closed',
      canTrade: false,
    };
  }

  if (marginLevel < marginThresholds.MARGIN_CALL) {
    return {
      status: 'danger',
      message: mode === 'game'
        ? '🚨 MARGIN CALL! Close some trades before opening new positions!'
        : `🚨 MARGIN CALL: Margin level below ${marginThresholds.MARGIN_CALL}% - close positions to trade`,
      canTrade: false, // Block trades when below margin call
    };
  }

  if (marginLevel < marginThresholds.WARNING) {
    return {
      status: 'warning',
      message: mode === 'game'
        ? '⚠️ Running low! Be careful with new trades!'
        : `⚠️ WARNING: Margin level below ${marginThresholds.WARNING}% - trade carefully`,
      canTrade: true,
    };
  }

  return {
    status: 'safe',
    message: mode === 'game'
      ? '✅ Safe to trade!'
      : '✅ Margin level healthy',
    canTrade: true,
  };
}

