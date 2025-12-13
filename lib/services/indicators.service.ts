/**
 * Technical Indicators Service
 * Calculates common trading indicators (RSI, MACD, SMA, EMA, Bollinger Bands)
 */

export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorData {
  time: number;
  value: number;
}

export interface MACDData {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsData {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: OHLCData[], period: number): IndicatorData[] {
  const result: IndicatorData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period
    });
  }
  
  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: OHLCData[], period: number): IndicatorData[] {
  const result: IndicatorData[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });
  
  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: data[i].time,
      value: ema
    });
  }
  
  return result;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  const changes: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  
  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // Calculate RSI for each point
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push({
      time: data[i + 1].time,
      value: rsi
    });
  }
  
  return result;
}

/**
 * Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  data: OHLCData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  const result: MACDData[] = [];
  
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // Calculate MACD line
  const macdLine: IndicatorData[] = [];
  const startIndex = slowPeriod - fastPeriod;
  
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push({
      time: slowEMA[i].time,
      value: fastEMA[i + startIndex].value - slowEMA[i].value
    });
  }
  
  // Calculate signal line (EMA of MACD)
  const signalMultiplier = 2 / (signalPeriod + 1);
  let signalEMA = 0;
  
  // Initial SMA for signal
  for (let i = 0; i < signalPeriod && i < macdLine.length; i++) {
    signalEMA += macdLine[i].value;
  }
  signalEMA /= Math.min(signalPeriod, macdLine.length);
  
  // Calculate MACD with signal and histogram
  for (let i = signalPeriod - 1; i < macdLine.length; i++) {
    if (i > signalPeriod - 1) {
      signalEMA = (macdLine[i].value - signalEMA) * signalMultiplier + signalEMA;
    }
    
    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: signalEMA,
      histogram: macdLine[i].value - signalEMA
    });
  }
  
  return result;
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: OHLCData[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsData[] {
  const result: BollingerBandsData[] = [];
  const sma = calculateSMA(data, period);
  
  for (let i = 0; i < sma.length; i++) {
    const dataIndex = i + period - 1;
    
    // Calculate standard deviation
    let sumSquares = 0;
    for (let j = 0; j < period; j++) {
      const diff = data[dataIndex - j].close - sma[i].value;
      sumSquares += diff * diff;
    }
    const standardDeviation = Math.sqrt(sumSquares / period);
    
    result.push({
      time: sma[i].time,
      middle: sma[i].value,
      upper: sma[i].value + (stdDev * standardDeviation),
      lower: sma[i].value - (stdDev * standardDeviation)
    });
  }
  
  return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(data: OHLCData[]): IndicatorData[] {
  const result: IndicatorData[] = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;
  
  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const volume = data[i].volume || 1;
    
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
    
    result.push({
      time: data[i].time,
      value: cumulativeTPV / cumulativeVolume
    });
  }
  
  return result;
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  const trueRanges: number[] = [];
  
  // Calculate True Range for each period
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  // Calculate initial ATR (SMA of TR)
  let atr = 0;
  for (let i = 0; i < period && i < trueRanges.length; i++) {
    atr += trueRanges[i];
  }
  atr /= Math.min(period, trueRanges.length);
  
  result.push({ time: data[period].time, value: atr });
  
  // Calculate smoothed ATR
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    result.push({
      time: data[i + 1].time,
      value: atr
    });
  }
  
  return result;
}

/**
 * Stochastic Oscillator
 */
export function calculateStochastic(
  data: OHLCData[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: IndicatorData[]; d: IndicatorData[] } {
  const kValues: IndicatorData[] = [];
  
  // Calculate %K
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highestHigh = data[i].high;
    let lowestLow = data[i].low;
    
    for (let j = 0; j < kPeriod; j++) {
      highestHigh = Math.max(highestHigh, data[i - j].high);
      lowestLow = Math.min(lowestLow, data[i - j].low);
    }
    
    const currentClose = data[i].close;
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    kValues.push({
      time: data[i].time,
      value: k
    });
  }
  
  // Calculate %D (SMA of %K)
  const dValues: IndicatorData[] = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += kValues[i - j].value;
    }
    dValues.push({
      time: kValues[i].time,
      value: sum / dPeriod
    });
  }
  
  return { k: kValues, d: dValues };
}

/**
 * Williams %R
 */
export function calculateWilliamsR(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let highestHigh = data[i].high;
    let lowestLow = data[i].low;
    
    for (let j = 0; j < period; j++) {
      highestHigh = Math.max(highestHigh, data[i - j].high);
      lowestLow = Math.min(lowestLow, data[i - j].low);
    }
    
    const currentClose = data[i].close;
    const wr = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    
    result.push({
      time: data[i].time,
      value: wr
    });
  }
  
  return result;
}

/**
 * Commodity Channel Index (CCI)
 */
export function calculateCCI(data: OHLCData[], period: number = 20): IndicatorData[] {
  const result: IndicatorData[] = [];
  const constant = 0.015;
  
  for (let i = period - 1; i < data.length; i++) {
    // Calculate Typical Price
    let sum = 0;
    const typicalPrices: number[] = [];
    
    for (let j = 0; j < period; j++) {
      const tp = (data[i - j].high + data[i - j].low + data[i - j].close) / 3;
      typicalPrices.push(tp);
      sum += tp;
    }
    
    const smaTP = sum / period;
    
    // Calculate Mean Deviation
    let meanDevSum = 0;
    for (let j = 0; j < period; j++) {
      meanDevSum += Math.abs(typicalPrices[j] - smaTP);
    }
    const meanDev = meanDevSum / period;
    
    const currentTP = (data[i].high + data[i].low + data[i].close) / 3;
    const cci = (currentTP - smaTP) / (constant * meanDev);
    
    result.push({
      time: data[i].time,
      value: cci
    });
  }
  
  return result;
}

/**
 * Average Directional Index (ADX)
 */
export function calculateADX(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  
  // Calculate True Range and Directional Movement
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    const prevClose = data[i - 1].close;
    
    // True Range
    const trueRange = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    tr.push(trueRange);
    
    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  
  // Calculate smoothed averages
  if (tr.length < period) return result;
  
  let smoothedTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  
  const dx: number[] = [];
  
  for (let i = period; i < tr.length; i++) {
    smoothedTR = smoothedTR - (smoothedTR / period) + tr[i];
    smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];
    
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;
    
    const dxValue = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    dx.push(dxValue);
  }
  
  // Calculate ADX (smoothed DX)
  if (dx.length < period) return result;
  
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push({ time: data[period * 2].time, value: adx });
  
  for (let i = period; i < dx.length; i++) {
    adx = ((adx * (period - 1)) + dx[i]) / period;
    result.push({
      time: data[i + period + 1].time,
      value: adx
    });
  }
  
  return result;
}

/**
 * Parabolic SAR
 */
export function calculateParabolicSAR(
  data: OHLCData[],
  accelerationFactor: number = 0.02,
  maxAF: number = 0.2
): IndicatorData[] {
  const result: IndicatorData[] = [];
  if (data.length < 2) return result;
  
  let isUptrend = data[1].close > data[0].close;
  let sar = isUptrend ? data[0].low : data[0].high;
  let extremePoint = isUptrend ? data[0].high : data[0].low;
  let af = accelerationFactor;
  
  for (let i = 1; i < data.length; i++) {
    result.push({ time: data[i].time, value: sar });
    
    // Update SAR
    sar = sar + af * (extremePoint - sar);
    
    // Check for reversal
    const reversal = isUptrend
      ? data[i].low < sar
      : data[i].high > sar;
    
    if (reversal) {
      isUptrend = !isUptrend;
      sar = extremePoint;
      extremePoint = isUptrend ? data[i].high : data[i].low;
      af = accelerationFactor;
    } else {
      // Update extreme point and AF
      if (isUptrend && data[i].high > extremePoint) {
        extremePoint = data[i].high;
        af = Math.min(af + accelerationFactor, maxAF);
      } else if (!isUptrend && data[i].low < extremePoint) {
        extremePoint = data[i].low;
        af = Math.min(af + accelerationFactor, maxAF);
      }
    }
  }
  
  return result;
}

/**
 * Pivot Points (Standard)
 */
export interface PivotPoints {
  time: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export function calculatePivotPoints(data: OHLCData[]): PivotPoints[] {
  const result: PivotPoints[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    const prevClose = data[i - 1].close;
    
    const pivot = (prevHigh + prevLow + prevClose) / 3;
    const r1 = (2 * pivot) - prevLow;
    const s1 = (2 * pivot) - prevHigh;
    const r2 = pivot + (prevHigh - prevLow);
    const s2 = pivot - (prevHigh - prevLow);
    const r3 = prevHigh + 2 * (pivot - prevLow);
    const s3 = prevLow - 2 * (prevHigh - pivot);
    
    result.push({
      time: data[i].time,
      pivot,
      r1,
      r2,
      r3,
      s1,
      s2,
      s3
    });
  }
  
  return result;
}

/**
 * Money Flow Index (MFI)
 */
export function calculateMFI(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  
  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      const typicalPrice = (data[idx].high + data[idx].low + data[idx].close) / 3;
      const prevTypicalPrice = (data[idx - 1].high + data[idx - 1].low + data[idx - 1].close) / 3;
      const moneyFlow = typicalPrice * (data[idx].volume || 1);
      
      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += moneyFlow;
      } else if (typicalPrice < prevTypicalPrice) {
        negativeFlow += moneyFlow;
      }
    }
    
    const mfiRatio = positiveFlow / (negativeFlow || 1);
    const mfi = 100 - (100 / (1 + mfiRatio));
    
    result.push({
      time: data[i].time,
      value: mfi
    });
  }
  
  return result;
}

