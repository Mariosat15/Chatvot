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

export interface IchimokuData {
  time: number;
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
}

export interface DonchianData {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface AroonData {
  time: number;
  up: number;
  down: number;
}

export interface VortexData {
  time: number;
  plus: number;
  minus: number;
}

export interface ElderRayData {
  time: number;
  bull: number;
  bear: number;
}

export interface SupertrendData {
  time: number;
  value: number;
  direction: number; // 1 = up, -1 = down
}

export interface StochRSIData {
  time: number;
  k: number;
  d: number;
}

export interface ChannelData {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(
  data: OHLCData[],
  period: number,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(
  data: OHLCData[],
  period: number,
): IndicatorData[] {
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
      value: ema,
    });
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
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

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    result.push({
      time: data[i + 1].time,
      value: rsi,
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
  signalPeriod: number = 9,
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
      value: fastEMA[i + startIndex].value - slowEMA[i].value,
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
      signalEMA =
        (macdLine[i].value - signalEMA) * signalMultiplier + signalEMA;
    }

    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: signalEMA,
      histogram: macdLine[i].value - signalEMA,
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
  stdDev: number = 2,
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
      upper: sma[i].value + stdDev * standardDeviation,
      lower: sma[i].value - stdDev * standardDeviation,
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
      value: cumulativeTPV / cumulativeVolume,
    });
  }

  return result;
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
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
      Math.abs(low - prevClose),
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
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result.push({
      time: data[i + 1].time,
      value: atr,
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
  dPeriod: number = 3,
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
      value: k,
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
      value: sum / dPeriod,
    });
  }

  return { k: kValues, d: dValues };
}

/**
 * Williams %R
 */
export function calculateWilliamsR(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let highestHigh = data[i].high;
    let lowestLow = data[i].low;

    for (let j = 0; j < period; j++) {
      highestHigh = Math.max(highestHigh, data[i - j].high);
      lowestLow = Math.min(lowestLow, data[i - j].low);
    }

    const currentClose = data[i].close;
    const wr =
      ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;

    result.push({
      time: data[i].time,
      value: wr,
    });
  }

  return result;
}

/**
 * Commodity Channel Index (CCI)
 */
export function calculateCCI(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
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
      value: cci,
    });
  }

  return result;
}

/**
 * Average Directional Index (ADX)
 */
export function calculateADX(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
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
      Math.abs(low - prevClose),
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
    smoothedTR = smoothedTR - smoothedTR / period + tr[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDM[i];

    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    const dxValue = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    dx.push(dxValue);
  }

  // Calculate ADX (smoothed DX)
  if (dx.length < period) return result;

  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push({ time: data[period * 2].time, value: adx });

  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period;
    result.push({
      time: data[i + period + 1].time,
      value: adx,
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
  maxAF: number = 0.2,
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
    const reversal = isUptrend ? data[i].low < sar : data[i].high > sar;

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
    const r1 = 2 * pivot - prevLow;
    const s1 = 2 * pivot - prevHigh;
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
      s3,
    });
  }

  return result;
}

/**
 * Money Flow Index (MFI)
 */
export function calculateMFI(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = 0; j < period; j++) {
      const idx = i - j;
      const typicalPrice =
        (data[idx].high + data[idx].low + data[idx].close) / 3;
      const prevTypicalPrice =
        (data[idx - 1].high + data[idx - 1].low + data[idx - 1].close) / 3;
      const moneyFlow = typicalPrice * (data[idx].volume || 1);

      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += moneyFlow;
      } else if (typicalPrice < prevTypicalPrice) {
        negativeFlow += moneyFlow;
      }
    }

    const mfiRatio = positiveFlow / (negativeFlow || 1);
    const mfi = 100 - 100 / (1 + mfiRatio);

    result.push({
      time: data[i].time,
      value: mfi,
    });
  }

  return result;
}

// ============================================================================
// NEW INDICATORS
// ============================================================================

/**
 * Weighted Moving Average (WMA)
 * Gives more weight to recent prices linearly
 */
export function calculateWMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let j = 0; j < period; j++) {
      const weight = period - j;
      weightedSum += data[i - j].close * weight;
      weightTotal += weight;
    }
    result.push({ time: data[i].time, value: weightedSum / weightTotal });
  }

  return result;
}

/**
 * Keltner Channels (EMA center + ATR bands)
 */
export function calculateKeltnerChannels(
  data: OHLCData[],
  period: number = 20,
  multiplier: number = 2,
): BollingerBandsData[] {
  const ema = calculateEMA(data, period);
  const atr = calculateATR(data, period);
  const result: BollingerBandsData[] = [];

  // Align EMA and ATR by time
  const atrMap = new Map(atr.map((d) => [d.time, d.value]));

  for (const e of ema) {
    const atrVal = atrMap.get(e.time);
    if (atrVal !== undefined) {
      result.push({
        time: e.time,
        upper: e.value + multiplier * atrVal,
        middle: e.value,
        lower: e.value - multiplier * atrVal,
      });
    }
  }

  return result;
}

/**
 * Double Exponential Moving Average (DEMA)
 * DEMA = 2 * EMA(n) - EMA(EMA(n))
 */
export function calculateDEMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const ema1 = calculateEMA(data, period);
  // Convert ema1 to OHLCData format for second pass
  const ema1AsOhlc: OHLCData[] = ema1.map((d) => ({
    time: d.time,
    open: d.value,
    high: d.value,
    low: d.value,
    close: d.value,
  }));
  const ema2 = calculateEMA(ema1AsOhlc, period);

  const ema2Map = new Map(ema2.map((d) => [d.time, d.value]));
  const result: IndicatorData[] = [];

  for (const e1 of ema1) {
    const e2 = ema2Map.get(e1.time);
    if (e2 !== undefined) {
      result.push({ time: e1.time, value: 2 * e1.value - e2 });
    }
  }

  return result;
}

/**
 * Triple Exponential Moving Average (TEMA)
 * TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
 */
export function calculateTEMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const ema1 = calculateEMA(data, period);
  const ema1AsOhlc: OHLCData[] = ema1.map((d) => ({
    time: d.time,
    open: d.value,
    high: d.value,
    low: d.value,
    close: d.value,
  }));
  const ema2 = calculateEMA(ema1AsOhlc, period);
  const ema2AsOhlc: OHLCData[] = ema2.map((d) => ({
    time: d.time,
    open: d.value,
    high: d.value,
    low: d.value,
    close: d.value,
  }));
  const ema3 = calculateEMA(ema2AsOhlc, period);

  const ema2Map = new Map(ema2.map((d) => [d.time, d.value]));
  const ema3Map = new Map(ema3.map((d) => [d.time, d.value]));
  const result: IndicatorData[] = [];

  for (const e1 of ema1) {
    const e2 = ema2Map.get(e1.time);
    const e3 = ema3Map.get(e1.time);
    if (e2 !== undefined && e3 !== undefined) {
      result.push({
        time: e1.time,
        value: 3 * e1.value - 3 * e2 + e3,
      });
    }
  }

  return result;
}

/**
 * Hull Moving Average (HMA)
 * HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
 */
export function calculateHMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const halfPeriod = Math.max(2, Math.round(period / 2));
  const sqrtPeriod = Math.max(2, Math.round(Math.sqrt(period)));

  const wmaHalf = calculateWMA(data, halfPeriod);
  const wmaFull = calculateWMA(data, period);

  // Create the difference series: 2 * WMA(n/2) - WMA(n)
  const fullMap = new Map(wmaFull.map((d) => [d.time, d.value]));
  const diffOhlc: OHLCData[] = [];

  for (const h of wmaHalf) {
    const f = fullMap.get(h.time);
    if (f !== undefined) {
      const val = 2 * h.value - f;
      diffOhlc.push({
        time: h.time,
        open: val,
        high: val,
        low: val,
        close: val,
      });
    }
  }

  return calculateWMA(diffOhlc, sqrtPeriod);
}

/**
 * Ichimoku Cloud
 */
export function calculateIchimoku(
  data: OHLCData[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
): IchimokuData[] {
  const result: IchimokuData[] = [];

  function periodHighLow(end: number, period: number) {
    let high = -Infinity;
    let low = Infinity;
    for (let i = Math.max(0, end - period + 1); i <= end; i++) {
      if (data[i].high > high) high = data[i].high;
      if (data[i].low < low) low = data[i].low;
    }
    return { high, low };
  }

  for (let i = senkouBPeriod - 1; i < data.length; i++) {
    const tenkanHL = periodHighLow(i, tenkanPeriod);
    const kijunHL = periodHighLow(i, kijunPeriod);
    const senkouBHL = periodHighLow(i, senkouBPeriod);

    const tenkan = (tenkanHL.high + tenkanHL.low) / 2;
    const kijun = (kijunHL.high + kijunHL.low) / 2;
    const senkouA = (tenkan + kijun) / 2;
    const senkouB = (senkouBHL.high + senkouBHL.low) / 2;
    const chikou = data[i].close;

    result.push({
      time: data[i].time,
      tenkan,
      kijun,
      senkouA,
      senkouB,
      chikou,
    });
  }

  return result;
}

/**
 * Donchian Channel
 */
export function calculateDonchianChannel(
  data: OHLCData[],
  period: number = 20,
): DonchianData[] {
  const result: DonchianData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let high = -Infinity;
    let low = Infinity;
    for (let j = 0; j < period; j++) {
      if (data[i - j].high > high) high = data[i - j].high;
      if (data[i - j].low < low) low = data[i - j].low;
    }
    result.push({
      time: data[i].time,
      upper: high,
      middle: (high + low) / 2,
      lower: low,
    });
  }

  return result;
}

/**
 * On Balance Volume (OBV)
 */
export function calculateOBV(data: OHLCData[]): IndicatorData[] {
  const result: IndicatorData[] = [];
  let obv = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      obv = data[i].volume || 0;
    } else if (data[i].close > data[i - 1].close) {
      obv += data[i].volume || 0;
    } else if (data[i].close < data[i - 1].close) {
      obv -= data[i].volume || 0;
    }
    result.push({ time: data[i].time, value: obv });
  }

  return result;
}

/**
 * Rate of Change (ROC)
 */
export function calculateROC(
  data: OHLCData[],
  period: number = 12,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period; i < data.length; i++) {
    const roc =
      ((data[i].close - data[i - period].close) / data[i - period].close) *
      100;
    result.push({ time: data[i].time, value: roc });
  }

  return result;
}

/**
 * Chaikin Money Flow (CMF)
 */
export function calculateCMF(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let mfvSum = 0;
    let volSum = 0;

    for (let j = 0; j < period; j++) {
      const d = data[i - j];
      const range = d.high - d.low;
      const mfMultiplier =
        range === 0 ? 0 : (d.close - d.low - (d.high - d.close)) / range;
      mfvSum += mfMultiplier * (d.volume || 1);
      volSum += d.volume || 1;
    }

    result.push({
      time: data[i].time,
      value: volSum === 0 ? 0 : mfvSum / volSum,
    });
  }

  return result;
}

/**
 * Momentum Oscillator
 */
export function calculateMomentum(
  data: OHLCData[],
  period: number = 10,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period; i < data.length; i++) {
    result.push({
      time: data[i].time,
      value: data[i].close - data[i - period].close,
    });
  }

  return result;
}

// ============================================================================
// BATCH 2: 40 NEW ADVANCED INDICATORS
// ============================================================================

// --- GROUP 1: ADVANCED MOVING AVERAGES (8) ---

/**
 * ALMA - Arnaud Legoux Moving Average
 * Uses Gaussian distribution for weighting
 */
export function calculateALMA(
  data: OHLCData[],
  period: number = 20,
  offset: number = 0.85,
  sigma: number = 6,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  const m = offset * (period - 1);
  const s = period / sigma;

  for (let i = period - 1; i < data.length; i++) {
    let norm = 0;
    let sum = 0;
    for (let j = 0; j < period; j++) {
      const w = Math.exp(-((j - m) * (j - m)) / (2 * s * s));
      norm += w;
      sum += data[i - (period - 1 - j)].close * w;
    }
    result.push({ time: data[i].time, value: sum / norm });
  }
  return result;
}

/**
 * KAMA - Kaufman Adaptive Moving Average
 * Adjusts smoothing based on market noise
 */
export function calculateKAMA(
  data: OHLCData[],
  period: number = 10,
  fastPeriod: number = 2,
  slowPeriod: number = 30,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  const fastSC = 2 / (fastPeriod + 1);
  const slowSC = 2 / (slowPeriod + 1);

  if (data.length < period + 1) return result;

  let kama = data[period].close;
  result.push({ time: data[period].time, value: kama });

  for (let i = period + 1; i < data.length; i++) {
    const direction = Math.abs(data[i].close - data[i - period].close);
    let volatility = 0;
    for (let j = 0; j < period; j++) {
      volatility += Math.abs(data[i - j].close - data[i - j - 1].close);
    }
    const er = volatility === 0 ? 0 : direction / volatility;
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    kama = kama + sc * (data[i].close - kama);
    result.push({ time: data[i].time, value: kama });
  }
  return result;
}

/**
 * ZLEMA - Zero-Lag Exponential Moving Average
 * Removes inherent EMA lag
 */
export function calculateZLEMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const lag = Math.floor((period - 1) / 2);
  const adjusted: OHLCData[] = [];
  for (let i = lag; i < data.length; i++) {
    const val = 2 * data[i].close - data[i - lag].close;
    adjusted.push({ time: data[i].time, open: val, high: val, low: val, close: val });
  }
  return calculateEMA(adjusted, period);
}

/**
 * T3 - Tillson T3 Moving Average
 * Ultra-smooth moving average with minimal lag
 */
export function calculateT3(
  data: OHLCData[],
  period: number = 5,
  vFactor: number = 0.7,
): IndicatorData[] {
  const toOhlc = (arr: IndicatorData[]): OHLCData[] =>
    arr.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value }));

  const e1 = calculateEMA(data, period);
  const e2 = calculateEMA(toOhlc(e1), period);
  const e3 = calculateEMA(toOhlc(e2), period);
  const e4 = calculateEMA(toOhlc(e3), period);
  const e5 = calculateEMA(toOhlc(e4), period);
  const e6 = calculateEMA(toOhlc(e5), period);

  const c1 = -(vFactor * vFactor * vFactor);
  const c2 = 3 * vFactor * vFactor + 3 * vFactor * vFactor * vFactor;
  const c3 = -6 * vFactor * vFactor - 3 * vFactor - 3 * vFactor * vFactor * vFactor;
  const c4 = 1 + 3 * vFactor + vFactor * vFactor * vFactor + 3 * vFactor * vFactor;

  const maps = [e3, e4, e5, e6].map((arr) => new Map(arr.map((d) => [d.time, d.value])));
  const result: IndicatorData[] = [];

  for (const d of e3) {
    const v4 = maps[1].get(d.time);
    const v5 = maps[2].get(d.time);
    const v6 = maps[3].get(d.time);
    if (v4 !== undefined && v5 !== undefined && v6 !== undefined) {
      result.push({ time: d.time, value: c1 * v6 + c2 * v5 + c3 * v4 + c4 * d.value });
    }
  }
  return result;
}

/**
 * SMMA - Smoothed Moving Average
 */
export function calculateSMMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let smma = sum / period;
  result.push({ time: data[period - 1].time, value: smma });

  for (let i = period; i < data.length; i++) {
    smma = (smma * (period - 1) + data[i].close) / period;
    result.push({ time: data[i].time, value: smma });
  }
  return result;
}

/**
 * LSMA - Least Squares Moving Average (Linear Regression)
 */
export function calculateLSMA(
  data: OHLCData[],
  period: number = 25,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < period; j++) {
      sumX += j;
      sumY += data[i - period + 1 + j].close;
      sumXY += j * data[i - period + 1 + j].close;
      sumX2 += j * j;
    }
    const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / period;
    result.push({ time: data[i].time, value: intercept + slope * (period - 1) });
  }
  return result;
}

/**
 * VIDYA - Variable Index Dynamic Average
 * Adapts smoothing based on CMO (Chande Momentum Oscillator)
 */
export function calculateVIDYA(
  data: OHLCData[],
  period: number = 20,
  cmoPeriod: number = 9,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  const sc = 2 / (period + 1);

  if (data.length < cmoPeriod + 1) return result;

  let vidya = data[cmoPeriod].close;
  result.push({ time: data[cmoPeriod].time, value: vidya });

  for (let i = cmoPeriod + 1; i < data.length; i++) {
    let up = 0, down = 0;
    for (let j = 0; j < cmoPeriod; j++) {
      const diff = data[i - j].close - data[i - j - 1].close;
      if (diff > 0) up += diff;
      else down -= diff;
    }
    const cmo = (up + down) === 0 ? 0 : Math.abs((up - down) / (up + down));
    vidya = vidya + sc * cmo * (data[i].close - vidya);
    result.push({ time: data[i].time, value: vidya });
  }
  return result;
}

/**
 * McGinley Dynamic
 * Self-adjusting moving average
 */
export function calculateMcGinley(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  if (data.length === 0) return result;

  let md = data[0].close;
  result.push({ time: data[0].time, value: md });

  for (let i = 1; i < data.length; i++) {
    const ratio = data[i].close / md;
    md = md + (data[i].close - md) / (period * Math.pow(ratio, 4));
    result.push({ time: data[i].time, value: md });
  }
  return result;
}

// --- GROUP 2: TREND INDICATORS (8) ---

/**
 * Supertrend
 */
export function calculateSupertrend(
  data: OHLCData[],
  period: number = 10,
  multiplier: number = 3,
): SupertrendData[] {
  const atr = calculateATR(data, period);
  const atrMap = new Map(atr.map((d) => [d.time, d.value]));
  const result: SupertrendData[] = [];

  let upperBand = 0, lowerBand = 0, supertrend = 0, direction = 1;

  for (let i = period; i < data.length; i++) {
    const atrVal = atrMap.get(data[i].time) || 0;
    const hl2 = (data[i].high + data[i].low) / 2;
    const newUpper = hl2 + multiplier * atrVal;
    const newLower = hl2 - multiplier * atrVal;

    upperBand = newUpper < upperBand || data[i - 1].close > upperBand ? newUpper : upperBand;
    lowerBand = newLower > lowerBand || data[i - 1].close < lowerBand ? newLower : lowerBand;

    if (supertrend === upperBand) {
      direction = data[i].close > upperBand ? 1 : -1;
    } else {
      direction = data[i].close < lowerBand ? -1 : 1;
    }
    supertrend = direction === 1 ? lowerBand : upperBand;

    result.push({ time: data[i].time, value: supertrend, direction });
  }
  return result;
}

/**
 * Aroon Oscillator
 */
export function calculateAroon(
  data: OHLCData[],
  period: number = 25,
): AroonData[] {
  const result: AroonData[] = [];

  for (let i = period; i < data.length; i++) {
    let highIdx = 0, lowIdx = 0;
    let maxH = -Infinity, minL = Infinity;
    for (let j = 0; j <= period; j++) {
      if (data[i - j].high > maxH) { maxH = data[i - j].high; highIdx = j; }
      if (data[i - j].low < minL) { minL = data[i - j].low; lowIdx = j; }
    }
    result.push({
      time: data[i].time,
      up: ((period - highIdx) / period) * 100,
      down: ((period - lowIdx) / period) * 100,
    });
  }
  return result;
}

/**
 * Vortex Indicator
 */
export function calculateVortex(
  data: OHLCData[],
  period: number = 14,
): VortexData[] {
  const result: VortexData[] = [];

  for (let i = period; i < data.length; i++) {
    let vmPlus = 0, vmMinus = 0, tr = 0;
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      vmPlus += Math.abs(data[idx].high - data[idx - 1].low);
      vmMinus += Math.abs(data[idx].low - data[idx - 1].high);
      tr += Math.max(
        data[idx].high - data[idx].low,
        Math.abs(data[idx].high - data[idx - 1].close),
        Math.abs(data[idx].low - data[idx - 1].close),
      );
    }
    result.push({
      time: data[i].time,
      plus: tr === 0 ? 0 : vmPlus / tr,
      minus: tr === 0 ? 0 : vmMinus / tr,
    });
  }
  return result;
}

/**
 * TRIX - Triple Exponential Average
 */
export function calculateTRIX(
  data: OHLCData[],
  period: number = 15,
): IndicatorData[] {
  const toOhlc = (arr: IndicatorData[]): OHLCData[] =>
    arr.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value }));

  const e1 = calculateEMA(data, period);
  const e2 = calculateEMA(toOhlc(e1), period);
  const e3 = calculateEMA(toOhlc(e2), period);

  const result: IndicatorData[] = [];
  for (let i = 1; i < e3.length; i++) {
    result.push({
      time: e3[i].time,
      value: e3[i - 1].value === 0 ? 0 : ((e3[i].value - e3[i - 1].value) / e3[i - 1].value) * 100,
    });
  }
  return result;
}

/**
 * DPO - Detrended Price Oscillator
 */
export function calculateDPO(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const sma = calculateSMA(data, period);
  const smaMap = new Map(sma.map((d) => [d.time, d.value]));
  const shift = Math.floor(period / 2) + 1;
  const result: IndicatorData[] = [];

  for (let i = shift; i < data.length; i++) {
    const smaVal = smaMap.get(data[i - shift]?.time);
    if (smaVal !== undefined) {
      result.push({ time: data[i].time, value: data[i].close - smaVal });
    }
  }
  return result;
}

/**
 * KST - Know Sure Thing
 */
export function calculateKST(
  data: OHLCData[],
): IndicatorData[] {
  const roc1 = calculateROC(data, 10);
  const roc2 = calculateROC(data, 15);
  const roc3 = calculateROC(data, 20);
  const roc4 = calculateROC(data, 30);

  const toOhlc = (arr: IndicatorData[]): OHLCData[] =>
    arr.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value }));

  const sma1 = calculateSMA(toOhlc(roc1), 10);
  const sma2 = calculateSMA(toOhlc(roc2), 10);
  const sma3 = calculateSMA(toOhlc(roc3), 10);
  const sma4 = calculateSMA(toOhlc(roc4), 15);

  const maps = [sma1, sma2, sma3, sma4].map((a) => new Map(a.map((d) => [d.time, d.value])));
  const result: IndicatorData[] = [];

  for (const d of sma4) {
    const v1 = maps[0].get(d.time);
    const v2 = maps[1].get(d.time);
    const v3 = maps[2].get(d.time);
    if (v1 !== undefined && v2 !== undefined && v3 !== undefined) {
      result.push({ time: d.time, value: v1 * 1 + v2 * 2 + v3 * 3 + d.value * 4 });
    }
  }
  return result;
}

/**
 * Coppock Curve
 */
export function calculateCoppock(
  data: OHLCData[],
  wmaPeriod: number = 10,
  longROC: number = 14,
  shortROC: number = 11,
): IndicatorData[] {
  const roc1 = calculateROC(data, longROC);
  const roc2 = calculateROC(data, shortROC);
  const roc2Map = new Map(roc2.map((d) => [d.time, d.value]));

  const combined: OHLCData[] = [];
  for (const d of roc1) {
    const v2 = roc2Map.get(d.time);
    if (v2 !== undefined) {
      const val = d.value + v2;
      combined.push({ time: d.time, open: val, high: val, low: val, close: val });
    }
  }
  return calculateWMA(combined, wmaPeriod);
}

/**
 * Elder Ray - Bull/Bear Power
 */
export function calculateElderRay(
  data: OHLCData[],
  period: number = 13,
): ElderRayData[] {
  const ema = calculateEMA(data, period);
  const emaMap = new Map(ema.map((d) => [d.time, d.value]));
  const result: ElderRayData[] = [];

  for (const d of data) {
    const emaVal = emaMap.get(d.time);
    if (emaVal !== undefined) {
      result.push({ time: d.time, bull: d.high - emaVal, bear: d.low - emaVal });
    }
  }
  return result;
}

// --- GROUP 3: VOLATILITY INDICATORS (6) ---

/**
 * Standard Deviation
 */
export function calculateStdDev(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;
    let sumSq = 0;
    for (let j = 0; j < period; j++) sumSq += Math.pow(data[i - j].close - mean, 2);
    result.push({ time: data[i].time, value: Math.sqrt(sumSq / period) });
  }
  return result;
}

/**
 * Historical Volatility
 */
export function calculateHistVolatility(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period; i < data.length; i++) {
    let sumLogR = 0;
    const logReturns: number[] = [];
    for (let j = 0; j < period; j++) {
      const lr = Math.log(data[i - j].close / data[i - j - 1].close);
      logReturns.push(lr);
      sumLogR += lr;
    }
    const mean = sumLogR / period;
    let sumSq = 0;
    for (const lr of logReturns) sumSq += Math.pow(lr - mean, 2);
    result.push({ time: data[i].time, value: Math.sqrt(sumSq / (period - 1)) * Math.sqrt(252) * 100 });
  }
  return result;
}

/**
 * Chaikin Volatility
 */
export function calculateChaikinVolatility(
  data: OHLCData[],
  emaPeriod: number = 10,
  rocPeriod: number = 10,
): IndicatorData[] {
  // EMA of (High - Low)
  const hlData: OHLCData[] = data.map((d) => {
    const val = d.high - d.low;
    return { time: d.time, open: val, high: val, low: val, close: val };
  });
  const emaHL = calculateEMA(hlData, emaPeriod);
  const result: IndicatorData[] = [];

  for (let i = rocPeriod; i < emaHL.length; i++) {
    const prev = emaHL[i - rocPeriod].value;
    result.push({
      time: emaHL[i].time,
      value: prev === 0 ? 0 : ((emaHL[i].value - prev) / prev) * 100,
    });
  }
  return result;
}

/**
 * Mass Index
 */
export function calculateMassIndex(
  data: OHLCData[],
  emaPeriod: number = 9,
  sumPeriod: number = 25,
): IndicatorData[] {
  const hlData: OHLCData[] = data.map((d) => {
    const val = d.high - d.low;
    return { time: d.time, open: val, high: val, low: val, close: val };
  });
  const ema1 = calculateEMA(hlData, emaPeriod);
  const ema2 = calculateEMA(
    ema1.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value })),
    emaPeriod,
  );
  const ema2Map = new Map(ema2.map((d) => [d.time, d.value]));

  const ratios: IndicatorData[] = [];
  for (const d of ema1) {
    const v2 = ema2Map.get(d.time);
    if (v2 !== undefined && v2 !== 0) {
      ratios.push({ time: d.time, value: d.value / v2 });
    }
  }

  const result: IndicatorData[] = [];
  for (let i = sumPeriod - 1; i < ratios.length; i++) {
    let sum = 0;
    for (let j = 0; j < sumPeriod; j++) sum += ratios[i - j].value;
    result.push({ time: ratios[i].time, value: sum });
  }
  return result;
}

/**
 * Ulcer Index
 */
export function calculateUlcerIndex(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let maxClose = -Infinity;
    for (let j = 0; j <= i; j++) {
      if (data[j].close > maxClose) maxClose = data[j].close;
    }
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const pctDrawdown = ((data[i - j].close - maxClose) / maxClose) * 100;
      sumSq += pctDrawdown * pctDrawdown;
    }
    result.push({ time: data[i].time, value: Math.sqrt(sumSq / period) });
  }
  return result;
}

/**
 * RVI - Relative Volatility Index
 */
export function calculateRVI(
  data: OHLCData[],
  period: number = 10,
  smoothing: number = 14,
): IndicatorData[] {
  const stdDevs: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;
    let sumSq = 0;
    for (let j = 0; j < period; j++) sumSq += Math.pow(data[i - j].close - mean, 2);
    stdDevs.push(Math.sqrt(sumSq / period));
  }

  const result: IndicatorData[] = [];
  let avgUp = 0, avgDown = 0;

  for (let i = 1; i < stdDevs.length; i++) {
    const dataIdx = i + period - 1;
    const change = data[dataIdx].close - data[dataIdx - 1].close;
    const sd = stdDevs[i];

    if (i <= smoothing) {
      if (change > 0) avgUp += sd;
      else avgDown += sd;
      if (i === smoothing) {
        avgUp /= smoothing;
        avgDown /= smoothing;
        const rvi = (avgUp + avgDown) === 0 ? 50 : (avgUp / (avgUp + avgDown)) * 100;
        result.push({ time: data[dataIdx].time, value: rvi });
      }
    } else {
      avgUp = (avgUp * (smoothing - 1) + (change > 0 ? sd : 0)) / smoothing;
      avgDown = (avgDown * (smoothing - 1) + (change <= 0 ? sd : 0)) / smoothing;
      const rvi = (avgUp + avgDown) === 0 ? 50 : (avgUp / (avgUp + avgDown)) * 100;
      result.push({ time: data[dataIdx].time, value: rvi });
    }
  }
  return result;
}

// --- GROUP 4: VOLUME INDICATORS (6) ---

/**
 * VWMA - Volume Weighted Moving Average
 */
export function calculateVWMA(
  data: OHLCData[],
  period: number = 20,
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sumPV = 0, sumV = 0;
    for (let j = 0; j < period; j++) {
      const v = data[i - j].volume || 1;
      sumPV += data[i - j].close * v;
      sumV += v;
    }
    result.push({ time: data[i].time, value: sumV === 0 ? data[i].close : sumPV / sumV });
  }
  return result;
}

/**
 * Accumulation/Distribution Line
 */
export function calculateADLine(data: OHLCData[]): IndicatorData[] {
  const result: IndicatorData[] = [];
  let ad = 0;

  for (const d of data) {
    const range = d.high - d.low;
    const clv = range === 0 ? 0 : ((d.close - d.low) - (d.high - d.close)) / range;
    ad += clv * (d.volume || 1);
    result.push({ time: d.time, value: ad });
  }
  return result;
}

/**
 * Force Index
 */
export function calculateForceIndex(
  data: OHLCData[],
  period: number = 13,
): IndicatorData[] {
  const raw: OHLCData[] = [];
  for (let i = 1; i < data.length; i++) {
    const val = (data[i].close - data[i - 1].close) * (data[i].volume || 1);
    raw.push({ time: data[i].time, open: val, high: val, low: val, close: val });
  }
  return calculateEMA(raw, period);
}

/**
 * Ease of Movement
 */
export function calculateEOM(
  data: OHLCData[],
  period: number = 14,
): IndicatorData[] {
  const raw: OHLCData[] = [];
  for (let i = 1; i < data.length; i++) {
    const dm = ((data[i].high + data[i].low) / 2) - ((data[i - 1].high + data[i - 1].low) / 2);
    const vol = data[i].volume || 1;
    const range = data[i].high - data[i].low;
    const br = range === 0 ? 0 : vol / range;
    const eom = br === 0 ? 0 : dm / br;
    raw.push({ time: data[i].time, open: eom, high: eom, low: eom, close: eom });
  }
  return calculateSMA(raw, period);
}

/**
 * NVI - Negative Volume Index
 */
export function calculateNVI(data: OHLCData[]): IndicatorData[] {
  const result: IndicatorData[] = [];
  let nvi = 1000;
  result.push({ time: data[0].time, value: nvi });

  for (let i = 1; i < data.length; i++) {
    if ((data[i].volume || 0) < (data[i - 1].volume || 0)) {
      nvi = nvi * (1 + (data[i].close - data[i - 1].close) / data[i - 1].close);
    }
    result.push({ time: data[i].time, value: nvi });
  }
  return result;
}

/**
 * PVI - Positive Volume Index
 */
export function calculatePVI(data: OHLCData[]): IndicatorData[] {
  const result: IndicatorData[] = [];
  let pvi = 1000;
  result.push({ time: data[0].time, value: pvi });

  for (let i = 1; i < data.length; i++) {
    if ((data[i].volume || 0) > (data[i - 1].volume || 0)) {
      pvi = pvi * (1 + (data[i].close - data[i - 1].close) / data[i - 1].close);
    }
    result.push({ time: data[i].time, value: pvi });
  }
  return result;
}

// --- GROUP 5: ADVANCED OSCILLATORS (8) ---

/**
 * Ultimate Oscillator
 */
export function calculateUltimateOscillator(
  data: OHLCData[],
  period1: number = 7,
  period2: number = 14,
  period3: number = 28,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  const bps: number[] = [];
  const trs: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const bp = data[i].close - Math.min(data[i].low, data[i - 1].close);
    const tr = Math.max(data[i].high, data[i - 1].close) - Math.min(data[i].low, data[i - 1].close);
    bps.push(bp);
    trs.push(tr);
  }

  for (let i = period3 - 1; i < bps.length; i++) {
    let bpSum1 = 0, trSum1 = 0, bpSum2 = 0, trSum2 = 0, bpSum3 = 0, trSum3 = 0;
    for (let j = 0; j < period1; j++) { bpSum1 += bps[i - j]; trSum1 += trs[i - j]; }
    for (let j = 0; j < period2; j++) { bpSum2 += bps[i - j]; trSum2 += trs[i - j]; }
    for (let j = 0; j < period3; j++) { bpSum3 += bps[i - j]; trSum3 += trs[i - j]; }

    const avg1 = trSum1 === 0 ? 0 : bpSum1 / trSum1;
    const avg2 = trSum2 === 0 ? 0 : bpSum2 / trSum2;
    const avg3 = trSum3 === 0 ? 0 : bpSum3 / trSum3;

    result.push({
      time: data[i + 1].time,
      value: ((4 * avg1 + 2 * avg2 + avg3) / 7) * 100,
    });
  }
  return result;
}

/**
 * Awesome Oscillator
 */
export function calculateAwesomeOscillator(data: OHLCData[]): IndicatorData[] {
  const hl2Data: OHLCData[] = data.map((d) => {
    const val = (d.high + d.low) / 2;
    return { time: d.time, open: val, high: val, low: val, close: val };
  });
  const sma5 = calculateSMA(hl2Data, 5);
  const sma34 = calculateSMA(hl2Data, 34);
  const sma34Map = new Map(sma34.map((d) => [d.time, d.value]));
  const result: IndicatorData[] = [];

  for (const d of sma5) {
    const v34 = sma34Map.get(d.time);
    if (v34 !== undefined) {
      result.push({ time: d.time, value: d.value - v34 });
    }
  }
  return result;
}

/**
 * Stochastic RSI
 */
export function calculateStochRSI(
  data: OHLCData[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3,
): StochRSIData[] {
  const rsi = calculateRSI(data, rsiPeriod);
  const result: StochRSIData[] = [];
  const kValues: IndicatorData[] = [];

  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    let minRSI = Infinity, maxRSI = -Infinity;
    for (let j = 0; j < stochPeriod; j++) {
      if (rsi[i - j].value < minRSI) minRSI = rsi[i - j].value;
      if (rsi[i - j].value > maxRSI) maxRSI = rsi[i - j].value;
    }
    const range = maxRSI - minRSI;
    const k = range === 0 ? 50 : ((rsi[i].value - minRSI) / range) * 100;
    kValues.push({ time: rsi[i].time, value: k });
  }

  // Smooth K
  const smoothedK: IndicatorData[] = [];
  for (let i = kSmooth - 1; i < kValues.length; i++) {
    let sum = 0;
    for (let j = 0; j < kSmooth; j++) sum += kValues[i - j].value;
    smoothedK.push({ time: kValues[i].time, value: sum / kSmooth });
  }

  // Smooth D from K
  for (let i = dSmooth - 1; i < smoothedK.length; i++) {
    let sum = 0;
    for (let j = 0; j < dSmooth; j++) sum += smoothedK[i - j].value;
    result.push({ time: smoothedK[i].time, k: smoothedK[i].value, d: sum / dSmooth });
  }
  return result;
}

/**
 * TSI - True Strength Index
 */
export function calculateTSI(
  data: OHLCData[],
  longPeriod: number = 25,
  shortPeriod: number = 13,
): IndicatorData[] {
  const toOhlc = (arr: IndicatorData[]): OHLCData[] =>
    arr.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value }));

  const pc: IndicatorData[] = [];
  const absPC: IndicatorData[] = [];
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    pc.push({ time: data[i].time, value: diff });
    absPC.push({ time: data[i].time, value: Math.abs(diff) });
  }

  const dsEma1 = calculateEMA(toOhlc(pc), longPeriod);
  const dsEma2 = calculateEMA(toOhlc(dsEma1), shortPeriod);
  const adsEma1 = calculateEMA(toOhlc(absPC), longPeriod);
  const adsEma2 = calculateEMA(toOhlc(adsEma1), shortPeriod);

  const adsMap = new Map(adsEma2.map((d) => [d.time, d.value]));
  const result: IndicatorData[] = [];

  for (const d of dsEma2) {
    const absVal = adsMap.get(d.time);
    if (absVal !== undefined && absVal !== 0) {
      result.push({ time: d.time, value: (d.value / absVal) * 100 });
    }
  }
  return result;
}

/**
 * PPO - Percentage Price Oscillator
 */
export function calculatePPO(
  data: OHLCData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDData[] {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  const slowMap = new Map(slowEMA.map((d) => [d.time, d.value]));

  const ppoLine: IndicatorData[] = [];
  for (const f of fastEMA) {
    const s = slowMap.get(f.time);
    if (s !== undefined && s !== 0) {
      ppoLine.push({ time: f.time, value: ((f.value - s) / s) * 100 });
    }
  }

  const signalEMA = calculateEMA(
    ppoLine.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value })),
    signalPeriod,
  );
  const signalMap = new Map(signalEMA.map((d) => [d.time, d.value]));

  const result: MACDData[] = [];
  for (const d of ppoLine) {
    const sig = signalMap.get(d.time);
    if (sig !== undefined) {
      result.push({ time: d.time, macd: d.value, signal: sig, histogram: d.value - sig });
    }
  }
  return result;
}

/**
 * Fisher Transform
 */
export function calculateFisherTransform(
  data: OHLCData[],
  period: number = 9,
): IndicatorData[] {
  const result: IndicatorData[] = [];
  let prevFisher = 0;

  for (let i = period - 1; i < data.length; i++) {
    let maxH = -Infinity, minL = Infinity;
    for (let j = 0; j < period; j++) {
      if (data[i - j].high > maxH) maxH = data[i - j].high;
      if (data[i - j].low < minL) minL = data[i - j].low;
    }
    const hl2 = (data[i].high + data[i].low) / 2;
    const range = maxH - minL;
    let val = range === 0 ? 0 : 2 * ((hl2 - minL) / range - 0.5);
    val = Math.max(-0.999, Math.min(0.999, val));
    const fisher = 0.5 * Math.log((1 + val) / (1 - val)) + 0.5 * prevFisher;
    prevFisher = fisher;
    result.push({ time: data[i].time, value: fisher });
  }
  return result;
}

/**
 * Connors RSI
 */
export function calculateConnorsRSI(
  data: OHLCData[],
  rsiPeriod: number = 3,
  streakPeriod: number = 2,
  rocPeriod: number = 100,
): IndicatorData[] {
  // RSI of close
  const rsi = calculateRSI(data, rsiPeriod);
  const rsiMap = new Map(rsi.map((d) => [d.time, d.value]));

  // Streak: consecutive up/down days
  const streaks: number[] = [0];
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      streaks.push(streaks[i - 1] > 0 ? streaks[i - 1] + 1 : 1);
    } else if (data[i].close < data[i - 1].close) {
      streaks.push(streaks[i - 1] < 0 ? streaks[i - 1] - 1 : -1);
    } else {
      streaks.push(0);
    }
  }

  // RSI of streak
  const streakOhlc: OHLCData[] = data.map((d, i) => ({
    time: d.time, open: streaks[i], high: streaks[i], low: streaks[i], close: streaks[i],
  }));
  const streakRSI = calculateRSI(streakOhlc, streakPeriod);
  const streakMap = new Map(streakRSI.map((d) => [d.time, d.value]));

  // Percentile rank of ROC
  const result: IndicatorData[] = [];
  for (let i = rocPeriod; i < data.length; i++) {
    const curROC = ((data[i].close - data[i - 1].close) / data[i - 1].close) * 100;
    let count = 0;
    for (let j = 1; j <= rocPeriod; j++) {
      const pastROC = ((data[i - j].close - data[i - j - 1]?.close) / (data[i - j - 1]?.close || 1)) * 100;
      if (pastROC < curROC) count++;
    }
    const pctRank = (count / rocPeriod) * 100;

    const r = rsiMap.get(data[i].time);
    const s = streakMap.get(data[i].time);
    if (r !== undefined && s !== undefined) {
      result.push({ time: data[i].time, value: (r + s + pctRank) / 3 });
    }
  }
  return result;
}

/**
 * SMI Ergodic Oscillator
 */
export function calculateSMIErgodic(
  data: OHLCData[],
  shortPeriod: number = 5,
  longPeriod: number = 20,
  signalPeriod: number = 5,
): MACDData[] {
  const tsi = calculateTSI(data, longPeriod, shortPeriod);
  const signalEMA = calculateEMA(
    tsi.map((d) => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value })),
    signalPeriod,
  );
  const signalMap = new Map(signalEMA.map((d) => [d.time, d.value]));

  const result: MACDData[] = [];
  for (const d of tsi) {
    const sig = signalMap.get(d.time);
    if (sig !== undefined) {
      result.push({ time: d.time, macd: d.value, signal: sig, histogram: d.value - sig });
    }
  }
  return result;
}

// --- GROUP 6: CHANNEL / BAND INDICATORS (4) ---

/**
 * Linear Regression Channel
 */
export function calculateLinRegChannel(
  data: OHLCData[],
  period: number = 100,
  deviations: number = 2,
): ChannelData[] {
  const result: ChannelData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < period; j++) {
      sumX += j;
      sumY += data[i - period + 1 + j].close;
      sumXY += j * data[i - period + 1 + j].close;
      sumX2 += j * j;
    }
    const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / period;
    const regValue = intercept + slope * (period - 1);

    // Calculate standard error
    let sumResidSq = 0;
    for (let j = 0; j < period; j++) {
      const predicted = intercept + slope * j;
      sumResidSq += Math.pow(data[i - period + 1 + j].close - predicted, 2);
    }
    const stdErr = Math.sqrt(sumResidSq / period);

    result.push({
      time: data[i].time,
      upper: regValue + deviations * stdErr,
      middle: regValue,
      lower: regValue - deviations * stdErr,
    });
  }
  return result;
}

/**
 * Moving Average Envelope
 */
export function calculateMAEnvelope(
  data: OHLCData[],
  period: number = 20,
  percentage: number = 2.5,
): ChannelData[] {
  const sma = calculateSMA(data, period);
  return sma.map((d) => ({
    time: d.time,
    upper: d.value * (1 + percentage / 100),
    middle: d.value,
    lower: d.value * (1 - percentage / 100),
  }));
}

/**
 * Price Channel (Highest High / Lowest Low)
 */
export function calculatePriceChannel(
  data: OHLCData[],
  period: number = 20,
): ChannelData[] {
  const result: ChannelData[] = [];

  for (let i = period; i < data.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let j = 1; j <= period; j++) {
      if (data[i - j].high > high) high = data[i - j].high;
      if (data[i - j].low < low) low = data[i - j].low;
    }
    result.push({ time: data[i].time, upper: high, middle: (high + low) / 2, lower: low });
  }
  return result;
}

/**
 * Chandelier Exit
 */
export function calculateChandelierExit(
  data: OHLCData[],
  period: number = 22,
  multiplier: number = 3,
): ChannelData[] {
  const atr = calculateATR(data, period);
  const atrMap = new Map(atr.map((d) => [d.time, d.value]));
  const result: ChannelData[] = [];

  for (let i = period; i < data.length; i++) {
    let maxH = -Infinity, minL = Infinity;
    for (let j = 0; j < period; j++) {
      if (data[i - j].high > maxH) maxH = data[i - j].high;
      if (data[i - j].low < minL) minL = data[i - j].low;
    }
    const atrVal = atrMap.get(data[i].time) || 0;
    const exitLong = maxH - multiplier * atrVal;
    const exitShort = minL + multiplier * atrVal;
    result.push({
      time: data[i].time,
      upper: exitShort,
      middle: (exitLong + exitShort) / 2,
      lower: exitLong,
    });
  }
  return result;
}
