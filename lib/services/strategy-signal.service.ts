/**
 * Strategy Signal Service
 * 
 * Evaluates strategy rules against price data to generate buy/sell signals
 */

import { IStrategyConfig, IStrategyRule, IStrategyCondition, SignalType } from '@/database/models/marketplace/marketplace-item.model';

// Signal result
export interface StrategySignal {
  time: number;
  type: SignalType;
  strength: number;
  ruleName: string;
  ruleId: string;
}

// Candle data for calculations
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Indicator calculation functions
const calculateSMA = (prices: number[], period: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
};

const calculateEMA = (prices: number[], period: number): number[] => {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(prices[0]);
    } else if (i < period - 1) {
      // Use SMA for initial values
      const sum = prices.slice(0, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / (i + 1));
    } else {
      const ema = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }
  return result;
};

const calculateBollingerBands = (
  prices: number[],
  period: number,
  stdDev: number
): { upper: number[]; middle: number[]; lower: number[] } => {
  const sma = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const sd = Math.sqrt(variance) * stdDev;
      upper.push(mean + sd);
      lower.push(mean - sd);
    }
  }
  
  return { upper, middle: sma, lower };
};

const calculateRSI = (prices: number[], period: number): number[] => {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(50); // Neutral
      gains.push(0);
      losses.push(0);
    } else {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
      
      if (i < period) {
        result.push(50);
      } else {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        
        if (avgLoss === 0) {
          result.push(100);
        } else {
          const rs = avgGain / avgLoss;
          result.push(100 - (100 / (1 + rs)));
        }
      }
    }
  }
  
  return result;
};

const calculateMACD = (
  prices: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macdLine: number[]; signalLine: number[]; histogram: number[] } => {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = calculateEMA(macdLine.filter(v => !isNaN(v)), signalPeriod);
  
  // Pad signal line to match macd line length
  const paddedSignal = Array(macdLine.length - signalLine.length).fill(NaN).concat(signalLine);
  
  const histogram = macdLine.map((macd, i) => macd - paddedSignal[i]);
  
  return { macdLine, signalLine: paddedSignal, histogram };
};

// Get indicator value at a specific index
const getIndicatorValue = (
  indicator: string,
  params: Record<string, number> | undefined,
  candles: CandleData[],
  index: number,
  calculatedIndicators: Map<string, number[]>
): number => {
  const closes = candles.map(c => c.close);
  const cacheKey = `${indicator}_${JSON.stringify(params || {})}`;
  
  // Price values
  if (indicator === 'price' || indicator === 'close') return candles[index].close;
  if (indicator === 'open') return candles[index].open;
  if (indicator === 'high') return candles[index].high;
  if (indicator === 'low') return candles[index].low;
  
  // Check cache first
  if (calculatedIndicators.has(cacheKey)) {
    return calculatedIndicators.get(cacheKey)![index];
  }
  
  // Calculate and cache
  let values: number[] = [];
  const period = params?.period || 20;
  
  switch (indicator) {
    case 'sma':
      values = calculateSMA(closes, period);
      break;
    case 'ema':
      values = calculateEMA(closes, period);
      break;
    case 'bb_upper':
      const bbU = calculateBollingerBands(closes, period, params?.stdDev || 2);
      calculatedIndicators.set(`bb_middle_${JSON.stringify(params || {})}`, bbU.middle);
      calculatedIndicators.set(`bb_lower_${JSON.stringify(params || {})}`, bbU.lower);
      values = bbU.upper;
      break;
    case 'bb_middle':
      const bbM = calculateBollingerBands(closes, period, params?.stdDev || 2);
      calculatedIndicators.set(`bb_upper_${JSON.stringify(params || {})}`, bbM.upper);
      calculatedIndicators.set(`bb_lower_${JSON.stringify(params || {})}`, bbM.lower);
      values = bbM.middle;
      break;
    case 'bb_lower':
      const bbL = calculateBollingerBands(closes, period, params?.stdDev || 2);
      calculatedIndicators.set(`bb_upper_${JSON.stringify(params || {})}`, bbL.upper);
      calculatedIndicators.set(`bb_middle_${JSON.stringify(params || {})}`, bbL.middle);
      values = bbL.lower;
      break;
    case 'rsi':
      values = calculateRSI(closes, params?.period || 14);
      break;
    case 'macd_line':
      const macdL = calculateMACD(closes, params?.fast || 12, params?.slow || 26, params?.signal || 9);
      calculatedIndicators.set(`macd_signal_${JSON.stringify(params || {})}`, macdL.signalLine);
      calculatedIndicators.set(`macd_histogram_${JSON.stringify(params || {})}`, macdL.histogram);
      values = macdL.macdLine;
      break;
    case 'macd_signal':
      const macdS = calculateMACD(closes, params?.fast || 12, params?.slow || 26, params?.signal || 9);
      calculatedIndicators.set(`macd_line_${JSON.stringify(params || {})}`, macdS.macdLine);
      calculatedIndicators.set(`macd_histogram_${JSON.stringify(params || {})}`, macdS.histogram);
      values = macdS.signalLine;
      break;
    case 'macd_histogram':
      const macdH = calculateMACD(closes, params?.fast || 12, params?.slow || 26, params?.signal || 9);
      calculatedIndicators.set(`macd_line_${JSON.stringify(params || {})}`, macdH.macdLine);
      calculatedIndicators.set(`macd_signal_${JSON.stringify(params || {})}`, macdH.signalLine);
      values = macdH.histogram;
      break;
    default:
      return NaN;
  }
  
  calculatedIndicators.set(cacheKey, values);
  return values[index];
};

// Evaluate a single condition
const evaluateCondition = (
  condition: IStrategyCondition,
  candles: CandleData[],
  index: number,
  calculatedIndicators: Map<string, number[]>
): boolean => {
  const value = getIndicatorValue(
    condition.indicator,
    condition.indicatorParams,
    candles,
    index,
    calculatedIndicators
  );
  
  if (isNaN(value)) return false;
  
  let compareValue: number;
  
  if (condition.compareWith === 'value') {
    compareValue = condition.compareValue || 0;
  } else {
    compareValue = getIndicatorValue(
      condition.compareIndicator || 'sma',
      condition.compareIndicatorParams,
      candles,
      index,
      calculatedIndicators
    );
  }
  
  if (isNaN(compareValue)) return false;
  
  switch (condition.operator) {
    case 'above':
      return value > compareValue;
    case 'below':
      return value < compareValue;
    case 'equals':
      return Math.abs(value - compareValue) < 0.0001;
    case 'crosses_above':
      if (index === 0) return false;
      const prevValue = getIndicatorValue(
        condition.indicator,
        condition.indicatorParams,
        candles,
        index - 1,
        calculatedIndicators
      );
      const prevCompare = condition.compareWith === 'value' 
        ? (condition.compareValue || 0)
        : getIndicatorValue(
            condition.compareIndicator || 'sma',
            condition.compareIndicatorParams,
            candles,
            index - 1,
            calculatedIndicators
          );
      return prevValue <= prevCompare && value > compareValue;
    case 'crosses_below':
      if (index === 0) return false;
      const prevVal = getIndicatorValue(
        condition.indicator,
        condition.indicatorParams,
        candles,
        index - 1,
        calculatedIndicators
      );
      const prevComp = condition.compareWith === 'value'
        ? (condition.compareValue || 0)
        : getIndicatorValue(
            condition.compareIndicator || 'sma',
            condition.compareIndicatorParams,
            candles,
            index - 1,
            calculatedIndicators
          );
      return prevVal >= prevComp && value < compareValue;
    default:
      return false;
  }
};

// Evaluate a rule (combination of conditions)
const evaluateRule = (
  rule: IStrategyRule,
  candles: CandleData[],
  index: number,
  calculatedIndicators: Map<string, number[]>
): boolean => {
  if (rule.conditions.length === 0) return false;
  
  if (rule.logic === 'AND') {
    return rule.conditions.every(condition =>
      evaluateCondition(condition, candles, index, calculatedIndicators)
    );
  } else {
    return rule.conditions.some(condition =>
      evaluateCondition(condition, candles, index, calculatedIndicators)
    );
  }
};

/**
 * Generate signals for a strategy configuration
 */
export function generateStrategySignals(
  config: IStrategyConfig,
  candles: CandleData[]
): StrategySignal[] {
  const signals: StrategySignal[] = [];
  const calculatedIndicators = new Map<string, number[]>();
  
  // Need at least some candles for calculations
  if (candles.length < 50) return signals;
  
  // Process each candle
  for (let i = 50; i < candles.length; i++) {
    // Check each rule
    for (const rule of config.rules) {
      if (evaluateRule(rule, candles, i, calculatedIndicators)) {
        signals.push({
          time: candles[i].time,
          type: rule.signal as SignalType,
          strength: rule.signalStrength,
          ruleName: rule.name,
          ruleId: rule.id,
        });
      }
    }
  }
  
  return signals;
}

/**
 * Get signal color based on type
 */
export function getSignalColor(type: SignalType): string {
  switch (type) {
    case 'strong_buy': return '#00ff00';
    case 'buy': return '#4ade80';
    case 'neutral': return '#6b7280';
    case 'sell': return '#f87171';
    case 'strong_sell': return '#ff0000';
    default: return '#6b7280';
  }
}

/**
 * Get signal label
 */
export function getSignalLabel(type: SignalType): string {
  switch (type) {
    case 'strong_buy': return 'STRONG BUY';
    case 'buy': return 'BUY';
    case 'neutral': return 'NEUTRAL';
    case 'sell': return 'SELL';
    case 'strong_sell': return 'STRONG SELL';
    default: return '';
  }
}

