/**
 * Risk Manager Service
 * 
 * Monitors margin levels and manages liquidations
 * Prevents users from losing more than their capital
 */

import {
  calculateEquity,
  calculateMarginLevel,
  isMarginCall,
  shouldLiquidate,
} from './pnl-calculator.service';

// Risk thresholds
export const RISK_THRESHOLDS = {
  MARGIN_CALL: 100, // Warn at 100% margin level
  LIQUIDATION: 50, // Liquidate at 50% margin level
  MAX_POSITION_SIZE: 100, // Max 100 lots per position
  MAX_OPEN_POSITIONS: 10, // Max 10 open positions
  MAX_LEVERAGE: 500, // Max 1:500 leverage
};

// Margin status
export type MarginStatus = 'safe' | 'warning' | 'danger' | 'liquidation';

/**
 * Calculate margin status for a participant
 * 
 * @param currentCapital - Current capital
 * @param totalUnrealizedPnL - Sum of all unrealized P&L
 * @param totalUsedMargin - Sum of all used margin
 * @returns Margin status and level
 */
export function getMarginStatus(
  currentCapital: number,
  totalUnrealizedPnL: number,
  totalUsedMargin: number,
  thresholds?: {
    liquidation: number;
    marginCall: number;
    warning: number;
  }
): {
  status: MarginStatus;
  marginLevel: number;
  equity: number;
  message: string;
} {
  // Use admin-configured thresholds or defaults
  const liquidationThreshold = thresholds?.liquidation ?? 50;
  const marginCallThreshold = thresholds?.marginCall ?? 100;
  const warningThreshold = thresholds?.warning ?? 150;

  const equity = calculateEquity(currentCapital, totalUnrealizedPnL);
  const marginLevel = calculateMarginLevel(equity, totalUsedMargin);

  let status: MarginStatus;
  let message: string;

  if (shouldLiquidate(marginLevel, liquidationThreshold)) {
    status = 'liquidation';
    message = `⚠️ LIQUIDATION: Margin level below ${liquidationThreshold}% - positions will be closed automatically`;
  } else if (isMarginCall(marginLevel, marginCallThreshold)) {
    status = 'danger';
    message = `🚨 MARGIN CALL: Margin level below ${marginCallThreshold}% - add capital or close positions to avoid liquidation`;
  } else if (marginLevel < warningThreshold) {
    status = 'warning';
    message = `⚠️ WARNING: Margin level below ${warningThreshold}% - consider reducing position sizes`;
  } else {
    status = 'safe';
    message = '✅ Margin level healthy';
  }

  return {
    status,
    marginLevel: Number.isFinite(marginLevel) ? marginLevel : Infinity,
    equity,
    message,
  };
}

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
export function validateNewOrder(
  availableCapital: number,
  marginRequired: number,
  currentOpenPositions: number,
  quantity: number,
  leverage: number,
  maxPositions: number = RISK_THRESHOLDS.MAX_OPEN_POSITIONS,
  maxLeverage: number = RISK_THRESHOLDS.MAX_LEVERAGE
): {
  valid: boolean;
  error?: string;
} {
  // Check available capital
  if (marginRequired > availableCapital) {
    return {
      valid: false,
      error: `Insufficient capital. Need $${marginRequired.toFixed(2)}, available $${availableCapital.toFixed(2)}`,
    };
  }

  // Check max positions
  if (currentOpenPositions >= maxPositions) {
    return {
      valid: false,
      error: `Maximum ${maxPositions} open positions allowed`,
    };
  }

  // Check position size
  if (quantity > RISK_THRESHOLDS.MAX_POSITION_SIZE) {
    return {
      valid: false,
      error: `Maximum position size is ${RISK_THRESHOLDS.MAX_POSITION_SIZE} lots`,
    };
  }

  // Check leverage
  if (leverage > maxLeverage) {
    return {
      valid: false,
      error: `Maximum leverage is 1:${maxLeverage}`,
    };
  }

  return { valid: true };
}

/**
 * Calculate maximum position size given available capital
 * 
 * @param availableCapital - Capital not tied in positions
 * @param entryPrice - Price to enter at
 * @param leverage - Leverage to use
 * @returns Maximum lot size
 */
export function calculateMaxPositionSize(
  availableCapital: number,
  entryPrice: number,
  leverage: number
): number {
  // Max position value with leverage
  const maxPositionValue = availableCapital * leverage;
  
  // Convert to lots (1 lot = 100,000 units)
  const contractSize = 100000;
  const maxLots = maxPositionValue / (entryPrice * contractSize);
  
  // Round down to 0.01 lot increments
  const maxLotsRounded = Math.floor(maxLots * 100) / 100;
  
  return Math.min(maxLotsRounded, RISK_THRESHOLDS.MAX_POSITION_SIZE);
}

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
export function calculateRecommendedStopLoss(
  entryPrice: number,
  side: 'long' | 'short',
  riskPercentage: number,
  capital: number,
  quantity: number
): number {
  // Risk amount in dollars
  const riskAmount = capital * (riskPercentage / 100);
  
  // Contract size
  const contractSize = 100000;
  
  // Price move that would result in this risk
  const priceMove = riskAmount / (quantity * contractSize);
  
  // Calculate SL price
  const stopLoss = side === 'long'
    ? entryPrice - priceMove
    : entryPrice + priceMove;
  
  return Number(stopLoss.toFixed(5));
}

/**
 * Calculate position risk as percentage of capital
 * 
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param quantity - Position size in lots
 * @param capital - Total capital
 * @returns Risk percentage
 */
export function calculatePositionRisk(
  entryPrice: number,
  stopLoss: number,
  quantity: number,
  capital: number
): number {
  const priceMove = Math.abs(entryPrice - stopLoss);
  const contractSize = 100000;
  const potentialLoss = priceMove * quantity * contractSize;
  const riskPercentage = (potentialLoss / capital) * 100;
  
  return Number(riskPercentage.toFixed(2));
}

/**
 * Check if total risk across all positions is within acceptable limits
 * 
 * @param positions - Array of open positions with risk data
 * @param capital - Total capital
 * @param maxTotalRisk - Max total risk percentage (default 10%)
 * @returns Validation result
 */
export function validateTotalRisk(
  positions: Array<{
    entryPrice: number;
    stopLoss?: number;
    quantity: number;
  }>,
  capital: number,
  maxTotalRisk: number = 10
): {
  valid: boolean;
  totalRisk: number;
  error?: string;
} {
  const totalRisk = positions.reduce((sum, position) => {
    if (!position.stopLoss) return sum;
    const risk = calculatePositionRisk(
      position.entryPrice,
      position.stopLoss,
      position.quantity,
      capital
    );
    return sum + risk;
  }, 0);

  if (totalRisk > maxTotalRisk) {
    return {
      valid: false,
      totalRisk: Number(totalRisk.toFixed(2)),
      error: `Total risk ${totalRisk.toFixed(1)}% exceeds maximum ${maxTotalRisk}%`,
    };
  }

  return {
    valid: true,
    totalRisk: Number(totalRisk.toFixed(2)),
  };
}

/**
 * Generate risk warnings based on participant status
 * 
 * @param marginStatus - Current margin status
 * @param openPositions - Number of open positions
 * @param maxPositions - Max allowed positions
 * @returns Array of warning messages
 */
export function getRiskWarnings(
  marginStatus: MarginStatus,
  openPositions: number,
  maxPositions: number
): string[] {
  const warnings: string[] = [];

  if (marginStatus === 'liquidation') {
    warnings.push('⚠️ CRITICAL: Liquidation imminent! Close positions immediately');
  } else if (marginStatus === 'danger') {
    warnings.push('🚨 Margin call: Your positions may be liquidated');
  } else if (marginStatus === 'warning') {
    warnings.push('⚠️ Low margin level: Consider reducing risk');
  }

  if (openPositions >= maxPositions * 0.8) {
    warnings.push(`📊 High position count: ${openPositions}/${maxPositions} positions open`);
  }

  return warnings;
}

export default {
  getMarginStatus,
  validateNewOrder,
  calculateMaxPositionSize,
  calculateRecommendedStopLoss,
  calculatePositionRisk,
  validateTotalRisk,
  getRiskWarnings,
  RISK_THRESHOLDS,
};

