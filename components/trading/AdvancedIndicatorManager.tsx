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
    };

    onIndicatorsChange([...indicators, newIndicator]);
    setSelectedIndicator(newIndicator.id);
    setActiveTab("active");
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
                onChange={(e) => setSearchQuery(e.target.value)}
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
                    onClick={() => setActiveTab("active")}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors",
                      activeTab === "active"
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
          {/* Main Color */}
          <div className="space-y-1.5">
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

          {/* Line Width */}
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

          {/* Opacity */}
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

          {/* Multi-color for bands */}
          {(indicator.type === "bb" || indicator.type === "keltner") && (
            <div className="space-y-3 pt-2 border-t border-[#363a45]">
              <Label className="text-[12px] text-[#787B86]">Band Colors</Label>
              <div className="grid grid-cols-3 gap-2">
                {["upper", "middle", "lower"].map((band) => (
                  <div key={band} className="space-y-1">
                    <span className="text-[10px] text-[#787B86] capitalize">
                      {band}
                    </span>
                    <input
                      type="color"
                      value={
                        indicator.colors?.[
                          band as keyof typeof indicator.colors
                        ] || indicator.color
                      }
                      onChange={(e) =>
                        onUpdate({
                          colors: {
                            ...indicator.colors,
                            [band]: e.target.value,
                          },
                        })
                      }
                      className="w-full h-7 rounded border border-[#363a45] bg-[#131722] cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MACD Colors */}
          {indicator.type === "macd" && (
            <div className="space-y-3 pt-2 border-t border-[#363a45]">
              <Label className="text-[12px] text-[#787B86]">MACD Colors</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#787B86]">Signal</span>
                  <input
                    type="color"
                    value={indicator.colors?.signal || "#f23645"}
                    onChange={(e) =>
                      onUpdate({
                        colors: { ...indicator.colors, signal: e.target.value },
                      })
                    }
                    className="w-full h-7 rounded border border-[#363a45] bg-[#131722] cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#787B86]">Positive</span>
                  <input
                    type="color"
                    value={indicator.colors?.positive || "#26a69a"}
                    onChange={(e) =>
                      onUpdate({
                        colors: {
                          ...indicator.colors,
                          positive: e.target.value,
                        },
                      })
                    }
                    className="w-full h-7 rounded border border-[#363a45] bg-[#131722] cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#787B86]">Negative</span>
                  <input
                    type="color"
                    value={indicator.colors?.negative || "#ef5350"}
                    onChange={(e) =>
                      onUpdate({
                        colors: {
                          ...indicator.colors,
                          negative: e.target.value,
                        },
                      })
                    }
                    className="w-full h-7 rounded border border-[#363a45] bg-[#131722] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Visibility Tab */}
        <TabsContent
          value="visibility"
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Label className="text-[13px] text-[#d1d4dc]">Show Indicator</Label>
            <button
              onClick={() => onUpdate({ enabled: !indicator.enabled })}
              className={cn(
                "w-10 h-5 rounded-full transition-colors",
                indicator.enabled ? "bg-[#2962FF]" : "bg-[#363a45]",
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  indicator.enabled ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-[13px] text-[#d1d4dc]">Show Label</Label>
            <button
              onClick={() => onUpdate({ showLabel: !indicator.showLabel })}
              className={cn(
                "w-10 h-5 rounded-full transition-colors",
                indicator.showLabel !== false ? "bg-[#2962FF]" : "bg-[#363a45]",
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  indicator.showLabel !== false
                    ? "translate-x-5"
                    : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          {/* Component visibility for multi-component indicators */}
          {(indicator.type === "bb" || indicator.type === "keltner") && (
            <div className="space-y-2 pt-2 border-t border-[#363a45]">
              <Label className="text-[12px] text-[#787B86]">
                Band Visibility
              </Label>
              {["upper", "middle", "lower"].map((band) => (
                <div key={band} className="flex items-center justify-between">
                  <span className="text-[13px] text-[#d1d4dc] capitalize">
                    {band} Band
                  </span>
                  <button
                    onClick={() =>
                      onUpdate({
                        visibility: {
                          ...indicator.visibility,
                          [band]: !(
                            indicator.visibility?.[
                              band as keyof typeof indicator.visibility
                            ] !== false
                          ),
                        },
                      })
                    }
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors",
                      indicator.visibility?.[
                        band as keyof typeof indicator.visibility
                      ] !== false
                        ? "bg-[#2962FF]"
                        : "bg-[#363a45]",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform",
                        indicator.visibility?.[
                          band as keyof typeof indicator.visibility
                        ] !== false
                          ? "translate-x-5"
                          : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {indicator.type === "macd" && (
            <div className="space-y-2 pt-2 border-t border-[#363a45]">
              <Label className="text-[12px] text-[#787B86]">
                Component Visibility
              </Label>
              {[
                { key: "main", label: "MACD Line" },
                { key: "signal", label: "Signal Line" },
                { key: "histogram", label: "Histogram" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[13px] text-[#d1d4dc]">{label}</span>
                  <button
                    onClick={() =>
                      onUpdate({
                        visibility: {
                          ...indicator.visibility,
                          [key]: !(
                            indicator.visibility?.[
                              key as keyof typeof indicator.visibility
                            ] !== false
                          ),
                        },
                      })
                    }
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors",
                      indicator.visibility?.[
                        key as keyof typeof indicator.visibility
                      ] !== false
                        ? "bg-[#2962FF]"
                        : "bg-[#363a45]",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform",
                        indicator.visibility?.[
                          key as keyof typeof indicator.visibility
                        ] !== false
                          ? "translate-x-5"
                          : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
