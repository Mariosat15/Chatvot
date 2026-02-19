/**
 * Strategy Signal Service
 *
 * Evaluates strategy rules against price data to generate buy/sell signals
 */

import {
  IStrategyConfig,
  IStrategyRule,
  IStrategyCondition,
  SignalType,
} from "@/database/models/marketplace/marketplace-item.model";

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
      const sum = prices
        .slice(i - period + 1, i + 1)
        .reduce((a, b) => a + b, 0);
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
  stdDev: number,
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
      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
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
        const avgGain =
          gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) /
          period;
        const avgLoss =
          losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) /
          period;

        if (avgLoss === 0) {
          result.push(100);
        } else {
          const rs = avgGain / avgLoss;
          result.push(100 - 100 / (1 + rs));
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
  signalPeriod: number,
): { macdLine: number[]; signalLine: number[]; histogram: number[] } => {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = calculateEMA(
    macdLine.filter((v) => !isNaN(v)),
    signalPeriod,
  );

  // Pad signal line to match macd line length
  const paddedSignal = Array(macdLine.length - signalLine.length)
    .fill(NaN)
    .concat(signalLine);

  const histogram = macdLine.map((macd, i) => macd - paddedSignal[i]);

  return { macdLine, signalLine: paddedSignal, histogram };
};

// ─── Extended indicator calculations ────────────────────────────────────────

const calculateWMA = (prices: number[], period: number): number[] => {
  const result: number[] = new Array(prices.length).fill(NaN);
  const weights = Array.from({ length: period }, (_, i) => i + 1);
  const wSum = weights.reduce((a, b) => a + b, 0);
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    result[i] = slice.reduce((sum, val, k) => sum + val * weights[k], 0) / wSum;
  }
  return result;
};

const calculateHullMA = (prices: number[], period: number): number[] => {
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(2, Math.round(Math.sqrt(period)));
  const wmaFull = calculateWMA(prices, period);
  const wmaHalf = calculateWMA(prices, half);
  const synthetic = prices.map((_, i) =>
    isNaN(wmaFull[i]) || isNaN(wmaHalf[i]) ? NaN : 2 * wmaHalf[i] - wmaFull[i],
  );
  const wSqrt = Array.from({ length: sqrtP }, (_, i) => i + 1);
  const wSqrtSum = wSqrt.reduce((a, b) => a + b, 0);
  const result: number[] = new Array(prices.length).fill(NaN);
  for (let i = sqrtP - 1; i < synthetic.length; i++) {
    const slice = synthetic.slice(i - sqrtP + 1, i + 1);
    if (slice.some((v) => isNaN(v))) continue;
    result[i] = slice.reduce((sum, val, k) => sum + val * wSqrt[k], 0) / wSqrtSum;
  }
  return result;
};

const calculateKAMA = (
  prices: number[],
  period: number,
  fast: number,
  slow: number,
): number[] => {
  const fastSC = 2 / (fast + 1);
  const slowSC = 2 / (slow + 1);
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length === 0) return result;
  result[0] = prices[0];
  for (let i = 1; i < prices.length; i++) {
    if (i < period) { result[i] = prices[i]; continue; }
    const direction = Math.abs(prices[i] - prices[i - period]);
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) volatility += Math.abs(prices[j] - prices[j - 1]);
    const er = volatility === 0 ? 0 : direction / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    const prev = isNaN(result[i - 1]) ? prices[i - 1] : result[i - 1];
    result[i] = prev + sc * (prices[i] - prev);
  }
  return result;
};

const calculateStochastic = (candles: CandleData[], period: number): number[] =>
  candles.map((c, i) => {
    if (i < period - 1) return NaN;
    const slice = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...slice.map((s) => s.high));
    const lowest = Math.min(...slice.map((s) => s.low));
    return highest === lowest ? 50 : ((c.close - lowest) / (highest - lowest)) * 100;
  });

const calculateCCI = (candles: CandleData[], period: number): number[] =>
  candles.map((c, i) => {
    if (i < period - 1) return NaN;
    const slice = candles.slice(i - period + 1, i + 1);
    const tps = slice.map((s) => (s.high + s.low + s.close) / 3);
    const tp = (c.high + c.low + c.close) / 3;
    const avg = tps.reduce((a, b) => a + b, 0) / period;
    const meanDev = tps.reduce((sum, p) => sum + Math.abs(p - avg), 0) / period;
    return meanDev === 0 ? 0 : (tp - avg) / (0.015 * meanDev);
  });

// Returns 0 (oversold) to 100 (overbought) - inverted Williams %R for intuitive thresholds
const calculateWilliamsR = (candles: CandleData[], period: number): number[] =>
  candles.map((c, i) => {
    if (i < period - 1) return NaN;
    const slice = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...slice.map((s) => s.high));
    const lowest = Math.min(...slice.map((s) => s.low));
    return highest === lowest ? 50 : ((c.close - lowest) / (highest - lowest)) * 100;
  });

const calculateROC = (prices: number[], period: number): number[] =>
  prices.map((price, i) => {
    if (i < period) return NaN;
    const prev = prices[i - period];
    return prev === 0 ? 0 : ((price - prev) / prev) * 100;
  });

const calculateATR = (candles: CandleData[], period: number): number[] => {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < 2) return result;
  const tr: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ));
  }
  let atrVal = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  result[period] = atrVal;
  const k = 2 / (period + 1);
  for (let i = period + 1; i < candles.length; i++) {
    atrVal = (tr[i] - atrVal) * k + atrVal;
    result[i] = atrVal;
  }
  return result;
};

const calculateSupertrend = (
  candles: CandleData[],
  period: number,
  multiplier: number,
): number[] => {
  const atr = calculateATR(candles, period);
  const result: number[] = new Array(candles.length).fill(NaN);
  let upperBand = NaN, lowerBand = NaN, direction = 1;
  for (let i = period; i < candles.length; i++) {
    if (isNaN(atr[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const basicUpper = hl2 + multiplier * atr[i];
    const basicLower = hl2 - multiplier * atr[i];
    const newUpper = isNaN(upperBand) || basicUpper < upperBand || candles[i - 1].close > upperBand ? basicUpper : upperBand;
    const newLower = isNaN(lowerBand) || basicLower > lowerBand || candles[i - 1].close < lowerBand ? basicLower : lowerBand;
    if (!isNaN(upperBand)) {
      if (candles[i].close > upperBand) direction = 1;
      else if (candles[i].close < lowerBand) direction = -1;
    }
    result[i] = direction === 1 ? newLower : newUpper;
    upperBand = newUpper;
    lowerBand = newLower;
  }
  return result;
};

// Composite momentum score 0-100 used by Kinetic Pressure Zones and Nova Resonance Field
const calculateKineticScore = (candles: CandleData[], period: number): number[] => {
  const closes = candles.map((c) => c.close);
  const rsiV = calculateRSI(closes, period);
  const stochV = calculateStochastic(candles, period);
  const cciV = calculateCCI(candles, period < 20 ? 20 : period);
  const williamsV = calculateWilliamsR(candles, period);
  const rocV = calculateROC(closes, period);
  return candles.map((_, i) => {
    if ([rsiV[i], stochV[i], cciV[i], williamsV[i], rocV[i]].some(isNaN)) return NaN;
    const normCci = Math.min(100, Math.max(0, (cciV[i] + 300) / 6));
    const normRoc = Math.min(100, Math.max(0, rocV[i] * 5 + 50));
    return (rsiV[i] + stochV[i] + normCci + williamsV[i] + normRoc) / 5;
  });
};

// Nexus trend score: -100 (strong bear) to +100 (strong bull)
const calculateNexusScore = (closes: number[], fast: number, slow: number): number[] => {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  return closes.map((_, i) => {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i]) || emaSlow[i] === 0) return NaN;
    return Math.min(100, Math.max(-100, ((emaFast[i] - emaSlow[i]) / emaSlow[i]) * 1000));
  });
};

// Stellar Confluence core: average of EMA + WMA(0.7x) + SMA
const calculateStellarCore = (prices: number[], period: number): number[] => {
  const ema = calculateEMA(prices, period);
  const wma = calculateWMA(prices, Math.max(1, Math.floor(period * 0.7)));
  const sma = calculateSMA(prices, period);
  return prices.map((_, i) => {
    if (isNaN(ema[i]) || isNaN(wma[i]) || isNaN(sma[i])) return NaN;
    return (ema[i] + wma[i] + sma[i]) / 3;
  });
};

// Sovereign / VWAP gravity center: rolling volume-weighted typical price
const calculateGravityCenter = (candles: CandleData[], period: number): number[] =>
  candles.map((_, i) => {
    if (i < period - 1) return NaN;
    const slice = candles.slice(i - period + 1, i + 1);
    const totalVol = slice.reduce((sum, c) => sum + (c.volume || 1), 0);
    const sumVP = slice.reduce((sum, c) => sum + ((c.high + c.low + c.close) / 3) * (c.volume || 1), 0);
    return totalVol > 0 ? sumVP / totalVol : (slice[slice.length - 1].high + slice[slice.length - 1].low + slice[slice.length - 1].close) / 3;
  });

// Dynamic 61.8% Fibonacci level from rolling swing high/low
const calculateFib618 = (candles: CandleData[], lookback: number): number[] =>
  candles.map((_, i) => {
    const start = Math.max(0, i - lookback + 1);
    const slice = candles.slice(start, i + 1);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    return low + (high - low) * 0.618;
  });

// Get indicator value at a specific index
const getIndicatorValue = (
  indicator: string,
  params: Record<string, number> | undefined,
  candles: CandleData[],
  index: number,
  calculatedIndicators: Map<string, number[]>,
): number => {
  const closes = candles.map((c) => c.close);
  const cacheKey = `${indicator}_${JSON.stringify(params || {})}`;

  // Price values
  if (indicator === "price" || indicator === "close")
    return candles[index].close;
  if (indicator === "open") return candles[index].open;
  if (indicator === "high") return candles[index].high;
  if (indicator === "low") return candles[index].low;

  // Check cache first
  if (calculatedIndicators.has(cacheKey)) {
    return calculatedIndicators.get(cacheKey)![index];
  }

  // Calculate and cache
  let values: number[] = [];
  const period = params?.period || 20;

  switch (indicator) {
    case "sma":
      values = calculateSMA(closes, period);
      break;
    case "ema":
      values = calculateEMA(closes, period);
      break;
    case "bb_upper":
      const bbU = calculateBollingerBands(closes, period, params?.stdDev || 2);
      calculatedIndicators.set(
        `bb_middle_${JSON.stringify(params || {})}`,
        bbU.middle,
      );
      calculatedIndicators.set(
        `bb_lower_${JSON.stringify(params || {})}`,
        bbU.lower,
      );
      values = bbU.upper;
      break;
    case "bb_middle":
      const bbM = calculateBollingerBands(closes, period, params?.stdDev || 2);
      calculatedIndicators.set(
        `bb_upper_${JSON.stringify(params || {})}`,
        bbM.upper,
      );
      calculatedIndicators.set(
        `bb_lower_${JSON.stringify(params || {})}`,
        bbM.lower,
      );
      values = bbM.middle;
      break;
    case "bb_lower":
      const bbL = calculateBollingerBands(closes, period, params?.stdDev || 2);
      calculatedIndicators.set(
        `bb_upper_${JSON.stringify(params || {})}`,
        bbL.upper,
      );
      calculatedIndicators.set(
        `bb_middle_${JSON.stringify(params || {})}`,
        bbL.middle,
      );
      values = bbL.lower;
      break;
    case "rsi":
      values = calculateRSI(closes, params?.period || 14);
      break;
    case "macd_line":
      const macdL = calculateMACD(
        closes,
        params?.fast || 12,
        params?.slow || 26,
        params?.signal || 9,
      );
      calculatedIndicators.set(
        `macd_signal_${JSON.stringify(params || {})}`,
        macdL.signalLine,
      );
      calculatedIndicators.set(
        `macd_histogram_${JSON.stringify(params || {})}`,
        macdL.histogram,
      );
      values = macdL.macdLine;
      break;
    case "macd_signal":
      const macdS = calculateMACD(
        closes,
        params?.fast || 12,
        params?.slow || 26,
        params?.signal || 9,
      );
      calculatedIndicators.set(
        `macd_line_${JSON.stringify(params || {})}`,
        macdS.macdLine,
      );
      calculatedIndicators.set(
        `macd_histogram_${JSON.stringify(params || {})}`,
        macdS.histogram,
      );
      values = macdS.signalLine;
      break;
    case "macd_histogram":
      const macdH = calculateMACD(
        closes,
        params?.fast || 12,
        params?.slow || 26,
        params?.signal || 9,
      );
      calculatedIndicators.set(
        `macd_line_${JSON.stringify(params || {})}`,
        macdH.macdLine,
      );
      calculatedIndicators.set(
        `macd_signal_${JSON.stringify(params || {})}`,
        macdH.signalLine,
      );
      values = macdH.histogram;
      break;
    // ── Extended standard indicators ──────────────────────────────────────
    case "wma":
      values = calculateWMA(closes, period);
      break;
    case "hma":
      values = calculateHullMA(closes, period);
      break;
    case "kama":
      values = calculateKAMA(closes, period, params?.fast || 2, params?.slow || 30);
      break;
    case "stoch":
      values = calculateStochastic(candles, period);
      break;
    case "cci":
      values = calculateCCI(candles, params?.period || 20);
      break;
    case "williams_r":
      values = calculateWilliamsR(candles, period);
      break;
    case "roc":
      values = calculateROC(closes, period);
      break;
    case "atr":
      values = calculateATR(candles, period);
      break;
    case "supertrend_line":
      values = calculateSupertrend(candles, period, params?.multiplier || 3);
      break;
    case "vwap":
      values = calculateGravityCenter(candles, period);
      break;

    // ── Premium indicator outputs ──────────────────────────────────────────
    // Kinetic Pressure Zones & Nova Resonance Field — composite 0-100 score
    case "kinetic_score":
    case "nova_score":
      values = calculateKineticScore(candles, period);
      break;
    // Nexus Trend Matrix — score −100 (bear) to +100 (bull)
    case "nexus_score":
      values = calculateNexusScore(closes, params?.fast || 9, params?.slow || 21);
      break;
    // Solaris Trend Engine — KAMA adaptive trend line (price-level)
    case "solaris_line":
      values = calculateKAMA(closes, period, 2, 30);
      break;
    // Stellar Confluence Ribbon — triple-MA core line (price-level)
    case "stellar_core":
      values = calculateStellarCore(closes, period);
      break;
    // Sovereign Gravity Arc — volume-weighted gravity center (price-level)
    case "sovereign_center":
      values = calculateGravityCenter(candles, period);
      break;
    // Spectre Liquidity Matrix — bias: +100 if price > EMA, −100 if below
    case "spectre_bias": {
      const biasEma = calculateEMA(closes, period);
      values = closes.map((c, i) => (isNaN(biasEma[i]) ? NaN : c > biasEma[i] ? 100 : -100));
      break;
    }
    // Radiant Fibonacci Matrix — dynamic 61.8% Fib level (price-level)
    case "fib_618":
      values = calculateFib618(candles, params?.lookback || 55);
      break;
    // Orion Momentum Shield — RSI-based momentum score
    case "orion_score":
      values = calculateRSI(closes, period);
      break;
    // Quantum Drift Mapper / Chaos Sentinel / Helix — return EMA-based drift line
    case "quantum_drift":
    case "chaos_line":
    case "helix_line":
    case "mirage_line":
    case "eclipse_line":
    case "flux_line":
    case "wraith_line":
    case "aurora_line":
    case "apex_line":
      values = calculateKAMA(closes, period, 2, 30);
      break;
    // Phantom Divergence Tracker — RSI divergence proxy (RSI value)
    case "phantom_rsi":
      values = calculateRSI(closes, period);
      break;
    // Prism Wavelet / Cipher Harmonic — Hull MA proxy
    case "prism_line":
    case "cipher_line":
    case "nebula_mid":
      values = calculateHullMA(closes, period);
      break;
    // Fractal Pulse / Vortex Drift — WMA proxy
    case "fractal_line":
    case "vortex_line":
      values = calculateWMA(closes, period);
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
  calculatedIndicators: Map<string, number[]>,
): boolean => {
  const value = getIndicatorValue(
    condition.indicator,
    condition.indicatorParams,
    candles,
    index,
    calculatedIndicators,
  );

  if (isNaN(value)) return false;

  let compareValue: number;

  if (condition.compareWith === "value") {
    compareValue = condition.compareValue || 0;
  } else {
    compareValue = getIndicatorValue(
      condition.compareIndicator || "sma",
      condition.compareIndicatorParams,
      candles,
      index,
      calculatedIndicators,
    );
  }

  if (isNaN(compareValue)) return false;

  switch (condition.operator) {
    case "above":
      return value > compareValue;
    case "below":
      return value < compareValue;
    case "equals":
      return Math.abs(value - compareValue) < 0.0001;
    case "crosses_above":
      if (index === 0) return false;
      const prevValue = getIndicatorValue(
        condition.indicator,
        condition.indicatorParams,
        candles,
        index - 1,
        calculatedIndicators,
      );
      const prevCompare =
        condition.compareWith === "value"
          ? condition.compareValue || 0
          : getIndicatorValue(
              condition.compareIndicator || "sma",
              condition.compareIndicatorParams,
              candles,
              index - 1,
              calculatedIndicators,
            );
      return prevValue <= prevCompare && value > compareValue;
    case "crosses_below":
      if (index === 0) return false;
      const prevVal = getIndicatorValue(
        condition.indicator,
        condition.indicatorParams,
        candles,
        index - 1,
        calculatedIndicators,
      );
      const prevComp =
        condition.compareWith === "value"
          ? condition.compareValue || 0
          : getIndicatorValue(
              condition.compareIndicator || "sma",
              condition.compareIndicatorParams,
              candles,
              index - 1,
              calculatedIndicators,
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
  calculatedIndicators: Map<string, number[]>,
): boolean => {
  if (rule.conditions.length === 0) return false;

  if (rule.logic === "AND") {
    return rule.conditions.every((condition) =>
      evaluateCondition(condition, candles, index, calculatedIndicators),
    );
  } else {
    return rule.conditions.some((condition) =>
      evaluateCondition(condition, candles, index, calculatedIndicators),
    );
  }
};

/**
 * Generate signals for a strategy configuration
 */
export function generateStrategySignals(
  config: IStrategyConfig,
  candles: CandleData[],
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
    case "strong_buy":
      return "#00ff00";
    case "buy":
      return "#4ade80";
    case "neutral":
      return "#6b7280";
    case "sell":
      return "#f87171";
    case "strong_sell":
      return "#ff0000";
    default:
      return "#6b7280";
  }
}

/**
 * Get signal label
 */
export function getSignalLabel(type: SignalType): string {
  switch (type) {
    case "strong_buy":
      return "STRONG BUY";
    case "buy":
      return "BUY";
    case "neutral":
      return "NEUTRAL";
    case "sell":
      return "SELL";
    case "strong_sell":
      return "STRONG SELL";
    default:
      return "";
  }
}
