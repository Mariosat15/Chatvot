"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Play,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus,
  GripVertical,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Available indicators for strategy conditions
const AVAILABLE_INDICATORS = [
  // ── Price ────────────────────────────────────────────────────────────────
  { value: "price",  label: "Current Price",  category: "price" },
  { value: "open",   label: "Open Price",     category: "price" },
  { value: "high",   label: "High Price",     category: "price" },
  { value: "low",    label: "Low Price",      category: "price" },
  { value: "close",  label: "Close Price",    category: "price" },

  // ── Trend ─────────────────────────────────────────────────────────────────
  { value: "sma",             label: "SMA (Simple Moving Average)",       category: "trend",      hasParams: true },
  { value: "ema",             label: "EMA (Exponential Moving Average)",  category: "trend",      hasParams: true },
  { value: "wma",             label: "WMA (Weighted Moving Average)",     category: "trend",      hasParams: true },
  { value: "hma",             label: "HMA (Hull Moving Average)",         category: "trend",      hasParams: true },
  { value: "kama",            label: "KAMA (Kaufman Adaptive MA)",        category: "trend",      hasParams: true },
  { value: "supertrend_line", label: "Supertrend Line",                   category: "trend",      hasParams: true },
  { value: "vwap",            label: "VWAP (Rolling)",                    category: "trend",      hasParams: true },

  // ── Volatility ────────────────────────────────────────────────────────────
  { value: "bb_upper",  label: "Bollinger Upper Band",  category: "volatility", hasParams: true },
  { value: "bb_middle", label: "Bollinger Middle Band", category: "volatility", hasParams: true },
  { value: "bb_lower",  label: "Bollinger Lower Band",  category: "volatility", hasParams: true },
  { value: "atr",       label: "ATR (Avg True Range)",  category: "volatility", hasParams: true },

  // ── Momentum ──────────────────────────────────────────────────────────────
  { value: "rsi",            label: "RSI (0–100)",                   category: "momentum", hasParams: true },
  { value: "stoch",          label: "Stochastic %K (0–100)",         category: "momentum", hasParams: true },
  { value: "cci",            label: "CCI",                           category: "momentum", hasParams: true },
  { value: "williams_r",     label: "Williams %R normalized (0–100)", category: "momentum", hasParams: true },
  { value: "roc",            label: "Rate of Change (%)",            category: "momentum", hasParams: true },
  { value: "macd_line",      label: "MACD Line",                     category: "momentum", hasParams: true },
  { value: "macd_signal",    label: "MACD Signal Line",              category: "momentum", hasParams: true },
  { value: "macd_histogram", label: "MACD Histogram",                category: "momentum", hasParams: true },

  // ── Support / Resistance ──────────────────────────────────────────────────
  { value: "fib_618", label: "Fibonacci 61.8% Level (dynamic)", category: "s/r", hasParams: true },

  // ── Premium Indicators ────────────────────────────────────────────────────
  // Each returns a single scalar value suitable for above/below/crosses conditions
  { value: "kinetic_score",    label: "⭐ Kinetic Pressure Score (0–100)",            category: "premium", hasParams: true },
  { value: "nova_score",       label: "⭐ Nova Resonance Score (0–100)",              category: "premium", hasParams: true },
  { value: "nexus_score",      label: "⭐ Nexus Trend Score (−100 bear → +100 bull)", category: "premium", hasParams: true },
  { value: "solaris_line",     label: "⭐ Solaris Adaptive Trend Line (price)",       category: "premium", hasParams: true },
  { value: "stellar_core",     label: "⭐ Stellar Confluence Core Line (price)",      category: "premium", hasParams: true },
  { value: "sovereign_center", label: "⭐ Sovereign Gravity Center (price)",          category: "premium", hasParams: true },
  { value: "spectre_bias",     label: "⭐ Spectre Bias Score (+100 bull / −100 bear)", category: "premium", hasParams: true },
  { value: "phantom_rsi",      label: "⭐ Phantom Divergence RSI (0–100)",           category: "premium", hasParams: true },
  { value: "orion_score",      label: "⭐ Orion Momentum Score (0–100)",             category: "premium", hasParams: true },
  { value: "prism_line",       label: "⭐ Prism Wavelet Core Line (price)",           category: "premium", hasParams: true },
  { value: "cipher_line",      label: "⭐ Cipher Harmonic Line (price)",              category: "premium", hasParams: true },
  { value: "helix_line",       label: "⭐ Helix Phase Engine Line (price)",           category: "premium", hasParams: true },
  { value: "quantum_drift",    label: "⭐ Quantum Drift Mapper Line (price)",         category: "premium", hasParams: true },
  { value: "chaos_line",       label: "⭐ Chaos Sentinel Line (price)",               category: "premium", hasParams: true },
  { value: "aurora_line",      label: "⭐ Aurora Cascade Flow Line (price)",          category: "premium", hasParams: true },
  { value: "flux_line",        label: "⭐ Flux Momentum Trail Line (price)",          category: "premium", hasParams: true },
  { value: "eclipse_line",     label: "⭐ Eclipse Stealth Trail Line (price)",        category: "premium", hasParams: true },
  { value: "wraith_line",      label: "⭐ Wraith Convergence Line (price)",           category: "premium", hasParams: true },
  { value: "apex_line",        label: "⭐ Apex Predator Signal Line (price)",         category: "premium", hasParams: true },
  { value: "nebula_mid",       label: "⭐ Nebula Phase Mid Line (price)",             category: "premium", hasParams: true },
  { value: "fractal_line",     label: "⭐ Fractal Pulse Grid Line (price)",           category: "premium", hasParams: true },
  { value: "vortex_line",      label: "⭐ Vortex Drift Cloud Line (price)",           category: "premium", hasParams: true },
  { value: "mirage_line",      label: "⭐ Mirage Depth Scanner Line (price)",         category: "premium", hasParams: true },
];

const OPERATORS = [
  { value: "above", label: "is above" },
  { value: "below", label: "is below" },
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
  { value: "between", label: "is between" },
  { value: "equals", label: "equals" },
];

const SIGNAL_TYPES = [
  {
    value: "strong_buy",
    label: "Strong Buy",
    color: "bg-green-500",
    icon: ArrowUpCircle,
  },
  { value: "buy", label: "Buy", color: "bg-green-400", icon: TrendingUp },
  { value: "neutral", label: "Neutral", color: "bg-gray-400", icon: Minus },
  { value: "sell", label: "Sell", color: "bg-red-400", icon: TrendingDown },
  {
    value: "strong_sell",
    label: "Strong Sell",
    color: "bg-red-500",
    icon: ArrowDownCircle,
  },
];

// ── Marker shape options ─────────────────────────────────────────────────────
const MARKER_SHAPES = [
  { value: "arrowUp",   label: "Arrow Up ▲",   glyph: "▲" },
  { value: "arrowDown", label: "Arrow Down ▼", glyph: "▼" },
  { value: "circle",    label: "Circle ●",     glyph: "●" },
  { value: "square",    label: "Square ■",     glyph: "■" },
] as const;

interface StrategyCondition {
  id: string;
  indicator: string;
  indicatorParams?: Record<string, number>;
  operator: string;
  compareWith: "value" | "indicator";
  compareValue?: number;
  compareIndicator?: string;
  compareIndicatorParams?: Record<string, number>;
}

interface StrategyRule {
  id: string;
  name: string;
  conditions: StrategyCondition[];
  logic: "AND" | "OR";
  signal: string;
  signalStrength: number;
  // Per-rule marker styling
  markerShape?: "arrowUp" | "arrowDown" | "circle" | "square";
  markerColor?: string;
  markerSize?: number;
  showLabel?: boolean;
}

interface StrategyConfig {
  rules: StrategyRule[];
  defaultIndicators: string[];
  signalDisplay: {
    showOnChart: boolean;
    showArrows: boolean;
    showLabels: boolean;
    arrowSize: "small" | "medium" | "large";
  };
}

interface StrategyBuilderProps {
  initialConfig?: StrategyConfig;
  onChange: (config: StrategyConfig) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const getDefaultParams = (indicator: string): Record<string, number> => {
  switch (indicator) {
    case "sma":
    case "ema":
    case "wma":
    case "hma":
      return { period: 20 };
    case "kama":
      return { period: 10, fast: 2, slow: 30 };
    case "supertrend_line":
      return { period: 10, multiplier: 3 };
    case "vwap":
    case "sovereign_center":
      return { period: 20 };
    case "bb_upper":
    case "bb_middle":
    case "bb_lower":
      return { period: 20, stdDev: 2 };
    case "atr":
      return { period: 14 };
    case "rsi":
    case "stoch":
    case "williams_r":
    case "phantom_rsi":
    case "orion_score":
      return { period: 14 };
    case "cci":
      return { period: 20 };
    case "roc":
      return { period: 10 };
    case "macd_line":
    case "macd_signal":
    case "macd_histogram":
      return { fast: 12, slow: 26, signal: 9 };
    case "fib_618":
      return { lookback: 55 };
    case "kinetic_score":
    case "nova_score":
      return { period: 14 };
    case "nexus_score":
      return { fast: 9, slow: 21 };
    case "solaris_line":
    case "stellar_core":
    case "spectre_bias":
    case "prism_line":
    case "cipher_line":
    case "helix_line":
    case "quantum_drift":
    case "chaos_line":
    case "aurora_line":
    case "flux_line":
    case "eclipse_line":
    case "wraith_line":
    case "apex_line":
    case "nebula_mid":
    case "fractal_line":
    case "vortex_line":
    case "mirage_line":
      return { period: 20 };
    default:
      return {};
  }
};

export default function StrategyBuilder({
  initialConfig,
  onChange,
}: StrategyBuilderProps) {
  const [config, setConfig] = useState<StrategyConfig>(
    initialConfig || {
      rules: [],
      defaultIndicators: [],
      signalDisplay: {
        showOnChart: true,
        showArrows: true,
        showLabels: true,
        arrowSize: "medium",
      },
    },
  );

  const updateConfig = useCallback(
    (newConfig: StrategyConfig) => {
      setConfig(newConfig);
      onChange(newConfig);
    },
    [onChange],
  );

  // Add a new rule
  const addRule = () => {
    const newRule: StrategyRule = {
      id: generateId(),
      name: `Rule ${config.rules.length + 1}`,
      conditions: [],
      logic: "AND",
      signal: "buy",
      signalStrength: 3,
    };
    updateConfig({ ...config, rules: [...config.rules, newRule] });
  };

  // Remove a rule
  const removeRule = (ruleId: string) => {
    updateConfig({
      ...config,
      rules: config.rules.filter((r) => r.id !== ruleId),
    });
  };

  // Duplicate a rule
  const duplicateRule = (rule: StrategyRule) => {
    const newRule: StrategyRule = {
      ...rule,
      id: generateId(),
      name: `${rule.name} (copy)`,
      conditions: rule.conditions.map((c) => ({ ...c, id: generateId() })),
    };
    updateConfig({ ...config, rules: [...config.rules, newRule] });
  };

  // Update a rule
  const updateRule = (ruleId: string, updates: Partial<StrategyRule>) => {
    updateConfig({
      ...config,
      rules: config.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r,
      ),
    });
  };

  // Add condition to a rule
  const addCondition = (ruleId: string) => {
    const newCondition: StrategyCondition = {
      id: generateId(),
      indicator: "price",
      operator: "above",
      compareWith: "indicator",
      compareIndicator: "sma",
      compareIndicatorParams: { period: 20 },
    };
    updateConfig({
      ...config,
      rules: config.rules.map((r) =>
        r.id === ruleId
          ? { ...r, conditions: [...r.conditions, newCondition] }
          : r,
      ),
    });
  };

  // Remove condition from a rule
  const removeCondition = (ruleId: string, conditionId: string) => {
    updateConfig({
      ...config,
      rules: config.rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: r.conditions.filter((c) => c.id !== conditionId),
            }
          : r,
      ),
    });
  };

  // Update a condition
  const updateCondition = (
    ruleId: string,
    conditionId: string,
    updates: Partial<StrategyCondition>,
  ) => {
    updateConfig({
      ...config,
      rules: config.rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: r.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c,
              ),
            }
          : r,
      ),
    });
  };

  // Get indicator info
  const getIndicatorInfo = (value: string) =>
    AVAILABLE_INDICATORS.find((i) => i.value === value);

  // Render condition editor
  const renderCondition = (
    rule: StrategyRule,
    condition: StrategyCondition,
    index: number,
  ) => {
    const indicatorInfo = getIndicatorInfo(condition.indicator);
    const compareIndicatorInfo = condition.compareIndicator
      ? getIndicatorInfo(condition.compareIndicator)
      : null;

    return (
      <div
        key={condition.id}
        className="flex items-start gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700"
      >
        <div className="flex items-center gap-1 text-gray-500 pt-2">
          <GripVertical className="h-4 w-4" />
          <span className="text-xs font-mono">{index + 1}</span>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
          {/* Indicator Selection */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Indicator</Label>
            <Select
              value={condition.indicator}
              onValueChange={(v) => {
                const info = getIndicatorInfo(v);
                updateCondition(rule.id, condition.id, {
                  indicator: v,
                  indicatorParams: info?.hasParams
                    ? getDefaultParams(v)
                    : undefined,
                });
              }}
            >
              <SelectTrigger className="h-9 bg-gray-800 border-gray-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(
                  AVAILABLE_INDICATORS.reduce(
                    (acc, ind) => {
                      if (!acc[ind.category]) acc[ind.category] = [];
                      acc[ind.category].push(ind);
                      return acc;
                    },
                    {} as Record<string, typeof AVAILABLE_INDICATORS>,
                  ),
                ).map(([category, indicators]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs text-gray-500 uppercase">
                      {category}
                    </div>
                    {indicators.map((ind) => (
                      <SelectItem key={ind.value} value={ind.value}>
                        {ind.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>

            {/* Indicator Parameters */}
            {indicatorInfo?.hasParams && condition.indicatorParams && (
              <div className="flex gap-1">
                {Object.entries(condition.indicatorParams).map(
                  ([key, value]) => (
                    <Input
                      key={key}
                      type="number"
                      value={value}
                      onChange={(e) =>
                        updateCondition(rule.id, condition.id, {
                          indicatorParams: {
                            ...condition.indicatorParams,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                      className="h-7 text-xs bg-gray-800 border-gray-700"
                      placeholder={key}
                      title={key}
                    />
                  ),
                )}
              </div>
            )}
          </div>

          {/* Operator Selection */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Condition</Label>
            <Select
              value={condition.operator}
              onValueChange={(v) =>
                updateCondition(rule.id, condition.id, { operator: v })
              }
            >
              <SelectTrigger className="h-9 bg-gray-800 border-gray-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Compare With */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Compare with</Label>
            <div className="flex gap-1">
              <Select
                value={condition.compareWith}
                onValueChange={(v: "value" | "indicator") =>
                  updateCondition(rule.id, condition.id, {
                    compareWith: v,
                    compareValue: v === "value" ? 0 : undefined,
                    compareIndicator: v === "indicator" ? "sma" : undefined,
                    compareIndicatorParams:
                      v === "indicator" ? { period: 20 } : undefined,
                  })
                }
              >
                <SelectTrigger className="h-9 w-24 bg-gray-800 border-gray-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicator">Indicator</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                </SelectContent>
              </Select>

              {condition.compareWith === "value" ? (
                <Input
                  type="number"
                  value={condition.compareValue || 0}
                  onChange={(e) =>
                    updateCondition(rule.id, condition.id, {
                      compareValue: Number(e.target.value),
                    })
                  }
                  className="h-9 flex-1 bg-gray-800 border-gray-700 text-sm"
                  placeholder="Value"
                />
              ) : (
                <Select
                  value={condition.compareIndicator || "sma"}
                  onValueChange={(v) => {
                    const info = getIndicatorInfo(v);
                    updateCondition(rule.id, condition.id, {
                      compareIndicator: v,
                      compareIndicatorParams: info?.hasParams
                        ? getDefaultParams(v)
                        : undefined,
                    });
                  }}
                >
                  <SelectTrigger className="h-9 flex-1 bg-gray-800 border-gray-700 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_INDICATORS.map((ind) => (
                      <SelectItem key={ind.value} value={ind.value}>
                        {ind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Compare Indicator Parameters */}
            {condition.compareWith === "indicator" &&
              compareIndicatorInfo?.hasParams &&
              condition.compareIndicatorParams && (
                <div className="flex gap-1">
                  {Object.entries(condition.compareIndicatorParams).map(
                    ([key, value]) => (
                      <Input
                        key={key}
                        type="number"
                        value={value}
                        onChange={(e) =>
                          updateCondition(rule.id, condition.id, {
                            compareIndicatorParams: {
                              ...condition.compareIndicatorParams,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                        className="h-7 text-xs bg-gray-800 border-gray-700"
                        placeholder={key}
                        title={key}
                      />
                    ),
                  )}
                </div>
              )}
          </div>

          {/* Delete Button */}
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeCondition(rule.id, condition.id)}
              className="h-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Render rule card
  const renderRule = (rule: StrategyRule) => {
    const signalInfo = SIGNAL_TYPES.find((s) => s.value === rule.signal);
    const SignalIcon = signalInfo?.icon || Minus;

    return (
      <Card key={rule.id} className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Input
                value={rule.name}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                className="h-8 w-48 bg-gray-900 border-gray-600 font-medium"
              />
              <Badge
                className={cn(
                  signalInfo?.color,
                  "text-white flex items-center gap-1",
                )}
              >
                <SignalIcon className="h-3 w-3" />
                {signalInfo?.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateRule(rule)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRule(rule.id)}
                className="text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Conditions */}
          <div className="space-y-2">
            {rule.conditions.length === 0 ? (
              <div className="text-center py-4 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                No conditions yet. Add a condition to define when this signal
                triggers.
              </div>
            ) : (
              rule.conditions.map((condition, index) => (
                <div key={condition.id}>
                  {index > 0 && (
                    <div className="flex items-center justify-center py-1">
                      <Select
                        value={rule.logic}
                        onValueChange={(v: "AND" | "OR") =>
                          updateRule(rule.id, { logic: v })
                        }
                      >
                        <SelectTrigger className="h-6 w-16 bg-gray-900 border-gray-700 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {renderCondition(rule, condition, index)}
                </div>
              ))
            )}
          </div>

          {/* ── Bottom: Add Condition + unified Signal Output panel ── */}
          <div className="pt-2 border-t border-gray-700 space-y-3">

            {/* Add Condition button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addCondition(rule.id)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Condition
            </Button>

            {/* ── Signal Output panel — all settings in one place ── */}
            <div className="rounded-lg border border-gray-600 bg-gray-900/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Signal Output
              </p>

              {/* Row A: Signal type + Strength */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Signal type */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-400 whitespace-nowrap">Signal type</Label>
                  <Select
                    value={rule.signal}
                    onValueChange={(v) => updateRule(rule.id, { signal: v })}
                  >
                    <SelectTrigger className="h-8 w-36 bg-gray-800 border-gray-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIGNAL_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex items-center gap-2">
                            <s.icon className="h-4 w-4" />
                            {s.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Strength */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-400 whitespace-nowrap">Strength</Label>
                  <Select
                    value={String(rule.signalStrength)}
                    onValueChange={(v) =>
                      updateRule(rule.id, { signalStrength: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-8 w-16 bg-gray-800 border-gray-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Show label toggle */}
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs text-gray-400 whitespace-nowrap">Show label</Label>
                  <Switch
                    checked={rule.showLabel !== false}
                    onCheckedChange={(v) =>
                      updateRule(rule.id, { showLabel: v })
                    }
                  />
                </div>
              </div>

              {/* Row B: Marker appearance */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Shape */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-400 whitespace-nowrap">Shape</Label>
                  <Select
                    value={rule.markerShape ?? "auto"}
                    onValueChange={(v) =>
                      updateRule(rule.id, {
                        markerShape:
                          v === "auto"
                            ? undefined
                            : (v as StrategyRule["markerShape"]),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-36 bg-gray-800 border-gray-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (by signal)</SelectItem>
                      {MARKER_SHAPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Color */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-400 whitespace-nowrap">Color</Label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={rule.markerColor ?? "#4ade80"}
                      onChange={(e) =>
                        updateRule(rule.id, { markerColor: e.target.value })
                      }
                      className="h-8 w-10 rounded border border-gray-700 bg-gray-800 cursor-pointer p-0.5"
                      title="Custom color (overrides signal default)"
                    />
                    {rule.markerColor && (
                      <button
                        onClick={() =>
                          updateRule(rule.id, { markerColor: undefined })
                        }
                        className="text-xs text-gray-500 hover:text-white"
                        title="Reset to default"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Size */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-400 whitespace-nowrap">Size</Label>
                  <Select
                    value={rule.markerSize !== undefined ? String(rule.markerSize) : "auto"}
                    onValueChange={(v) =>
                      updateRule(rule.id, {
                        markerSize: v === "auto" ? undefined : Number(v),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-20 bg-gray-800 border-gray-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Live preview */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-gray-500">Preview:</span>
                  <span
                    style={{
                      color: rule.markerColor ?? "#6b7280",
                      fontSize: "20px",
                      lineHeight: 1,
                    }}
                    title="Approximate chart preview"
                  >
                    {MARKER_SHAPES.find(
                      (s) => s.value === (rule.markerShape ?? "circle"),
                    )?.glyph ?? "●"}
                  </span>
                  {rule.showLabel !== false && (
                    <span
                      style={{ color: rule.markerColor ?? "#6b7280" }}
                      className="text-xs font-mono opacity-60"
                    >
                      {rule.signal.replace(/_/g, " ").toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Strategy Builder</h3>
          <p className="text-sm text-gray-400">
            Create trading rules by combining indicators and conditions
          </p>
        </div>
        <Button onClick={addRule}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Rules */}
      <div className="space-y-4">
        {config.rules.length === 0 ? (
          <Card className="bg-gray-800/30 border-gray-700 border-dashed">
            <CardContent className="py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
              <h4 className="text-white font-medium mb-1">No Rules Defined</h4>
              <p className="text-gray-400 text-sm mb-4">
                Add rules to create buy/sell signals based on indicator
                conditions
              </p>
              <Button onClick={addRule}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          config.rules.map((rule) => renderRule(rule))
        )}
      </div>

      {/* Display Settings */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Signal Display Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-400">Show on Chart</Label>
              <Switch
                checked={config.signalDisplay.showOnChart}
                onCheckedChange={(v) =>
                  updateConfig({
                    ...config,
                    signalDisplay: { ...config.signalDisplay, showOnChart: v },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-400">Show Arrows</Label>
              <Switch
                checked={config.signalDisplay.showArrows}
                onCheckedChange={(v) =>
                  updateConfig({
                    ...config,
                    signalDisplay: { ...config.signalDisplay, showArrows: v },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-400">Show Labels</Label>
              <Switch
                checked={config.signalDisplay.showLabels}
                onCheckedChange={(v) =>
                  updateConfig({
                    ...config,
                    signalDisplay: { ...config.signalDisplay, showLabels: v },
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-400">Arrow Size</Label>
              <Select
                value={config.signalDisplay.arrowSize}
                onValueChange={(v: "small" | "medium" | "large") =>
                  updateConfig({
                    ...config,
                    signalDisplay: { ...config.signalDisplay, arrowSize: v },
                  })
                }
              >
                <SelectTrigger className="h-8 w-24 bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {config.rules.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="h-4 w-4" />
              Strategy Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {config.rules.map((rule, idx) => {
                const signalInfo = SIGNAL_TYPES.find(
                  (s) => s.value === rule.signal,
                );
                return (
                  <div
                    key={rule.id}
                    className="p-2 bg-gray-900/50 rounded border border-gray-700"
                  >
                    <span className="text-gray-400">Rule {idx + 1}:</span>{" "}
                    <span className="text-white">
                      When{" "}
                      {rule.conditions.map((c, i) => {
                        const ind = getIndicatorInfo(c.indicator);
                        const compInd = c.compareIndicator
                          ? getIndicatorInfo(c.compareIndicator)
                          : null;
                        const op = OPERATORS.find(
                          (o) => o.value === c.operator,
                        );
                        return (
                          <span key={c.id}>
                            {i > 0 && (
                              <span className="text-cyan-400">
                                {" "}
                                {rule.logic}{" "}
                              </span>
                            )}
                            <span className="text-yellow-400">
                              {ind?.label}
                            </span>{" "}
                            {op?.label}{" "}
                            {c.compareWith === "value" ? (
                              <span className="text-purple-400">
                                {c.compareValue}
                              </span>
                            ) : (
                              <span className="text-yellow-400">
                                {compInd?.label}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </span>
                    {" → "}
                    <Badge
                      className={cn(signalInfo?.color, "text-white text-xs")}
                    >
                      {signalInfo?.label}
                    </Badge>
                    {/* Marker style preview */}
                    {(rule.markerShape || rule.markerColor || rule.markerSize) && (
                      <span className="ml-2 text-xs text-gray-500">
                        [
                        {rule.markerShape && <span> {MARKER_SHAPES.find(s => s.value === rule.markerShape)?.glyph}</span>}
                        {rule.markerColor && (
                          <span
                            style={{ color: rule.markerColor }}
                            className="mx-0.5"
                          >
                            ■
                          </span>
                        )}
                        {rule.markerSize !== undefined && <span> sz:{rule.markerSize}</span>}
                        ]
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
