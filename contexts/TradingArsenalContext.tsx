"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { IStrategyConfig } from "@/database/models/marketplace/marketplace-item.model";

// All supported indicator types (must match chart implementations)
export type IndicatorType =
  | "sma" | "ema" | "wma" | "dema" | "tema" | "hma"
  | "alma" | "kama" | "zlema" | "t3" | "smma" | "lsma" | "vidya" | "mcginley"
  | "bb" | "keltner" | "donchian" | "ichimoku"
  | "linreg_channel" | "ma_envelope" | "price_channel" | "chandelier"
  | "rsi" | "macd" | "stoch" | "williamsR" | "cci" | "adx" | "mfi" | "atr"
  | "obv" | "roc" | "cmf" | "momentum"
  | "ultimate_osc" | "awesome_osc" | "stochrsi" | "tsi" | "ppo"
  | "fisher" | "connors_rsi" | "smi_ergodic"
  | "supertrend" | "aroon" | "vortex" | "trix" | "dpo" | "kst" | "coppock" | "elder_ray"
  | "std_dev" | "hist_volatility" | "chaikin_volatility" | "mass_index" | "ulcer_index" | "rvi"
  | "vwap" | "vwma" | "ad_line" | "force_index" | "eom" | "nvi" | "pvi"
  | "sar" | "pivots" | "support_resistance"
  // Premium Marketplace-Only
  | "trend_pulse" | "market_regime" | "trend_composite" | "composite_breadth"
  | "reversal_signal" | "predictive_range" | "breakout_prob" | "sentiment_osc"
  | "whale_accumulation" | "smart_money_flow" | "volume_climax" | "net_buying_pressure"
  | "order_flow_imbalance" | "intraday_intensity" | "volume_momentum" | "liquidity_heatmap"
  | "volatility_squeeze" | "squeeze_momentum" | "volatility_ratio" | "range_expansion"
  | "choppy_market" | "fractal_dimension" | "acceleration_bands" | "adaptive_channel"
  | "alpha_momentum" | "efficiency_ratio" | "trend_persistence" | "mtf_momentum"
  | "momentum_wave" | "gap_momentum" | "heikin_ashi_trend" | "cycle_detector"
  | "adaptive_rsi" | "mean_reversion_band" | "trend_ribbon" | "relative_vigor"
  | "dynamic_pivots" | "price_action_score" | "ergodic_volume" | "anchored_vwap_bands"
  | "vortex_drift_cloud"
  | "orion_momentum_shield"
  | "nebula_phase_bands"
  | "cipher_harmonic_veil"
  | "titan_pulse_signal"
  | "aurora_cascade_flow"
  | "eclipse_stealth_trail"
  | "wraith_convergence_engine"
  | "flux_momentum_trail"
  | "apex_predator_signal"
  | "phantom_divergence_tracker"
  | "chaos_sentinel"
  | "helix_phase_engine"
  | "prism_wavelet_cascade"
  | "mirage_depth_scanner"
  | "quantum_drift_mapper"
  | "sovereign_gravity_arc"
  | "solaris_trend_engine"
  | "stellar_confluence_ribbon"
  | "kinetic_pressure_zones"
  | "nova_resonance_field"
  | "spectre_liquidity_matrix"
  | "radiant_fibonacci_matrix";

// Indicator configuration that matches the chart's CustomIndicator interface
export interface ArsenalIndicator {
  id: string;
  purchaseId: string;
  itemName: string;
  type: IndicatorType;
  displayType: "overlay" | "oscillator";
  enabled: boolean;
  color: string;
  lineWidth: number;
  parameters: Record<string, number>;
}

// Strategy with signals
export interface ArsenalStrategy {
  id: string;
  purchaseId: string;
  itemName: string;
  config: IStrategyConfig;
  enabled: boolean;
}

// Signal type
export interface StrategySignal {
  time: number;
  type: "buy" | "sell" | "strong_buy" | "strong_sell" | "neutral";
  strength: number;
  ruleName: string;
  ruleId: string;
  strategyId: string;
  strategyName: string;
}

interface TradingArsenalContextValue {
  // Indicators
  activeIndicators: ArsenalIndicator[];
  addIndicator: (indicator: ArsenalIndicator) => void;
  removeIndicator: (id: string) => void;
  updateIndicator: (id: string, updates: Partial<ArsenalIndicator>) => void;
  toggleIndicator: (id: string, enabled: boolean) => void;

  // Strategies
  activeStrategies: ArsenalStrategy[];
  addStrategy: (strategy: ArsenalStrategy) => void;
  removeStrategy: (id: string) => void;
  toggleStrategy: (id: string, enabled: boolean) => void;

  // Signals (computed from strategies)
  signals: StrategySignal[];
  setSignals: (signals: StrategySignal[]) => void;

  // Support/Resistance levels
  supportResistanceLevels: {
    price: number;
    type: "support" | "resistance";
    strength: number;
  }[];
  setSupportResistanceLevels: (
    levels: {
      price: number;
      type: "support" | "resistance";
      strength: number;
    }[],
  ) => void;
}

const TradingArsenalContext = createContext<
  TradingArsenalContextValue | undefined
>(undefined);

export const TradingArsenalProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [activeIndicators, setActiveIndicators] = useState<ArsenalIndicator[]>(
    [],
  );
  const [activeStrategies, setActiveStrategies] = useState<ArsenalStrategy[]>(
    [],
  );
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [supportResistanceLevels, setSupportResistanceLevels] = useState<
    { price: number; type: "support" | "resistance"; strength: number }[]
  >([]);

  // Indicator management
  const addIndicator = useCallback((indicator: ArsenalIndicator) => {
    setActiveIndicators((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === indicator.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = indicator;
        return updated;
      }
      return [...prev, indicator];
    });
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setActiveIndicators((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateIndicator = useCallback(
    (id: string, updates: Partial<ArsenalIndicator>) => {
      setActiveIndicators((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      );
    },
    [],
  );

  const toggleIndicator = useCallback((id: string, enabled: boolean) => {
    setActiveIndicators((prev) =>
      prev.map((i) => (i.id === id ? { ...i, enabled } : i)),
    );
  }, []);

  // Strategy management
  const addStrategy = useCallback((strategy: ArsenalStrategy) => {
    setActiveStrategies((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === strategy.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = strategy;
        return updated;
      }
      return [...prev, strategy];
    });
  }, []);

  const removeStrategy = useCallback((id: string) => {
    setActiveStrategies((prev) => prev.filter((s) => s.id !== id));
    // Also remove signals from this strategy
    setSignals((prev) => prev.filter((s) => s.strategyId !== id));
  }, []);

  const toggleStrategy = useCallback((id: string, enabled: boolean) => {
    setActiveStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
    );
    // Clear signals if strategy is disabled
    if (!enabled) {
      setSignals((prev) => prev.filter((s) => s.strategyId !== id));
    }
  }, []);

  return (
    <TradingArsenalContext.Provider
      value={{
        activeIndicators,
        addIndicator,
        removeIndicator,
        updateIndicator,
        toggleIndicator,
        activeStrategies,
        addStrategy,
        removeStrategy,
        toggleStrategy,
        signals,
        setSignals,
        supportResistanceLevels,
        setSupportResistanceLevels,
      }}
    >
      {children}
    </TradingArsenalContext.Provider>
  );
};

export const useTradingArsenal = () => {
  const context = useContext(TradingArsenalContext);
  if (!context) {
    throw new Error(
      "useTradingArsenal must be used within TradingArsenalProvider",
    );
  }
  return context;
};

// Mapping of indicator slugs to types - ONLY indicators with chart implementations
const INDICATOR_TYPE_MAP: Record<
  string,
  { type: IndicatorType; displayType: "overlay" | "oscillator" }
> = {
  // Moving Averages
  "simple moving average": { type: "sma", displayType: "overlay" },
  sma: { type: "sma", displayType: "overlay" },
  "exponential moving average": { type: "ema", displayType: "overlay" },
  ema: { type: "ema", displayType: "overlay" },
  "weighted moving average": { type: "wma", displayType: "overlay" },
  wma: { type: "wma", displayType: "overlay" },
  "double exponential": { type: "dema", displayType: "overlay" },
  dema: { type: "dema", displayType: "overlay" },
  "triple exponential": { type: "tema", displayType: "overlay" },
  tema: { type: "tema", displayType: "overlay" },
  "hull moving average": { type: "hma", displayType: "overlay" },
  hma: { type: "hma", displayType: "overlay" },

  // Momentum Oscillators
  rsi: { type: "rsi", displayType: "oscillator" },
  "relative strength": { type: "rsi", displayType: "oscillator" },
  macd: { type: "macd", displayType: "oscillator" },
  stochastic: { type: "stoch", displayType: "oscillator" },
  stoch: { type: "stoch", displayType: "oscillator" },
  "williams %r": { type: "williamsR", displayType: "oscillator" },
  "williams r": { type: "williamsR", displayType: "oscillator" },
  williamsR: { type: "williamsR", displayType: "oscillator" },
  "commodity channel": { type: "cci", displayType: "oscillator" },
  cci: { type: "cci", displayType: "oscillator" },
  "average directional": { type: "adx", displayType: "oscillator" },
  adx: { type: "adx", displayType: "oscillator" },
  "money flow index": { type: "mfi", displayType: "oscillator" },
  mfi: { type: "mfi", displayType: "oscillator" },
  "on balance volume": { type: "obv", displayType: "oscillator" },
  obv: { type: "obv", displayType: "oscillator" },
  "rate of change": { type: "roc", displayType: "oscillator" },
  roc: { type: "roc", displayType: "oscillator" },
  "chaikin money flow": { type: "cmf", displayType: "oscillator" },
  cmf: { type: "cmf", displayType: "oscillator" },
  momentum: { type: "momentum", displayType: "oscillator" },

  // Volatility / Bands
  bollinger: { type: "bb", displayType: "overlay" },
  bb: { type: "bb", displayType: "overlay" },
  keltner: { type: "keltner", displayType: "overlay" },
  "keltner channel": { type: "keltner", displayType: "overlay" },
  donchian: { type: "donchian", displayType: "overlay" },
  "donchian channel": { type: "donchian", displayType: "overlay" },
  ichimoku: { type: "ichimoku", displayType: "overlay" },
  "ichimoku cloud": { type: "ichimoku", displayType: "overlay" },

  // Other Overlays
  "average true range": { type: "atr", displayType: "oscillator" },
  atr: { type: "atr", displayType: "oscillator" },
  vwap: { type: "vwap", displayType: "overlay" },
  "volume weighted": { type: "vwap", displayType: "overlay" },
  "parabolic sar": { type: "sar", displayType: "overlay" },
  sar: { type: "sar", displayType: "overlay" },
  "pivot points": { type: "pivots", displayType: "overlay" },
  pivots: { type: "pivots", displayType: "overlay" },

  // Support/Resistance
  support: { type: "support_resistance", displayType: "overlay" },
  resistance: { type: "support_resistance", displayType: "overlay" },
  "auto support": { type: "support_resistance", displayType: "overlay" },

  // Batch 2: Advanced Moving Averages
  alma: { type: "alma", displayType: "overlay" },
  "arnaud legoux": { type: "alma", displayType: "overlay" },
  kama: { type: "kama", displayType: "overlay" },
  "kaufman adaptive": { type: "kama", displayType: "overlay" },
  zlema: { type: "zlema", displayType: "overlay" },
  "zero-lag": { type: "zlema", displayType: "overlay" },
  "zero lag": { type: "zlema", displayType: "overlay" },
  t3: { type: "t3", displayType: "overlay" },
  "tillson t3": { type: "t3", displayType: "overlay" },
  smma: { type: "smma", displayType: "overlay" },
  "smoothed moving": { type: "smma", displayType: "overlay" },
  lsma: { type: "lsma", displayType: "overlay" },
  "least squares": { type: "lsma", displayType: "overlay" },
  "linear regression ma": { type: "lsma", displayType: "overlay" },
  vidya: { type: "vidya", displayType: "overlay" },
  "variable index": { type: "vidya", displayType: "overlay" },
  mcginley: { type: "mcginley", displayType: "overlay" },
  "mcginley dynamic": { type: "mcginley", displayType: "overlay" },
  vwma: { type: "vwma", displayType: "overlay" },
  "volume weighted ma": { type: "vwma", displayType: "overlay" },

  // Batch 2: Channels
  linreg_channel: { type: "linreg_channel", displayType: "overlay" },
  "linear regression channel": { type: "linreg_channel", displayType: "overlay" },
  ma_envelope: { type: "ma_envelope", displayType: "overlay" },
  "moving average envelope": { type: "ma_envelope", displayType: "overlay" },
  envelope: { type: "ma_envelope", displayType: "overlay" },
  price_channel: { type: "price_channel", displayType: "overlay" },
  "price channel": { type: "price_channel", displayType: "overlay" },
  chandelier: { type: "chandelier", displayType: "overlay" },
  "chandelier exit": { type: "chandelier", displayType: "overlay" },

  // Batch 2: Trend
  supertrend: { type: "supertrend", displayType: "overlay" },
  aroon: { type: "aroon", displayType: "oscillator" },
  "aroon oscillator": { type: "aroon", displayType: "oscillator" },
  vortex: { type: "vortex", displayType: "oscillator" },
  "vortex indicator": { type: "vortex", displayType: "oscillator" },
  trix: { type: "trix", displayType: "oscillator" },
  dpo: { type: "dpo", displayType: "oscillator" },
  "detrended price": { type: "dpo", displayType: "oscillator" },
  kst: { type: "kst", displayType: "oscillator" },
  "know sure thing": { type: "kst", displayType: "oscillator" },
  coppock: { type: "coppock", displayType: "oscillator" },
  "coppock curve": { type: "coppock", displayType: "oscillator" },
  elder_ray: { type: "elder_ray", displayType: "oscillator" },
  "elder ray": { type: "elder_ray", displayType: "oscillator" },

  // Batch 2: Volatility
  std_dev: { type: "std_dev", displayType: "oscillator" },
  "standard deviation": { type: "std_dev", displayType: "oscillator" },
  hist_volatility: { type: "hist_volatility", displayType: "oscillator" },
  "historical volatility": { type: "hist_volatility", displayType: "oscillator" },
  chaikin_volatility: { type: "chaikin_volatility", displayType: "oscillator" },
  "chaikin volatility": { type: "chaikin_volatility", displayType: "oscillator" },
  mass_index: { type: "mass_index", displayType: "oscillator" },
  "mass index": { type: "mass_index", displayType: "oscillator" },
  ulcer_index: { type: "ulcer_index", displayType: "oscillator" },
  "ulcer index": { type: "ulcer_index", displayType: "oscillator" },
  rvi: { type: "rvi", displayType: "oscillator" },
  "relative volatility": { type: "rvi", displayType: "oscillator" },

  // Batch 2: Volume
  ad_line: { type: "ad_line", displayType: "oscillator" },
  "accumulation/distribution": { type: "ad_line", displayType: "oscillator" },
  force_index: { type: "force_index", displayType: "oscillator" },
  "force index": { type: "force_index", displayType: "oscillator" },
  eom: { type: "eom", displayType: "oscillator" },
  "ease of movement": { type: "eom", displayType: "oscillator" },
  nvi: { type: "nvi", displayType: "oscillator" },
  "negative volume": { type: "nvi", displayType: "oscillator" },
  pvi: { type: "pvi", displayType: "oscillator" },
  "positive volume": { type: "pvi", displayType: "oscillator" },

  // Batch 2: Advanced Oscillators
  ultimate_osc: { type: "ultimate_osc", displayType: "oscillator" },
  "ultimate oscillator": { type: "ultimate_osc", displayType: "oscillator" },
  awesome_osc: { type: "awesome_osc", displayType: "oscillator" },
  "awesome oscillator": { type: "awesome_osc", displayType: "oscillator" },
  stochrsi: { type: "stochrsi", displayType: "oscillator" },
  "stochastic rsi": { type: "stochrsi", displayType: "oscillator" },
  tsi: { type: "tsi", displayType: "oscillator" },
  "true strength": { type: "tsi", displayType: "oscillator" },
  ppo: { type: "ppo", displayType: "oscillator" },
  "percentage price": { type: "ppo", displayType: "oscillator" },
  fisher: { type: "fisher", displayType: "oscillator" },
  "fisher transform": { type: "fisher", displayType: "oscillator" },
  connors_rsi: { type: "connors_rsi", displayType: "oscillator" },
  "connors rsi": { type: "connors_rsi", displayType: "oscillator" },
  smi_ergodic: { type: "smi_ergodic", displayType: "oscillator" },
  "smi ergodic": { type: "smi_ergodic", displayType: "oscillator" },

  // Premium Marketplace-Only Indicators
  trend_pulse: { type: "trend_pulse", displayType: "oscillator" },
  "trend pulse": { type: "trend_pulse", displayType: "oscillator" },
  market_regime: { type: "market_regime", displayType: "oscillator" },
  "market regime": { type: "market_regime", displayType: "oscillator" },
  trend_composite: { type: "trend_composite", displayType: "oscillator" },
  "trend composite": { type: "trend_composite", displayType: "oscillator" },
  composite_breadth: { type: "composite_breadth", displayType: "oscillator" },
  "composite breadth": { type: "composite_breadth", displayType: "oscillator" },
  reversal_signal: { type: "reversal_signal", displayType: "oscillator" },
  "reversal signal": { type: "reversal_signal", displayType: "oscillator" },
  predictive_range: { type: "predictive_range", displayType: "overlay" },
  "predictive range": { type: "predictive_range", displayType: "overlay" },
  breakout_prob: { type: "breakout_prob", displayType: "oscillator" },
  "breakout probability": { type: "breakout_prob", displayType: "oscillator" },
  sentiment_osc: { type: "sentiment_osc", displayType: "oscillator" },
  "sentiment oscillator": { type: "sentiment_osc", displayType: "oscillator" },
  whale_accumulation: { type: "whale_accumulation", displayType: "oscillator" },
  "whale accumulation": { type: "whale_accumulation", displayType: "oscillator" },
  smart_money_flow: { type: "smart_money_flow", displayType: "oscillator" },
  "smart money flow": { type: "smart_money_flow", displayType: "oscillator" },
  volume_climax: { type: "volume_climax", displayType: "oscillator" },
  "volume climax": { type: "volume_climax", displayType: "oscillator" },
  net_buying_pressure: { type: "net_buying_pressure", displayType: "oscillator" },
  "net buying pressure": { type: "net_buying_pressure", displayType: "oscillator" },
  order_flow_imbalance: { type: "order_flow_imbalance", displayType: "oscillator" },
  "order flow imbalance": { type: "order_flow_imbalance", displayType: "oscillator" },
  intraday_intensity: { type: "intraday_intensity", displayType: "oscillator" },
  "intraday intensity": { type: "intraday_intensity", displayType: "oscillator" },
  volume_momentum: { type: "volume_momentum", displayType: "oscillator" },
  "volume momentum": { type: "volume_momentum", displayType: "oscillator" },
  liquidity_heatmap: { type: "liquidity_heatmap", displayType: "oscillator" },
  "liquidity heatmap": { type: "liquidity_heatmap", displayType: "oscillator" },
  volatility_squeeze: { type: "volatility_squeeze", displayType: "oscillator" },
  "volatility squeeze": { type: "volatility_squeeze", displayType: "oscillator" },
  squeeze_momentum: { type: "squeeze_momentum", displayType: "oscillator" },
  "squeeze momentum": { type: "squeeze_momentum", displayType: "oscillator" },
  volatility_ratio: { type: "volatility_ratio", displayType: "oscillator" },
  "volatility ratio": { type: "volatility_ratio", displayType: "oscillator" },
  range_expansion: { type: "range_expansion", displayType: "oscillator" },
  "range expansion": { type: "range_expansion", displayType: "oscillator" },
  choppy_market: { type: "choppy_market", displayType: "oscillator" },
  "choppy market": { type: "choppy_market", displayType: "oscillator" },
  fractal_dimension: { type: "fractal_dimension", displayType: "oscillator" },
  "fractal dimension": { type: "fractal_dimension", displayType: "oscillator" },
  acceleration_bands: { type: "acceleration_bands", displayType: "overlay" },
  "acceleration bands": { type: "acceleration_bands", displayType: "overlay" },
  adaptive_channel: { type: "adaptive_channel", displayType: "overlay" },
  "adaptive channel": { type: "adaptive_channel", displayType: "overlay" },
  alpha_momentum: { type: "alpha_momentum", displayType: "oscillator" },
  "alpha momentum": { type: "alpha_momentum", displayType: "oscillator" },
  efficiency_ratio: { type: "efficiency_ratio", displayType: "oscillator" },
  "efficiency ratio": { type: "efficiency_ratio", displayType: "oscillator" },
  trend_persistence: { type: "trend_persistence", displayType: "oscillator" },
  "trend persistence": { type: "trend_persistence", displayType: "oscillator" },
  mtf_momentum: { type: "mtf_momentum", displayType: "oscillator" },
  "multi-timeframe momentum": { type: "mtf_momentum", displayType: "oscillator" },
  momentum_wave: { type: "momentum_wave", displayType: "oscillator" },
  "momentum wave": { type: "momentum_wave", displayType: "oscillator" },
  gap_momentum: { type: "gap_momentum", displayType: "oscillator" },
  "gap momentum": { type: "gap_momentum", displayType: "oscillator" },
  heikin_ashi_trend: { type: "heikin_ashi_trend", displayType: "oscillator" },
  "heikin ashi trend": { type: "heikin_ashi_trend", displayType: "oscillator" },
  cycle_detector: { type: "cycle_detector", displayType: "oscillator" },
  "cycle detector": { type: "cycle_detector", displayType: "oscillator" },
  adaptive_rsi: { type: "adaptive_rsi", displayType: "oscillator" },
  "adaptive rsi": { type: "adaptive_rsi", displayType: "oscillator" },
  mean_reversion_band: { type: "mean_reversion_band", displayType: "overlay" },
  "mean reversion band": { type: "mean_reversion_band", displayType: "overlay" },
  trend_ribbon: { type: "trend_ribbon", displayType: "overlay" },
  "trend ribbon": { type: "trend_ribbon", displayType: "overlay" },
  relative_vigor: { type: "relative_vigor", displayType: "oscillator" },
  "relative vigor": { type: "relative_vigor", displayType: "oscillator" },
  dynamic_pivots: { type: "dynamic_pivots", displayType: "overlay" },
  "dynamic pivots": { type: "dynamic_pivots", displayType: "overlay" },
  price_action_score: { type: "price_action_score", displayType: "oscillator" },
  "price action score": { type: "price_action_score", displayType: "oscillator" },
  ergodic_volume: { type: "ergodic_volume", displayType: "oscillator" },
  "ergodic volume": { type: "ergodic_volume", displayType: "oscillator" },
  anchored_vwap_bands: { type: "anchored_vwap_bands", displayType: "overlay" },
  "anchored vwap bands": { type: "anchored_vwap_bands", displayType: "overlay" },
  nexus_trend_matrix: { type: "nexus_trend_matrix", displayType: "overlay" },
  "nexus trend matrix": { type: "nexus_trend_matrix", displayType: "overlay" },
  phantom_flow_zones: { type: "phantom_flow_zones", displayType: "overlay" },
  "phantom flow zones": { type: "phantom_flow_zones", displayType: "overlay" },
  fractal_pulse_grid: { type: "fractal_pulse_grid", displayType: "overlay" },
  "fractal pulse grid": { type: "fractal_pulse_grid", displayType: "overlay" },
  vortex_drift_cloud: { type: "vortex_drift_cloud", displayType: "overlay" },
  "vortex drift cloud": { type: "vortex_drift_cloud", displayType: "overlay" },
  orion_momentum_shield: { type: "orion_momentum_shield", displayType: "overlay" },
  "orion momentum shield": { type: "orion_momentum_shield", displayType: "overlay" },
  nebula_phase_bands: { type: "nebula_phase_bands", displayType: "overlay" },
  "nebula phase bands": { type: "nebula_phase_bands", displayType: "overlay" },
  cipher_harmonic_veil: { type: "cipher_harmonic_veil", displayType: "overlay" },
  "cipher harmonic veil": { type: "cipher_harmonic_veil", displayType: "overlay" },
  titan_pulse_signal: { type: "titan_pulse_signal", displayType: "overlay" },
  "titan pulse signal": { type: "titan_pulse_signal", displayType: "overlay" },
  aurora_cascade_flow: { type: "aurora_cascade_flow", displayType: "overlay" },
  "aurora cascade flow": { type: "aurora_cascade_flow", displayType: "overlay" },
  eclipse_stealth_trail: { type: "eclipse_stealth_trail", displayType: "overlay" },
  "eclipse stealth trail": { type: "eclipse_stealth_trail", displayType: "overlay" },
  wraith_convergence_engine: { type: "wraith_convergence_engine", displayType: "overlay" },
  "wraith convergence engine": { type: "wraith_convergence_engine", displayType: "overlay" },
  flux_momentum_trail: { type: "flux_momentum_trail", displayType: "overlay" },
  "flux momentum trail": { type: "flux_momentum_trail", displayType: "overlay" },
  apex_predator_signal: { type: "apex_predator_signal", displayType: "overlay" },
  "apex predator signal": { type: "apex_predator_signal", displayType: "overlay" },
  phantom_divergence_tracker: { type: "phantom_divergence_tracker", displayType: "overlay" },
  "phantom divergence tracker": { type: "phantom_divergence_tracker", displayType: "overlay" },
  chaos_sentinel: { type: "chaos_sentinel", displayType: "overlay" },
  "chaos sentinel": { type: "chaos_sentinel", displayType: "overlay" },
  helix_phase_engine: { type: "helix_phase_engine", displayType: "overlay" },
  "helix phase engine": { type: "helix_phase_engine", displayType: "overlay" },
  prism_wavelet_cascade: { type: "prism_wavelet_cascade", displayType: "overlay" },
  "prism wavelet cascade": { type: "prism_wavelet_cascade", displayType: "overlay" },
  mirage_depth_scanner: { type: "mirage_depth_scanner", displayType: "overlay" },
  "mirage depth scanner": { type: "mirage_depth_scanner", displayType: "overlay" },
  quantum_drift_mapper: { type: "quantum_drift_mapper", displayType: "overlay" },
  "quantum drift mapper": { type: "quantum_drift_mapper", displayType: "overlay" },
  sovereign_gravity_arc: { type: "sovereign_gravity_arc", displayType: "overlay" },
  "sovereign gravity arc": { type: "sovereign_gravity_arc", displayType: "overlay" },
  solaris_trend_engine: { type: "solaris_trend_engine", displayType: "overlay" },
  "solaris trend engine": { type: "solaris_trend_engine", displayType: "overlay" },
  stellar_confluence_ribbon: { type: "stellar_confluence_ribbon", displayType: "overlay" },
  "stellar confluence ribbon": { type: "stellar_confluence_ribbon", displayType: "overlay" },
  kinetic_pressure_zones: { type: "kinetic_pressure_zones", displayType: "overlay" },
  "kinetic pressure zones": { type: "kinetic_pressure_zones", displayType: "overlay" },
  nova_resonance_field: { type: "nova_resonance_field", displayType: "overlay" },
  "nova resonance field": { type: "nova_resonance_field", displayType: "overlay" },
  spectre_liquidity_matrix: { type: "spectre_liquidity_matrix", displayType: "overlay" },
  "spectre liquidity matrix": { type: "spectre_liquidity_matrix", displayType: "overlay" },
  radiant_fibonacci_matrix: { type: "radiant_fibonacci_matrix", displayType: "overlay" },
  "radiant fibonacci matrix": { type: "radiant_fibonacci_matrix", displayType: "overlay" },
};

// Helper to convert marketplace item to chart indicator
export function marketplaceItemToIndicator(
  purchaseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: {
    _id: string;
    name: string;
    category: string;
    indicatorType?: string;
    defaultSettings?: any;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customSettings: any,
): ArsenalIndicator | null {
  if (item.category !== "indicator") return null;

  const slug = item.name.toLowerCase();
  const settings = { ...item.defaultSettings, ...customSettings };

  // Find matching indicator type - prefer explicit indicatorType field
  let indicatorConfig: {
    type: IndicatorType;
    displayType: "overlay" | "oscillator";
  } | null = null;

  // 1. Try using the explicit indicatorType field first
  if (item.indicatorType && INDICATOR_TYPE_MAP[item.indicatorType]) {
    indicatorConfig = INDICATOR_TYPE_MAP[item.indicatorType];
  }

  // 2. Fallback to name-based matching
  if (!indicatorConfig) {
    for (const [key, config] of Object.entries(INDICATOR_TYPE_MAP)) {
      if (slug.includes(key)) {
        indicatorConfig = config;
        break;
      }
    }
  }

  // Default to SMA if no match
  if (!indicatorConfig) {
    console.warn(
      `⚠️ Unknown indicator type for "${item.name}" (indicatorType: ${item.indicatorType}), defaulting to SMA`,
    );
    indicatorConfig = { type: "sma", displayType: "overlay" };
  }

  // Build parameters with defaults
  const params: Record<string, number> = {};

  // Add type-specific parameters
  switch (indicatorConfig.type) {
    case "rsi":
      params.period = settings?.period || 14;
      params.overbought = settings?.overbought || 70;
      params.oversold = settings?.oversold || 30;
      break;
    case "bb":
      params.period = settings?.period || 20;
      params.stdDev = settings?.stdDev || 2;
      break;
    case "macd":
      params.fast = settings?.fastPeriod || 12;
      params.slow = settings?.slowPeriod || 26;
      params.signal = settings?.signalPeriod || 9;
      break;
    case "stoch":
      params.kPeriod = settings?.kPeriod || 14;
      params.dPeriod = settings?.dPeriod || 3;
      break;
    case "keltner":
      params.period = settings?.period || 20;
      params.multiplier = settings?.multiplier || 2;
      break;
    case "donchian":
      params.period = settings?.period || 20;
      break;
    case "ichimoku":
      params.tenkanPeriod = settings?.tenkanPeriod || 9;
      params.kijunPeriod = settings?.kijunPeriod || 26;
      params.senkouBPeriod = settings?.senkouBPeriod || 52;
      break;
    case "sar":
      params.acceleration = settings?.acceleration || 0.02;
      params.maximum = settings?.maximum || 0.2;
      break;
    case "roc":
      params.period = settings?.period || 12;
      break;
    case "momentum":
      params.period = settings?.period || 10;
      break;
    case "cmf":
      params.period = settings?.period || 20;
      break;
    case "support_resistance":
      params.period = settings?.period || 20;
      params.strength = settings?.strength || 2;
      break;
    case "vwap":
    case "obv":
    case "pivots":
    case "ad_line":
    case "nvi":
    case "pvi":
    case "awesome_osc":
    case "kst":
      // No params needed
      break;
    case "alma":
      params.period = settings?.period || 20;
      params.offset = settings?.offset || 0.85;
      params.sigma = settings?.sigma || 6;
      break;
    case "t3":
      params.period = settings?.period || 5;
      params.vFactor = settings?.vFactor || 0.7;
      break;
    case "linreg_channel":
      params.period = settings?.period || 100;
      params.deviations = settings?.deviations || 2;
      break;
    case "ma_envelope":
      params.period = settings?.period || 20;
      params.percentage = settings?.percentage || 2.5;
      break;
    case "supertrend":
      params.period = settings?.period || 10;
      params.multiplier = settings?.multiplier || 3;
      break;
    case "coppock":
      params.wmaPeriod = settings?.wmaPeriod || 10;
      params.longROC = settings?.longROC || 14;
      params.shortROC = settings?.shortROC || 11;
      break;
    case "stochrsi":
      params.rsiPeriod = settings?.rsiPeriod || 14;
      params.stochPeriod = settings?.stochPeriod || 14;
      params.kSmooth = settings?.kSmooth || 3;
      params.dSmooth = settings?.dSmooth || 3;
      break;
    case "tsi":
      params.longPeriod = settings?.longPeriod || 25;
      params.shortPeriod = settings?.shortPeriod || 13;
      break;
    case "ppo":
      params.fast = settings?.fast || 12;
      params.slow = settings?.slow || 26;
      params.signal = settings?.signal || 9;
      break;
    case "connors_rsi":
      params.rsiPeriod = settings?.rsiPeriod || 3;
      params.streakPeriod = settings?.streakPeriod || 2;
      params.rocPeriod = settings?.rocPeriod || 100;
      break;
    case "smi_ergodic":
      params.shortPeriod = settings?.shortPeriod || 5;
      params.longPeriod = settings?.longPeriod || 20;
      params.signalPeriod = settings?.signalPeriod || 5;
      break;
    case "ultimate_osc":
      params.period1 = settings?.period1 || 7;
      params.period2 = settings?.period2 || 14;
      params.period3 = settings?.period3 || 28;
      break;
    case "mass_index":
      params.emaPeriod = settings?.emaPeriod || 9;
      params.sumPeriod = settings?.sumPeriod || 25;
      break;
    case "chaikin_volatility":
      params.emaPeriod = settings?.emaPeriod || 10;
      params.rocPeriod = settings?.rocPeriod || 10;
      break;
    // Premium indicators with special params
    case "trend_pulse":
      params.adxPeriod = settings?.adxPeriod || 14;
      params.rsiPeriod = settings?.rsiPeriod || 14;
      break;
    case "breakout_prob":
      params.bbPeriod = settings?.bbPeriod || 20;
      params.keltPeriod = settings?.keltPeriod || 20;
      break;
    case "volatility_ratio":
      params.shortPeriod = settings?.shortPeriod || 5;
      params.longPeriod = settings?.longPeriod || 20;
      break;
    case "ergodic_volume":
      params.shortPeriod = settings?.shortPeriod || 5;
      params.longPeriod = settings?.longPeriod || 20;
      break;
    case "dynamic_pivots":
      params.lookback = settings?.lookback || 5;
      break;
    case "anchored_vwap_bands":
      params.deviations = settings?.deviations || 2;
      break;
    case "whale_accumulation":
      params.threshold = settings?.threshold || 1.5;
      break;
    case "composite_breadth":
    case "mtf_momentum":
    case "awesome_osc":
      // No params needed
      break;
    case "trend_ribbon":
      // No params - uses fixed Fibonacci EMAs
      break;
    case "nexus_trend_matrix":
      params.period = settings?.period || 20;
      params.fastPeriod = settings?.fastPeriod || 2;
      params.slowPeriod = settings?.slowPeriod || 30;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.atrMultiplier = settings?.atrMultiplier || 2.0;
      params.trendSmoothPeriod = settings?.trendSmoothPeriod || 10;
      break;
    case "phantom_flow_zones":
      params.period = settings?.period || 20;
      params.volumeThreshold = settings?.volumeThreshold || 1.5;
      params.wickThreshold = settings?.wickThreshold || 0.6;
      params.zoneLookback = settings?.zoneLookback || 50;
      params.smoothPeriod = settings?.smoothPeriod || 10;
      break;
    case "fractal_pulse_grid":
      params.period = settings?.period || 20;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.baseLookback = settings?.baseLookback || 3;
      params.maxAge = settings?.maxAge || 100;
      params.smoothPeriod = settings?.smoothPeriod || 8;
      params.breakTolerance = settings?.breakTolerance || 0.25;
      break;
    case "vortex_drift_cloud":
      params.smoothPeriod = settings?.smoothPeriod || 21;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.bandMultiplier = settings?.bandMultiplier || 2.0;
      params.adxPeriod = settings?.adxPeriod || 14;
      params.adxThreshold = settings?.adxThreshold || 25;
      params.momentumLookback = settings?.momentumLookback || 10;
      break;
    case "orion_momentum_shield":
      params.hmaPeriod = settings?.hmaPeriod || 16;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.bandMultiplier = settings?.bandMultiplier || 1.8;
      params.momentumPeriod = settings?.momentumPeriod || 12;
      params.surgeThreshold = settings?.surgeThreshold || 40;
      params.fadeSmooth = settings?.fadeSmooth || 5;
      break;
    case "nebula_phase_bands":
      params.kalmanGain = settings?.kalmanGain || 0.05;
      params.entropyPeriod = settings?.entropyPeriod || 20;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.bandMultiplier = settings?.bandMultiplier || 2.0;
      params.phaseSmooth = settings?.phaseSmooth || 5;
      break;
    case "cipher_harmonic_veil":
      params.maxCyclePeriod = settings?.maxCyclePeriod || 50;
      params.hurstPeriod = settings?.hurstPeriod || 100;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.bandMultiplier = settings?.bandMultiplier || 2.0;
      params.smooth = settings?.smooth || 5;
      break;
    case "titan_pulse_signal":
      params.kamaPeriod = settings?.kamaPeriod || 10;
      params.kamaFast = settings?.kamaFast || 2;
      params.kamaSlow = settings?.kamaSlow || 30;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.atrMultiplier = settings?.atrMultiplier || 1.5;
      params.squeezeLookback = settings?.squeezeLookback || 20;
      params.signalThreshold = settings?.signalThreshold || 40;
      break;
    case "aurora_cascade_flow":
      params.erPeriod = settings?.erPeriod || 10;
      params.fastSC = settings?.fastSC || 2;
      params.slowMin = settings?.slowMin || 10;
      params.slowMax = settings?.slowMax || 40;
      params.smoothFactor = settings?.smoothFactor || 3;
      break;
    case "eclipse_stealth_trail":
      params.mcgPeriod = settings?.mcgPeriod || 14;
      params.fdPeriod = settings?.fdPeriod || 30;
      params.fdThreshold = settings?.fdThreshold || 1.5;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.atrMultiplier = settings?.atrMultiplier || 1.8;
      break;
    case "wraith_convergence_engine":
      params.period = settings?.period || 20;
      params.kamaFast = settings?.kamaFast || 2;
      params.kamaSlow = settings?.kamaSlow || 30;
      params.convergenceThreshold = settings?.convergenceThreshold || 70;
      break;
    case "flux_momentum_trail":
      params.fastPeriod = settings?.fastPeriod || 8;
      params.slowPeriod = settings?.slowPeriod || 21;
      params.rocPeriod = settings?.rocPeriod || 12;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.surgeThreshold = settings?.surgeThreshold || 70;
      break;
    case "apex_predator_signal":
      params.zlemaPeriod = settings?.zlemaPeriod || 21;
      params.rocPeriod = settings?.rocPeriod || 12;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.volPeriod = settings?.volPeriod || 20;
      params.minConfluence = settings?.minConfluence || 2;
      break;
    case "phantom_divergence_tracker":
      params.smoothPeriod = settings?.smoothPeriod || 21;
      params.volPeriod = settings?.volPeriod || 20;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.divergenceThreshold = settings?.divergenceThreshold || 60;
      break;
    case "chaos_sentinel":
      params.attractorPeriod = settings?.attractorPeriod || 21;
      params.lyapunovPeriod = settings?.lyapunovPeriod || 14;
      params.smoothing = settings?.smoothing || 5;
      params.chaosThreshold = settings?.chaosThreshold || 50;
      break;
    case "helix_phase_engine":
      params.detrendPeriod = settings?.detrendPeriod || 20;
      params.hilbertLength = settings?.hilbertLength || 7;
      params.ampMultiplier = settings?.ampMultiplier || 1.5;
      params.velocitySmooth = settings?.velocitySmooth || 5;
      params.leadSensitivity = settings?.leadSensitivity || 55;
      break;
    case "prism_wavelet_cascade":
      params.waveletDepth = settings?.waveletDepth || 3;
      params.smoothPeriod = settings?.smoothPeriod || 8;
      params.alignThreshold = settings?.alignThreshold || 70;
      params.splitThreshold = settings?.splitThreshold || 30;
      break;
    case "mirage_depth_scanner":
      params.windowLength = settings?.windowLength || 30;
      params.corridorMultiplier = settings?.corridorMultiplier || 1.5;
      params.depthSmooth = settings?.depthSmooth || 5;
      params.signalThreshold = settings?.signalThreshold || 65;
      break;
    case "quantum_drift_mapper":
      params.dfaPeriod = settings?.dfaPeriod || 30;
      params.dfaScales = settings?.dfaScales || 5;
      params.corridorMultiplier = settings?.corridorMultiplier || 1.5;
      params.smooth = settings?.smooth || 5;
      params.persistenceThreshold = settings?.persistenceThreshold || 60;
      break;
    case "sovereign_gravity_arc":
      params.gravityWindow = settings?.gravityWindow || 30;
      params.orbitalRadius = settings?.orbitalRadius || 2.0;
      params.velocitySmooth = settings?.velocitySmooth || 5;
      params.escapeMultiplier = settings?.escapeMultiplier || 1.8;
      break;
    case "solaris_trend_engine":
      params.kamaFast = settings?.kamaFast || 2;
      params.kamaSlow = settings?.kamaSlow || 30;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.supertrendMult = settings?.supertrendMult || 3.0;
      params.adxPeriod = settings?.adxPeriod || 14;
      params.adxThreshold = settings?.adxThreshold || 25;
      break;
    case "stellar_confluence_ribbon":
      params.blendPeriod = settings?.blendPeriod || 21;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.innerMult = settings?.innerMult || 1.5;
      params.outerMult = settings?.outerMult || 2.8;
      params.confluenceThreshold = settings?.confluenceThreshold || 70;
      params.nodeThreshold = settings?.nodeThreshold || 80;
      break;
    case "kinetic_pressure_zones":
      params.period = settings?.period || 14;
      params.rocPeriod = settings?.rocPeriod || 10;
      params.atrPeriod = settings?.atrPeriod || 14;
      params.zoneWidthMult = settings?.zoneWidthMult || 1.2;
      params.oversoldLevel = settings?.oversoldLevel || 30;
      params.overboughtLevel = settings?.overboughtLevel || 70;
      break;
    case "nova_resonance_field":
      params.period = settings?.period || 14;
      params.sensitivity = settings?.sensitivity || 2.0;
      params.signalPeriod = settings?.signalPeriod || 9;
      params.novaThreshold = settings?.novaThreshold || 70;
      params.divergenceLookback = settings?.divergenceLookback || 20;
      break;
    case "spectre_liquidity_matrix":
      params.swingLookback = settings?.swingLookback || 5;
      params.obStrength    = settings?.obStrength    || 1.5;
      params.period        = settings?.period        || 20;
      params.maxFVGAge     = settings?.maxFVGAge     || 50;
      break;
    case "radiant_fibonacci_matrix":
      params.lookback  = settings?.lookback  || 55;
      params.atrPeriod = settings?.atrPeriod || 14;
      break;
    default:
      // Generic period-based indicators
      params.period = settings?.period || 20;
      break;
  }

  const result: ArsenalIndicator = {
    id: `arsenal-${purchaseId}`,
    purchaseId,
    itemName: item.name,
    type: indicatorConfig.type,
    displayType: indicatorConfig.displayType,
    enabled: true,
    color: settings?.color || "#3b82f6",
    lineWidth: settings?.lineWidth || 2,
    parameters: params,
  };

  return result;
}

// Helper to convert marketplace item to strategy
export function marketplaceItemToStrategy(
  purchaseId: string,
  item: {
    _id: string;
    name: string;
    category: string;
    strategyConfig?: IStrategyConfig;
  },
): ArsenalStrategy | null {
  if (item.category !== "strategy") return null;
  if (!item.strategyConfig) return null;

  return {
    id: `strategy-${purchaseId}`,
    purchaseId,
    itemName: item.name,
    config: item.strategyConfig,
    enabled: true,
  };
}
