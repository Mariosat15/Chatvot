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
  // Major Pairs
  "EUR/USD": { name: "Euro vs US Dollar", pip: 0.0001, contractSize: 100000 },
  "GBP/USD": {
    name: "British Pound vs US Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "USD/JPY": {
    name: "US Dollar vs Japanese Yen",
    pip: 0.01,
    contractSize: 100000,
  },
  "USD/CHF": {
    name: "US Dollar vs Swiss Franc",
    pip: 0.0001,
    contractSize: 100000,
  },
  "AUD/USD": {
    name: "Australian Dollar vs US Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "USD/CAD": {
    name: "US Dollar vs Canadian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "NZD/USD": {
    name: "New Zealand Dollar vs US Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },

  // Cross Pairs
  "EUR/GBP": {
    name: "Euro vs British Pound",
    pip: 0.0001,
    contractSize: 100000,
  },
  "EUR/JPY": { name: "Euro vs Japanese Yen", pip: 0.01, contractSize: 100000 },
  "EUR/CHF": { name: "Euro vs Swiss Franc", pip: 0.0001, contractSize: 100000 },
  "EUR/AUD": {
    name: "Euro vs Australian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "EUR/CAD": {
    name: "Euro vs Canadian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "EUR/NZD": {
    name: "Euro vs New Zealand Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "GBP/JPY": {
    name: "British Pound vs Japanese Yen",
    pip: 0.01,
    contractSize: 100000,
  },
  "GBP/CHF": {
    name: "British Pound vs Swiss Franc",
    pip: 0.0001,
    contractSize: 100000,
  },
  "GBP/AUD": {
    name: "British Pound vs Australian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "GBP/CAD": {
    name: "British Pound vs Canadian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "GBP/NZD": {
    name: "British Pound vs New Zealand Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "AUD/JPY": {
    name: "Australian Dollar vs Japanese Yen",
    pip: 0.01,
    contractSize: 100000,
  },
  "AUD/CHF": {
    name: "Australian Dollar vs Swiss Franc",
    pip: 0.0001,
    contractSize: 100000,
  },
  "AUD/CAD": {
    name: "Australian Dollar vs Canadian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "AUD/NZD": {
    name: "Australian Dollar vs New Zealand Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },
  "CAD/JPY": {
    name: "Canadian Dollar vs Japanese Yen",
    pip: 0.01,
    contractSize: 100000,
  },
  "CAD/CHF": {
    name: "Canadian Dollar vs Swiss Franc",
    pip: 0.0001,
    contractSize: 100000,
  },
  "CHF/JPY": {
    name: "Swiss Franc vs Japanese Yen",
    pip: 0.01,
    contractSize: 100000,
  },
  "NZD/JPY": {
    name: "New Zealand Dollar vs Japanese Yen",
    pip: 0.01,
    contractSize: 100000,
  },
  "NZD/CHF": {
    name: "New Zealand Dollar vs Swiss Franc",
    pip: 0.0001,
    contractSize: 100000,
  },
  "NZD/CAD": {
    name: "New Zealand Dollar vs Canadian Dollar",
    pip: 0.0001,
    contractSize: 100000,
  },

  // Exotic Pairs
  "USD/MXN": {
    name: "US Dollar vs Mexican Peso",
    pip: 0.0001,
    contractSize: 100000,
  },
  "USD/ZAR": {
    name: "US Dollar vs South African Rand",
    pip: 0.0001,
    contractSize: 100000,
  },
  "USD/TRY": {
    name: "US Dollar vs Turkish Lira",
    pip: 0.0001,
    contractSize: 100000,
  },
  "USD/SEK": {
    name: "US Dollar vs Swedish Krona",
    pip: 0.0001,
    contractSize: 100000,
  },
  "USD/NOK": {
    name: "US Dollar vs Norwegian Krone",
    pip: 0.0001,
    contractSize: 100000,
  },
};

export type ForexSymbol = keyof typeof FOREX_PAIRS;

// Reason: PnL and margin for non-USD-quoted pairs (e.g. NZD/JPY) are denominated
// in the quote currency. Without converting to USD the numbers are wildly wrong
// (e.g. 92× too large for JPY pairs because 1 USD ≈ 149 JPY).

interface PriceData {
  bid: number;
  ask: number;
}

/**
 * Returns the number of quote-currency units per 1 USD (mid price).
 * Used to convert raw PnL / margin from quote currency → USD.
 *
 * Example: NZD/JPY → quote is JPY → looks up USD/JPY ≈ 149.5 → returns 149.5
 */
export function getQuoteToUsdRate(
  symbol: ForexSymbol | string,
  prices?: Map<string, PriceData> | null,
): number {
  const quote = symbol.split("/")[1];
  if (quote === "USD") return 1.0;
  if (!prices || prices.size === 0) return 1.0;

  // Try USD/QUOTE pair directly (USD/JPY, USD/CHF, USD/CAD, …)
  const directPair = `USD/${quote}`;
  const directPrice = prices.get(directPair);
  if (directPrice && directPrice.bid > 0) {
    return (directPrice.bid + directPrice.ask) / 2;
  }

  // Try QUOTE/USD pair and invert (GBP/USD, AUD/USD, NZD/USD, …)
  const invertPair = `${quote}/USD`;
  const invertPrice = prices.get(invertPair);
  if (invertPrice && invertPrice.bid > 0) {
    const mid = (invertPrice.bid + invertPrice.ask) / 2;
    return mid > 0 ? 1 / mid : 1.0;
  }

  return 1.0;
}

/**
 * Returns the additional forex symbols needed to compute USD conversion rates
 * for a set of traded symbols. Merge these into your price fetch call.
 */
export function getConversionPairSymbols(
  symbols: (ForexSymbol | string)[],
): ForexSymbol[] {
  const needed = new Set<ForexSymbol>();

  for (const sym of symbols) {
    const quote = sym.split("/")[1];
    if (quote === "USD") continue;

    const directPair = `USD/${quote}` as ForexSymbol;
    if (directPair in FOREX_PAIRS) {
      needed.add(directPair);
      continue;
    }
    const invertPair = `${quote}/USD` as ForexSymbol;
    if (invertPair in FOREX_PAIRS) {
      needed.add(invertPair);
    }
  }

  return [...needed];
}

/**
 * Calculate unrealized P&L for an open position
 *
 * @param side - 'long' or 'short'
 * @param entryPrice - Price when position was opened
 * @param currentPrice - Current market price
 * @param quantity - Position size in lots
 * @param symbol - Forex pair symbol
 * @param quoteToUsdRate - Quote-currency units per 1 USD (default 1 = USD-quoted pair)
 * @returns Unrealized profit/loss in USD
 */
export function calculateUnrealizedPnL(
  side: "long" | "short",
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  symbol: ForexSymbol,
  quoteToUsdRate: number = 1,
): number {
  const pairConfig = FOREX_PAIRS[symbol];
  if (!pairConfig) {
    throw new Error(`Unknown forex pair: ${symbol}`);
  }

  const { contractSize } = pairConfig;
  const priceChange =
    side === "long" ? currentPrice - entryPrice : entryPrice - currentPrice;

  let pnl = priceChange * quantity * contractSize;

  // Reason: raw pnl is in quote currency; divide by quoteToUsdRate to get USD.
  if (quoteToUsdRate > 0 && quoteToUsdRate !== 1) {
    pnl /= quoteToUsdRate;
  }

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
export function calculatePnLPercentage(
  pnl: number,
  marginUsed: number,
): number {
  if (marginUsed === 0) return 0;
  return Number(((pnl / marginUsed) * 100).toFixed(2));
}

/**
 * Calculate margin required to open a position
 *
 * @param quantity - Position size in lots
 * @param entryPrice - Entry price (in quote currency)
 * @param leverage - Leverage ratio (e.g., 100 for 1:100)
 * @param symbol - Forex pair symbol
 * @param quoteToUsdRate - Quote-currency units per 1 USD (default 1 = USD-quoted pair)
 * @returns Required margin in USD
 */
export function calculateMarginRequired(
  quantity: number,
  entryPrice: number,
  leverage: number,
  symbol: ForexSymbol,
  quoteToUsdRate: number = 1,
): number {
  const pairConfig = FOREX_PAIRS[symbol];
  if (!pairConfig) {
    throw new Error(`Unknown forex pair: ${symbol}`);
  }

  const { contractSize } = pairConfig;
  let positionValue = quantity * contractSize * entryPrice;

  // Reason: positionValue is in quote currency; divide to get USD.
  if (quoteToUsdRate > 0 && quoteToUsdRate !== 1) {
    positionValue /= quoteToUsdRate;
  }

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
export function calculateEquity(
  currentCapital: number,
  unrealizedPnL: number,
): number {
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
export function calculateMarginLevel(
  equity: number,
  usedMargin: number,
): number {
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
export function isMarginCall(
  marginLevel: number,
  threshold: number = 100,
): boolean {
  return marginLevel < threshold;
}

/**
 * Check if position should be liquidated
 *
 * @param marginLevel - Current margin level
 * @param threshold - Liquidation threshold from admin settings (default: 50%)
 * @returns True if should liquidate
 */
export function shouldLiquidate(
  marginLevel: number,
  threshold: number = 50,
): boolean {
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
  side: "long" | "short",
  entryPrice: number,
  quantity: number,
  marginUsed: number,
  leverage: number,
  symbol: ForexSymbol,
  quoteToUsdRate: number = 1,
): number {
  const pairConfig = FOREX_PAIRS[symbol];
  if (!pairConfig) {
    throw new Error(`Unknown forex pair: ${symbol}`);
  }

  const { contractSize } = pairConfig;

  // Reason: marginUsed is in USD; convert to quote currency before computing price move.
  const maxLossInQuote =
    quoteToUsdRate > 0 && quoteToUsdRate !== 1
      ? marginUsed * quoteToUsdRate
      : marginUsed;

  const priceMove = maxLossInQuote / (quantity * contractSize);

  const liquidationPrice =
    side === "long" ? entryPrice - priceMove : entryPrice + priceMove;

  return Number(liquidationPrice.toFixed(5));
}

/**
 * Calculate pip value in USD
 *
 * @param quantity - Position size in lots
 * @param symbol - Forex pair symbol
 * @param quoteToUsdRate - Quote-currency units per 1 USD (default 1)
 * @returns Pip value in USD
 */
export function calculatePipValue(
  quantity: number,
  symbol: ForexSymbol,
  quoteToUsdRate: number = 1,
): number {
  const pairConfig = FOREX_PAIRS[symbol];
  if (!pairConfig) {
    throw new Error(`Unknown forex pair: ${symbol}`);
  }

  const { pip, contractSize } = pairConfig;
  let pipValue = pip * quantity * contractSize;

  if (quoteToUsdRate > 0 && quoteToUsdRate !== 1) {
    pipValue /= quoteToUsdRate;
  }

  return Number(pipValue.toFixed(4));
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
  symbol: ForexSymbol,
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
  maxLot: number = 100,
): { valid: boolean; error?: string } {
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
  if (remainder > 0.0001) {
    // Allow tiny floating-point errors
    return { valid: false, error: "Lot size must be in increments of 0.01" };
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
  side: "long" | "short",
  entryPrice: number,
  stopLoss?: number,
  takeProfit?: number,
): { valid: boolean; error?: string } {
  if (side === "long") {
    // For long: SL must be below entry, TP must be above entry
    if (stopLoss && stopLoss >= entryPrice) {
      return {
        valid: false,
        error: "Stop loss must be below entry price for long positions",
      };
    }
    if (takeProfit && takeProfit <= entryPrice) {
      return {
        valid: false,
        error: "Take profit must be above entry price for long positions",
      };
    }
  } else {
    // For short: SL must be above entry, TP must be below entry
    if (stopLoss && stopLoss <= entryPrice) {
      return {
        valid: false,
        error: "Stop loss must be above entry price for short positions",
      };
    }
    if (takeProfit && takeProfit >= entryPrice) {
      return {
        valid: false,
        error: "Take profit must be below entry price for short positions",
      };
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
  side: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  symbol: ForexSymbol,
  quoteToUsdRate: number = 1,
): number {
  return calculateUnrealizedPnL(
    side,
    entryPrice,
    exitPrice,
    quantity,
    symbol,
    quoteToUsdRate,
  );
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
  _side: "long" | "short",
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);

  if (risk === 0) return 0;

  return Number((reward / risk).toFixed(2));
}
