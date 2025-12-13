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

// Forex pair configurations
export const FOREX_PAIRS = {
  'EUR/USD': { name: 'Euro vs US Dollar', pip: 0.0001, contractSize: 100000 },
  'GBP/USD': { name: 'British Pound vs US Dollar', pip: 0.0001, contractSize: 100000 },
  'USD/JPY': { name: 'US Dollar vs Japanese Yen', pip: 0.01, contractSize: 100000 },
  'USD/CHF': { name: 'US Dollar vs Swiss Franc', pip: 0.0001, contractSize: 100000 },
  'AUD/USD': { name: 'Australian Dollar vs US Dollar', pip: 0.0001, contractSize: 100000 },
  'USD/CAD': { name: 'US Dollar vs Canadian Dollar', pip: 0.0001, contractSize: 100000 },
  'NZD/USD': { name: 'New Zealand Dollar vs US Dollar', pip: 0.0001, contractSize: 100000 },
  'EUR/GBP': { name: 'Euro vs British Pound', pip: 0.0001, contractSize: 100000 },
  'EUR/JPY': { name: 'Euro vs Japanese Yen', pip: 0.01, contractSize: 100000 },
  'GBP/JPY': { name: 'British Pound vs Japanese Yen', pip: 0.01, contractSize: 100000 },
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
export function calculateUnrealizedPnL(
  side: 'long' | 'short',
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  symbol: ForexSymbol
): number {
  const pairConfig = FOREX_PAIRS[symbol];
  if (!pairConfig) {
    throw new Error(`Unknown forex pair: ${symbol}`);
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
export function calculatePnLPercentage(pnl: number, marginUsed: number): number {
  if (marginUsed === 0) return 0;
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
export function calculateMarginRequired(
  quantity: number,
  entryPrice: number,
  leverage: number,
  symbol: ForexSymbol
): number {
  const pairConfig = FOREX_PAIRS[symbol];
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
export function calculateMaintenanceMargin(initialMargin: number): number {
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
export function calculateEquity(currentCapital: number, unrealizedPnL: number): number {
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
export function calculateMarginLevel(equity: number, usedMargin: number): number {
  if (usedMargin === 0) return Infinity;
  return Number(((equity / usedMargin) * 100).toFixed(2));
}

/**
 * Check if margin call should be triggered
 * 
 * @param marginLevel - Current margin level
 * @param threshold - Margin call threshold from admin settings (default: 100%)
 * @returns True if margin call triggered
 */
export function isMarginCall(marginLevel: number, threshold: number = 100): boolean {
  return marginLevel < threshold;
}

/**
 * Check if position should be liquidated
 * 
 * @param marginLevel - Current margin level
 * @param threshold - Liquidation threshold from admin settings (default: 50%)
 * @returns True if should liquidate
 */
export function shouldLiquidate(marginLevel: number, threshold: number = 50): boolean {
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
export function calculateLiquidationPrice(
  side: 'long' | 'short',
  entryPrice: number,
  quantity: number,
  marginUsed: number,
  leverage: number,
  symbol: ForexSymbol
): number {
  const pairConfig = FOREX_PAIRS[symbol];
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
export function calculatePipValue(quantity: number, symbol: ForexSymbol): number {
  const pairConfig = FOREX_PAIRS[symbol];
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
export function calculatePipsMoved(
  entryPrice: number,
  currentPrice: number,
  symbol: ForexSymbol
): number {
  const pairConfig = FOREX_PAIRS[symbol];
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
export function validateQuantity(
  quantity: number,
  minLot: number = 0.01,
  maxLot: number = 100
): { valid: boolean; error?: string } {
  if (quantity < minLot) {
    return { valid: false, error: `Minimum lot size is ${minLot}` };
  }
  if (quantity > maxLot) {
    return { valid: false, error: `Maximum lot size is ${maxLot}` };
  }
  // Check if quantity is a valid increment (0.01)
  const remainder = (quantity * 100) % 1;
  if (remainder !== 0) {
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
export function validateSLTP(
  side: 'long' | 'short',
  entryPrice: number,
  stopLoss?: number,
  takeProfit?: number
): { valid: boolean; error?: string } {
  if (side === 'long') {
    // For long: SL must be below entry, TP must be above entry
    if (stopLoss && stopLoss >= entryPrice) {
      return { valid: false, error: 'Stop loss must be below entry price for long positions' };
    }
    if (takeProfit && takeProfit <= entryPrice) {
      return { valid: false, error: 'Take profit must be above entry price for long positions' };
    }
  } else {
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
export function calculatePotentialPnL(
  side: 'long' | 'short',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  symbol: ForexSymbol
): number {
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
export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  side: 'long' | 'short'
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  
  if (risk === 0) return 0;
  
  return Number((reward / risk).toFixed(2));
}

