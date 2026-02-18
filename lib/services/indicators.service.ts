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

// ============================================================================
// PREMIUM MARKETPLACE-ONLY INDICATORS (40 unique, creative indicators)
// These are NOT available in the free chart panel
// ============================================================================

export interface TrendRibbonData { time: number; ema1: number; ema2: number; ema3: number; ema4: number; ema5: number; ema6: number; ema7: number; ema8: number; }
export interface DualLineData { time: number; upper: number; lower: number; }

// --- 1. Trend Pulse: ADX strength × RSI direction normalized 0-100 ---
export function calculateTrendPulse(data: OHLCData[], adxPeriod: number = 14, rsiPeriod: number = 14): IndicatorData[] {
  const adx = calculateADX(data, adxPeriod);
  const rsi = calculateRSI(data, rsiPeriod);
  const adxMap = new Map(adx.map(d => [d.time, d.value]));
  const rsiMap = new Map(rsi.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  for (const d of data) {
    const a = adxMap.get(d.time); const r = rsiMap.get(d.time);
    if (a !== undefined && r !== undefined) {
      // Blend: strong trend (ADX>25) + directional bias (RSI distance from 50)
      const dirBias = (r - 50) / 50; // -1 to 1
      const strength = Math.min(a / 50, 1); // 0 to 1
      result.push({ time: d.time, value: 50 + dirBias * strength * 50 });
    }
  }
  return result;
}

// --- 2. Market Regime Detector: 0=ranging, 50=transitioning, 100=trending ---
export function calculateMarketRegime(data: OHLCData[], period: number = 20): IndicatorData[] {
  const adx = calculateADX(data, period);
  const atr = calculateATR(data, period);
  const adxMap = new Map(adx.map(d => [d.time, d.value]));
  const atrMap = new Map(atr.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  const atrValues: number[] = [];
  for (const d of data) {
    const a = adxMap.get(d.time); const t = atrMap.get(d.time);
    if (a !== undefined && t !== undefined) {
      atrValues.push(t);
      const avgATR = atrValues.length >= period ? atrValues.slice(-period).reduce((s, v) => s + v, 0) / period : t;
      const volExpansion = avgATR === 0 ? 1 : t / avgATR;
      const trendScore = Math.min(a / 40, 1) * 0.6 + Math.min(volExpansion, 2) / 2 * 0.4;
      result.push({ time: d.time, value: trendScore * 100 });
    }
  }
  return result;
}

// --- 3. Trend Strength Composite: consensus of EMA slope + ADX + momentum ---
export function calculateTrendComposite(data: OHLCData[], period: number = 14): IndicatorData[] {
  const ema = calculateEMA(data, period);
  const adx = calculateADX(data, period);
  const mom = calculateMomentum(data, period);
  const emaMap = new Map(ema.map(d => [d.time, d.value]));
  const adxMap = new Map(adx.map(d => [d.time, d.value]));
  const momMap = new Map(mom.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  let prevEma = 0;
  for (const d of data) {
    const e = emaMap.get(d.time); const a = adxMap.get(d.time); const m = momMap.get(d.time);
    if (e !== undefined && a !== undefined && m !== undefined) {
      const slope = prevEma === 0 ? 0 : (e - prevEma) / prevEma * 1000;
      prevEma = e;
      const slopeScore = Math.max(-1, Math.min(1, slope));
      const adxScore = Math.min(a / 50, 1);
      const momScore = m === 0 ? 0 : Math.max(-1, Math.min(1, m / (Math.abs(m) + d.close * 0.01)));
      result.push({ time: d.time, value: ((slopeScore + momScore) / 2 * adxScore) * 50 + 50 });
    }
  }
  return result;
}

// --- 4. Composite Breadth Score: how many sub-signals agree ---
export function calculateCompositeBreadth(data: OHLCData[]): IndicatorData[] {
  const rsi = calculateRSI(data, 14);
  const macd = calculateMACD(data, 12, 26, 9);
  const stoch = calculateStochastic(data, 14, 3);
  const cci = calculateCCI(data, 20);
  const rsiMap = new Map(rsi.map(d => [d.time, d.value]));
  const macdMap = new Map(macd.map(d => [d.time, d.macd > d.signal ? 1 : -1]));
  const stochKMap = new Map(stoch.k.map(d => [d.time, d.value]));
  const stochDMap = new Map(stoch.d.map(d => [d.time, d.value]));
  const cciMap = new Map(cci.map(d => [d.time, d.value > 0 ? 1 : -1]));
  const ema20 = calculateEMA(data, 20);
  const emaMap = new Map(ema20.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  for (const d of data) {
    const signals: number[] = [];
    const r = rsiMap.get(d.time); if (r !== undefined) signals.push(r > 50 ? 1 : -1);
    const m = macdMap.get(d.time); if (m !== undefined) signals.push(m);
    const sk = stochKMap.get(d.time); const sd = stochDMap.get(d.time); if (sk !== undefined && sd !== undefined) signals.push(sk > sd ? 1 : -1);
    const c = cciMap.get(d.time); if (c !== undefined) signals.push(c);
    const e = emaMap.get(d.time); if (e !== undefined) signals.push(d.close > e ? 1 : -1);
    if (signals.length >= 3) {
      const sum = signals.reduce((a, b) => a + b, 0);
      result.push({ time: d.time, value: (sum / signals.length) * 50 + 50 }); // 0-100
    }
  }
  return result;
}

// --- 5. Reversal Signal Detector: composite oversold+volume+candle pattern ---
export function calculateReversalSignal(data: OHLCData[], rsiPeriod: number = 14): IndicatorData[] {
  const rsi = calculateRSI(data, rsiPeriod);
  const rsiMap = new Map(rsi.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  for (let i = 1; i < data.length; i++) {
    const r = rsiMap.get(data[i].time);
    if (r === undefined) continue;
    const body = data[i].close - data[i].open;
    const range = data[i].high - data[i].low || 0.0001;
    const lowerWick = Math.min(data[i].open, data[i].close) - data[i].low;
    const upperWick = data[i].high - Math.max(data[i].open, data[i].close);
    const vol = data[i].volume || 1; const prevVol = data[i - 1].volume || 1;
    const volSpike = vol / prevVol;
    // Bullish reversal score
    let bullScore = 0;
    if (r < 30) bullScore += (30 - r) / 30; // Oversold RSI
    if (lowerWick / range > 0.6) bullScore += 0.3; // Hammer
    if (volSpike > 1.5) bullScore += 0.2; // Volume spike
    if (body > 0 && data[i - 1].close < data[i - 1].open) bullScore += 0.2; // Bullish after bearish
    // Bearish reversal score
    let bearScore = 0;
    if (r > 70) bearScore += (r - 70) / 30;
    if (upperWick / range > 0.6) bearScore += 0.3;
    if (volSpike > 1.5) bearScore += 0.2;
    if (body < 0 && data[i - 1].close > data[i - 1].open) bearScore += 0.2;
    result.push({ time: data[i].time, value: (bullScore - bearScore) * 50 + 50 });
  }
  return result;
}

// --- 6. Predictive Range: projected next-bar expected range ---
export function calculatePredictiveRange(data: OHLCData[], period: number = 14): ChannelData[] {
  const atr = calculateATR(data, period);
  const atrMap = new Map(atr.map(d => [d.time, d.value]));
  const result: ChannelData[] = [];
  for (let i = 1; i < data.length; i++) {
    const a = atrMap.get(data[i].time);
    if (a !== undefined) {
      const momentum = (data[i].close - data[i - 1].close);
      const center = data[i].close + momentum * 0.5;
      result.push({ time: data[i].time, upper: center + a, middle: center, lower: center - a });
    }
  }
  return result;
}

// --- 7. Breakout Probability: squeeze detection + energy build-up ---
export function calculateBreakoutProb(data: OHLCData[], bbPeriod: number = 20, keltPeriod: number = 20): IndicatorData[] {
  const bb = calculateBollingerBands(data, bbPeriod, 2);
  const kelt = calculateKeltnerChannels(data, keltPeriod, 1.5);
  const bbMap = new Map(bb.map(d => [d.time, { u: d.upper, l: d.lower }]));
  const keltMap = new Map(kelt.map(d => [d.time, { u: d.upper, l: d.lower }]));
  const result: IndicatorData[] = [];
  let squeezeCount = 0;
  for (const d of data) {
    const b = bbMap.get(d.time); const k = keltMap.get(d.time);
    if (b && k) {
      const isSqueeze = b.u < k.u && b.l > k.l;
      if (isSqueeze) squeezeCount++;
      else squeezeCount = Math.max(0, squeezeCount - 2);
      // Probability increases with squeeze duration
      const prob = Math.min(squeezeCount * 5, 100);
      result.push({ time: d.time, value: prob });
    }
  }
  return result;
}

// --- 8. Sentiment Oscillator: candle pattern scoring ---
export function calculateSentimentOsc(data: OHLCData[], smooth: number = 5): IndicatorData[] {
  const raw: IndicatorData[] = [];
  for (let i = 1; i < data.length; i++) {
    const d = data[i]; const p = data[i - 1];
    const body = d.close - d.open; const range = d.high - d.low || 0.0001;
    const bodyRatio = Math.abs(body) / range;
    const lowerWick = (Math.min(d.open, d.close) - d.low) / range;
    const upperWick = (d.high - Math.max(d.open, d.close)) / range;
    let score = 0;
    // Bullish patterns
    if (body > 0 && bodyRatio > 0.6) score += 2; // Strong bullish candle
    if (lowerWick > 0.6 && bodyRatio < 0.3) score += 3; // Hammer/pin bar
    if (body > 0 && p.close < p.open && d.close > p.open) score += 3; // Bullish engulfing
    if (Math.abs(body) / range < 0.1) score += 0; // Doji - neutral
    // Bearish patterns
    if (body < 0 && bodyRatio > 0.6) score -= 2;
    if (upperWick > 0.6 && bodyRatio < 0.3) score -= 3; // Shooting star
    if (body < 0 && p.close > p.open && d.close < p.open) score -= 3; // Bearish engulfing
    raw.push({ time: d.time, value: score });
  }
  // Smooth
  const result: IndicatorData[] = [];
  for (let i = smooth - 1; i < raw.length; i++) {
    let sum = 0;
    for (let j = 0; j < smooth; j++) sum += raw[i - j].value;
    result.push({ time: raw[i].time, value: sum / smooth });
  }
  return result;
}

// --- 9. Whale Accumulation: volume-weighted OBV focusing on big blocks ---
export function calculateWhaleAccumulation(data: OHLCData[], threshold: number = 1.5): IndicatorData[] {
  const result: IndicatorData[] = [];
  let acc = 0;
  // Calculate average volume
  const avgVolWindow = 20;
  for (let i = 0; i < data.length; i++) {
    const vol = data[i].volume || 1;
    let avgVol = vol;
    if (i >= avgVolWindow) {
      let sum = 0;
      for (let j = 1; j <= avgVolWindow; j++) sum += (data[i - j].volume || 1);
      avgVol = sum / avgVolWindow;
    }
    // Only count volume blocks above threshold * average
    if (vol > avgVol * threshold) {
      acc += data[i].close >= (i > 0 ? data[i - 1].close : data[i].open) ? vol : -vol;
    }
    result.push({ time: data[i].time, value: acc });
  }
  return result;
}

// --- 10. Smart Money Flow: weighted money flow emphasizing institutional bars ---
export function calculateSmartMoneyFlow(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let smartFlow = 0;
    for (let j = 0; j < period; j++) {
      const d = data[i - j];
      const range = d.high - d.low || 0.0001;
      const clv = ((d.close - d.low) - (d.high - d.close)) / range;
      const vol = d.volume || 1;
      // Weight by relative volume (institutional = high vol)
      const relVol = j > 0 ? vol / (data[i - j - 1]?.volume || vol) : 1;
      smartFlow += clv * vol * Math.min(relVol, 3);
    }
    result.push({ time: data[i].time, value: smartFlow });
  }
  return result;
}

// --- 11. Volume Climax: detects extreme volume spikes ---
export function calculateVolumeClimax(data: OHLCData[], period: number = 20, threshold: number = 2): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let sum = 0;
    for (let j = 1; j <= period; j++) sum += (data[i - j].volume || 1);
    const avgVol = sum / period;
    const curVol = data[i].volume || 1;
    const ratio = avgVol === 0 ? 1 : curVol / avgVol;
    const isClimax = ratio > threshold;
    const direction = data[i].close >= data[i].open ? 1 : -1;
    result.push({ time: data[i].time, value: isClimax ? direction * ratio * 10 : 0 });
  }
  return result;
}

// --- 12. Net Buying Pressure: buyer aggression from within-bar action ---
export function calculateNetBuyingPressure(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let pressure = 0;
    for (let j = 0; j < period; j++) {
      const d = data[i - j];
      const range = d.high - d.low || 0.0001;
      const buyPressure = (d.close - d.low) / range;
      const sellPressure = (d.high - d.close) / range;
      pressure += (buyPressure - sellPressure) * (d.volume || 1);
    }
    result.push({ time: data[i].time, value: pressure });
  }
  return result;
}

// --- 13. Order Flow Imbalance: approximated buy vs sell from candle structure ---
export function calculateOrderFlowImbalance(data: OHLCData[], period: number = 10): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let buyVol = 0, sellVol = 0;
    for (let j = 0; j < period; j++) {
      const d = data[i - j];
      const range = d.high - d.low || 0.0001;
      const buyFrac = (d.close - d.low) / range;
      const vol = d.volume || 1;
      buyVol += buyFrac * vol;
      sellVol += (1 - buyFrac) * vol;
    }
    const total = buyVol + sellVol || 1;
    result.push({ time: data[i].time, value: ((buyVol - sellVol) / total) * 100 });
  }
  return result;
}

// --- 14. Intraday Intensity Index ---
export function calculateIntradayIntensity(data: OHLCData[], period: number = 21): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let iiSum = 0, volSum = 0;
    for (let j = 0; j < period; j++) {
      const d = data[i - j]; const range = d.high - d.low || 0.0001;
      iiSum += ((2 * d.close - d.high - d.low) / range) * (d.volume || 1);
      volSum += (d.volume || 1);
    }
    result.push({ time: data[i].time, value: volSum === 0 ? 0 : (iiSum / volSum) * 100 });
  }
  return result;
}

// --- 15. Volume Momentum: rate of change of volume ---
export function calculateVolumeMomentum(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    const curVol = data[i].volume || 1;
    const prevVol = data[i - period].volume || 1;
    result.push({ time: data[i].time, value: prevVol === 0 ? 0 : ((curVol - prevVol) / prevVol) * 100 });
  }
  return result;
}

// --- 16. Liquidity Heatmap: volume-weighted price levels proxy ---
export function calculateLiquidityHeatmap(data: OHLCData[], period: number = 50): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let vpSum = 0, volSum = 0;
    for (let j = 0; j < period; j++) {
      const d = data[i - j]; const tp = (d.high + d.low + d.close) / 3;
      vpSum += tp * (d.volume || 1);
      volSum += (d.volume || 1);
    }
    const vpoc = volSum === 0 ? data[i].close : vpSum / volSum;
    // Return distance from VPOC as percentage
    result.push({ time: data[i].time, value: ((data[i].close - vpoc) / vpoc) * 100 });
  }
  return result;
}

// --- 17. Volatility Squeeze: BB inside Keltner detection ---
export function calculateVolatilitySqueeze(data: OHLCData[], period: number = 20): IndicatorData[] {
  const bb = calculateBollingerBands(data, period, 2);
  const kelt = calculateKeltnerChannels(data, period, 1.5);
  const mom = calculateMomentum(data, 12);
  const bbMap = new Map(bb.map(d => [d.time, { u: d.upper, l: d.lower }]));
  const keltMap = new Map(kelt.map(d => [d.time, { u: d.upper, l: d.lower }]));
  const momMap = new Map(mom.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  for (const d of data) {
    const b = bbMap.get(d.time); const k = keltMap.get(d.time); const m = momMap.get(d.time);
    if (b && k && m !== undefined) {
      const squeeze = b.u < k.u && b.l > k.l;
      result.push({ time: d.time, value: squeeze ? m * 0.5 : m });
    }
  }
  return result;
}

// --- 18. Squeeze Momentum: momentum reading during squeeze ---
export function calculateSqueezeMomentum(data: OHLCData[], period: number = 20): IndicatorData[] {
  // Linear regression of close - midline(keltner)
  const kelt = calculateKeltnerChannels(data, period, 1.5);
  const keltMap = new Map(kelt.map(d => [d.time, d.middle]));
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    const mid = keltMap.get(data[i].time);
    if (mid !== undefined) {
      // Simple momentum relative to Keltner midline
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let j = 0; j < period; j++) {
        const y = data[i - j].close - (keltMap.get(data[i - j].time) || mid);
        sumX += j; sumY += y; sumXY += j * y; sumX2 += j * j;
      }
      const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
      result.push({ time: data[i].time, value: slope * 1000 });
    }
  }
  return result;
}

// --- 19. Volatility Ratio: current vs historical vol ---
export function calculateVolatilityRatio(data: OHLCData[], shortPeriod: number = 5, longPeriod: number = 20): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = longPeriod; i < data.length; i++) {
    let shortTR = 0, longTR = 0;
    for (let j = 0; j < shortPeriod; j++) {
      const idx = i - j;
      shortTR += Math.max(data[idx].high - data[idx].low, Math.abs(data[idx].high - data[idx - 1].close), Math.abs(data[idx].low - data[idx - 1].close));
    }
    for (let j = 0; j < longPeriod; j++) {
      const idx = i - j;
      longTR += Math.max(data[idx].high - data[idx].low, Math.abs(data[idx].high - data[idx - 1].close), Math.abs(data[idx].low - data[idx - 1].close));
    }
    const ratio = (longTR / longPeriod) === 0 ? 1 : (shortTR / shortPeriod) / (longTR / longPeriod);
    result.push({ time: data[i].time, value: ratio });
  }
  return result;
}

// --- 20. Range Expansion Index ---
export function calculateRangeExpansion(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let avgRange = 0;
    for (let j = 1; j <= period; j++) avgRange += (data[i - j].high - data[i - j].low);
    avgRange /= period;
    const curRange = data[i].high - data[i].low;
    result.push({ time: data[i].time, value: avgRange === 0 ? 0 : (curRange / avgRange - 1) * 100 });
  }
  return result;
}

// --- 21. Choppy Market Index ---
export function calculateChoppyMarket(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let trSum = 0; let maxH = -Infinity, minL = Infinity;
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      trSum += Math.max(data[idx].high - data[idx].low, Math.abs(data[idx].high - data[idx - 1].close), Math.abs(data[idx].low - data[idx - 1].close));
      if (data[idx].high > maxH) maxH = data[idx].high;
      if (data[idx].low < minL) minL = data[idx].low;
    }
    const hlRange = maxH - minL || 0.0001;
    const chop = (Math.log10(trSum / hlRange) / Math.log10(period)) * 100;
    result.push({ time: data[i].time, value: Math.max(0, Math.min(100, chop)) });
  }
  return result;
}

// --- 22. Fractal Dimension: market complexity 1=trending, 2=random ---
export function calculateFractalDimension(data: OHLCData[], period: number = 30): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    const half = Math.floor(period / 2);
    let n1 = 0, n2 = 0, n3 = 0;
    let maxH1 = -Infinity, minL1 = Infinity, maxH2 = -Infinity, minL2 = Infinity, maxH3 = -Infinity, minL3 = Infinity;
    for (let j = 0; j < half; j++) {
      if (data[i - j].high > maxH1) maxH1 = data[i - j].high;
      if (data[i - j].low < minL1) minL1 = data[i - j].low;
    }
    n1 = (maxH1 - minL1) / half;
    for (let j = half; j < period; j++) {
      if (data[i - j].high > maxH2) maxH2 = data[i - j].high;
      if (data[i - j].low < minL2) minL2 = data[i - j].low;
    }
    n2 = (maxH2 - minL2) / half;
    for (let j = 0; j < period; j++) {
      if (data[i - j].high > maxH3) maxH3 = data[i - j].high;
      if (data[i - j].low < minL3) minL3 = data[i - j].low;
    }
    n3 = (maxH3 - minL3) / period;
    const dimen = (n1 + n2 > 0 && n3 > 0) ? (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2) + 1 : 1.5;
    result.push({ time: data[i].time, value: Math.max(1, Math.min(2, dimen)) });
  }
  return result;
}

// --- 23. Acceleration Bands ---
export function calculateAccelerationBands(data: OHLCData[], period: number = 20): ChannelData[] {
  const result: ChannelData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sumMid = 0, sumUpper = 0, sumLower = 0;
    for (let j = 0; j < period; j++) {
      const d = data[i - j]; const range = d.high - d.low;
      const accel = d.high === 0 ? 0 : range / d.high;
      sumUpper += d.high * (1 + 2 * accel);
      sumLower += d.low * (1 - 2 * accel);
      sumMid += d.close;
    }
    result.push({ time: data[i].time, upper: sumUpper / period, middle: sumMid / period, lower: sumLower / period });
  }
  return result;
}

// --- 24. Adaptive Channel: volatility-adaptive price channel ---
export function calculateAdaptiveChannel(data: OHLCData[], period: number = 20): ChannelData[] {
  const atr = calculateATR(data, period);
  const ema = calculateEMA(data, period);
  const atrMap = new Map(atr.map(d => [d.time, d.value]));
  const emaMap = new Map(ema.map(d => [d.time, d.value]));
  const result: ChannelData[] = [];
  for (const d of data) {
    const a = atrMap.get(d.time); const e = emaMap.get(d.time);
    if (a !== undefined && e !== undefined) {
      const width = a * 2.5;
      result.push({ time: d.time, upper: e + width, middle: e, lower: e - width });
    }
  }
  return result;
}

// --- 25. Alpha Momentum: risk-adjusted momentum ---
export function calculateAlphaMomentum(data: OHLCData[], period: number = 20): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    const returns = (data[i].close - data[i - period].close) / data[i - period].close;
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const r = (data[i - j].close - data[i - j - 1].close) / (data[i - j - 1].close || 1);
      sumSq += r * r;
    }
    const vol = Math.sqrt(sumSq / period);
    result.push({ time: data[i].time, value: vol === 0 ? 0 : (returns / vol) * 10 });
  }
  return result;
}

// --- 26. Efficiency Ratio Oscillator ---
export function calculateEfficiencyRatio(data: OHLCData[], period: number = 10): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    const direction = Math.abs(data[i].close - data[i - period].close);
    let volatility = 0;
    for (let j = 0; j < period; j++) volatility += Math.abs(data[i - j].close - data[i - j - 1].close);
    const er = volatility === 0 ? 0 : direction / volatility;
    const sign = data[i].close > data[i - period].close ? 1 : -1;
    result.push({ time: data[i].time, value: sign * er * 100 });
  }
  return result;
}

// --- 27. Trend Persistence ---
export function calculateTrendPersistence(data: OHLCData[], period: number = 20): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let upCount = 0;
    for (let j = 0; j < period; j++) {
      if (data[i - j].close > data[i - j - 1].close) upCount++;
    }
    result.push({ time: data[i].time, value: (upCount / period) * 100 });
  }
  return result;
}

// --- 28. Multi-Timeframe Momentum ---
export function calculateMTFMomentum(data: OHLCData[]): IndicatorData[] {
  const mom5 = calculateROC(data, 5);
  const mom10 = calculateROC(data, 10);
  const mom20 = calculateROC(data, 20);
  const m10Map = new Map(mom10.map(d => [d.time, d.value]));
  const m20Map = new Map(mom20.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  for (const d of mom5) {
    const m10 = m10Map.get(d.time); const m20 = m20Map.get(d.time);
    if (m10 !== undefined && m20 !== undefined) {
      result.push({ time: d.time, value: d.value * 0.5 + m10 * 0.3 + m20 * 0.2 });
    }
  }
  return result;
}

// --- 29. Momentum Wave: sine-wave fitted cycle momentum ---
export function calculateMomentumWave(data: OHLCData[], period: number = 20): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period; i < data.length; i++) {
    let sinSum = 0, cosSum = 0;
    for (let j = 0; j < period; j++) {
      const phase = (2 * Math.PI * j) / period;
      const val = data[i - j].close - data[i - period].close;
      sinSum += val * Math.sin(phase);
      cosSum += val * Math.cos(phase);
    }
    const amplitude = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / period;
    const phase = Math.atan2(sinSum, cosSum);
    result.push({ time: data[i].time, value: amplitude * Math.sin(phase) });
  }
  return result;
}

// --- 30. Gap Momentum: cumulative overnight/gap impact ---
export function calculateGapMomentum(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  const gaps: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const gap = data[i].open - data[i - 1].close;
    gaps.push(gap);
    if (gaps.length >= period) {
      let sum = 0;
      for (let j = gaps.length - period; j < gaps.length; j++) sum += gaps[j];
      result.push({ time: data[i].time, value: sum });
    }
  }
  return result;
}

// --- 31. Heikin Ashi Trend: HA-based trend direction ---
export function calculateHeikinAshiTrend(data: OHLCData[], period: number = 10): IndicatorData[] {
  const ha: { time: number; close: number; open: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const haClose = (data[i].open + data[i].high + data[i].low + data[i].close) / 4;
    const haOpen = i === 0 ? (data[i].open + data[i].close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({ time: data[i].time, close: haClose, open: haOpen });
  }
  const result: IndicatorData[] = [];
  for (let i = period - 1; i < ha.length; i++) {
    let bullCount = 0;
    for (let j = 0; j < period; j++) {
      if (ha[i - j].close > ha[i - j].open) bullCount++;
    }
    result.push({ time: ha[i].time, value: (bullCount / period) * 100 });
  }
  return result;
}

// --- 32. Cycle Detector: dominant period estimation ---
export function calculateCycleDetector(data: OHLCData[], maxPeriod: number = 50): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = maxPeriod * 2; i < data.length; i++) {
    let bestPeriod = 10; let bestCorr = -Infinity;
    for (let p = 5; p <= maxPeriod; p++) {
      let corr = 0;
      for (let j = 0; j < p; j++) {
        corr += (data[i - j].close - data[i - j - 1].close) * (data[i - j - p].close - data[i - j - p - 1].close);
      }
      if (corr > bestCorr) { bestCorr = corr; bestPeriod = p; }
    }
    result.push({ time: data[i].time, value: bestPeriod });
  }
  return result;
}

// --- 33. Adaptive RSI: volatility-adjusted period ---
export function calculateAdaptiveRSI(data: OHLCData[], basePeriod: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = basePeriod * 2; i < data.length; i++) {
    // Calculate local volatility to adapt period
    let vol = 0;
    for (let j = 0; j < basePeriod; j++) {
      vol += Math.abs(data[i - j].close - data[i - j - 1].close);
    }
    const avgVol = vol / basePeriod;
    let longVol = 0;
    for (let j = 0; j < basePeriod * 2; j++) {
      longVol += Math.abs(data[i - j].close - data[i - j - 1].close);
    }
    const avgLongVol = longVol / (basePeriod * 2);
    const ratio = avgLongVol === 0 ? 1 : avgVol / avgLongVol;
    const adaptedPeriod = Math.max(5, Math.min(30, Math.round(basePeriod / ratio)));
    // Calculate RSI with adapted period
    let avgGain = 0, avgLoss = 0;
    for (let j = 0; j < adaptedPeriod; j++) {
      const change = data[i - j].close - data[i - j - 1].close;
      if (change > 0) avgGain += change; else avgLoss -= change;
    }
    avgGain /= adaptedPeriod; avgLoss /= adaptedPeriod;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

// --- 34. Mean Reversion Band: Z-score bands ---
export function calculateMeanReversionBand(data: OHLCData[], period: number = 20): ChannelData[] {
  const result: ChannelData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;
    let sumSq = 0;
    for (let j = 0; j < period; j++) sumSq += Math.pow(data[i - j].close - mean, 2);
    const stdDev = Math.sqrt(sumSq / period);
    result.push({ time: data[i].time, upper: mean + 2 * stdDev, middle: mean, lower: mean - 2 * stdDev });
  }
  return result;
}

// --- 35. Trend Ribbon: 8 EMAs for visual ribbon ---
export function calculateTrendRibbon(data: OHLCData[]): TrendRibbonData[] {
  const periods = [5, 8, 13, 21, 34, 55, 89, 144];
  const emas = periods.map(p => new Map(calculateEMA(data, p).map(d => [d.time, d.value])));
  const result: TrendRibbonData[] = [];
  for (const d of data) {
    const vals = emas.map(m => m.get(d.time));
    if (vals.every(v => v !== undefined)) {
      result.push({ time: d.time, ema1: vals[0]!, ema2: vals[1]!, ema3: vals[2]!, ema4: vals[3]!, ema5: vals[4]!, ema6: vals[5]!, ema7: vals[6]!, ema8: vals[7]! });
    }
  }
  return result;
}

// --- 36. Relative Vigor Index (unique version): conviction using O/H/L/C ---
export function calculateRelativeVigor(data: OHLCData[], period: number = 10): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period + 3; i < data.length; i++) {
    let numSum = 0, denSum = 0;
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      // Numerator: (Close-Open) + 2*(Close[1]-Open[1]) + 2*(Close[2]-Open[2]) + (Close[3]-Open[3])
      const num = (data[idx].close - data[idx].open) + 2 * (data[idx - 1].close - data[idx - 1].open) + 2 * (data[idx - 2].close - data[idx - 2].open) + (data[idx - 3].close - data[idx - 3].open);
      const den = (data[idx].high - data[idx].low) + 2 * (data[idx - 1].high - data[idx - 1].low) + 2 * (data[idx - 2].high - data[idx - 2].low) + (data[idx - 3].high - data[idx - 3].low);
      numSum += num / 6; denSum += den / 6;
    }
    result.push({ time: data[i].time, value: denSum === 0 ? 0 : (numSum / denSum) * 100 });
  }
  return result;
}

// --- 37. Dynamic Pivot Zones ---
export function calculateDynamicPivots(data: OHLCData[], lookback: number = 5): ChannelData[] {
  const result: ChannelData[] = [];
  for (let i = lookback * 2; i < data.length; i++) {
    // Find fractal high/low pivots
    let pivotHigh = data[i].high, pivotLow = data[i].low;
    for (let j = 1; j <= lookback * 2; j++) {
      const idx = i - j;
      // Check if any point was a swing high/low
      if (idx >= lookback && idx < data.length - lookback) {
        let isHigh = true, isLow = true;
        for (let k = 1; k <= lookback; k++) {
          if (data[idx].high <= data[idx - k].high || data[idx].high <= data[idx + k >= data.length ? idx : idx + k].high) isHigh = false;
          if (data[idx].low >= data[idx - k].low || data[idx].low >= data[idx + k >= data.length ? idx : idx + k].low) isLow = false;
        }
        if (isHigh && data[idx].high > pivotHigh * 0.99) pivotHigh = data[idx].high;
        if (isLow && data[idx].low < pivotLow * 1.01) pivotLow = data[idx].low;
      }
    }
    result.push({ time: data[i].time, upper: pivotHigh, middle: (pivotHigh + pivotLow) / 2, lower: pivotLow });
  }
  return result;
}

// --- 38. Price Action Score ---
export function calculatePriceActionScore(data: OHLCData[], period: number = 10): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = 2; i < data.length; i++) {
    const d = data[i]; const p1 = data[i - 1]; const p2 = data[i - 2];
    let score = 0;
    const body = d.close - d.open; const range = d.high - d.low || 0.0001;
    // Higher highs / higher lows
    if (d.high > p1.high && d.low > p1.low) score += 2;
    if (d.high < p1.high && d.low < p1.low) score -= 2;
    // Body vs range
    if (body > 0) score += Math.abs(body) / range * 2;
    else score -= Math.abs(body) / range * 2;
    // Consecutive direction
    if (body > 0 && p1.close > p1.open) score += 1;
    if (body < 0 && p1.close < p1.open) score -= 1;
    // Three-bar pattern
    if (d.close > p2.high) score += 1.5;
    if (d.close < p2.low) score -= 1.5;
    result.push({ time: d.time, value: score });
  }
  // Smooth
  const smoothed: IndicatorData[] = [];
  for (let i = period - 1; i < result.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += result[i - j].value;
    smoothed.push({ time: result[i].time, value: sum / period });
  }
  return smoothed;
}

// --- 39. Ergodic Volume Oscillator ---
export function calculateErgodicVolume(data: OHLCData[], shortPeriod: number = 5, longPeriod: number = 20): IndicatorData[] {
  const toOhlc = (arr: IndicatorData[]): OHLCData[] => arr.map(d => ({ time: d.time, open: d.value, high: d.value, low: d.value, close: d.value }));
  // Volume-weighted candle body
  const vwBody: IndicatorData[] = [];
  for (const d of data) {
    vwBody.push({ time: d.time, value: (d.close - d.open) * (d.volume || 1) });
  }
  const e1 = calculateEMA(toOhlc(vwBody), longPeriod);
  const e2 = calculateEMA(toOhlc(e1), shortPeriod);
  const absVwBody = vwBody.map(d => ({ time: d.time, value: Math.abs(d.value) }));
  const ae1 = calculateEMA(toOhlc(absVwBody), longPeriod);
  const ae2 = calculateEMA(toOhlc(ae1), shortPeriod);
  const ae2Map = new Map(ae2.map(d => [d.time, d.value]));
  const result: IndicatorData[] = [];
  for (const d of e2) {
    const abs = ae2Map.get(d.time);
    if (abs !== undefined && abs !== 0) result.push({ time: d.time, value: (d.value / abs) * 100 });
  }
  return result;
}

// --- 40. Anchored VWAP Bands ---
export function calculateAnchoredVWAPBands(data: OHLCData[], deviations: number = 2): ChannelData[] {
  let cumVP = 0, cumVol = 0, cumVP2 = 0;
  const result: ChannelData[] = [];
  for (const d of data) {
    const tp = (d.high + d.low + d.close) / 3;
    const vol = d.volume || 1;
    cumVP += tp * vol; cumVol += vol; cumVP2 += tp * tp * vol;
    const vwap = cumVol === 0 ? tp : cumVP / cumVol;
    const variance = cumVol === 0 ? 0 : cumVP2 / cumVol - vwap * vwap;
    const stdDev = Math.sqrt(Math.max(0, variance));
    result.push({ time: d.time, upper: vwap + deviations * stdDev, middle: vwap, lower: vwap - deviations * stdDev });
  }
  return result;
}

// ============================================================================
// NEXUS TREND MATRIX — Premium Marketplace Indicator
// Combines KAMA adaptive core + ATR volatility bands + multi-factor trend score
// ============================================================================

export interface NexusTrendMatrixData {
  time: number;
  core: number;       // KAMA adaptive center line
  upper: number;      // Core + ATR-based upper band
  lower: number;      // Core - ATR-based lower band
  trendScore: number; // -100 to +100 composite trend strength
}

export function calculateNexusTrendMatrix(
  data: OHLCData[],
  period: number = 20,
  fastPeriod: number = 2,
  slowPeriod: number = 30,
  atrPeriod: number = 14,
  atrMultiplier: number = 2.0,
  trendSmoothPeriod: number = 10,
): NexusTrendMatrixData[] {
  if (data.length < Math.max(period, atrPeriod, trendSmoothPeriod) + 10) return [];

  // --- Component 1: KAMA Adaptive Core ---
  const fastSC = 2 / (fastPeriod + 1);
  const slowSC = 2 / (slowPeriod + 1);
  const kamaValues: number[] = new Array(data.length).fill(NaN);

  if (data.length > period) {
    kamaValues[period] = data[period].close;
    for (let i = period + 1; i < data.length; i++) {
      const direction = Math.abs(data[i].close - data[i - period].close);
      let volatility = 0;
      for (let j = 0; j < period; j++) {
        volatility += Math.abs(data[i - j].close - data[i - j - 1].close);
      }
      const er = volatility === 0 ? 0 : direction / volatility;
      const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
      kamaValues[i] = kamaValues[i - 1] + sc * (data[i].close - kamaValues[i - 1]);
    }
  }

  // --- Component 2: ATR for dynamic bands ---
  const atrValues: number[] = new Array(data.length).fill(NaN);
  if (data.length > atrPeriod) {
    let atrSum = 0;
    for (let i = 1; i <= atrPeriod; i++) {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close),
      );
      atrSum += tr;
    }
    atrValues[atrPeriod] = atrSum / atrPeriod;
    for (let i = atrPeriod + 1; i < data.length; i++) {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close),
      );
      atrValues[i] = (atrValues[i - 1] * (atrPeriod - 1) + tr) / atrPeriod;
    }
  }

  // --- Component 3: Multi-factor trend score ---
  // Factor A: KAMA slope (direction and magnitude)
  // Factor B: ADX-like directional strength
  // Factor C: Price momentum relative to KAMA
  const rawScores: number[] = new Array(data.length).fill(0);
  const slopeLookback = Math.max(3, Math.floor(period / 4));

  for (let i = period + slopeLookback; i < data.length; i++) {
    if (isNaN(kamaValues[i]) || isNaN(kamaValues[i - slopeLookback])) continue;

    // Factor A: Normalized KAMA slope (-50 to +50)
    const kamaSlope = (kamaValues[i] - kamaValues[i - slopeLookback]) / slopeLookback;
    const avgPrice = (data[i].high + data[i].low) / 2;
    const normalizedSlope = avgPrice === 0 ? 0 : (kamaSlope / avgPrice) * 10000;
    const slopeScore = Math.max(-50, Math.min(50, normalizedSlope * 10));

    // Factor B: Directional strength via +DI/-DI ratio (-30 to +30)
    let plusDMSum = 0, minusDMSum = 0, trSum = 0;
    const diLookback = Math.min(atrPeriod, i);
    for (let j = 1; j <= diLookback; j++) {
      const idx = i - diLookback + j;
      if (idx < 1) continue;
      const upMove = data[idx].high - data[idx - 1].high;
      const downMove = data[idx - 1].low - data[idx].low;
      plusDMSum += (upMove > downMove && upMove > 0) ? upMove : 0;
      minusDMSum += (downMove > upMove && downMove > 0) ? downMove : 0;
      trSum += Math.max(
        data[idx].high - data[idx].low,
        Math.abs(data[idx].high - data[idx - 1].close),
        Math.abs(data[idx].low - data[idx - 1].close),
      );
    }
    const plusDI = trSum === 0 ? 0 : (plusDMSum / trSum) * 100;
    const minusDI = trSum === 0 ? 0 : (minusDMSum / trSum) * 100;
    const diDiff = plusDI - minusDI;
    const diSum = plusDI + minusDI;
    const dirScore = diSum === 0 ? 0 : (diDiff / diSum) * 30;

    // Factor C: Price position relative to KAMA (-20 to +20)
    const priceDeviation = data[i].close - kamaValues[i];
    const atrVal = isNaN(atrValues[i]) ? 1 : Math.max(atrValues[i], 0.00001);
    const positionScore = Math.max(-20, Math.min(20, (priceDeviation / atrVal) * 10));

    rawScores[i] = slopeScore + dirScore + positionScore;
  }

  // Smooth the trend score with EMA
  const smoothedScores: number[] = new Array(data.length).fill(0);
  const smoothAlpha = 2 / (trendSmoothPeriod + 1);
  let smoothInit = false;
  for (let i = 0; i < data.length; i++) {
    if (rawScores[i] !== 0 && !smoothInit) {
      smoothedScores[i] = rawScores[i];
      smoothInit = true;
    } else if (smoothInit) {
      smoothedScores[i] = smoothAlpha * rawScores[i] + (1 - smoothAlpha) * smoothedScores[i - 1];
    }
  }

  // --- Assemble output ---
  const result: NexusTrendMatrixData[] = [];
  const startIdx = Math.max(period + slopeLookback, atrPeriod + 1);

  for (let i = startIdx; i < data.length; i++) {
    if (isNaN(kamaValues[i]) || isNaN(atrValues[i])) continue;

    const atr = atrValues[i];
    const core = kamaValues[i];
    const trendScore = Math.max(-100, Math.min(100, Math.round(smoothedScores[i])));

    result.push({
      time: data[i].time,
      core,
      upper: core + atrMultiplier * atr,
      lower: core - atrMultiplier * atr,
      trendScore,
    });
  }

  return result;
}

// ============================================================================
// PHANTOM FLOW ZONES — Premium Marketplace Indicator
// Detects institutional accumulation/distribution via volume absorption,
// wick rejection, and projects dynamic supply/demand zones on chart.
// ============================================================================

export interface PhantomFlowZonesData {
  time: number;
  flowLine: number;    // Volume-weighted smoothed midpoint (institutional bias)
  demandZone: number;  // Demand (support) level, NaN when inactive
  supplyZone: number;  // Supply (resistance) level, NaN when inactive
  signalStrength: number; // 0-100 strength of the current zone signal
}

export function calculatePhantomFlowZones(
  data: OHLCData[],
  period: number = 20,
  volumeThreshold: number = 1.5,
  wickThreshold: number = 0.6,
  zoneLookback: number = 50,
  smoothPeriod: number = 10,
): PhantomFlowZonesData[] {
  if (data.length < period + 5) return [];

  // --- Step 1: Compute volume SMA for spike detection ---
  const volSma: number[] = new Array(data.length).fill(0);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += (data[i - j].volume || 1);
    }
    volSma[i] = sum / period;
  }

  // --- Step 2: Detect absorption and rejection events ---
  interface ZoneEvent {
    bar: number;
    level: number;
    type: "demand" | "supply";
    strength: number;
  }
  const events: ZoneEvent[] = [];

  for (let i = period; i < data.length; i++) {
    const d = data[i];
    const vol = d.volume || 1;
    const avgVol = volSma[i] || 1;
    const range = d.high - d.low;
    if (range <= 0) continue;

    const body = Math.abs(d.close - d.open);
    const upperWick = d.high - Math.max(d.close, d.open);
    const lowerWick = Math.min(d.close, d.open) - d.low;

    // Volume ratio: how much volume relative to average
    const volumeRatio = vol / avgVol;

    // Absorption score: high volume + small body = orders being absorbed
    const bodyRatio = body / range;
    const absorptionScore = volumeRatio * (1 - bodyRatio);

    // Wick rejection: large wicks relative to range
    const wickRatio = (upperWick + lowerWick) / range;

    // Combined signal
    const signal = absorptionScore * (0.5 + wickRatio * 0.5);

    // Must exceed volume threshold AND have meaningful wicks
    if (volumeRatio >= volumeThreshold && wickRatio >= wickThreshold * 0.5 && signal > 1.0) {
      const strength = Math.min(100, Math.round(signal * 40));

      if (d.close >= d.open) {
        events.push({ bar: i, level: d.low, type: "demand", strength });
      } else {
        events.push({ bar: i, level: d.high, type: "supply", strength });
      }
    } else if (volumeRatio >= volumeThreshold * 0.8 && wickRatio >= wickThreshold) {
      const strength = Math.min(80, Math.round(wickRatio * volumeRatio * 30));
      if (lowerWick > upperWick) {
        events.push({ bar: i, level: d.low, type: "demand", strength });
      } else {
        events.push({ bar: i, level: d.high, type: "supply", strength });
      }
    }
  }

  // --- Step 3: Compute flow line (volume-weighted EMA of typical price) ---
  const flowLineValues: number[] = new Array(data.length).fill(NaN);
  const alpha = 2 / (smoothPeriod + 1);
  let flowInit = false;

  for (let i = period; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    const vol = data[i].volume || 1;
    const avgVol = volSma[i] || 1;
    const weight = Math.min(vol / avgVol, 3);
    const effectiveAlpha = alpha * (0.5 + weight * 0.5);

    if (!flowInit) {
      flowLineValues[i] = tp;
      flowInit = true;
    } else {
      flowLineValues[i] = effectiveAlpha * tp + (1 - effectiveAlpha) * flowLineValues[i - 1];
    }
  }

  // --- Step 4: Project zones forward and assemble output ---
  const result: PhantomFlowZonesData[] = [];

  for (let i = period; i < data.length; i++) {
    if (isNaN(flowLineValues[i])) continue;

    let demandLevel = NaN;
    let supplyLevel = NaN;
    let demandStrength = 0;
    let supplyStrength = 0;

    for (let e = events.length - 1; e >= 0; e--) {
      const ev = events[e];
      const age = i - ev.bar;
      if (age < 0) continue;
      if (age > zoneLookback) break;

      let broken = false;
      for (let k = ev.bar + 1; k <= i; k++) {
        if (ev.type === "demand" && data[k].close < ev.level - (data[k].high - data[k].low) * 0.5) {
          broken = true; break;
        }
        if (ev.type === "supply" && data[k].close > ev.level + (data[k].high - data[k].low) * 0.5) {
          broken = true; break;
        }
      }
      if (broken) continue;

      const ageFactor = 1 - (age / zoneLookback) * 0.7;
      const effectiveStrength = ev.strength * ageFactor;

      if (ev.type === "demand" && effectiveStrength > demandStrength) {
        demandLevel = ev.level;
        demandStrength = effectiveStrength;
      } else if (ev.type === "supply" && effectiveStrength > supplyStrength) {
        supplyLevel = ev.level;
        supplyStrength = effectiveStrength;
      }
    }

    result.push({
      time: data[i].time,
      flowLine: flowLineValues[i],
      demandZone: demandLevel,
      supplyZone: supplyLevel,
      signalStrength: Math.round(Math.max(demandStrength, supplyStrength)),
    });
  }

  return result;
}

// ============================================================================
// FRACTAL PULSE GRID — Premium Marketplace Indicator
// Adaptive market structure overlay: volatility-adaptive fractal swing detection,
// structural level tracking with break/test logic, and a pulse line showing bias.
// ============================================================================

export interface FractalPulseGridData {
  time: number;
  resistance: number;  // Active structural resistance level, NaN when none
  support: number;     // Active structural support level, NaN when none
  pulseLine: number;   // Adaptive smoothed midpoint of structure
  structureBias: number; // -100 to +100 (positive = bullish structure)
}

export function calculateFractalPulseGrid(
  data: OHLCData[],
  period: number = 20,
  atrPeriod: number = 14,
  baseLookback: number = 3,
  maxAge: number = 100,
  smoothPeriod: number = 8,
  breakTolerance: number = 0.25,
): FractalPulseGridData[] {
  if (data.length < Math.max(period, atrPeriod) + baseLookback * 2 + 5) return [];

  // --- Step 1: Compute ATR for volatility adaptation ---
  const atrArr: number[] = new Array(data.length).fill(0);
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );
    if (i < atrPeriod) {
      atrArr[i] = atrArr[i - 1] + (tr - atrArr[i - 1]) / i;
    } else {
      atrArr[i] = atrArr[i - 1] + (tr - atrArr[i - 1]) / atrPeriod;
    }
  }

  // ATR SMA for volatility normalization
  const atrSma: number[] = new Array(data.length).fill(0);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += atrArr[i - j];
    atrSma[i] = sum / period;
  }

  // --- Step 2: Detect adaptive fractals and track levels ---
  interface SwingLevel {
    bar: number;
    price: number;
    type: "high" | "low";
    testCount: number;
  }

  const activeHighs: SwingLevel[] = [];
  const activeLows: SwingLevel[] = [];
  const startBar = Math.max(period, atrPeriod) + baseLookback;
  const result: FractalPulseGridData[] = [];
  const alpha = 2 / (smoothPeriod + 1);
  let pulseEma = NaN;
  let prevResistance = NaN;
  let prevSupport = NaN;
  let biasSmooth = 0;

  for (let i = startBar; i < data.length; i++) {
    const curAtr = atrArr[i] || 0.0001;
    const breakDist = curAtr * breakTolerance;
    const volRatio = atrSma[i] > 0 ? atrArr[i] / atrSma[i] : 1;
    const adaptiveLookback = Math.max(2, Math.min(6,
      Math.round(baseLookback * Math.max(0.7, Math.min(1.8, volRatio)))),
    );

    // --- Fractal detection (need future bars, so detect for bar i - adaptiveLookback) ---
    const checkBar = i - adaptiveLookback;
    if (checkBar >= startBar - baseLookback && checkBar > 0) {
      let isSwingHigh = true;
      let isSwingLow = true;
      for (let j = 1; j <= adaptiveLookback; j++) {
        const leftIdx = checkBar - j;
        const rightIdx = checkBar + j;
        if (leftIdx < 0 || rightIdx >= data.length) { isSwingHigh = false; isSwingLow = false; break; }
        if (data[leftIdx].high >= data[checkBar].high || data[rightIdx].high >= data[checkBar].high) isSwingHigh = false;
        if (data[leftIdx].low <= data[checkBar].low || data[rightIdx].low <= data[checkBar].low) isSwingLow = false;
      }

      if (isSwingHigh) {
        const tooClose = activeHighs.some(
          (h) => Math.abs(h.price - data[checkBar].high) < curAtr * 0.3 && checkBar - h.bar < period,
        );
        if (!tooClose) {
          activeHighs.push({ bar: checkBar, price: data[checkBar].high, type: "high", testCount: 0 });
        }
      }
      if (isSwingLow) {
        const tooClose = activeLows.some(
          (l) => Math.abs(l.price - data[checkBar].low) < curAtr * 0.3 && checkBar - l.bar < period,
        );
        if (!tooClose) {
          activeLows.push({ bar: checkBar, price: data[checkBar].low, type: "low", testCount: 0 });
        }
      }
    }

    // --- Expire old levels and detect breaks/tests ---
    for (let h = activeHighs.length - 1; h >= 0; h--) {
      const lvl = activeHighs[h];
      if (i - lvl.bar > maxAge) { activeHighs.splice(h, 1); continue; }
      if (lvl.bar > i) continue;
      if (data[i].close > lvl.price + breakDist) { activeHighs.splice(h, 1); continue; }
      if (data[i].high >= lvl.price - breakDist && data[i].close <= lvl.price + breakDist * 0.5) {
        lvl.testCount++;
      }
    }

    for (let l = activeLows.length - 1; l >= 0; l--) {
      const lvl = activeLows[l];
      if (i - lvl.bar > maxAge) { activeLows.splice(l, 1); continue; }
      if (lvl.bar > i) continue;
      if (data[i].close < lvl.price - breakDist) { activeLows.splice(l, 1); continue; }
      if (data[i].low <= lvl.price + breakDist && data[i].close >= lvl.price - breakDist * 0.5) {
        lvl.testCount++;
      }
    }

    // --- Select best resistance (closest above price, weighted by recency + tests) ---
    let bestRes = NaN;
    let bestResScore = -Infinity;
    for (const h of activeHighs) {
      if (h.bar > i || h.price <= data[i].close) continue;
      const proximity = 1 / (1 + (h.price - data[i].close) / curAtr);
      const recency = 1 - (i - h.bar) / maxAge * 0.5;
      const testBonus = 1 + h.testCount * 0.3;
      const score = proximity * recency * testBonus;
      if (score > bestResScore) { bestResScore = score; bestRes = h.price; }
    }

    // --- Select best support (closest below price, weighted by recency + tests) ---
    let bestSup = NaN;
    let bestSupScore = -Infinity;
    for (const l of activeLows) {
      if (l.bar > i || l.price >= data[i].close) continue;
      const proximity = 1 / (1 + (data[i].close - l.price) / curAtr);
      const recency = 1 - (i - l.bar) / maxAge * 0.5;
      const testBonus = 1 + l.testCount * 0.3;
      const score = proximity * recency * testBonus;
      if (score > bestSupScore) { bestSupScore = score; bestSup = l.price; }
    }

    // Carry forward previous levels when no active level found
    if (isNaN(bestRes) && !isNaN(prevResistance)) bestRes = prevResistance;
    if (isNaN(bestSup) && !isNaN(prevSupport)) bestSup = prevSupport;
    prevResistance = bestRes;
    prevSupport = bestSup;

    // --- Pulse line: adaptive midpoint ---
    let mid: number;
    if (!isNaN(bestRes) && !isNaN(bestSup)) {
      mid = (bestRes + bestSup) / 2;
    } else if (!isNaN(bestRes)) {
      mid = bestRes - curAtr;
    } else if (!isNaN(bestSup)) {
      mid = bestSup + curAtr;
    } else {
      mid = (data[i].high + data[i].low + data[i].close) / 3;
    }

    if (isNaN(pulseEma)) {
      pulseEma = mid;
    } else {
      const structureShifting = (bestRes !== prevResistance) || (bestSup !== prevSupport);
      const effectiveAlpha = structureShifting ? alpha * 1.5 : alpha;
      pulseEma = effectiveAlpha * mid + (1 - effectiveAlpha) * pulseEma;
    }

    // --- Structure bias ---
    let bias = 0;
    if (!isNaN(pulseEma) && curAtr > 0) {
      const pricePos = (data[i].close - pulseEma) / curAtr;
      const priceBias = Math.max(-1, Math.min(1, pricePos * 0.5));
      const supDist = !isNaN(bestSup) ? (data[i].close - bestSup) / curAtr : 0;
      const resDist = !isNaN(bestRes) ? (bestRes - data[i].close) / curAtr : 0;
      const levelBias = resDist > 0 && supDist > 0
        ? Math.max(-1, Math.min(1, (supDist - resDist) / (supDist + resDist)))
        : 0;
      bias = (priceBias * 0.6 + levelBias * 0.4) * 100;
    }
    biasSmooth = biasSmooth * 0.8 + bias * 0.2;

    result.push({
      time: data[i].time,
      resistance: bestRes,
      support: bestSup,
      pulseLine: pulseEma,
      structureBias: Math.round(Math.max(-100, Math.min(100, biasSmooth))),
    });
  }

  return result;
}

// ============================================================================
// VORTEX DRIFT CLOUD - Adaptive trend channel with momentum coloring
// ============================================================================

export interface VortexDriftCloudData {
  time: number;
  upper: number;
  middle: number;
  lower: number;
  trend: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
}

export function calculateVortexDriftCloud(
  data: OHLCData[],
  smoothPeriod: number = 21,
  atrPeriod: number = 14,
  bandMultiplier: number = 2.0,
  adxPeriod: number = 14,
  adxThreshold: number = 25,
  momentumLookback: number = 10,
): VortexDriftCloudData[] {
  if (data.length < Math.max(smoothPeriod, atrPeriod, adxPeriod) + 10) return [];

  const result: VortexDriftCloudData[] = [];
  const closes = data.map((d) => d.close);

  // Ehlers 2-pole Super Smoother filter (near-zero lag)
  const angle = (Math.PI * Math.SQRT2) / smoothPeriod;
  const a1 = Math.exp(-angle);
  const coeff2 = 2 * a1 * Math.cos(angle);
  const coeff3 = -(a1 * a1);
  const coeff1 = 1 - coeff2 - coeff3;
  const ss: number[] = new Array(data.length).fill(0);
  ss[0] = closes[0];
  ss[1] = closes.length > 1 ? closes[1] : closes[0];
  for (let i = 2; i < data.length; i++) {
    ss[i] = coeff1 * (closes[i] + closes[i - 1]) / 2 + coeff2 * ss[i - 1] + coeff3 * ss[i - 2];
  }

  // ATR (exponential smoothing)
  const atr: number[] = new Array(data.length).fill(0);
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );
    if (i < atrPeriod) {
      atr[i] = atr[i - 1] + (tr - atr[i - 1]) / i;
    } else {
      atr[i] = atr[i - 1] + (tr - atr[i - 1]) * (2 / (atrPeriod + 1));
    }
  }

  // ADX (Wilder smoothing)
  const adx: number[] = new Array(data.length).fill(0);
  let sPlusDM = 0;
  let sMinusDM = 0;
  let sTR = 0;
  let adxEma = 0;

  for (let i = 1; i < data.length; i++) {
    const upMove = data[i].high - data[i - 1].high;
    const downMove = data[i - 1].low - data[i].low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );

    if (i <= adxPeriod) {
      sPlusDM += plusDM;
      sMinusDM += minusDM;
      sTR += tr;
      if (i === adxPeriod) {
        sPlusDM /= adxPeriod;
        sMinusDM /= adxPeriod;
        sTR /= adxPeriod;
      }
    } else {
      sPlusDM = sPlusDM - sPlusDM / adxPeriod + plusDM;
      sMinusDM = sMinusDM - sMinusDM / adxPeriod + minusDM;
      sTR = sTR - sTR / adxPeriod + tr;
    }

    if (i >= adxPeriod && sTR > 0) {
      const plusDI = (sPlusDM / sTR) * 100;
      const minusDI = (sMinusDM / sTR) * 100;
      const diSum = plusDI + minusDI;
      const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
      adxEma = adxEma === 0 ? dx : adxEma + (dx - adxEma) * (2 / (adxPeriod + 1));
      adx[i] = adxEma;
    }
  }

  // Build output: midline, adaptive bands, trend classification
  const startIdx = Math.max(smoothPeriod, atrPeriod, adxPeriod) + 2;
  for (let i = startIdx; i < data.length; i++) {
    const midline = ss[i];
    const adxWeight = 0.5 + 0.5 * Math.min(adx[i] / 50, 1);
    const bandWidth = atr[i] * bandMultiplier * adxWeight;

    const lookbackIdx = Math.max(0, i - momentumLookback);
    const midlineRising = midline > ss[lookbackIdx];
    const midlineFalling = midline < ss[lookbackIdx];

    let trend: "bullish" | "bearish" | "neutral" = "neutral";
    if (midlineRising && closes[i] > midline) trend = "bullish";
    else if (midlineFalling && closes[i] < midline) trend = "bearish";

    result.push({
      time: data[i].time,
      upper: midline + bandWidth,
      middle: midline,
      lower: midline - bandWidth,
      trend,
      strength: Math.round(Math.min(100, Math.max(0, (adx[i] / 50) * 100))),
    });
  }

  return result;
}

// ============================================================================
// ORION MOMENTUM SHIELD - Momentum-reactive overlay with EHMA and VNM bands
// ============================================================================

export interface OrionMomentumShieldData {
  time: number;
  upper: number;
  middle: number;
  lower: number;
  vnm: number;       // Volatility-Normalized Momentum (-100 to +100)
  phase: "surge" | "drift" | "fade"; // momentum phase
}

export function calculateOrionMomentumShield(
  data: OHLCData[],
  hmaPeriod: number = 16,
  atrPeriod: number = 14,
  bandMultiplier: number = 1.8,
  momentumPeriod: number = 12,
  surgeThreshold: number = 40,
  fadeSmooth: number = 5,
): OrionMomentumShieldData[] {
  const minBars = Math.max(hmaPeriod * 2, atrPeriod, momentumPeriod) + fadeSmooth + 5;
  if (data.length < minBars) return [];

  const closes = data.map((d) => d.close);
  const len = data.length;

  // --- EMA helper ---
  const ema = (src: number[], period: number): number[] => {
    const out = new Array(len).fill(NaN);
    const k = 2 / (period + 1);
    let acc = 0;
    let cnt = 0;
    for (let i = 0; i < len; i++) {
      if (isNaN(src[i])) continue;
      if (isNaN(out[i - 1] ?? NaN) || cnt < period) {
        acc += src[i];
        cnt++;
        out[i] = acc / cnt;
      } else {
        out[i] = src[i] * k + out[i - 1] * (1 - k);
      }
    }
    return out;
  };

  // --- WMA helper ---
  const wma = (src: number[], period: number): number[] => {
    const out = new Array(len).fill(NaN);
    const denom = (period * (period + 1)) / 2;
    for (let i = period - 1; i < len; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += src[i - period + 1 + j] * (j + 1);
      }
      out[i] = sum / denom;
    }
    return out;
  };

  // --- EHMA: Exponential Hull Moving Average ---
  // EHMA = WMA(2*EMA(N/2) - EMA(N), sqrt(N))
  const halfPeriod = Math.max(2, Math.round(hmaPeriod / 2));
  const sqrtPeriod = Math.max(2, Math.round(Math.sqrt(hmaPeriod)));
  const emaHalf = ema(closes, halfPeriod);
  const emaFull = ema(closes, hmaPeriod);
  const diff: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(emaHalf[i]) && !isNaN(emaFull[i])) {
      diff[i] = 2 * emaHalf[i] - emaFull[i];
    }
  }
  const ehma = wma(diff, sqrtPeriod);

  // --- ATR ---
  const atr: number[] = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    );
    atr[i] = i < atrPeriod
      ? atr[i - 1] + (tr - atr[i - 1]) / i
      : atr[i - 1] + (tr - atr[i - 1]) * (2 / (atrPeriod + 1));
  }

  // --- Volatility-Normalized Momentum (VNM) ---
  // Raw momentum (ROC) normalized by ATR → scale roughly -100 to +100
  const vnmRaw: number[] = new Array(len).fill(0);
  for (let i = momentumPeriod; i < len; i++) {
    const roc = closes[i] - closes[i - momentumPeriod];
    vnmRaw[i] = atr[i] > 0 ? (roc / atr[i]) * 20 : 0;
    vnmRaw[i] = Math.max(-100, Math.min(100, vnmRaw[i]));
  }

  // Smooth VNM
  const vnm = ema(vnmRaw, fadeSmooth);

  // --- Build output ---
  const result: OrionMomentumShieldData[] = [];
  const startIdx = minBars;

  for (let i = startIdx; i < len; i++) {
    if (isNaN(ehma[i]) || atr[i] === 0) continue;

    const midline = ehma[i];
    const momentumAbs = Math.abs(vnm[i] || 0);
    const expansionFactor = 1 + (momentumAbs / 100) * 0.8;
    const bandWidth = atr[i] * bandMultiplier * expansionFactor;

    let phase: "surge" | "drift" | "fade" = "drift";
    if (momentumAbs >= surgeThreshold) phase = "surge";
    else if (momentumAbs < surgeThreshold * 0.4) phase = "fade";

    result.push({
      time: data[i].time,
      upper: midline + bandWidth,
      middle: midline,
      lower: midline - bandWidth,
      vnm: Math.round(vnm[i] || 0),
      phase,
    });
  }

  return result;
}
