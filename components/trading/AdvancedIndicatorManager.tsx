"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Activity,
  X,
  Search,
  TrendingUp,
  BarChart3,
  Settings,
  Palette,
  Layers,
  Check,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomIndicator {
  id: string;
  type: string;
  name: string;
  displayType: "overlay" | "oscillator";
  enabled: boolean;
  color: string;
  lineWidth: number;
  lineStyle: number;
  parameters: Record<string, number>;
  opacity?: number;
  customLabel?: string;
  priceSource?: "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4";
  offset?: number;
  precision?: number;
  showLabel?: boolean;
  colors?: {
    upper?: string;
    middle?: string;
    lower?: string;
    signal?: string;
    histogram?: string;
    positive?: string;
    negative?: string;
  };
  levels?: {
    overbought?: number;
    oversold?: number;
    threshold?: number;
  };
  visibility?: {
    main?: boolean;
    signal?: boolean;
    histogram?: boolean;
    upper?: boolean;
    middle?: boolean;
    lower?: boolean;
  };
  // Per-component color overrides (key → hex color string)
  componentColors?: Record<string, string>;
  // Per-component visibility overrides (key → boolean)
  componentVisibility?: Record<string, boolean>;
}

export const INDICATOR_TEMPLATES = {
  // Moving Averages
  sma: {
    name: "Simple Moving Average",
    shortName: "SMA",
    displayType: "overlay" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  ema: {
    name: "Exponential Moving Average",
    shortName: "EMA",
    displayType: "overlay" as const,
    defaultParams: { period: 12 },
    paramLabels: { period: "Period" },
  },
  wma: {
    name: "Weighted Moving Average",
    shortName: "WMA",
    displayType: "overlay" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  dema: {
    name: "Double Exponential Moving Average",
    shortName: "DEMA",
    displayType: "overlay" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  tema: {
    name: "Triple Exponential Moving Average",
    shortName: "TEMA",
    displayType: "overlay" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  hma: {
    name: "Hull Moving Average",
    shortName: "HMA",
    displayType: "overlay" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  alma: { name: "Arnaud Legoux MA", shortName: "ALMA", displayType: "overlay" as const, defaultParams: { period: 20, offset: 0.85, sigma: 6 }, paramLabels: { period: "Period", offset: "Offset", sigma: "Sigma" } },
  kama: { name: "Kaufman Adaptive MA", shortName: "KAMA", displayType: "overlay" as const, defaultParams: { period: 10 }, paramLabels: { period: "Period" } },
  zlema: { name: "Zero-Lag EMA", shortName: "ZLEMA", displayType: "overlay" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  t3: { name: "Tillson T3", shortName: "T3", displayType: "overlay" as const, defaultParams: { period: 5, vFactor: 0.7 }, paramLabels: { period: "Period", vFactor: "Volume Factor" } },
  smma: { name: "Smoothed MA", shortName: "SMMA", displayType: "overlay" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  lsma: { name: "Least Squares MA", shortName: "LSMA", displayType: "overlay" as const, defaultParams: { period: 25 }, paramLabels: { period: "Period" } },
  vidya: { name: "Variable Index Dynamic Avg", shortName: "VIDYA", displayType: "overlay" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  mcginley: { name: "McGinley Dynamic", shortName: "McGinley", displayType: "overlay" as const, defaultParams: { period: 14 }, paramLabels: { period: "Period" } },
  vwma: { name: "Volume Weighted MA", shortName: "VWMA", displayType: "overlay" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },

  // Bands
  bb: {
    name: "Bollinger Bands",
    shortName: "BB",
    displayType: "overlay" as const,
    defaultParams: { period: 20, stdDev: 2 },
    paramLabels: { period: "Period", stdDev: "Std Dev" },
  },
  keltner: {
    name: "Keltner Channels",
    shortName: "KC",
    displayType: "overlay" as const,
    defaultParams: { period: 20, multiplier: 2 },
    paramLabels: { period: "Period", multiplier: "Multiplier" },
  },
  donchian: {
    name: "Donchian Channel",
    shortName: "DC",
    displayType: "overlay" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  ichimoku: {
    name: "Ichimoku Cloud",
    shortName: "Ichimoku",
    displayType: "overlay" as const,
    defaultParams: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 },
    paramLabels: { tenkanPeriod: "Tenkan", kijunPeriod: "Kijun", senkouBPeriod: "Senkou B" },
  },
  linreg_channel: { name: "Linear Regression Channel", shortName: "LinReg", displayType: "overlay" as const, defaultParams: { period: 100, deviations: 2 }, paramLabels: { period: "Period", deviations: "Deviations" } },
  ma_envelope: { name: "Moving Average Envelope", shortName: "Envelope", displayType: "overlay" as const, defaultParams: { period: 20, percentage: 2.5 }, paramLabels: { period: "Period", percentage: "Percentage" } },
  price_channel: { name: "Price Channel", shortName: "PC", displayType: "overlay" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  chandelier: { name: "Chandelier Exit", shortName: "ChanExit", displayType: "overlay" as const, defaultParams: { period: 22, multiplier: 3 }, paramLabels: { period: "Period", multiplier: "Multiplier" } },
  supertrend: { name: "Supertrend", shortName: "ST", displayType: "overlay" as const, defaultParams: { period: 10, multiplier: 3 }, paramLabels: { period: "Period", multiplier: "Multiplier" } },

  // Oscillators
  rsi: {
    name: "Relative Strength Index",
    shortName: "RSI",
    displayType: "oscillator" as const,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
  },
  macd: {
    name: "MACD",
    shortName: "MACD",
    displayType: "oscillator" as const,
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramLabels: { fast: "Fast", slow: "Slow", signal: "Signal" },
  },
  stoch: {
    name: "Stochastic",
    shortName: "Stoch",
    displayType: "oscillator" as const,
    defaultParams: { kPeriod: 14, dPeriod: 3 },
    paramLabels: { kPeriod: "%K", dPeriod: "%D" },
  },
  williamsR: {
    name: "Williams %R",
    shortName: "W%R",
    displayType: "oscillator" as const,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
  },
  cci: {
    name: "Commodity Channel Index",
    shortName: "CCI",
    displayType: "oscillator" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  mfi: {
    name: "Money Flow Index",
    shortName: "MFI",
    displayType: "oscillator" as const,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
  },
  adx: {
    name: "Average Directional Index",
    shortName: "ADX",
    displayType: "oscillator" as const,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
  },

  // Other
  vwap: {
    name: "VWAP",
    shortName: "VWAP",
    displayType: "overlay" as const,
    defaultParams: {},
    paramLabels: {},
  },
  atr: {
    name: "Average True Range",
    shortName: "ATR",
    displayType: "oscillator" as const,
    defaultParams: { period: 14 },
    paramLabels: { period: "Period" },
  },
  obv: {
    name: "On Balance Volume",
    shortName: "OBV",
    displayType: "oscillator" as const,
    defaultParams: {},
    paramLabels: {},
  },
  roc: {
    name: "Rate of Change",
    shortName: "ROC",
    displayType: "oscillator" as const,
    defaultParams: { period: 12 },
    paramLabels: { period: "Period" },
  },
  cmf: {
    name: "Chaikin Money Flow",
    shortName: "CMF",
    displayType: "oscillator" as const,
    defaultParams: { period: 20 },
    paramLabels: { period: "Period" },
  },
  momentum: {
    name: "Momentum",
    shortName: "MOM",
    displayType: "oscillator" as const,
    defaultParams: { period: 10 },
    paramLabels: { period: "Period" },
  },
  // Trend oscillators
  aroon: { name: "Aroon", shortName: "Aroon", displayType: "oscillator" as const, defaultParams: { period: 25 }, paramLabels: { period: "Period" } },
  vortex: { name: "Vortex Indicator", shortName: "VI", displayType: "oscillator" as const, defaultParams: { period: 14 }, paramLabels: { period: "Period" } },
  trix: { name: "TRIX", shortName: "TRIX", displayType: "oscillator" as const, defaultParams: { period: 15 }, paramLabels: { period: "Period" } },
  dpo: { name: "Detrended Price Osc", shortName: "DPO", displayType: "oscillator" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  kst: { name: "Know Sure Thing", shortName: "KST", displayType: "oscillator" as const, defaultParams: {}, paramLabels: {} },
  coppock: { name: "Coppock Curve", shortName: "Coppock", displayType: "oscillator" as const, defaultParams: { wmaPeriod: 10, longROC: 14, shortROC: 11 }, paramLabels: { wmaPeriod: "WMA Period", longROC: "Long ROC", shortROC: "Short ROC" } },
  elder_ray: { name: "Elder Ray", shortName: "ElderRay", displayType: "oscillator" as const, defaultParams: { period: 13 }, paramLabels: { period: "Period" } },
  // Volatility oscillators
  std_dev: { name: "Standard Deviation", shortName: "StdDev", displayType: "oscillator" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  hist_volatility: { name: "Historical Volatility", shortName: "HV", displayType: "oscillator" as const, defaultParams: { period: 20 }, paramLabels: { period: "Period" } },
  chaikin_volatility: { name: "Chaikin Volatility", shortName: "ChkVol", displayType: "oscillator" as const, defaultParams: { emaPeriod: 10, rocPeriod: 10 }, paramLabels: { emaPeriod: "EMA Period", rocPeriod: "ROC Period" } },
  mass_index: { name: "Mass Index", shortName: "MI", displayType: "oscillator" as const, defaultParams: { emaPeriod: 9, sumPeriod: 25 }, paramLabels: { emaPeriod: "EMA Period", sumPeriod: "Sum Period" } },
  ulcer_index: { name: "Ulcer Index", shortName: "UI", displayType: "oscillator" as const, defaultParams: { period: 14 }, paramLabels: { period: "Period" } },
  rvi: { name: "Relative Volatility Index", shortName: "RVI", displayType: "oscillator" as const, defaultParams: { period: 10 }, paramLabels: { period: "Period" } },
  // Volume oscillators
  ad_line: { name: "Accum/Distribution Line", shortName: "A/D", displayType: "oscillator" as const, defaultParams: {}, paramLabels: {} },
  force_index: { name: "Force Index", shortName: "FI", displayType: "oscillator" as const, defaultParams: { period: 13 }, paramLabels: { period: "Period" } },
  eom: { name: "Ease of Movement", shortName: "EOM", displayType: "oscillator" as const, defaultParams: { period: 14 }, paramLabels: { period: "Period" } },
  nvi: { name: "Negative Volume Index", shortName: "NVI", displayType: "oscillator" as const, defaultParams: {}, paramLabels: {} },
  pvi: { name: "Positive Volume Index", shortName: "PVI", displayType: "oscillator" as const, defaultParams: {}, paramLabels: {} },
  // Advanced oscillators
  ultimate_osc: { name: "Ultimate Oscillator", shortName: "UO", displayType: "oscillator" as const, defaultParams: { period1: 7, period2: 14, period3: 28 }, paramLabels: { period1: "Fast", period2: "Mid", period3: "Slow" } },
  awesome_osc: { name: "Awesome Oscillator", shortName: "AO", displayType: "oscillator" as const, defaultParams: {}, paramLabels: {} },
  stochrsi: { name: "Stochastic RSI", shortName: "StochRSI", displayType: "oscillator" as const, defaultParams: { rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3 }, paramLabels: { rsiPeriod: "RSI Period", stochPeriod: "Stoch Period", kSmooth: "K Smooth", dSmooth: "D Smooth" } },
  tsi: { name: "True Strength Index", shortName: "TSI", displayType: "oscillator" as const, defaultParams: { longPeriod: 25, shortPeriod: 13 }, paramLabels: { longPeriod: "Long", shortPeriod: "Short" } },
  ppo: { name: "Percentage Price Osc", shortName: "PPO", displayType: "oscillator" as const, defaultParams: { fast: 12, slow: 26, signal: 9 }, paramLabels: { fast: "Fast", slow: "Slow", signal: "Signal" } },
  fisher: { name: "Fisher Transform", shortName: "Fisher", displayType: "oscillator" as const, defaultParams: { period: 9 }, paramLabels: { period: "Period" } },
  connors_rsi: { name: "Connors RSI", shortName: "CRSI", displayType: "oscillator" as const, defaultParams: { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 }, paramLabels: { rsiPeriod: "RSI", streakPeriod: "Streak", rocPeriod: "Rank" } },
  smi_ergodic: { name: "SMI Ergodic", shortName: "SMI", displayType: "oscillator" as const, defaultParams: { shortPeriod: 5, longPeriod: 20, signalPeriod: 5 }, paramLabels: { shortPeriod: "Short", longPeriod: "Long", signalPeriod: "Signal" } },
  sar: {
    name: "Parabolic SAR",
    shortName: "SAR",
    displayType: "overlay" as const,
    defaultParams: { acceleration: 0.02, maximum: 0.2 },
    paramLabels: { acceleration: "Acceleration", maximum: "Maximum" },
  },
  pivots: {
    name: "Pivot Points",
    shortName: "Pivots",
    displayType: "overlay" as const,
    defaultParams: {},
    paramLabels: {},
  },
  nexus_trend_matrix: {
    name: "Nexus Trend Matrix",
    shortName: "NTM",
    displayType: "overlay" as const,
    defaultParams: { period: 20, fastPeriod: 2, slowPeriod: 30, atrPeriod: 14, atrMultiplier: 2.0, trendSmoothPeriod: 10 },
    paramLabels: { period: "KAMA Period", fastPeriod: "Fast Period", slowPeriod: "Slow Period", atrPeriod: "ATR Period", atrMultiplier: "ATR Multiplier", trendSmoothPeriod: "Trend Smooth" },
  },
  phantom_flow_zones: {
    name: "Phantom Flow Zones",
    shortName: "PFZ",
    displayType: "overlay" as const,
    defaultParams: { period: 20, volumeThreshold: 1.5, wickThreshold: 0.6, zoneLookback: 50, smoothPeriod: 10 },
    paramLabels: { period: "Volume SMA Period", volumeThreshold: "Volume Threshold", wickThreshold: "Wick Threshold", zoneLookback: "Zone Lookback", smoothPeriod: "Flow Smooth Period" },
  },
  fractal_pulse_grid: {
    name: "Fractal Pulse Grid",
    shortName: "FPG",
    displayType: "overlay" as const,
    defaultParams: { period: 20, atrPeriod: 14, baseLookback: 3, maxAge: 100, smoothPeriod: 8, breakTolerance: 0.25 },
    paramLabels: { period: "Volatility Period", atrPeriod: "ATR Period", baseLookback: "Base Lookback", maxAge: "Max Level Age", smoothPeriod: "Pulse Smooth", breakTolerance: "Break Tolerance" },
  },
  vortex_drift_cloud: {
    name: "Vortex Drift Cloud",
    shortName: "VDC",
    displayType: "overlay" as const,
    defaultParams: { smoothPeriod: 21, atrPeriod: 14, bandMultiplier: 2.0, adxPeriod: 14, adxThreshold: 25, momentumLookback: 10 },
    paramLabels: { smoothPeriod: "Smoother Period", atrPeriod: "ATR Period", bandMultiplier: "Band Width", adxPeriod: "ADX Period", adxThreshold: "Trend Threshold", momentumLookback: "Momentum Lookback" },
  },
  orion_momentum_shield: {
    name: "Orion Momentum Shield",
    shortName: "OMS",
    displayType: "overlay" as const,
    defaultParams: { hmaPeriod: 16, atrPeriod: 14, bandMultiplier: 1.8, momentumPeriod: 12, surgeThreshold: 40, fadeSmooth: 5 },
    paramLabels: { hmaPeriod: "EHMA Period", atrPeriod: "ATR Period", bandMultiplier: "Band Width", momentumPeriod: "Momentum Period", surgeThreshold: "Surge Threshold", fadeSmooth: "Fade Smoothing" },
  },
  nebula_phase_bands: {
    name: "Nebula Phase Bands",
    shortName: "NPB",
    displayType: "overlay" as const,
    defaultParams: { kalmanGain: 0.05, entropyPeriod: 20, atrPeriod: 14, bandMultiplier: 2.0, phaseSmooth: 5 },
    paramLabels: { kalmanGain: "Kalman Gain", entropyPeriod: "Entropy Period", atrPeriod: "ATR Period", bandMultiplier: "Band Width", phaseSmooth: "Phase Smoothing" },
  },
  cipher_harmonic_veil: {
    name: "Cipher Harmonic Veil",
    shortName: "CHV",
    displayType: "overlay" as const,
    defaultParams: { maxCyclePeriod: 50, hurstPeriod: 100, atrPeriod: 14, bandMultiplier: 2.0, smooth: 5 },
    paramLabels: { maxCyclePeriod: "Max Cycle Period", hurstPeriod: "Hurst Window", atrPeriod: "ATR Period", bandMultiplier: "Band Width", smooth: "Smoothing" },
  },
  titan_pulse_signal: {
    name: "Titan Pulse Signal",
    shortName: "TPS",
    displayType: "overlay" as const,
    defaultParams: { kamaPeriod: 10, kamaFast: 2, kamaSlow: 30, atrPeriod: 14, atrMultiplier: 1.5, squeezeLookback: 20, signalThreshold: 40 },
    paramLabels: { kamaPeriod: "KAMA Period", kamaFast: "Fast SC", kamaSlow: "Slow SC", atrPeriod: "ATR Period", atrMultiplier: "ATR Multiplier", squeezeLookback: "Squeeze Lookback", signalThreshold: "Signal Threshold" },
  },
  aurora_cascade_flow: {
    name: "Aurora Cascade Flow",
    shortName: "ACF",
    displayType: "overlay" as const,
    defaultParams: { erPeriod: 10, fastSC: 2, slowMin: 10, slowMax: 40, smoothFactor: 3 },
    paramLabels: { erPeriod: "ER Period", fastSC: "Fast SC", slowMin: "Slow Min", slowMax: "Slow Max", smoothFactor: "Smooth Factor" },
  },
  eclipse_stealth_trail: {
    name: "Eclipse Stealth Trail",
    shortName: "EST",
    displayType: "overlay" as const,
    defaultParams: { mcgPeriod: 14, fdPeriod: 30, fdThreshold: 1.5, atrPeriod: 14, atrMultiplier: 1.8 },
    paramLabels: { mcgPeriod: "McGinley Period", fdPeriod: "Fractal Dim Period", fdThreshold: "FD Threshold", atrPeriod: "ATR Period", atrMultiplier: "ATR Multiplier" },
  },
  wraith_convergence_engine: {
    name: "Wraith Convergence Engine",
    shortName: "WCE",
    displayType: "overlay" as const,
    defaultParams: { period: 20, kamaFast: 2, kamaSlow: 30, convergenceThreshold: 70 },
    paramLabels: { period: "Period", kamaFast: "KAMA Fast", kamaSlow: "KAMA Slow", convergenceThreshold: "Conv. Threshold" },
  },
  flux_momentum_trail: {
    name: "Flux Momentum Trail",
    shortName: "FMT",
    displayType: "overlay" as const,
    defaultParams: { fastPeriod: 8, slowPeriod: 21, rocPeriod: 12, atrPeriod: 14, surgeThreshold: 70 },
    paramLabels: { fastPeriod: "Fast Period", slowPeriod: "Slow Period", rocPeriod: "ROC Period", atrPeriod: "ATR Period", surgeThreshold: "Surge Threshold" },
  },
  apex_predator_signal: {
    name: "Apex Predator Signal",
    shortName: "APS",
    displayType: "overlay" as const,
    defaultParams: { zlemaPeriod: 21, rocPeriod: 12, atrPeriod: 14, volPeriod: 20, minConfluence: 2 },
    paramLabels: { zlemaPeriod: "ZLEMA Period", rocPeriod: "ROC Period", atrPeriod: "ATR Period", volPeriod: "Volume Period", minConfluence: "Min Confluence" },
  },
  phantom_divergence_tracker: {
    name: "Phantom Divergence Tracker",
    shortName: "PDT",
    displayType: "overlay" as const,
    defaultParams: { smoothPeriod: 21, volPeriod: 20, atrPeriod: 14, divergenceThreshold: 60 },
    paramLabels: { smoothPeriod: "Smooth Period", volPeriod: "Vol. Period", atrPeriod: "ATR Period", divergenceThreshold: "Div. Threshold" },
  },
  chaos_sentinel: {
    name: "Chaos Sentinel",
    shortName: "CS",
    displayType: "overlay" as const,
    defaultParams: { attractorPeriod: 21, lyapunovPeriod: 14, smoothing: 5, chaosThreshold: 50 },
    paramLabels: { attractorPeriod: "Attractor Period", lyapunovPeriod: "Lyapunov Period", smoothing: "Smoothing", chaosThreshold: "Chaos Threshold" },
  },
  helix_phase_engine: {
    name: "Helix Phase Engine",
    shortName: "HPE",
    displayType: "overlay" as const,
    defaultParams: { detrendPeriod: 20, hilbertLength: 7, ampMultiplier: 1.5, velocitySmooth: 5, leadSensitivity: 55 },
    paramLabels: { detrendPeriod: "Detrend Period", hilbertLength: "Hilbert Length", ampMultiplier: "Amplitude Multiplier", velocitySmooth: "Velocity Smooth", leadSensitivity: "Lead Sensitivity" },
  },
  prism_wavelet_cascade: {
    name: "Prism Wavelet Cascade",
    shortName: "PWC",
    displayType: "overlay" as const,
    defaultParams: { waveletDepth: 3, smoothPeriod: 8, alignThreshold: 70, splitThreshold: 30 },
    paramLabels: { waveletDepth: "Wavelet Depth", smoothPeriod: "Smooth Period", alignThreshold: "Align Threshold", splitThreshold: "Split Threshold" },
  },
  mirage_depth_scanner: {
    name: "Mirage Depth Scanner",
    shortName: "MDS",
    displayType: "overlay" as const,
    defaultParams: { windowLength: 30, corridorMultiplier: 1.5, depthSmooth: 5, signalThreshold: 65 },
    paramLabels: { windowLength: "Window Length", corridorMultiplier: "Corridor Width", depthSmooth: "Depth Smooth", signalThreshold: "Signal Threshold" },
  },
  quantum_drift_mapper: {
    name: "Quantum Drift Mapper",
    shortName: "QDM",
    displayType: "overlay" as const,
    defaultParams: { dfaPeriod: 30, dfaScales: 5, corridorMultiplier: 1.5, smooth: 5, persistenceThreshold: 60 },
    paramLabels: { dfaPeriod: "DFA Period", dfaScales: "DFA Scales", corridorMultiplier: "Corridor Width", smooth: "Smoothing", persistenceThreshold: "Persistence Threshold" },
  },
  sovereign_gravity_arc: {
    name: "Sovereign Gravity Arc",
    shortName: "SGA",
    displayType: "overlay" as const,
    defaultParams: { gravityWindow: 30, orbitalRadius: 2.0, velocitySmooth: 5, escapeMultiplier: 1.8 },
    paramLabels: { gravityWindow: "Gravity Window", orbitalRadius: "Orbital Radius", velocitySmooth: "Velocity Smooth", escapeMultiplier: "Escape Multiplier" },
  },
  solaris_trend_engine: {
    name: "Solaris Trend Engine",
    shortName: "STE",
    displayType: "overlay" as const,
    defaultParams: { kamaFast: 2, kamaSlow: 30, atrPeriod: 14, supertrendMult: 3.0, adxPeriod: 14, adxThreshold: 25 },
    paramLabels: { kamaFast: "KAMA Fast", kamaSlow: "KAMA Slow", atrPeriod: "ATR Period", supertrendMult: "Supertrend Mult", adxPeriod: "ADX Period", adxThreshold: "ADX Threshold" },
  },
  stellar_confluence_ribbon: {
    name: "Stellar Confluence Ribbon",
    shortName: "SCR",
    displayType: "overlay" as const,
    defaultParams: { blendPeriod: 21, atrPeriod: 14, innerMult: 1.5, outerMult: 2.8, confluenceThreshold: 70, nodeThreshold: 80 },
    paramLabels: { blendPeriod: "Blend Period", atrPeriod: "ATR Period", innerMult: "Inner ATR Mult", outerMult: "Outer ATR Mult", confluenceThreshold: "Confluence Threshold", nodeThreshold: "Node Threshold" },
  },
  kinetic_pressure_zones: {
    name: "Kinetic Pressure Zones",
    shortName: "KPZ",
    displayType: "overlay" as const,
    defaultParams: { period: 14, rocPeriod: 10, atrPeriod: 14, zoneWidthMult: 1.2, oversoldLevel: 30, overboughtLevel: 70 },
    paramLabels: { period: "MA Period", rocPeriod: "ROC Period", atrPeriod: "ATR Period", zoneWidthMult: "Zone Width Mult", oversoldLevel: "Oversold Level", overboughtLevel: "Overbought Level" },
  },
  nova_resonance_field: {
    name: "Nova Resonance Field",
    shortName: "NRF",
    displayType: "overlay" as const,
    defaultParams: { period: 14, sensitivity: 2.0, signalPeriod: 9, novaThreshold: 70, divergenceLookback: 20 },
    paramLabels: { period: "Period", sensitivity: "Echo Sensitivity", signalPeriod: "Signal Period", novaThreshold: "Nova Threshold", divergenceLookback: "Divergence Lookback" },
  },
};

// ─── Per-indicator component style/visibility configuration ───────────────────
// Each entry lists the styleable color components and hideable series components
// for that indicator type. Used by IndicatorSettingsPanel to render dynamic controls.
export const INDICATOR_COMPONENT_CONFIG: Record<string, {
  colors: Array<{ key: string; label: string; default: string }>;
  visibility: Array<{ key: string; label: string }>;
}> = {
  // ── Built-in channel indicators ────────────────────────────────────────────
  bb: {
    colors: [
      { key: "upper", label: "Upper Band", default: "#f23645" },
      { key: "middle", label: "Middle Band", default: "#2962ff" },
      { key: "lower", label: "Lower Band", default: "#00e676" },
    ],
    visibility: [
      { key: "upper", label: "Upper Band" },
      { key: "middle", label: "Middle Band" },
      { key: "lower", label: "Lower Band" },
    ],
  },
  keltner: {
    colors: [
      { key: "upper", label: "Upper Band", default: "#f23645" },
      { key: "middle", label: "Middle Band", default: "#2962ff" },
      { key: "lower", label: "Lower Band", default: "#00e676" },
    ],
    visibility: [
      { key: "upper", label: "Upper Band" },
      { key: "middle", label: "Middle Band" },
      { key: "lower", label: "Lower Band" },
    ],
  },
  macd: {
    colors: [
      { key: "macdLine", label: "MACD Line", default: "#2962ff" },
      { key: "signalLine", label: "Signal Line", default: "#f23645" },
      { key: "histPositive", label: "Histogram Positive", default: "#26a69a" },
      { key: "histNegative", label: "Histogram Negative", default: "#ef5350" },
    ],
    visibility: [
      { key: "macdLine", label: "MACD Line" },
      { key: "signalLine", label: "Signal Line" },
      { key: "histogram", label: "Histogram" },
    ],
  },
  // ── Premium band indicators ────────────────────────────────────────────────
  vortex_drift_cloud: {
    colors: [
      { key: "upper", label: "Upper Band", default: "#22d3ee" },
      { key: "middle", label: "Core Line", default: "#22d3ee" },
      { key: "lower", label: "Lower Band", default: "#f97316" },
    ],
    visibility: [
      { key: "upper", label: "Upper Band" },
      { key: "middle", label: "Core Line" },
      { key: "lower", label: "Lower Band" },
    ],
  },
  orion_momentum_shield: {
    colors: [
      { key: "upper", label: "Upper Shield", default: "#34d399" },
      { key: "middle", label: "Core Line", default: "#a78bfa" },
      { key: "lower", label: "Lower Shield", default: "#fb923c" },
    ],
    visibility: [
      { key: "upper", label: "Upper Shield" },
      { key: "middle", label: "Core Line" },
      { key: "lower", label: "Lower Shield" },
    ],
  },
  nebula_phase_bands: {
    colors: [
      { key: "upper", label: "Upper Band", default: "#67e8f9" },
      { key: "middle", label: "Core Phase Line", default: "#06b6d4" },
      { key: "lower", label: "Lower Band", default: "#818cf8" },
    ],
    visibility: [
      { key: "upper", label: "Upper Band" },
      { key: "middle", label: "Core Phase Line" },
      { key: "lower", label: "Lower Band" },
    ],
  },
  cipher_harmonic_veil: {
    colors: [
      { key: "upper", label: "Upper Veil", default: "#60a5fa" },
      { key: "middle", label: "Core Harmonic", default: "#3b82f6" },
      { key: "lower", label: "Lower Veil", default: "#f97316" },
    ],
    visibility: [
      { key: "upper", label: "Upper Veil" },
      { key: "middle", label: "Core Harmonic" },
      { key: "lower", label: "Lower Veil" },
    ],
  },
  fractal_pulse_grid: {
    colors: [
      { key: "upper", label: "Resistance", default: "#f44336" },
      { key: "middle", label: "Pulse Line", default: "#ffc107" },
      { key: "lower", label: "Support", default: "#4caf50" },
    ],
    visibility: [
      { key: "upper", label: "Resistance" },
      { key: "middle", label: "Pulse Line" },
      { key: "lower", label: "Support" },
    ],
  },
  nexus_trend_matrix: {
    colors: [
      { key: "upper", label: "Upper Channel", default: "#9e9e9e" },
      { key: "core", label: "Core Trend Line", default: "#06b6d4" },
      { key: "lower", label: "Lower Channel", default: "#9e9e9e" },
    ],
    visibility: [
      { key: "upper", label: "Upper Channel" },
      { key: "core", label: "Core Trend Line" },
      { key: "lower", label: "Lower Channel" },
      { key: "signals", label: "BULL/BEAR Signals" },
    ],
  },
  phantom_flow_zones: {
    colors: [
      { key: "supply", label: "Supply Zone", default: "#e040fb" },
      { key: "flow", label: "Flow Line", default: "#00bcd4" },
      { key: "demand", label: "Demand Zone", default: "#00e5ff" },
    ],
    visibility: [
      { key: "upper", label: "Supply Zone" },
      { key: "middle", label: "Flow Line" },
      { key: "lower", label: "Demand Zone" },
      { key: "signals", label: "SUPPLY/DEMAND Signals" },
    ],
  },
  // ── Premium signal indicators ──────────────────────────────────────────────
  titan_pulse_signal: {
    colors: [
      { key: "bull", label: "Bullish Line", default: "#22c55e" },
      { key: "bear", label: "Bearish Line", default: "#ef4444" },
    ],
    visibility: [
      { key: "bull", label: "Bullish Line" },
      { key: "bear", label: "Bearish Line" },
      { key: "signals", label: "BUY/SELL Signals" },
    ],
  },
  aurora_cascade_flow: {
    colors: [
      { key: "l1", label: "Layer 1 — Fastest", default: "#22d3ee" },
      { key: "l2", label: "Layer 2", default: "#06b6d4" },
      { key: "l3", label: "Layer 3 — Core", default: "#0891b2" },
      { key: "l4", label: "Layer 4", default: "#0e7490" },
      { key: "l5", label: "Layer 5 — Slowest", default: "#155e75" },
    ],
    visibility: [
      { key: "l1", label: "Layer 1 (Fastest)" },
      { key: "l2", label: "Layer 2" },
      { key: "l3", label: "Layer 3 (Core)" },
      { key: "l4", label: "Layer 4" },
      { key: "l5", label: "Layer 5 (Slowest)" },
    ],
  },
  eclipse_stealth_trail: {
    colors: [
      { key: "shadow", label: "Shadow Trail", default: "#64748b" },
      { key: "bull", label: "Bull Trail", default: "#22c55e" },
      { key: "bear", label: "Bear Trail", default: "#ef4444" },
    ],
    visibility: [
      { key: "shadow", label: "Shadow Trail" },
      { key: "bull", label: "Bull Trail" },
      { key: "bear", label: "Bear Trail" },
      { key: "signals", label: "Flip/Breakout Signals" },
    ],
  },
  wraith_convergence_engine: {
    colors: [
      { key: "bull", label: "Bull Consensus", default: "#22c55e" },
      { key: "bear", label: "Bear Consensus", default: "#ef4444" },
    ],
    visibility: [
      { key: "bull", label: "Bull Consensus" },
      { key: "bear", label: "Bear Consensus" },
      { key: "signals", label: "CONV/DIV Signals" },
    ],
  },
  flux_momentum_trail: {
    colors: [
      { key: "trail", label: "Momentum Trail", default: "#94a3b8" },
    ],
    visibility: [
      { key: "trail", label: "Momentum Trail" },
      { key: "signals", label: "SURGE/FADE Signals" },
    ],
  },
  apex_predator_signal: {
    colors: [
      { key: "bull", label: "Bull Line", default: "#22c55e" },
      { key: "bear", label: "Bear Line", default: "#ef4444" },
    ],
    visibility: [
      { key: "bull", label: "Bull Line" },
      { key: "bear", label: "Bear Line" },
      { key: "signals", label: "APEX/STALK Signals" },
    ],
  },
  phantom_divergence_tracker: {
    colors: [
      { key: "price", label: "Price Line", default: "#06b6d4" },
      { key: "momentum", label: "Momentum Line", default: "#a78bfa" },
    ],
    visibility: [
      { key: "price", label: "Price Line" },
      { key: "momentum", label: "Momentum Line" },
      { key: "signals", label: "DIV/SYNC Signals" },
    ],
  },
  chaos_sentinel: {
    colors: [
      { key: "order", label: "Order Phase", default: "#3b82f6" },
      { key: "chaos", label: "Chaos Phase", default: "#ef4444" },
      { key: "transition", label: "Transition Phase", default: "#94a3b8" },
    ],
    visibility: [
      { key: "order", label: "Order Phase" },
      { key: "chaos", label: "Chaos Phase" },
      { key: "transition", label: "Transition Phase" },
      { key: "signals", label: "ORDER/CHAOS Signals" },
    ],
  },
  helix_phase_engine: {
    colors: [
      { key: "envelope", label: "Amplitude Envelope", default: "#78909c" },
      { key: "core", label: "Phase Lead Line", default: "#00e5ff" },
    ],
    visibility: [
      { key: "envelope", label: "Amplitude Envelope" },
      { key: "core", label: "Phase Lead Line" },
      { key: "signals", label: "LEAD/SYNC Signals" },
    ],
  },
  prism_wavelet_cascade: {
    colors: [
      { key: "d1", label: "Fast Layer (D1)", default: "#00e5ff" },
      { key: "d2", label: "Medium Layer (D2)", default: "#2979ff" },
      { key: "d3", label: "Slow Layer (D3)", default: "#7c4dff" },
      { key: "a3", label: "Trend Layer (A3)", default: "#e040fb" },
    ],
    visibility: [
      { key: "d1", label: "Fast Layer (D1)" },
      { key: "d2", label: "Medium Layer (D2)" },
      { key: "d3", label: "Slow Layer (D3)" },
      { key: "a3", label: "Trend Layer (A3)" },
      { key: "signals", label: "ALIGN/SPLIT Signals" },
    ],
  },
  mirage_depth_scanner: {
    colors: [
      { key: "corridor", label: "Depth Corridor", default: "#9e9e9e" },
      { key: "trend", label: "Trend Depth Line", default: "#ffd740" },
    ],
    visibility: [
      { key: "upper", label: "Upper Corridor" },
      { key: "trend", label: "Trend Line" },
      { key: "lower", label: "Lower Corridor" },
      { key: "signals", label: "EMERGE/SUBMERGE Signals" },
    ],
  },
  quantum_drift_mapper: {
    colors: [
      { key: "corridor", label: "Drift Corridor", default: "#b0bec5" },
      { key: "drift", label: "Drift Line", default: "#00e5ff" },
    ],
    visibility: [
      { key: "upper", label: "Upper Corridor" },
      { key: "drift", label: "Drift Line" },
      { key: "lower", label: "Lower Corridor" },
      { key: "signals", label: "DRIFT/SNAP Signals" },
    ],
  },
  sovereign_gravity_arc: {
    colors: [
      { key: "arcs", label: "Orbital Arcs", default: "#7b1fa2" },
      { key: "center", label: "Gravity Center", default: "#9c27b0" },
    ],
    visibility: [
      { key: "upper", label: "Upper Arc" },
      { key: "center", label: "Gravity Arc" },
      { key: "lower", label: "Lower Arc" },
      { key: "signals", label: "ESCAPE/ORBIT Signals" },
    ],
  },
  solaris_trend_engine: {
    colors: [
      { key: "core", label: "Solar Core (KAMA)", default: "#ffd700" },
      { key: "upperBand", label: "Upper Supertrend", default: "#ef5350" },
      { key: "lowerBand", label: "Lower Supertrend", default: "#26a69a" },
      { key: "sar", label: "SAR Dots", default: "#ce93d8" },
    ],
    visibility: [
      { key: "core", label: "Solar Core Line" },
      { key: "upper", label: "Upper Band" },
      { key: "lower", label: "Lower Band" },
      { key: "sar", label: "SAR Dots" },
      { key: "signals", label: "FUSION Signals" },
    ],
  },
  stellar_confluence_ribbon: {
    colors: [
      { key: "outerArc", label: "Outer Arcs", default: "#90a4ae" },
      { key: "innerRibbon", label: "Inner Ribbon", default: "#00f0ff" },
      { key: "core", label: "Core Blend Line", default: "#00f0ff" },
    ],
    visibility: [
      { key: "outerArcs", label: "Outer Arcs" },
      { key: "innerRibbon", label: "Inner Ribbon" },
      { key: "core", label: "Core Blend Line" },
      { key: "signals", label: "STELLAR/NODE Signals" },
    ],
  },
  kinetic_pressure_zones: {
    colors: [
      { key: "spine", label: "Kinetic Spine", default: "#00e5ff" },
      { key: "supply1", label: "Supply Zone 1", default: "#7c4dff" },
      { key: "supply2", label: "Supply Zone 2", default: "#b388ff" },
      { key: "demand1", label: "Demand Zone 1", default: "#00e5ff" },
      { key: "demand2", label: "Demand Zone 2", default: "#00bcd4" },
    ],
    visibility: [
      { key: "spine", label: "Kinetic Spine" },
      { key: "supply1", label: "Supply Zone 1" },
      { key: "supply2", label: "Supply Zone 2" },
      { key: "demand1", label: "Demand Zone 1" },
      { key: "demand2", label: "Demand Zone 2" },
      { key: "signals", label: "KINETIC Signals" },
    ],
  },
  nova_resonance_field: {
    colors: [
      { key: "priceRef", label: "Price Reference", default: "#546e7a" },
      { key: "signalLine", label: "Signal Line", default: "#78909c" },
      { key: "echoLine", label: "Echo Line", default: "#ff9800" },
    ],
    visibility: [
      { key: "priceRef", label: "Price Reference" },
      { key: "signalLine", label: "Signal Line" },
      { key: "echoLine", label: "Echo Line" },
      { key: "signals", label: "NOVA/ECHO/DIV Signals" },
    ],
  },
};

const DEFAULT_COLORS = [
  "#2962ff",
  "#f23645",
  "#00e676",
  "#ff6d00",
  "#9c27b0",
  "#fdd835",
  "#00bcd4",
  "#ff4081",
  "#8bc34a",
  "#ff9800",
];

// Categories for left sidebar
const CATEGORIES = [
  { id: "technicals", name: "Technicals", icon: TrendingUp },
  { id: "oscillators", name: "Oscillators", icon: Activity },
  { id: "volume", name: "Volume", icon: BarChart3 },
];

// Group indicators by category
const INDICATOR_GROUPS = {
  technicals: ["sma", "ema", "wma", "bb", "keltner", "vwap", "sar", "pivots"],
  oscillators: ["rsi", "macd", "stoch", "williamsR", "cci", "adx", "atr"],
  volume: ["mfi"],
};

interface AdvancedIndicatorManagerProps {
  indicators: CustomIndicator[];
  onIndicatorsChange: (indicators: CustomIndicator[]) => void;
  portalContainer?: HTMLElement | null;
}

export default function AdvancedIndicatorManager({
  indicators,
  onIndicatorsChange,
  portalContainer,
}: AdvancedIndicatorManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("technicals");
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"indicators" | "active">(
    "indicators",
  );

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset position when opening
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
      setSearchQuery("");
      setSelectedIndicator(null);
    }
  }, [open]);

  // Handle dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".dialog-header")) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          posX: position.x,
          posY: position.y,
        };
        e.preventDefault();
      }
    },
    [position],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: dragStartRef.current.posX + (e.clientX - dragStartRef.current.x),
          y: dragStartRef.current.posY + (e.clientY - dragStartRef.current.y),
        });
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Filter indicators based on search and category
  const filteredIndicators = Object.entries(INDICATOR_TEMPLATES).filter(
    ([key, template]) => {
      const matchesSearch =
        searchQuery === "" ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.shortName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        INDICATOR_GROUPS[
          selectedCategory as keyof typeof INDICATOR_GROUPS
        ]?.includes(key);
      return matchesSearch && (searchQuery !== "" || matchesCategory);
    },
  );

  const addIndicator = (type: string) => {
    const template =
      INDICATOR_TEMPLATES[type as keyof typeof INDICATOR_TEMPLATES];
    if (!template) return;

    const colorIndex = indicators.length % DEFAULT_COLORS.length;
    const newIndicator: CustomIndicator = {
      id: `${type}_${Date.now()}`,
      type,
      name: template.name,
      displayType: template.displayType,
      enabled: true,
      color: DEFAULT_COLORS[colorIndex],
      lineWidth: 2,
      lineStyle: 0,
      parameters: { ...template.defaultParams },
      opacity: 100,
      priceSource: "close",
      offset: 0,
      precision: 5,
      showLabel: true,
      colors: {
        upper: "#f23645",
        middle: DEFAULT_COLORS[colorIndex],
        lower: "#00e676",
        signal: "#f23645",
        histogram: "#26a69a",
        positive: "#26a69a",
        negative: "#ef5350",
      },
      levels:
        type === "rsi" || type === "mfi"
          ? { overbought: 70, oversold: 30 }
          : type === "williamsR"
            ? { overbought: -20, oversold: -80 }
            : type === "cci"
              ? { overbought: 100, oversold: -100 }
              : type === "adx"
                ? { threshold: 25 }
                : undefined,
      visibility: {
        main: true,
        signal: true,
        histogram: true,
        upper: true,
        middle: true,
        lower: true,
      },
      // Initialize per-component colors from INDICATOR_COMPONENT_CONFIG defaults
      componentColors: (() => {
        const cfg = INDICATOR_COMPONENT_CONFIG[type];
        if (!cfg) return {};
        return Object.fromEntries(cfg.colors.map((c) => [c.key, c.default]));
      })(),
      // Initialize per-component visibility — all visible by default
      componentVisibility: (() => {
        const cfg = INDICATOR_COMPONENT_CONFIG[type];
        if (!cfg) return {};
        return Object.fromEntries(cfg.visibility.map((v) => [v.key, true]));
      })(),
    };

    onIndicatorsChange([...indicators, newIndicator]);
    // Stay in the current list view so the user can continue adding more indicators.
    // The newly added indicator gets a checkmark. They can click "My Indicators" to manage settings.
  };

  const removeIndicator = (id: string) => {
    onIndicatorsChange(indicators.filter((ind) => ind.id !== id));
    if (selectedIndicator === id) setSelectedIndicator(null);
  };

  const toggleIndicator = (id: string) => {
    onIndicatorsChange(
      indicators.map((ind) =>
        ind.id === id ? { ...ind, enabled: !ind.enabled } : ind,
      ),
    );
  };

  const updateIndicator = (id: string, updates: Partial<CustomIndicator>) => {
    onIndicatorsChange(
      indicators.map((ind) => (ind.id === id ? { ...ind, ...updates } : ind)),
    );
  };

  const isIndicatorAdded = (type: string) =>
    indicators.some((ind) => ind.type === type);
  const enabledCount = indicators.filter((ind) => ind.enabled).length;
  const selectedIndicatorData = selectedIndicator
    ? indicators.find((ind) => ind.id === selectedIndicator)
    : null;

  return (
    <>
      {/* Trigger Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="hover:bg-[#2a2e39] relative h-[34px] w-[34px] p-0 text-[#787b86]"
        title={`Indicators${enabledCount > 0 ? ` (${enabledCount} active)` : ""}`}
      >
        <Activity className="h-[18px] w-[18px]" />
        {enabledCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-[#2962ff] rounded-full text-[8px] flex items-center justify-center text-white font-bold">
            {enabledCount}
          </span>
        )}
      </Button>

      {/* Modal Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-[9998]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Modal Dialog - TradingView Style */}
      {open && (
        <div
          ref={dialogRef}
          className="fixed z-[9999] bg-[#1e222d] border border-[#363a45] rounded-lg shadow-2xl overflow-hidden"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
            width: "720px",
            maxWidth: "90vw",
            height: "560px",
            maxHeight: "85vh",
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Header - Draggable */}
          <div className="dialog-header flex items-center justify-between px-5 py-3 border-b border-[#363a45] cursor-move select-none bg-[#1e222d]">
            <h2 className="text-[15px] font-medium text-white">
              Indicators, metrics, and strategies
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#363a45] text-[#787B86] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-5 py-3 border-b border-[#363a45]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787B86]" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value) {
                    setActiveTab("indicators");
                    setSelectedIndicator(null);
                  }
                }}
                placeholder="Search"
                className="w-full h-9 pl-9 bg-[#131722] border-[#363a45] text-white placeholder:text-[#787B86] focus:border-[#2962FF] rounded"
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex h-[calc(100%-108px)]">
            {/* Left Sidebar - Categories */}
            <div className="w-[180px] border-r border-[#363a45] py-2 overflow-y-auto">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#787B86] uppercase tracking-wider">
                Built-in
              </div>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSearchQuery("");
                      setActiveTab("indicators");
                      setSelectedIndicator(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors",
                      selectedCategory === cat.id
                        ? "bg-[#2962FF]/20 text-white"
                        : "text-[#d1d4dc] hover:bg-[#2a2e39]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}

              {/* Active Indicators Section */}
              {indicators.length > 0 && (
                <>
                  <div className="px-3 py-1.5 mt-3 text-[11px] font-semibold text-[#787B86] uppercase tracking-wider border-t border-[#363a45] pt-3">
                    Active ({indicators.length})
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("active");
                      setSelectedIndicator(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors",
                      activeTab === "active" && !selectedIndicator
                        ? "bg-[#2962FF]/20 text-white"
                        : "text-[#d1d4dc] hover:bg-[#2a2e39]",
                    )}
                  >
                    <Check className="h-4 w-4" />
                    <span>My Indicators</span>
                  </button>
                </>
              )}
            </div>

            {/* Right Content - Indicator List or Settings */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === "active" && selectedIndicatorData ? (
                // Indicator Settings Panel
                <IndicatorSettingsPanel
                  indicator={selectedIndicatorData}
                  onUpdate={(updates) =>
                    updateIndicator(selectedIndicatorData.id, updates)
                  }
                  onRemove={() => removeIndicator(selectedIndicatorData.id)}
                  onBack={() => setSelectedIndicator(null)}
                  portalContainer={portalContainer}
                />
              ) : activeTab === "active" ? (
                // Active Indicators List
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-2 text-[11px] font-semibold text-[#787B86] uppercase tracking-wider border-b border-[#363a45]">
                    Active Indicators
                  </div>
                  {indicators.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#787B86]">
                      <Activity className="h-12 w-12 mb-2 opacity-40" />
                      <p className="text-sm">No indicators added</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#363a45]/50">
                      {indicators.map((ind) => (
                        <div
                          key={ind.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#2a2e39] cursor-pointer group"
                          onClick={() => setSelectedIndicator(ind.id)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleIndicator(ind.id);
                            }}
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                              ind.enabled
                                ? "bg-[#2962FF] border-[#2962FF]"
                                : "border-[#787B86] hover:border-[#d1d4dc]",
                            )}
                          >
                            {ind.enabled && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </button>
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ind.color }}
                          />
                          <span
                            className={cn(
                              "flex-1 text-[13px]",
                              ind.enabled ? "text-[#d1d4dc]" : "text-[#787B86]",
                            )}
                          >
                            {ind.name}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[#787B86] opacity-0 group-hover:opacity-100 transition-opacity" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeIndicator(ind.id);
                            }}
                            className="p-1 rounded hover:bg-[#F23645]/20 text-[#787B86] hover:text-[#F23645] opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Indicator List to Add
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-2 text-[11px] font-semibold text-[#787B86] uppercase tracking-wider border-b border-[#363a45]">
                    Script Name
                  </div>
                  <div className="divide-y divide-[#363a45]/50">
                    {filteredIndicators.map(([key, template]) => {
                      const added = isIndicatorAdded(key);
                      return (
                        <button
                          key={key}
                          onClick={() => !added && addIndicator(key)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            added
                              ? "bg-[#2962FF]/10 text-[#2962FF]"
                              : "text-[#d1d4dc] hover:bg-[#2a2e39]",
                          )}
                        >
                          <span className="flex-1 text-[13px]">
                            {template.name}
                          </span>
                          {added && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                    {filteredIndicators.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-[#787B86]">
                        <Search className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">No indicators found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Indicator Settings Panel Component
function IndicatorSettingsPanel({
  indicator,
  onUpdate,
  onRemove,
  onBack,
  portalContainer,
}: {
  indicator: CustomIndicator;
  onUpdate: (updates: Partial<CustomIndicator>) => void;
  onRemove: () => void;
  onBack: () => void;
  portalContainer?: HTMLElement | null;
}) {
  const template =
    INDICATOR_TEMPLATES[indicator.type as keyof typeof INDICATOR_TEMPLATES];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#363a45]">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-[#2a2e39] text-[#787B86]"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: indicator.color }}
        />
        <span className="flex-1 text-[14px] font-medium text-white">
          {indicator.name}
        </span>
        <button
          onClick={onRemove}
          className="p-1.5 rounded hover:bg-[#F23645]/20 text-[#787B86] hover:text-[#F23645] transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Settings Tabs */}
      <Tabs
        defaultValue="inputs"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid grid-cols-3 bg-[#131722] rounded-none border-b border-[#363a45] p-0 h-10">
          <TabsTrigger
            value="inputs"
            className="text-[12px] rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2962FF] data-[state=active]:text-white"
          >
            Inputs
          </TabsTrigger>
          <TabsTrigger
            value="style"
            className="text-[12px] rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2962FF] data-[state=active]:text-white"
          >
            Style
          </TabsTrigger>
          <TabsTrigger
            value="visibility"
            className="text-[12px] rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#2962FF] data-[state=active]:text-white"
          >
            Visibility
          </TabsTrigger>
        </TabsList>

        {/* Inputs Tab */}
        <TabsContent
          value="inputs"
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {Object.keys(indicator.parameters).length > 0 ? (
            Object.entries(indicator.parameters).map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-[12px] text-[#787B86]">
                  {(template?.paramLabels as Record<string, string>)?.[key] ||
                    key}
                </Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    onUpdate({
                      parameters: {
                        ...indicator.parameters,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                  step="0.01"
                  className="h-8 bg-[#131722] border-[#363a45] text-white"
                />
              </div>
            ))
          ) : (
            <p className="text-[13px] text-[#787B86]">
              No adjustable parameters
            </p>
          )}

          {/* Price Source */}
          <div className="space-y-1.5 pt-2 border-t border-[#363a45]">
            <Label className="text-[12px] text-[#787B86]">Source</Label>
            <Select
              value={indicator.priceSource || "close"}
              onValueChange={(value) =>
                onUpdate({
                  priceSource: value as "close" | "open" | "high" | "low",
                })
              }
            >
              <SelectTrigger className="h-8 bg-[#131722] border-[#363a45] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="bg-[#1e222d] border-[#363a45]"
                container={portalContainer}
              >
                <SelectItem value="close" className="text-white">
                  Close
                </SelectItem>
                <SelectItem value="open" className="text-white">
                  Open
                </SelectItem>
                <SelectItem value="high" className="text-white">
                  High
                </SelectItem>
                <SelectItem value="low" className="text-white">
                  Low
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* Style Tab */}
        <TabsContent
          value="style"
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {/* Global: Line Width */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[#787B86]">
              Line Width: {indicator.lineWidth}
            </Label>
            <Slider
              value={[indicator.lineWidth]}
              onValueChange={(value) => onUpdate({ lineWidth: value[0] })}
              min={1}
              max={5}
              step={1}
            />
          </div>

          {/* Global: Opacity */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-[#787B86]">
              Opacity: {indicator.opacity || 100}%
            </Label>
            <Slider
              value={[indicator.opacity || 100]}
              onValueChange={(value) => onUpdate({ opacity: value[0] })}
              min={10}
              max={100}
              step={5}
            />
          </div>

          {/* Per-component color pickers — dynamic from INDICATOR_COMPONENT_CONFIG */}
          {(() => {
            const cfg = INDICATOR_COMPONENT_CONFIG[indicator.type];
            if (!cfg || cfg.colors.length === 0) {
              // Fallback: single color picker for simple indicators
              return (
                <div className="space-y-1.5 pt-2 border-t border-[#363a45]">
                  <Label className="text-[12px] text-[#787B86]">Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={indicator.color}
                      onChange={(e) => onUpdate({ color: e.target.value })}
                      className="w-10 h-8 rounded border border-[#363a45] bg-[#131722] cursor-pointer"
                    />
                    <Input
                      value={indicator.color}
                      onChange={(e) => onUpdate({ color: e.target.value })}
                      className="h-8 bg-[#131722] border-[#363a45] text-white flex-1"
                    />
                  </div>
                </div>
              );
            }
            return (
              <div className="space-y-3 pt-2 border-t border-[#363a45]">
                <Label className="text-[12px] text-[#787B86] uppercase tracking-wider">Component Colors</Label>
                {cfg.colors.map((comp) => {
                  const currentColor =
                    indicator.componentColors?.[comp.key] ?? comp.default;
                  return (
                    <div key={comp.key} className="space-y-1">
                      <span className="text-[11px] text-[#787B86]">{comp.label}</span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={currentColor}
                          onChange={(e) =>
                            onUpdate({
                              componentColors: {
                                ...indicator.componentColors,
                                [comp.key]: e.target.value,
                              },
                            })
                          }
                          className="w-9 h-7 rounded border border-[#363a45] bg-[#131722] cursor-pointer flex-shrink-0"
                        />
                        <Input
                          value={currentColor}
                          onChange={(e) =>
                            onUpdate({
                              componentColors: {
                                ...indicator.componentColors,
                                [comp.key]: e.target.value,
                              },
                            })
                          }
                          className="h-7 bg-[#131722] border-[#363a45] text-white text-[11px] flex-1"
                        />
                        {currentColor !== comp.default && (
                          <button
                            onClick={() =>
                              onUpdate({
                                componentColors: {
                                  ...indicator.componentColors,
                                  [comp.key]: comp.default,
                                },
                              })
                            }
                            className="text-[10px] text-[#787B86] hover:text-white px-1 flex-shrink-0"
                            title="Reset to default"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        {/* Visibility Tab */}
        <TabsContent
          value="visibility"
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {/* Global: Show Indicator */}
          <div className="flex items-center justify-between">
            <Label className="text-[13px] text-[#d1d4dc]">Show Indicator</Label>
            <button
              onClick={() => onUpdate({ enabled: !indicator.enabled })}
              className={cn(
                "w-10 h-5 rounded-full transition-colors relative",
                indicator.enabled ? "bg-[#2962FF]" : "bg-[#363a45]",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  indicator.enabled ? "left-5" : "left-0.5",
                )}
              />
            </button>
          </div>

          {/* Global: Show Label */}
          <div className="flex items-center justify-between">
            <Label className="text-[13px] text-[#d1d4dc]">Show Label</Label>
            <button
              onClick={() => onUpdate({ showLabel: !indicator.showLabel })}
              className={cn(
                "w-10 h-5 rounded-full transition-colors relative",
                indicator.showLabel !== false ? "bg-[#2962FF]" : "bg-[#363a45]",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  indicator.showLabel !== false ? "left-5" : "left-0.5",
                )}
              />
            </button>
          </div>

          {/* Per-component visibility toggles — dynamic from INDICATOR_COMPONENT_CONFIG */}
          {(() => {
            const cfg = INDICATOR_COMPONENT_CONFIG[indicator.type];
            if (!cfg || cfg.visibility.length === 0) return null;
            return (
              <div className="space-y-2 pt-2 border-t border-[#363a45]">
                <Label className="text-[12px] text-[#787B86] uppercase tracking-wider">Component Visibility</Label>
                {cfg.visibility.map(({ key, label }) => {
                  const isVisible = indicator.componentVisibility?.[key] !== false;
                  return (
                    <div key={key} className="flex items-center justify-between py-0.5">
                      <span className="text-[13px] text-[#d1d4dc]">{label}</span>
                      <button
                        onClick={() =>
                          onUpdate({
                            componentVisibility: {
                              ...indicator.componentVisibility,
                              [key]: !isVisible,
                            },
                          })
                        }
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative flex-shrink-0",
                          isVisible ? "bg-[#2962FF]" : "bg-[#363a45]",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                            isVisible ? "left-5" : "left-0.5",
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
