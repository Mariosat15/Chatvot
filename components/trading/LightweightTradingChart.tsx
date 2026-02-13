"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
} from "lightweight-charts";
import { useDragScroll } from "@/hooks/useDragScroll";
import {
  ForexSymbol,
  FOREX_PAIRS,
} from "@/lib/services/pnl-calculator.service";
import { usePrices } from "@/contexts/PriceProvider";
import { useChartSymbol } from "@/contexts/ChartSymbolContext";
import { OHLCCandle, Timeframe } from "@/lib/services/forex-historical.service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Loader2,
  TrendingUp,
  Minus,
  BarChart3,
  Settings,
  Maximize2,
  Minimize2,
  Grid3x3,
  Activity,
  BarChart,
  Grid,
  CircleDot,
  X,
  CandlestickChart,
  LineChart,
  ChevronDown,
  Clock,
  PanelRight,
  PanelBottom,
  LayoutGrid,
} from "lucide-react";
import AdvancedIndicatorManager, {
  CustomIndicator,
} from "./AdvancedIndicatorManager";
import ChartToolbar from "./ChartToolbar";
import { useChartDrawings } from "@/hooks/useChartDrawings";
import { DrawingToolType } from "@/lib/chart/primitives";
import { PeriodSeparatorPrimitive } from "@/lib/chart/primitives/period-separator.primitive";
import { SymbolSelector, SymbolSelectorButton } from "./SymbolSelector";
import OrderForm from "./OrderForm";
import PositionsTable from "./PositionsTable";
import { LiveAccountInfo } from "./LiveAccountInfo";
import Watchlist from "./Watchlist";
import { GripHorizontal } from "lucide-react";
import { useTradingArsenal } from "@/contexts/TradingArsenalContext";
import {
  calculateSMA, calculateEMA, calculateWMA, calculateDEMA, calculateTEMA, calculateHMA,
  calculateALMA, calculateKAMA, calculateZLEMA, calculateT3, calculateSMMA, calculateLSMA,
  calculateVIDYA, calculateMcGinley,
  calculateRSI, calculateMACD, calculateBollingerBands, calculateKeltnerChannels,
  calculateDonchianChannel, calculateIchimoku, calculateStochastic, calculateWilliamsR,
  calculateCCI, calculateADX, calculateMFI, calculateATR, calculateVWAP,
  calculateParabolicSAR, calculatePivotPoints, calculateOBV, calculateROC, calculateCMF,
  calculateMomentum,
  calculateSupertrend, calculateAroon, calculateVortex, calculateTRIX, calculateDPO,
  calculateKST, calculateCoppock, calculateElderRay,
  calculateStdDev, calculateHistVolatility, calculateChaikinVolatility, calculateMassIndex,
  calculateUlcerIndex, calculateRVI,
  calculateVWMA, calculateADLine, calculateForceIndex, calculateEOM, calculateNVI, calculatePVI,
  calculateUltimateOscillator, calculateAwesomeOscillator, calculateStochRSI, calculateTSI,
  calculatePPO, calculateFisherTransform, calculateConnorsRSI, calculateSMIErgodic,
  calculateLinRegChannel, calculateMAEnvelope, calculatePriceChannel, calculateChandelierExit,
  // Premium indicators
  calculateTrendPulse, calculateMarketRegime, calculateTrendComposite, calculateCompositeBreadth,
  calculateReversalSignal, calculatePredictiveRange, calculateBreakoutProb, calculateSentimentOsc,
  calculateWhaleAccumulation, calculateSmartMoneyFlow, calculateVolumeClimax, calculateNetBuyingPressure,
  calculateOrderFlowImbalance, calculateIntradayIntensity, calculateVolumeMomentum, calculateLiquidityHeatmap,
  calculateVolatilitySqueeze, calculateSqueezeMomentum, calculateVolatilityRatio, calculateRangeExpansion,
  calculateChoppyMarket, calculateFractalDimension, calculateAccelerationBands, calculateAdaptiveChannel,
  calculateAlphaMomentum, calculateEfficiencyRatio, calculateTrendPersistence, calculateMTFMomentum,
  calculateMomentumWave, calculateGapMomentum, calculateHeikinAshiTrend, calculateCycleDetector,
  calculateAdaptiveRSI, calculateMeanReversionBand, calculateTrendRibbon, calculateRelativeVigor,
  calculateDynamicPivots, calculatePriceActionScore, calculateErgodicVolume, calculateAnchoredVWAPBands,
} from "@/lib/services/indicators.service";

interface Position {
  _id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface PendingOrder {
  _id: string;
  symbol: string;
  side: "buy" | "sell";
  requestedPrice: number;
  quantity: number;
}

interface TradingProps {
  availableCapital: number;
  defaultLeverage: number;
  openPositionsCount: number;
  maxPositions: number;
  currentEquity: number;
  existingUsedMargin: number;
  currentBalance: number;
  startingCapital?: number;
  dailyRealizedPnl?: number;
  marginThresholds?: {
    LIQUIDATION: number;
    MARGIN_CALL: number;
    WARNING: number;
    SAFE: number;
  };
}

interface LightweightTradingChartProps {
  competitionId: string;
  positions?: Position[];
  pendingOrders?: PendingOrder[];
  tradingProps?: TradingProps;
}

// Debug logging - disable in production
const DEBUG = process.env.NODE_ENV === "development" && false; // Set to true only when debugging
const log = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args);
};

const LightweightTradingChart = ({
  competitionId,
  positions = [],
  pendingOrders = [],
  tradingProps,
}: LightweightTradingChartProps) => {
  // Track if component is mounted to prevent "Object is disposed" errors
  const isMountedRef = useRef(true);

  // Set up mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debug: Log positions received by chart component
  useEffect(() => {
    log("🎨 LightweightTradingChart received positions:", positions.length);
    log(
      "📊 Positions with TP/SL:",
      positions.map((p) => ({
        id: p._id,
        symbol: p.symbol,
        hasTP: !!p.takeProfit,
        hasSL: !!p.stopLoss,
        tp: p.takeProfit,
        sl: p.stopLoss,
      })),
    );
  }, [positions]);

  // ⚡ State to track TP/SL updates and position closures for immediate UI refresh
  const [tpslVersion, setTpslVersion] = useState(0);

  // (indicatorDataVersion removed - live updates now use lightweight refresh via series.update())
  const closedPositionIdsRef = useRef<Set<string>>(new Set());

  // Listen for TP/SL updates and position closures to immediately redraw position lines
  useEffect(() => {
    const handleTPSLUpdate = (event: CustomEvent) => {
      log("⚡ Chart received tpslUpdated event:", event.detail);
      // Increment version to trigger position line redraw
      setTpslVersion((v) => v + 1);
    };

    const handlePositionClosed = (event: CustomEvent) => {
      const { positionId, symbol: closedSymbol } = event.detail;
      log("⚡ Chart received positionClosed event:", positionId, closedSymbol);

      // Track this position as closed
      closedPositionIdsRef.current.add(positionId);

      // Immediately remove position lines from chart
      const series = candlestickSeriesRef.current;
      const entryLine = positionLinesRef.current.get(positionId);
      const tpLine = positionLinesRef.current.get(`${positionId}-tp`);
      const slLine = positionLinesRef.current.get(`${positionId}-sl`);
      const tpArea = tpSlSeriesRef.current.get(`${positionId}-tp-area`);
      const slArea = tpSlSeriesRef.current.get(`${positionId}-sl-area`);

      if (series) {
        try {
          if (entryLine) series.removePriceLine(entryLine);
          if (tpLine) series.removePriceLine(tpLine);
          if (slLine) series.removePriceLine(slLine);
        } catch {
          // Lines may already be removed
        }
      }

      if (chartRef.current) {
        try {
          if (tpArea) chartRef.current.removeSeries(tpArea);
          if (slArea) chartRef.current.removeSeries(slArea);
        } catch {
          // Series may already be removed
        }
      }

      // Clean up refs
      positionLinesRef.current.delete(positionId);
      positionLinesRef.current.delete(`${positionId}-tp`);
      positionLinesRef.current.delete(`${positionId}-sl`);
      tpSlSeriesRef.current.delete(`${positionId}-tp-area`);
      tpSlSeriesRef.current.delete(`${positionId}-sl-area`);

      // Increment version to trigger full redraw
      setTpslVersion((v) => v + 1);
    };

    window.addEventListener("tpslUpdated", handleTPSLUpdate as EventListener);
    window.addEventListener(
      "positionClosed",
      handlePositionClosed as EventListener,
    );
    return () => {
      window.removeEventListener(
        "tpslUpdated",
        handleTPSLUpdate as EventListener,
      );
      window.removeEventListener(
        "positionClosed",
        handlePositionClosed as EventListener,
      );
    };
  }, []);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const periodSeparatorRef = useRef<PeriodSeparatorPrimitive | null>(null);

  // Drag-to-scroll refs for horizontal scrollable areas
  const priceDisplayRef = useDragScroll<HTMLDivElement>();
  const toolbarRef = useDragScroll<HTMLDivElement>();

  // Store position price lines and filled areas
  const positionLinesRef = useRef<Map<string, any>>(new Map());
  const tpSlSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  const {
    prices,
    subscribe,
    unsubscribe,
    marketOpen,
    marketStatus,
    isStale,
    forceRefresh,
  } = usePrices();
  const { symbol, setSymbol } = useChartSymbol();

  // Get indicators and strategies from Trading Arsenal (marketplace purchases)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let arsenalIndicators: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let arsenalStrategies: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let arsenalSignals: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let setArsenalSignals: ((signals: any[]) => void) | null = null;
  try {
    const arsenal = useTradingArsenal();
    arsenalIndicators = arsenal.activeIndicators || [];
    arsenalStrategies = arsenal.activeStrategies || [];
    arsenalSignals = arsenal.signals || [];
    setArsenalSignals = arsenal.setSignals;
  } catch {
    // Arsenal context not available (e.g., outside of provider)
  }

  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [loading, setLoading] = useState(true);
  const [candlesLoaded, setCandlesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy loading state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Start with false - only set true AFTER server confirms there's more history
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const oldestCandleTimeRef = useRef<number | null>(null);
  const [showVolume, setShowVolume] = useState(false);
  const [chartType, setChartType] = useState<
    "candlestick" | "line" | "renko" | "heikinashi" | "pointfigure"
  >("candlestick");
  const [showGrid, setShowGrid] = useState(true);
  const [showPeriodSeparators, setShowPeriodSeparators] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chart-show-period-separators");
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [indicators, setIndicators] = useState<CustomIndicator[]>([]);
  // Drawing system using new primitive-based architecture
  const chartDrawings = useChartDrawings({
    storageKey: `chart-drawings-${competitionId}`,
    autoSave: true,
    defaultColor: "#2962ff",
    defaultLineWidth: 2,
  });
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [symbolDialogOpen, setSymbolDialogOpen] = useState(false);
  const [timeframeDialogOpen, setTimeframeDialogOpen] = useState(false);
  const [signalUpdateTrigger, setSignalUpdateTrigger] = useState(0);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0); // Triggers chart reload when server data updates
  const portalContainerRef = useRef<HTMLDivElement>(null);

  // OHLCV data display state
  const [ohlcvData, setOhlcvData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    change: number;
    changePercent: number;
  } | null>(null);

  // UTC time display - client-side only to avoid hydration mismatch
  const [utcTime, setUtcTime] = useState<string>("--:--:--");

  // Chart display settings - Load from localStorage
  const [showBidAskLines, setShowBidAskLines] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chart-show-bid-ask");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showPriceLabels, setShowPriceLabels] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chart-show-labels");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showTradeMarkers, setShowTradeMarkers] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chart-show-markers");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showTPSLZones, setShowTPSLZones] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chart-show-tpsl-zones");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showTPSLLines, setShowTPSLLines] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chart-show-tpsl-lines");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Price update mode and intervals from admin settings
  const [priceUpdateMode, setPriceUpdateMode] = useState<
    "polling" | "websocket"
  >("polling");
  const [pollingIntervalMs, setPollingIntervalMs] = useState(200);
  const [websocketIntervalMs, setWebsocketIntervalMs] = useState(200);

  // Update UTC time on client side only (avoids hydration mismatch)
  useEffect(() => {
    const updateTime = () => {
      setUtcTime(new Date().toISOString().slice(11, 19));
    };
    updateTime(); // Set immediately on mount
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch price update mode and intervals from server (cached for 10 seconds)
  useEffect(() => {
    let mounted = true;

    const fetchMode = async () => {
      try {
        const response = await fetch("/api/trading/price-update-mode");
        if (response.ok && mounted) {
          const data = await response.json();
          setPriceUpdateMode(data.mode || "polling");
          setPollingIntervalMs(data.pollingIntervalMs || 200);
          setWebsocketIntervalMs(data.websocketIntervalMs || 200);
        }
      } catch {
        // Default to polling on error
      }
    };

    fetchMode();
    // Re-check every 30 seconds in case admin changes the setting
    const intervalId = setInterval(fetchMode, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "chart-show-bid-ask",
        JSON.stringify(showBidAskLines),
      );
    }
  }, [showBidAskLines]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "chart-show-labels",
        JSON.stringify(showPriceLabels),
      );
    }
  }, [showPriceLabels]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "chart-show-markers",
        JSON.stringify(showTradeMarkers),
      );
    }
  }, [showTradeMarkers]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "chart-show-tpsl-zones",
        JSON.stringify(showTPSLZones),
      );
    }
  }, [showTPSLZones]);

  // Save period separator setting to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "chart-show-period-separators",
        JSON.stringify(showPeriodSeparators),
      );
    }
  }, [showPeriodSeparators]);

  // Update period separator visibility when setting changes
  useEffect(() => {
    if (periodSeparatorRef.current) {
      periodSeparatorRef.current.setVisible(showPeriodSeparators);
    }
  }, [showPeriodSeparators]);

  // Update period separator timeframe when timeframe changes
  useEffect(() => {
    if (periodSeparatorRef.current) {
      periodSeparatorRef.current.setTimeframe(timeframe);
    }
  }, [timeframe]);

  // Sync arsenal indicators with chart indicators
  useEffect(() => {
    log("📊 Arsenal indicators changed:", arsenalIndicators);

    // Convert arsenal indicators to chart CustomIndicator format
    const chartIndicators: CustomIndicator[] = arsenalIndicators
      .filter((ai) => ai.enabled)
      .map((ai) => ({
        id: ai.id,
        type: ai.type,
        name: ai.itemName,
        displayType: ai.displayType,
        enabled: ai.enabled,
        color: ai.color || "#3b82f6",
        lineWidth: ai.lineWidth || 2,
        lineStyle: 0,
        parameters: ai.parameters || { period: 20 },
      }));

    // Merge with existing indicators (keep user-added ones, replace arsenal ones)
    setIndicators((prev) => {
      const existingNonArsenal = prev.filter(
        (i) => !i.id.startsWith("arsenal-"),
      );
      const newIndicators = [...existingNonArsenal, ...chartIndicators];
      log(
        "📊 Updated chart indicators:",
        newIndicators.map((i) => ({ id: i.id, type: i.type })),
      );
      return newIndicators;
    });
  }, [
    arsenalIndicators,
    arsenalIndicators.length,
    arsenalIndicators.map((a) => a.enabled).join(","),
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "chart-show-tpsl-lines",
        JSON.stringify(showTPSLLines),
      );
    }
  }, [showTPSLLines]);

  const lastUpdateRef = useRef<number>(0);
  const currentCandleRef = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const bidPriceLineRef = useRef<any>(null);
  const askPriceLineRef = useRef<any>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const oscillatorChartsRef = useRef<Map<string, IChartApi>>(new Map());
  const oscillatorSeriesRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
  const candleDataRef = useRef<OHLCCandle[]>([]);

  // Ref to always hold the latest updateIndicators function (avoids stale closure in poll loop)
  const updateIndicatorsFnRef = useRef<((candles: OHLCCandle[], chart: IChartApi, series: ISeriesApi<any>) => void) | null>(null);

  // Lightweight refresh functions per oscillator - captured at creation time
  // Each function accepts a mode: "light" (tail-slice + series.update) or "full" (all data + setData)
  const oscillatorRefreshFnsRef = useRef<Map<string, (mode: "light" | "full") => void>>(new Map());
  // Ref for the refresh dispatcher (called from live update paths)
  const refreshOscillatorsFnRef = useRef<((mode?: "light" | "full") => void) | null>(null);
  // Per-instance throttle for oscillator refresh (replaces global window.__lastIndicatorRefresh)
  const lastOscRefreshRef = useRef<number>(0);
  // Track whether WebSocket is actively connected (to skip polling refresh when WS is live)
  const wsActiveRef = useRef<boolean>(false);

  // Convert OHLC to Heikin Ashi
  const convertToHeikinAshi = (candles: OHLCCandle[]): OHLCCandle[] => {
    if (candles.length === 0) return [];

    const haCandles: OHLCCandle[] = [];
    let prevHA = { open: candles[0].open, close: candles[0].close };

    for (const candle of candles) {
      const haClose =
        (candle.open + candle.high + candle.low + candle.close) / 4;
      const haOpen = (prevHA.open + prevHA.close) / 2;
      const haHigh = Math.max(candle.high, haOpen, haClose);
      const haLow = Math.min(candle.low, haOpen, haClose);

      haCandles.push({
        time: candle.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: candle.volume,
      });

      prevHA = { open: haOpen, close: haClose };
    }

    return haCandles;
  };

  // Convert OHLC to Renko bars (brick size: 0.0005 for forex)
  const convertToRenko = (
    candles: OHLCCandle[],
    brickSize: number = 0.0005,
  ): OHLCCandle[] => {
    if (candles.length === 0) return [];

    const renkoBars: OHLCCandle[] = [];
    let currentBrick = candles[0].close;
    let currentTime = candles[0].time;
    let volume = 0;
    const timeIncrement = 1; // Increment by 1 second for each brick to avoid duplicates

    for (const candle of candles) {
      volume += candle.volume || 0;
      const price = candle.close;

      // Check if we should create a new brick
      const priceDiff = price - currentBrick;
      const bricksToCreate = Math.floor(Math.abs(priceDiff) / brickSize);

      if (bricksToCreate > 0) {
        const direction = priceDiff > 0 ? 1 : -1;

        for (let i = 0; i < bricksToCreate; i++) {
          const brickOpen = currentBrick;
          const brickClose = currentBrick + direction * brickSize;

          renkoBars.push({
            time: currentTime + i * timeIncrement,
            open: brickOpen,
            high: Math.max(brickOpen, brickClose),
            low: Math.min(brickOpen, brickClose),
            close: brickClose,
            volume: volume / bricksToCreate,
          });

          currentBrick = brickClose;
        }

        currentTime = candle.time;
        volume = 0;
      }
    }

    return renkoBars.length > 0 ? renkoBars : candles;
  };

  // Convert OHLC to Point & Figure (box size: 0.0005, reversal: 3 boxes)
  const convertToPointFigure = (
    candles: OHLCCandle[],
    boxSize: number = 0.0005,
    reversal: number = 3,
  ): OHLCCandle[] => {
    if (candles.length === 0) return [];

    const pfColumns: OHLCCandle[] = [];
    let direction: "X" | "O" | null = null; // X = rising, O = falling
    let currentColumn = candles[0].close;
    let columnStart = candles[0].time;
    let volume = 0;
    let columnCount = 0;
    const timeIncrement = 1; // Increment by 1 second for each column to avoid duplicates

    for (const candle of candles) {
      volume += candle.volume || 0;
      const high = candle.high;
      const low = candle.low;

      if (direction === null) {
        // Determine initial direction
        if (high - currentColumn >= boxSize) {
          direction = "X";
        } else if (currentColumn - low >= boxSize) {
          direction = "O";
        }
      }

      if (direction === "X") {
        // Check for continuation (new X's)
        const boxes = Math.floor((high - currentColumn) / boxSize);
        if (boxes > 0) {
          const newHigh = currentColumn + boxes * boxSize;
          pfColumns.push({
            time: columnStart + columnCount * timeIncrement,
            open: currentColumn,
            high: newHigh,
            low: currentColumn,
            close: newHigh,
            volume: volume,
          });
          currentColumn = newHigh;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }

        // Check for reversal (switch to O's)
        if (currentColumn - low >= reversal * boxSize) {
          direction = "O";
          const newLow = currentColumn - reversal * boxSize;
          pfColumns.push({
            time: candle.time + columnCount * timeIncrement,
            open: currentColumn,
            high: currentColumn,
            low: newLow,
            close: newLow,
            volume: volume,
          });
          currentColumn = newLow;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }
      } else if (direction === "O") {
        // Check for continuation (new O's)
        const boxes = Math.floor((currentColumn - low) / boxSize);
        if (boxes > 0) {
          const newLow = currentColumn - boxes * boxSize;
          pfColumns.push({
            time: columnStart + columnCount * timeIncrement,
            open: currentColumn,
            high: currentColumn,
            low: newLow,
            close: newLow,
            volume: volume,
          });
          currentColumn = newLow;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }

        // Check for reversal (switch to X's)
        if (high - currentColumn >= reversal * boxSize) {
          direction = "X";
          const newHigh = currentColumn + reversal * boxSize;
          pfColumns.push({
            time: candle.time + columnCount * timeIncrement,
            open: currentColumn,
            high: newHigh,
            low: currentColumn,
            close: newHigh,
            volume: volume,
          });
          currentColumn = newHigh;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }
      }
    }

    return pfColumns.length > 0 ? pfColumns : candles;
  };

  // Helper function to convert hex color to rgba with opacity
  const hexToRgba = (hex: string, opacity: number = 100): string => {
    // Handle cases where hex might not start with #
    const cleanHex = hex.startsWith("#") ? hex : `#${hex}`;
    const r = parseInt(cleanHex.slice(1, 3), 16);
    const g = parseInt(cleanHex.slice(3, 5), 16);
    const b = parseInt(cleanHex.slice(5, 7), 16);
    const alpha = opacity / 100;
    const result = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    log(`🎨 hexToRgba: ${hex} @ ${opacity}% → ${result}`);
    return result;
  };

  // Helper function to apply offset to data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyOffset = (data: any[], offset: number = 0): any[] => {
    if (offset === 0) return data;

    log(`📊 Applying offset ${offset} to ${data.length} data points`);

    if (offset > 0) {
      // Shift forward: remove last N points
      const result = data.slice(0, -offset);
      log(`   → Shifted forward, result: ${result.length} points`);
      return result;
    } else {
      // Shift backward: remove first N points
      const result = data.slice(Math.abs(offset));
      log(`   → Shifted backward, result: ${result.length} points`);
      return result;
    }
  };

  // Helper function to get price from candle based on price source
  const getPriceFromCandle = (
    candle: OHLCCandle,
    priceSource: string = "close",
  ): number => {
    switch (priceSource) {
      case "open":
        return candle.open;
      case "high":
        return candle.high;
      case "low":
        return candle.low;
      case "hl2":
        return (candle.high + candle.low) / 2;
      case "hlc3":
        return (candle.high + candle.low + candle.close) / 3;
      case "ohlc4":
        return (candle.open + candle.high + candle.low + candle.close) / 4;
      case "close":
      default:
        return candle.close;
    }
  };

  // Helper function to transform candles based on price source
  const transformCandlesForPriceSource = (
    candles: OHLCCandle[],
    priceSource: string = "close",
  ): OHLCCandle[] => {
    if (priceSource === "close") return candles; // Default, no transformation needed

    log(
      `💱 Transforming ${candles.length} candles for price source: ${priceSource}`,
    );

    return candles.map((candle) => {
      const price = getPriceFromCandle(candle, priceSource);
      // Create a modified candle where all prices are the selected source
      return {
        ...candle,
        close: price, // Most indicators use close price, so we override it
        // Keep original OHLC for reference but indicators will use close
      };
    });
  };

  // Function to calculate and display indicators
  const updateIndicators = (
    candles: OHLCCandle[],
    chart: IChartApi,
    mainSeries: ISeriesApi<any>,
  ) => {
    log("🔄 updateIndicators called with", indicators.length, "indicators");
    log(
      "📊 Enabled indicators:",
      indicators.filter((i) => i.enabled).map((i) => i.type),
    );

    // Clear existing overlay indicator series from main chart
    indicatorSeriesRef.current.forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch {
        // Series might already be removed or chart disposed
      }
    });
    indicatorSeriesRef.current.clear();

    const enabledIndicators = indicators.filter((ind) => ind.enabled);

    // For oscillator charts: remove series from reusable charts, destroy charts no longer needed
    const activeOscIds = new Set(
      enabledIndicators.filter((i) => i.displayType === "oscillator").map((i) => i.id),
    );
    // Remove series from ALL existing oscillator charts (we'll re-add updated data)
    oscillatorSeriesRef.current.forEach((seriesList, id) => {
      const oscChart = oscillatorChartsRef.current.get(id);
      if (oscChart) {
        seriesList.forEach((s) => {
          try { oscChart.removeSeries(s); } catch { /* already removed */ }
        });
      }
    });
    oscillatorSeriesRef.current.clear();
    // Destroy oscillator charts whose indicators are no longer active
    oscillatorChartsRef.current.forEach((oscChart, id) => {
      if (!activeOscIds.has(id)) {
        try { oscChart.remove(); } catch { /* already removed */ }
        oscillatorChartsRef.current.delete(id);
        oscillatorRefreshFnsRef.current.delete(id);
      }
    });
    log("✅ Processing", enabledIndicators.length, "enabled indicators");

    enabledIndicators.forEach((indicator) => {
      log(`📈 Adding indicator: ${indicator.type} - ${indicator.name}`);
      log("   Settings:", {
        priceSource: indicator.priceSource || "close",
        opacity: indicator.opacity,
        lineWidth: indicator.lineWidth,
        lineStyle: indicator.lineStyle,
        customLabel: indicator.customLabel,
        offset: indicator.offset,
        precision: indicator.precision,
        colors: indicator.colors,
        visibility: indicator.visibility,
        levels: indicator.levels,
      });

      if (indicator.displayType === "overlay") {
        // Transform candles based on price source
        const transformedCandles = transformCandlesForPriceSource(
          candles,
          indicator.priceSource || "close",
        );

        // Overlay indicators (on main chart)
        if (indicator.type === "sma") {
          const smaData = calculateSMA(
            transformedCandles,
            indicator.parameters.period,
          );
          const offsetData = applyOffset(smaData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "ema") {
          const emaData = calculateEMA(
            transformedCandles,
            indicator.parameters.period,
          );
          const offsetData = applyOffset(emaData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "bb") {
          const bbData = calculateBollingerBands(
            transformedCandles,
            indicator.parameters.period,
            indicator.parameters.stdDev,
          );
          const offsetData = applyOffset(bbData, indicator.offset || 0);

          // Upper band (only if visible)
          if (indicator.visibility?.upper !== false) {
            const upperColor = indicator.colors?.upper || indicator.color;
            const upperSeries = chart.addLineSeries({
              color: hexToRgba(upperColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || "BB"} Upper`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            upperSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.upper,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_upper`,
              upperSeries,
            );
          }

          // Middle band (only if visible)
          if (indicator.visibility?.middle !== false) {
            const middleColor = indicator.colors?.middle || indicator.color;
            const middleSeries = chart.addLineSeries({
              color: hexToRgba(middleColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: 2 as any, // Dashed
              title: `${indicator.customLabel || "BB"} Middle`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            middleSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.middle,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_middle`,
              middleSeries,
            );
          }

          // Lower band (only if visible)
          if (indicator.visibility?.lower !== false) {
            const lowerColor = indicator.colors?.lower || indicator.color;
            const lowerSeries = chart.addLineSeries({
              color: hexToRgba(lowerColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || "BB"} Lower`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            lowerSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.lower,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_lower`,
              lowerSeries,
            );
          }
        } else if (indicator.type === "wma") {
          const wmaData = calculateWMA(
            transformedCandles,
            indicator.parameters.period,
          );
          const offsetData = applyOffset(wmaData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "keltner") {
          // Keltner Channels - EMA center + ATR bands
          const bbData = calculateKeltnerChannels(
            transformedCandles,
            indicator.parameters.period || 20,
            indicator.parameters.multiplier || 2,
          );
          const offsetData = applyOffset(bbData, indicator.offset || 0);

          // Upper band (only if visible)
          if (indicator.visibility?.upper !== false) {
            const upperColor = indicator.colors?.upper || indicator.color;
            const upperSeries = chart.addLineSeries({
              color: hexToRgba(upperColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || "Keltner"} Upper`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            upperSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.upper,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_upper`,
              upperSeries,
            );
          }

          // Middle band (only if visible)
          if (indicator.visibility?.middle !== false) {
            const middleColor = indicator.colors?.middle || indicator.color;
            const middleSeries = chart.addLineSeries({
              color: hexToRgba(middleColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: 2 as any,
              title: `${indicator.customLabel || "Keltner"} Middle`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            middleSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.middle,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_middle`,
              middleSeries,
            );
          }

          // Lower band (only if visible)
          if (indicator.visibility?.lower !== false) {
            const lowerColor = indicator.colors?.lower || indicator.color;
            const lowerSeries = chart.addLineSeries({
              color: hexToRgba(lowerColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || "Keltner"} Lower`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            lowerSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.lower,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_lower`,
              lowerSeries,
            );
          }
        } else if (indicator.type === "sar") {
          const sarData = calculateParabolicSAR(
            transformedCandles,
            indicator.parameters.acceleration || 0.02,
            indicator.parameters.maximum || 0.2,
          );
          const offsetData = applyOffset(sarData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "pivot") {
          const pivotData = calculatePivotPoints(transformedCandles);
          const offsetData = applyOffset(pivotData, indicator.offset || 0);

          // Pivot point
          const pivotSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: 2 as any,
            title: `${indicator.customLabel || "Pivot"} PP`,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });
          pivotSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.pivot,
            })),
          );
          indicatorSeriesRef.current.set(`${indicator.id}_pivot`, pivotSeries);

          // Support/Resistance levels
          ["r1", "r2", "s1", "s2"].forEach((level) => {
            const series = chart.addLineSeries({
              color: hexToRgba(
                level.startsWith("r") ? "#f23645" : "#00e676",
                indicator.opacity || 100,
              ),
              lineWidth: 1,
              lineStyle: 2 as any,
              title: `${indicator.customLabel || "Pivot"} ${level.toUpperCase()}`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            series.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: (d as any)[level],
              })),
            );
            indicatorSeriesRef.current.set(`${indicator.id}_${level}`, series);
          });
        } else if (indicator.type === "vwap") {
          const vwapData = calculateVWAP(transformedCandles);
          const offsetData = applyOffset(vwapData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "support_resistance") {
          // Auto Support & Resistance - Detect key levels from price data
          const period = indicator.parameters.period || 20;
          const strength = indicator.parameters.strength || 3; // Minimum touches to be considered valid

          // Find swing highs and lows
          const levels: {
            price: number;
            type: "support" | "resistance";
            strength: number;
            time: number | string;
          }[] = [];
          const closes = transformedCandles.map((c) => c.close);
          const highs = candles.map((c) => c.high);
          const lows = candles.map((c) => c.low);

          // Simple level detection - find areas where price bounced multiple times
          const levelMap = new Map<
            number,
            { touches: number; type: "support" | "resistance" }
          >();
          const precision = 5; // Price precision
          const tolerance = Math.pow(10, -precision) * 10; // Grouping tolerance

          // Scan for support levels (price lows that get tested multiple times)
          for (let i = period; i < lows.length - period; i++) {
            const low = lows[i];
            // Check if it's a swing low (lower than nearby candles)
            let isSwingLow = true;
            for (let j = 1; j <= period / 2; j++) {
              if (lows[i - j] < low || lows[i + j] < low) {
                isSwingLow = false;
                break;
              }
            }
            if (isSwingLow) {
              const roundedPrice = Math.round(low / tolerance) * tolerance;
              const existing = levelMap.get(roundedPrice);
              if (existing) {
                existing.touches++;
              } else {
                levelMap.set(roundedPrice, { touches: 1, type: "support" });
              }
            }
          }

          // Scan for resistance levels (price highs that get tested multiple times)
          for (let i = period; i < highs.length - period; i++) {
            const high = highs[i];
            // Check if it's a swing high (higher than nearby candles)
            let isSwingHigh = true;
            for (let j = 1; j <= period / 2; j++) {
              if (highs[i - j] > high || highs[i + j] > high) {
                isSwingHigh = false;
                break;
              }
            }
            if (isSwingHigh) {
              const roundedPrice = Math.round(high / tolerance) * tolerance;
              const existing = levelMap.get(roundedPrice);
              if (existing) {
                existing.touches++;
              } else {
                levelMap.set(roundedPrice, { touches: 1, type: "resistance" });
              }
            }
          }

          // Filter levels with enough touches and draw them
          let levelIndex = 0;
          const firstTime = candles[0]?.time || 0;
          const lastTime = candles[candles.length - 1]?.time || 0;

          levelMap.forEach((value, price) => {
            if (value.touches >= Math.max(1, strength - 1)) {
              const color = value.type === "support" ? "#00e676" : "#f23645";

              const lineSeries = chart.addLineSeries({
                color: hexToRgba(color, indicator.opacity || 80),
                lineWidth: (indicator.lineWidth as any) || 2,
                lineStyle: 2 as any, // Dashed
                title: `${value.type.charAt(0).toUpperCase() + value.type.slice(1)} ${price.toFixed(precision)}`,
                priceScaleId: "right",
                priceFormat: {
                  type: "price",
                  precision: precision,
                },
              });

              // Create a horizontal line across the entire chart
              lineSeries.setData([
                { time: firstTime as UTCTimestamp, value: price },
                { time: lastTime as UTCTimestamp, value: price },
              ]);

              indicatorSeriesRef.current.set(
                `${indicator.id}_level_${levelIndex}`,
                lineSeries,
              );
              levelIndex++;
            }
          });

          log(`📊 S/R Indicator: Found ${levelIndex} levels`);
        } else if (indicator.type === "dema") {
          const demaData = calculateDEMA(
            transformedCandles,
            indicator.parameters.period || 20,
          );
          const offsetData = applyOffset(demaData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "tema") {
          const temaData = calculateTEMA(
            transformedCandles,
            indicator.parameters.period || 20,
          );
          const offsetData = applyOffset(temaData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "hma") {
          const hmaData = calculateHMA(
            transformedCandles,
            indicator.parameters.period || 20,
          );
          const offsetData = applyOffset(hmaData, indicator.offset || 0);

          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: {
              type: "price",
              precision: indicator.precision || 5,
            },
          });

          lineSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        } else if (indicator.type === "ichimoku") {
          const ichimokuData = calculateIchimoku(
            transformedCandles,
            indicator.parameters.tenkanPeriod || 9,
            indicator.parameters.kijunPeriod || 26,
            indicator.parameters.senkouBPeriod || 52,
          );

          // Tenkan-sen (Conversion Line) - fast
          if (indicator.visibility?.main !== false) {
            const tenkanSeries = chart.addLineSeries({
              color: hexToRgba(
                indicator.colors?.upper || "#2962ff",
                indicator.opacity || 100,
              ),
              lineWidth: (indicator.lineWidth as any) || 1,
              title: "Tenkan",
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            tenkanSeries.setData(
              ichimokuData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.tenkan,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_tenkan`,
              tenkanSeries,
            );
          }

          // Kijun-sen (Base Line) - slow
          if (indicator.visibility?.signal !== false) {
            const kijunSeries = chart.addLineSeries({
              color: hexToRgba(
                indicator.colors?.lower || "#f23645",
                indicator.opacity || 100,
              ),
              lineWidth: (indicator.lineWidth as any) || 1,
              title: "Kijun",
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            kijunSeries.setData(
              ichimokuData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.kijun,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_kijun`,
              kijunSeries,
            );
          }

          // Senkou Span A (Leading Span A)
          if (indicator.visibility?.upper !== false) {
            const senkouASeries = chart.addLineSeries({
              color: hexToRgba(
                indicator.colors?.positive || "#00e676",
                indicator.opacity || 40,
              ),
              lineWidth: 1 as any,
              lineStyle: 2 as any,
              title: "Senkou A",
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            senkouASeries.setData(
              ichimokuData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.senkouA,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_senkouA`,
              senkouASeries,
            );
          }

          // Senkou Span B (Leading Span B)
          if (indicator.visibility?.lower !== false) {
            const senkouBSeries = chart.addLineSeries({
              color: hexToRgba(
                indicator.colors?.negative || "#f23645",
                indicator.opacity || 40,
              ),
              lineWidth: 1 as any,
              lineStyle: 2 as any,
              title: "Senkou B",
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            senkouBSeries.setData(
              ichimokuData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.senkouB,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_senkouB`,
              senkouBSeries,
            );
          }

          log(`📊 Ichimoku Cloud rendered with ${ichimokuData.length} points`);
        } else if (indicator.type === "donchian") {
          const donchianData = calculateDonchianChannel(
            transformedCandles,
            indicator.parameters.period || 20,
          );
          const offsetData = applyOffset(donchianData, indicator.offset || 0);

          // Upper band
          if (indicator.visibility?.upper !== false) {
            const upperColor = indicator.colors?.upper || indicator.color;
            const upperSeries = chart.addLineSeries({
              color: hexToRgba(upperColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || "Donchian"} Upper`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            upperSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.upper,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_upper`,
              upperSeries,
            );
          }

          // Middle band
          if (indicator.visibility?.middle !== false) {
            const middleColor = indicator.colors?.middle || indicator.color;
            const middleSeries = chart.addLineSeries({
              color: hexToRgba(middleColor, indicator.opacity || 60),
              lineWidth: indicator.lineWidth as any,
              lineStyle: 2 as any,
              title: `${indicator.customLabel || "Donchian"} Middle`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            middleSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.middle,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_middle`,
              middleSeries,
            );
          }

          // Lower band
          if (indicator.visibility?.lower !== false) {
            const lowerColor = indicator.colors?.lower || indicator.color;
            const lowerSeries = chart.addLineSeries({
              color: hexToRgba(lowerColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || "Donchian"} Lower`,
              priceScaleId: "right",
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            lowerSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.lower,
              })),
            );
            indicatorSeriesRef.current.set(
              `${indicator.id}_lower`,
              lowerSeries,
            );
          }

        // --- NEW OVERLAY INDICATORS (Batch 2) ---
        // Simple line overlays: ALMA, KAMA, ZLEMA, T3, SMMA, LSMA, VIDYA, McGinley, VWMA
        } else if (["alma","kama","zlema","t3","smma","lsma","vidya","mcginley","vwma"].includes(indicator.type)) {
          const calcMap: Record<string, () => { time: number; value: number }[]> = {
            alma: () => calculateALMA(transformedCandles, indicator.parameters.period || 20, indicator.parameters.offset || 0.85, indicator.parameters.sigma || 6),
            kama: () => calculateKAMA(transformedCandles, indicator.parameters.period || 10),
            zlema: () => calculateZLEMA(transformedCandles, indicator.parameters.period || 20),
            t3: () => calculateT3(transformedCandles, indicator.parameters.period || 5, indicator.parameters.vFactor || 0.7),
            smma: () => calculateSMMA(transformedCandles, indicator.parameters.period || 20),
            lsma: () => calculateLSMA(transformedCandles, indicator.parameters.period || 25),
            vidya: () => calculateVIDYA(transformedCandles, indicator.parameters.period || 20),
            mcginley: () => calculateMcGinley(transformedCandles, indicator.parameters.period || 14),
            vwma: () => calculateVWMA(transformedCandles, indicator.parameters.period || 20),
          };
          const calcData = calcMap[indicator.type]?.() || [];
          const offsetData = applyOffset(calcData, indicator.offset || 0);
          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: indicator.precision || 5 },
          });
          lineSeries.setData(offsetData.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
          indicatorSeriesRef.current.set(indicator.id, lineSeries);

        } else if (indicator.type === "supertrend") {
          const stData = calculateSupertrend(transformedCandles, indicator.parameters.period || 10, indicator.parameters.multiplier || 3);
          // Split into up/down segments for coloring
          const upData: { time: number; value: number }[] = [];
          const downData: { time: number; value: number }[] = [];
          for (const d of stData) {
            if (d.direction === 1) { upData.push({ time: d.time, value: d.value }); }
            else { downData.push({ time: d.time, value: d.value }); }
          }
          if (upData.length > 0) {
            const upSeries = chart.addLineSeries({
              color: hexToRgba(indicator.colors?.positive || "#00e676", indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              title: "Supertrend ▲",
              priceScaleId: "right",
              priceFormat: { type: "price", precision: indicator.precision || 5 },
            });
            upSeries.setData(upData.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
            indicatorSeriesRef.current.set(`${indicator.id}_up`, upSeries);
          }
          if (downData.length > 0) {
            const downSeries = chart.addLineSeries({
              color: hexToRgba(indicator.colors?.negative || "#f23645", indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              title: "Supertrend ▼",
              priceScaleId: "right",
              priceFormat: { type: "price", precision: indicator.precision || 5 },
            });
            downSeries.setData(downData.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
            indicatorSeriesRef.current.set(`${indicator.id}_down`, downSeries);
          }

        // Channel overlays: linreg_channel, ma_envelope, price_channel, chandelier
        } else if (["linreg_channel","ma_envelope","price_channel","chandelier"].includes(indicator.type)) {
          const channelCalc: Record<string, () => { time: number; upper: number; middle: number; lower: number }[]> = {
            linreg_channel: () => calculateLinRegChannel(transformedCandles, indicator.parameters.period || 100, indicator.parameters.deviations || 2),
            ma_envelope: () => calculateMAEnvelope(transformedCandles, indicator.parameters.period || 20, indicator.parameters.percentage || 2.5),
            price_channel: () => calculatePriceChannel(transformedCandles, indicator.parameters.period || 20),
            chandelier: () => calculateChandelierExit(transformedCandles, indicator.parameters.period || 22, indicator.parameters.multiplier || 3),
          };
          const chData = channelCalc[indicator.type]?.() || [];
          const offsetData = applyOffset(chData, indicator.offset || 0);

          if (indicator.visibility?.upper !== false) {
            const uSeries = chart.addLineSeries({
              color: hexToRgba(indicator.colors?.upper || indicator.color, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || indicator.name} Upper`,
              priceScaleId: "right",
              priceFormat: { type: "price", precision: indicator.precision || 5 },
            });
            uSeries.setData(offsetData.map((d) => ({ time: d.time as UTCTimestamp, value: d.upper })));
            indicatorSeriesRef.current.set(`${indicator.id}_upper`, uSeries);
          }
          if (indicator.visibility?.middle !== false) {
            const mSeries = chart.addLineSeries({
              color: hexToRgba(indicator.colors?.middle || indicator.color, indicator.opacity || 60),
              lineWidth: indicator.lineWidth as any,
              lineStyle: 2 as any,
              title: `${indicator.customLabel || indicator.name} Mid`,
              priceScaleId: "right",
              priceFormat: { type: "price", precision: indicator.precision || 5 },
            });
            mSeries.setData(offsetData.map((d) => ({ time: d.time as UTCTimestamp, value: d.middle })));
            indicatorSeriesRef.current.set(`${indicator.id}_middle`, mSeries);
          }
          if (indicator.visibility?.lower !== false) {
            const lSeries = chart.addLineSeries({
              color: hexToRgba(indicator.colors?.lower || indicator.color, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || indicator.name} Lower`,
              priceScaleId: "right",
              priceFormat: { type: "price", precision: indicator.precision || 5 },
            });
            lSeries.setData(offsetData.map((d) => ({ time: d.time as UTCTimestamp, value: d.lower })));
            indicatorSeriesRef.current.set(`${indicator.id}_lower`, lSeries);
          }

        // --- PREMIUM OVERLAY INDICATORS ---
        // Channel overlays: predictive_range, acceleration_bands, adaptive_channel, mean_reversion_band, dynamic_pivots, anchored_vwap_bands
        } else if (["predictive_range","acceleration_bands","adaptive_channel","mean_reversion_band","dynamic_pivots","anchored_vwap_bands"].includes(indicator.type)) {
          const premChCalc: Record<string, () => { time: number; upper: number; middle: number; lower: number }[]> = {
            predictive_range: () => calculatePredictiveRange(transformedCandles, indicator.parameters.period || 14),
            acceleration_bands: () => calculateAccelerationBands(transformedCandles, indicator.parameters.period || 20),
            adaptive_channel: () => calculateAdaptiveChannel(transformedCandles, indicator.parameters.period || 20),
            mean_reversion_band: () => calculateMeanReversionBand(transformedCandles, indicator.parameters.period || 20),
            dynamic_pivots: () => calculateDynamicPivots(transformedCandles, indicator.parameters.lookback || 5),
            anchored_vwap_bands: () => calculateAnchoredVWAPBands(transformedCandles, indicator.parameters.deviations || 2),
          };
          const premChData = premChCalc[indicator.type]?.() || [];
          if (indicator.visibility?.upper !== false) {
            const uS = chart.addLineSeries({ color: hexToRgba(indicator.colors?.upper || indicator.color, indicator.opacity || 100), lineWidth: indicator.lineWidth as any, title: `${indicator.customLabel || indicator.name} Upper`, priceScaleId: "right", priceFormat: { type: "price", precision: indicator.precision || 5 } });
            uS.setData(premChData.map(d => ({ time: d.time as UTCTimestamp, value: d.upper })));
            indicatorSeriesRef.current.set(`${indicator.id}_upper`, uS);
          }
          if (indicator.visibility?.middle !== false) {
            const mS = chart.addLineSeries({ color: hexToRgba(indicator.colors?.middle || indicator.color, indicator.opacity || 60), lineWidth: indicator.lineWidth as any, lineStyle: 2 as any, title: `${indicator.customLabel || indicator.name} Mid`, priceScaleId: "right", priceFormat: { type: "price", precision: indicator.precision || 5 } });
            mS.setData(premChData.map(d => ({ time: d.time as UTCTimestamp, value: d.middle })));
            indicatorSeriesRef.current.set(`${indicator.id}_middle`, mS);
          }
          if (indicator.visibility?.lower !== false) {
            const lS = chart.addLineSeries({ color: hexToRgba(indicator.colors?.lower || indicator.color, indicator.opacity || 100), lineWidth: indicator.lineWidth as any, title: `${indicator.customLabel || indicator.name} Lower`, priceScaleId: "right", priceFormat: { type: "price", precision: indicator.precision || 5 } });
            lS.setData(premChData.map(d => ({ time: d.time as UTCTimestamp, value: d.lower })));
            indicatorSeriesRef.current.set(`${indicator.id}_lower`, lS);
          }

        // Trend Ribbon: 8 EMA lines
        } else if (indicator.type === "trend_ribbon") {
          const ribbonData = calculateTrendRibbon(transformedCandles);
          const colors = ["#00e676","#00c853","#2196f3","#1976d2","#f57c00","#e65100","#f44336","#c62828"];
          const emaKeys = ["ema1","ema2","ema3","ema4","ema5","ema6","ema7","ema8"] as const;
          emaKeys.forEach((key, idx) => {
            const s = chart.addLineSeries({ color: hexToRgba(colors[idx], indicator.opacity || 70), lineWidth: 1 as any, title: idx === 0 ? (indicator.customLabel || "Trend Ribbon") : "", priceScaleId: "right", priceFormat: { type: "price", precision: indicator.precision || 5 } });
            s.setData(ribbonData.map(d => ({ time: d.time as UTCTimestamp, value: d[key] })));
            indicatorSeriesRef.current.set(`${indicator.id}_${key}`, s);
          });

        } else {
          console.warn(`⚠️ Unknown overlay indicator type: ${indicator.type}`);
        }
      } else if (indicator.displayType === "oscillator") {
        // Transform candles based on price source
        const transformedCandles = transformCandlesForPriceSource(
          candles,
          indicator.priceSource || "close",
        );

        // Oscillator indicators (separate panels) - reuse existing charts to avoid flicker
        const container = document.getElementById(`oscillator-${indicator.id}`);
        if (!container) return;

        let isNewChart = false;
        let oscChart = oscillatorChartsRef.current.get(indicator.id);
        if (!oscChart) {
          isNewChart = true;
          oscChart = createChart(container, {
            width: container.clientWidth,
            height: 150,
            layout: {
              background: { color: "#131722" },
              textColor: "#B2B5BE",
              fontSize: 11,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              // @ts-expect-error attributionLogo is a newer lightweight-charts option not yet in types
              attributionLogo: false, // Hide watermark
            },
            grid: {
              vertLines: { color: "rgba(42, 46, 57, 0.6)" },
              horzLines: { color: "rgba(42, 46, 57, 0.6)" },
            },
            timeScale: {
              borderColor: "#2A2E39",
              timeVisible: false,
              secondsVisible: false,
            },
            rightPriceScale: {
              borderColor: "#2A2E39",
            },
          });
          oscillatorChartsRef.current.set(indicator.id, oscChart);
        }

        // Track series for this oscillator so we can clean them up on next update
        const oscSeriesList: ISeriesApi<any>[] = [];
        // Proxy addLineSeries/addHistogramSeries to auto-track series
        const _origAddLine = oscChart.addLineSeries.bind(oscChart);
        const _origAddHist = oscChart.addHistogramSeries.bind(oscChart);
        oscChart.addLineSeries = (...args: any[]) => { const s = _origAddLine(...args); oscSeriesList.push(s); return s; };
        oscChart.addHistogramSeries = (...args: any[]) => { const s = _origAddHist(...args); oscSeriesList.push(s); return s; };

        if (indicator.type === "rsi") {
          const rsiData = calculateRSI(
            transformedCandles,
            indicator.parameters.period,
          );
          const offsetData = applyOffset(rsiData, indicator.offset || 0);

          const rsiSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });

          rsiSeries.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Add custom overbought/oversold lines
          const overbought = indicator.levels?.overbought || 70;
          const oversold = indicator.levels?.oversold || 30;

          const overboughtLine = rsiSeries.createPriceLine({
            price: overbought,
            color: hexToRgba("#f23645", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          const oversoldLine = rsiSeries.createPriceLine({
            price: oversold,
            color: hexToRgba("#00e676", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        } else if (indicator.type === "macd") {
          const macdData = calculateMACD(
            transformedCandles,
            indicator.parameters.fast,
            indicator.parameters.slow,
            indicator.parameters.signal,
          );
          const offsetData = applyOffset(macdData, indicator.offset || 0);

          // MACD line (only if visible)
          if (indicator.visibility?.main !== false) {
            const macdSeries = oscChart.addLineSeries({
              color: hexToRgba(indicator.color, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              title: `${indicator.customLabel || "MACD"}`,
            });
            macdSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.macd,
              })),
            );
          }

          // Signal line (only if visible)
          if (indicator.visibility?.signal !== false) {
            const signalColor = indicator.colors?.signal || "#f23645";
            const signalSeries = oscChart.addLineSeries({
              color: hexToRgba(signalColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              title: "Signal",
            });
            signalSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.signal,
              })),
            );
          }

          // Histogram (only if visible)
          if (indicator.visibility?.histogram !== false) {
            const positiveColor = indicator.colors?.positive || "#26a69a";
            const negativeColor = indicator.colors?.negative || "#ef5350";

            const histogramSeries = oscChart.addHistogramSeries({
              priceFormat: {
                type: "price",
                precision: indicator.precision || 5,
              },
            });
            histogramSeries.setData(
              offsetData.map((d) => ({
                time: d.time as UTCTimestamp,
                value: d.histogram,
                color: hexToRgba(
                  d.histogram >= 0 ? positiveColor : negativeColor,
                  indicator.opacity || 100,
                ),
              })),
            );
          }
        } else if (indicator.type === "stoch") {
          const stochData = calculateStochastic(
            transformedCandles,
            indicator.parameters.kPeriod,
            indicator.parameters.dPeriod,
          );
          const offsetKData = applyOffset(stochData.k, indicator.offset || 0);
          const offsetDData = applyOffset(stochData.d, indicator.offset || 0);

          // %K line
          const kSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: `${indicator.customLabel || "Stoch"} %K`,
          });
          kSeries.setData(
            offsetKData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // %D line
          const dColor = indicator.colors?.signal || "#f23645";
          const dSeries = oscChart.addLineSeries({
            color: hexToRgba(dColor, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "%D",
          });
          dSeries.setData(
            offsetDData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Add overbought/oversold lines
          const overboughtLine = kSeries.createPriceLine({
            price: 80,
            color: hexToRgba("#f23645", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "80",
          });
          const oversoldLine = kSeries.createPriceLine({
            price: 20,
            color: hexToRgba("#00e676", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "20",
          });
        } else if (indicator.type === "williamsR") {
          const williamsData = calculateWilliamsR(
            transformedCandles,
            indicator.parameters.period || 14,
          );
          const offsetData = applyOffset(williamsData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Add custom reference lines
          const overbought = indicator.levels?.overbought || -20;
          const oversold = indicator.levels?.oversold || -80;

          series.createPriceLine({
            price: overbought,
            color: hexToRgba("#f23645", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          series.createPriceLine({
            price: oversold,
            color: hexToRgba("#00e676", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        } else if (indicator.type === "cci") {
          const cciData = calculateCCI(
            transformedCandles,
            indicator.parameters.period || 20,
          );
          const offsetData = applyOffset(cciData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Add custom reference lines
          const overbought = indicator.levels?.overbought || 100;
          const oversold = indicator.levels?.oversold || -100;

          series.createPriceLine({
            price: overbought,
            color: hexToRgba("#f23645", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          series.createPriceLine({
            price: oversold,
            color: hexToRgba("#00e676", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        } else if (indicator.type === "adx") {
          const adxData = calculateADX(
            transformedCandles,
            indicator.parameters.period || 14,
          );
          const offsetData = applyOffset(adxData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || "ADX",
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Add custom threshold line
          const threshold = indicator.levels?.threshold || 25;
          series.createPriceLine({
            price: threshold,
            color: hexToRgba("#787b86", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(threshold),
          });
        } else if (indicator.type === "mfi") {
          const mfiData = calculateMFI(
            transformedCandles,
            indicator.parameters.period || 14,
          );
          const offsetData = applyOffset(mfiData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Add custom overbought/oversold lines
          const overbought = indicator.levels?.overbought || 80;
          const oversold = indicator.levels?.oversold || 20;

          series.createPriceLine({
            price: overbought,
            color: hexToRgba("#f23645", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          series.createPriceLine({
            price: oversold,
            color: hexToRgba("#00e676", 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        } else if (indicator.type === "atr") {
          const atrData = calculateATR(
            transformedCandles,
            indicator.parameters.period || 14,
          );
          const offsetData = applyOffset(atrData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || "ATR",
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
        } else if (indicator.type === "obv") {
          const obvData = calculateOBV(transformedCandles);
          const offsetData = applyOffset(obvData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || "OBV",
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );
        } else if (indicator.type === "roc") {
          const rocData = calculateROC(
            transformedCandles,
            indicator.parameters.period || 12,
          );
          const offsetData = applyOffset(rocData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || "ROC",
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Zero line
          series.createPriceLine({
            price: 0,
            color: "rgba(255,255,255,0.3)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          });
        } else if (indicator.type === "cmf") {
          const cmfData = calculateCMF(
            transformedCandles,
            indicator.parameters.period || 20,
          );
          const offsetData = applyOffset(cmfData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || "CMF",
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Zero line
          series.createPriceLine({
            price: 0,
            color: "rgba(255,255,255,0.3)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          });
        } else if (indicator.type === "momentum") {
          const momData = calculateMomentum(
            transformedCandles,
            indicator.parameters.period || 10,
          );
          const offsetData = applyOffset(momData, indicator.offset || 0);

          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || "Momentum",
          });
          series.setData(
            offsetData.map((d) => ({
              time: d.time as UTCTimestamp,
              value: d.value,
            })),
          );

          // Zero line
          series.createPriceLine({
            price: 0,
            color: "rgba(255,255,255,0.3)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          });

        // --- NEW OSCILLATOR INDICATORS (Batch 2) ---
        // Simple line oscillators (no zero line): std_dev, hist_volatility, mass_index, ulcer_index, rvi, nvi, pvi, ad_line
        } else if (["std_dev","hist_volatility","mass_index","ulcer_index","rvi","nvi","pvi","ad_line"].includes(indicator.type)) {
          const oscCalc: Record<string, () => { time: number; value: number }[]> = {
            std_dev: () => calculateStdDev(transformedCandles, indicator.parameters.period || 20),
            hist_volatility: () => calculateHistVolatility(transformedCandles, indicator.parameters.period || 20),
            mass_index: () => calculateMassIndex(transformedCandles, indicator.parameters.emaPeriod || 9, indicator.parameters.sumPeriod || 25),
            ulcer_index: () => calculateUlcerIndex(transformedCandles, indicator.parameters.period || 14),
            rvi: () => calculateRVI(transformedCandles, indicator.parameters.period || 10),
            nvi: () => calculateNVI(transformedCandles),
            pvi: () => calculatePVI(transformedCandles),
            ad_line: () => calculateADLine(transformedCandles),
          };
          const calcData = oscCalc[indicator.type]?.() || [];
          const offsetData = applyOffset(calcData, indicator.offset || 0);
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(offsetData.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));

        // Zero-line oscillators: trix, dpo, kst, coppock, chaikin_volatility, force_index, eom, awesome_osc, fisher, tsi, connors_rsi, ultimate_osc
        } else if (["trix","dpo","kst","coppock","chaikin_volatility","force_index","eom","awesome_osc","fisher","tsi","connors_rsi","ultimate_osc"].includes(indicator.type)) {
          const zeroCalc: Record<string, () => { time: number; value: number }[]> = {
            trix: () => calculateTRIX(transformedCandles, indicator.parameters.period || 15),
            dpo: () => calculateDPO(transformedCandles, indicator.parameters.period || 20),
            kst: () => calculateKST(transformedCandles),
            coppock: () => calculateCoppock(transformedCandles, indicator.parameters.wmaPeriod || 10, indicator.parameters.longROC || 14, indicator.parameters.shortROC || 11),
            chaikin_volatility: () => calculateChaikinVolatility(transformedCandles, indicator.parameters.emaPeriod || 10, indicator.parameters.rocPeriod || 10),
            force_index: () => calculateForceIndex(transformedCandles, indicator.parameters.period || 13),
            eom: () => calculateEOM(transformedCandles, indicator.parameters.period || 14),
            awesome_osc: () => calculateAwesomeOscillator(transformedCandles),
            fisher: () => calculateFisherTransform(transformedCandles, indicator.parameters.period || 9),
            tsi: () => calculateTSI(transformedCandles, indicator.parameters.longPeriod || 25, indicator.parameters.shortPeriod || 13),
            connors_rsi: () => calculateConnorsRSI(transformedCandles, indicator.parameters.rsiPeriod || 3, indicator.parameters.streakPeriod || 2, indicator.parameters.rocPeriod || 100),
            ultimate_osc: () => calculateUltimateOscillator(transformedCandles, indicator.parameters.period1 || 7, indicator.parameters.period2 || 14, indicator.parameters.period3 || 28),
          };
          const calcData = zeroCalc[indicator.type]?.() || [];
          const offsetData = applyOffset(calcData, indicator.offset || 0);
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(offsetData.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
          series.createPriceLine({ price: 0, color: "rgba(255,255,255,0.3)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

        // Dual-line oscillators: aroon (up/down), vortex (plus/minus), elder_ray (bull/bear)
        } else if (indicator.type === "aroon") {
          const aroonData = calculateAroon(transformedCandles, indicator.parameters.period || 25);
          const upSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.positive || "#00e676", indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "Aroon Up",
          });
          upSeries.setData(aroonData.map((d) => ({ time: d.time as UTCTimestamp, value: d.up })));
          const downSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.negative || "#f23645", indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "Aroon Down",
          });
          downSeries.setData(aroonData.map((d) => ({ time: d.time as UTCTimestamp, value: d.down })));

        } else if (indicator.type === "vortex") {
          const vortexData = calculateVortex(transformedCandles, indicator.parameters.period || 14);
          const plusSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.positive || "#00e676", indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "VI+",
          });
          plusSeries.setData(vortexData.map((d) => ({ time: d.time as UTCTimestamp, value: d.plus })));
          const minusSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.negative || "#f23645", indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "VI-",
          });
          minusSeries.setData(vortexData.map((d) => ({ time: d.time as UTCTimestamp, value: d.minus })));

        } else if (indicator.type === "elder_ray") {
          const elderData = calculateElderRay(transformedCandles, indicator.parameters.period || 13);
          const bullSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.positive || "#00e676", indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "Bull Power",
          });
          bullSeries.setData(elderData.map((d) => ({ time: d.time as UTCTimestamp, value: d.bull })));
          const bearSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.negative || "#f23645", indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "Bear Power",
          });
          bearSeries.setData(elderData.map((d) => ({ time: d.time as UTCTimestamp, value: d.bear })));
          bullSeries.createPriceLine({ price: 0, color: "rgba(255,255,255,0.3)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

        // StochRSI (K/D lines like Stochastic)
        } else if (indicator.type === "stochrsi") {
          const stochRSIData = calculateStochRSI(transformedCandles, indicator.parameters.rsiPeriod || 14, indicator.parameters.stochPeriod || 14, indicator.parameters.kSmooth || 3, indicator.parameters.dSmooth || 3);
          const kSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.upper || indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: "StochRSI %K",
          });
          kSeries.setData(stochRSIData.map((d) => ({ time: d.time as UTCTimestamp, value: d.k })));
          const dSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.signal || "#f23645", indicator.opacity || 80),
            lineWidth: 1 as any,
            title: "StochRSI %D",
          });
          dSeries.setData(stochRSIData.map((d) => ({ time: d.time as UTCTimestamp, value: d.d })));
          kSeries.createPriceLine({ price: 80, color: hexToRgba("#f23645", 70), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "80" });
          kSeries.createPriceLine({ price: 20, color: hexToRgba("#00e676", 70), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "20" });

        // PPO and SMI Ergodic (MACD-style with line + signal + histogram)
        } else if (indicator.type === "ppo" || indicator.type === "smi_ergodic") {
          const ppoData = indicator.type === "ppo"
            ? calculatePPO(transformedCandles, indicator.parameters.fast || 12, indicator.parameters.slow || 26, indicator.parameters.signal || 9)
            : calculateSMIErgodic(transformedCandles, indicator.parameters.shortPeriod || 5, indicator.parameters.longPeriod || 20, indicator.parameters.signalPeriod || 5);
          const mainSeries2 = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          mainSeries2.setData(ppoData.map((d) => ({ time: d.time as UTCTimestamp, value: d.macd })));
          const sigSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.colors?.signal || "#f97316", indicator.opacity || 80),
            lineWidth: 1 as any,
            title: "Signal",
          });
          sigSeries.setData(ppoData.map((d) => ({ time: d.time as UTCTimestamp, value: d.signal })));
          mainSeries2.createPriceLine({ price: 0, color: "rgba(255,255,255,0.3)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

        // --- PREMIUM OSCILLATOR INDICATORS ---
        // Bounded 0-100 oscillators: trend_pulse, market_regime, trend_composite, composite_breadth, reversal_signal, breakout_prob, heikin_ashi_trend, adaptive_rsi, trend_persistence, choppy_market
        } else if (["trend_pulse","market_regime","trend_composite","composite_breadth","reversal_signal","breakout_prob","heikin_ashi_trend","adaptive_rsi","trend_persistence","choppy_market"].includes(indicator.type)) {
          const boundedCalc: Record<string, () => { time: number; value: number }[]> = {
            trend_pulse: () => calculateTrendPulse(transformedCandles, indicator.parameters.adxPeriod || 14, indicator.parameters.rsiPeriod || 14),
            market_regime: () => calculateMarketRegime(transformedCandles, indicator.parameters.period || 20),
            trend_composite: () => calculateTrendComposite(transformedCandles, indicator.parameters.period || 14),
            composite_breadth: () => calculateCompositeBreadth(transformedCandles),
            reversal_signal: () => calculateReversalSignal(transformedCandles, indicator.parameters.rsiPeriod || 14),
            breakout_prob: () => calculateBreakoutProb(transformedCandles, indicator.parameters.bbPeriod || 20, indicator.parameters.keltPeriod || 20),
            heikin_ashi_trend: () => calculateHeikinAshiTrend(transformedCandles, indicator.parameters.period || 10),
            adaptive_rsi: () => calculateAdaptiveRSI(transformedCandles, indicator.parameters.period || 14),
            trend_persistence: () => calculateTrendPersistence(transformedCandles, indicator.parameters.period || 20),
            choppy_market: () => calculateChoppyMarket(transformedCandles, indicator.parameters.period || 14),
          };
          const bData = boundedCalc[indicator.type]?.() || [];
          const series = oscChart.addLineSeries({ color: hexToRgba(indicator.color, indicator.opacity || 100), lineWidth: indicator.lineWidth as any, title: indicator.customLabel || indicator.name });
          series.setData(bData.map(d => ({ time: d.time as UTCTimestamp, value: d.value })));
          series.createPriceLine({ price: 50, color: "rgba(255,255,255,0.3)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
          if (["adaptive_rsi","trend_pulse","reversal_signal"].includes(indicator.type)) {
            series.createPriceLine({ price: 70, color: hexToRgba("#f23645", 50), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
            series.createPriceLine({ price: 30, color: hexToRgba("#00e676", 50), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
          }

        // Zero-line oscillators: sentiment_osc, volatility_squeeze, squeeze_momentum, range_expansion, alpha_momentum, efficiency_ratio, momentum_wave, gap_momentum, price_action_score, ergodic_volume, order_flow_imbalance, net_buying_pressure, volume_climax, relative_vigor, intraday_intensity, volume_momentum, liquidity_heatmap, mtf_momentum
        } else if (["sentiment_osc","volatility_squeeze","squeeze_momentum","range_expansion","alpha_momentum","efficiency_ratio","momentum_wave","gap_momentum","price_action_score","ergodic_volume","order_flow_imbalance","net_buying_pressure","volume_climax","relative_vigor","intraday_intensity","volume_momentum","liquidity_heatmap","mtf_momentum"].includes(indicator.type)) {
          const zeroCalc: Record<string, () => { time: number; value: number }[]> = {
            sentiment_osc: () => calculateSentimentOsc(transformedCandles, indicator.parameters.smooth || 5),
            volatility_squeeze: () => calculateVolatilitySqueeze(transformedCandles, indicator.parameters.period || 20),
            squeeze_momentum: () => calculateSqueezeMomentum(transformedCandles, indicator.parameters.period || 20),
            range_expansion: () => calculateRangeExpansion(transformedCandles, indicator.parameters.period || 14),
            alpha_momentum: () => calculateAlphaMomentum(transformedCandles, indicator.parameters.period || 20),
            efficiency_ratio: () => calculateEfficiencyRatio(transformedCandles, indicator.parameters.period || 10),
            momentum_wave: () => calculateMomentumWave(transformedCandles, indicator.parameters.period || 20),
            gap_momentum: () => calculateGapMomentum(transformedCandles, indicator.parameters.period || 14),
            price_action_score: () => calculatePriceActionScore(transformedCandles, indicator.parameters.period || 10),
            ergodic_volume: () => calculateErgodicVolume(transformedCandles, indicator.parameters.shortPeriod || 5, indicator.parameters.longPeriod || 20),
            order_flow_imbalance: () => calculateOrderFlowImbalance(transformedCandles, indicator.parameters.period || 10),
            net_buying_pressure: () => calculateNetBuyingPressure(transformedCandles, indicator.parameters.period || 14),
            volume_climax: () => calculateVolumeClimax(transformedCandles, indicator.parameters.period || 20),
            relative_vigor: () => calculateRelativeVigor(transformedCandles, indicator.parameters.period || 10),
            intraday_intensity: () => calculateIntradayIntensity(transformedCandles, indicator.parameters.period || 21),
            volume_momentum: () => calculateVolumeMomentum(transformedCandles, indicator.parameters.period || 14),
            liquidity_heatmap: () => calculateLiquidityHeatmap(transformedCandles, indicator.parameters.period || 50),
            mtf_momentum: () => calculateMTFMomentum(transformedCandles),
          };
          const zData = zeroCalc[indicator.type]?.() || [];
          const series = oscChart.addLineSeries({ color: hexToRgba(indicator.color, indicator.opacity || 100), lineWidth: indicator.lineWidth as any, title: indicator.customLabel || indicator.name });
          series.setData(zData.map(d => ({ time: d.time as UTCTimestamp, value: d.value })));
          series.createPriceLine({ price: 0, color: "rgba(255,255,255,0.3)", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

        // Non-bounded line oscillators: whale_accumulation, smart_money_flow, fractal_dimension, volatility_ratio, cycle_detector
        } else if (["whale_accumulation","smart_money_flow","fractal_dimension","volatility_ratio","cycle_detector"].includes(indicator.type)) {
          const lineCalc: Record<string, () => { time: number; value: number }[]> = {
            whale_accumulation: () => calculateWhaleAccumulation(transformedCandles, indicator.parameters.threshold || 1.5),
            smart_money_flow: () => calculateSmartMoneyFlow(transformedCandles, indicator.parameters.period || 14),
            fractal_dimension: () => calculateFractalDimension(transformedCandles, indicator.parameters.period || 30),
            volatility_ratio: () => calculateVolatilityRatio(transformedCandles, indicator.parameters.shortPeriod || 5, indicator.parameters.longPeriod || 20),
            cycle_detector: () => calculateCycleDetector(transformedCandles, indicator.parameters.maxPeriod || 50),
          };
          const lData = lineCalc[indicator.type]?.() || [];
          const series = oscChart.addLineSeries({ color: hexToRgba(indicator.color, indicator.opacity || 100), lineWidth: indicator.lineWidth as any, title: indicator.customLabel || indicator.name });
          series.setData(lData.map(d => ({ time: d.time as UTCTimestamp, value: d.value })));

        } else {
          console.warn(
            `⚠️ Unknown oscillator indicator type: ${indicator.type}`,
          );
        }

        // Restore original methods and save tracked series
        oscChart.addLineSeries = _origAddLine;
        oscChart.addHistogramSeries = _origAddHist;
        oscillatorSeriesRef.current.set(indicator.id, oscSeriesList);

        // Two-tier refresh closure: "light" = tail-slice + series.update, "full" = all data + setData
        const _oscChartRef = oscChart;
        const _seriesRefs = [...oscSeriesList];
        const _indType = indicator.type;
        const _indParams = { ...indicator.parameters };
        const _priceSource = indicator.priceSource || "close";

        // Shared calculator builder (used by both light and full modes)
        const buildCalc = (tc: OHLCCandle[]) => {
          const p = _indParams;
          const calc: Record<string, () => {time:any,value:number}[]> = {
            rsi:()=>calculateRSI(tc,p.period||14), williams_r:()=>calculateWilliamsR(tc,p.period||14), cci:()=>calculateCCI(tc,p.period||20),
            mfi:()=>calculateMFI(tc,p.period||14), momentum:()=>calculateMomentum(tc,p.period||10), roc:()=>calculateROC(tc,p.period||12),
            atr:()=>calculateATR(tc,p.period||14), cmf:()=>calculateCMF(tc,p.period||20), obv:()=>calculateOBV(tc), adx:()=>calculateADX(tc,p.period||14),
            trend_pulse:()=>calculateTrendPulse(tc,p.adxPeriod||14,p.rsiPeriod||14), market_regime:()=>calculateMarketRegime(tc,p.period||20),
            trend_composite:()=>calculateTrendComposite(tc,p.period||14), composite_breadth:()=>calculateCompositeBreadth(tc),
            reversal_signal:()=>calculateReversalSignal(tc,p.rsiPeriod||14), breakout_prob:()=>calculateBreakoutProb(tc,p.bbPeriod||20,p.keltPeriod||20),
            heikin_ashi_trend:()=>calculateHeikinAshiTrend(tc,p.period||10), adaptive_rsi:()=>calculateAdaptiveRSI(tc,p.period||14),
            trend_persistence:()=>calculateTrendPersistence(tc,p.period||20), choppy_market:()=>calculateChoppyMarket(tc,p.period||14),
            sentiment_osc:()=>calculateSentimentOsc(tc,p.smooth||5), volatility_squeeze:()=>calculateVolatilitySqueeze(tc,p.period||20),
            squeeze_momentum:()=>calculateSqueezeMomentum(tc,p.period||20), range_expansion:()=>calculateRangeExpansion(tc,p.period||14),
            alpha_momentum:()=>calculateAlphaMomentum(tc,p.period||20), efficiency_ratio:()=>calculateEfficiencyRatio(tc,p.period||10),
            momentum_wave:()=>calculateMomentumWave(tc,p.period||20), gap_momentum:()=>calculateGapMomentum(tc,p.period||14),
            price_action_score:()=>calculatePriceActionScore(tc,p.period||10), ergodic_volume:()=>calculateErgodicVolume(tc,p.shortPeriod||5,p.longPeriod||20),
            order_flow_imbalance:()=>calculateOrderFlowImbalance(tc,p.period||10), net_buying_pressure:()=>calculateNetBuyingPressure(tc,p.period||14),
            volume_climax:()=>calculateVolumeClimax(tc,p.period||20), relative_vigor:()=>calculateRelativeVigor(tc,p.period||10),
            intraday_intensity:()=>calculateIntradayIntensity(tc,p.period||21), volume_momentum:()=>calculateVolumeMomentum(tc,p.period||14),
            liquidity_heatmap:()=>calculateLiquidityHeatmap(tc,p.period||50), mtf_momentum:()=>calculateMTFMomentum(tc),
            whale_accumulation:()=>calculateWhaleAccumulation(tc,p.threshold||1.5), smart_money_flow:()=>calculateSmartMoneyFlow(tc,p.period||14),
            fractal_dimension:()=>calculateFractalDimension(tc,p.period||30), volatility_ratio:()=>calculateVolatilityRatio(tc,p.shortPeriod||5,p.longPeriod||20),
            cycle_detector:()=>calculateCycleDetector(tc,p.maxPeriod||50),
          };
          return calc;
        };

        oscillatorRefreshFnsRef.current.set(indicator.id, (mode: "light" | "full") => {
          if (!isMountedRef.current || candleDataRef.current.length < 20 || _seriesRefs.length === 0) return;
          // Check chart is still alive
          try { _oscChartRef.timeScale(); } catch { return; }
          const p = _indParams;

          try {
            if (mode === "light") {
              // === LIGHT MODE: tail-slice (last 100 candles) + series.update() on last point ===
              // Only recalculates from a small window, then updates just the last data point.
              // series.update() naturally preserves zoom/scroll -- no range save/restore needed.
              const tailLen = Math.min(candleDataRef.current.length, 100);
              const tail = candleDataRef.current.slice(-tailLen);
              const tc = transformCandlesForPriceSource(tail, _priceSource);

              // Helper: update last point on a series via series.update()
              const uLast = (s: ISeriesApi<any>, d: { time: any; value: number }[]) => {
                if (d.length > 0) {
                  const last = d[d.length - 1];
                  s.update({ time: last.time as UTCTimestamp, value: last.value });
                }
              };

              if (_indType === "macd") {
                const d = calculateMACD(tc, p.fast||12, p.slow||26, p.signal||9);
                if (d.length > 0) {
                  const last = d[d.length - 1];
                  if (_seriesRefs[0]) _seriesRefs[0].update({ time: last.time as UTCTimestamp, value: last.signal });
                  if (_seriesRefs[1]) _seriesRefs[1].update({ time: last.time as UTCTimestamp, value: last.macd });
                  if (_seriesRefs[2]) _seriesRefs[2].update({ time: last.time as UTCTimestamp, value: last.histogram, color: last.histogram >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)" } as any);
                }
              } else if (_indType === "stochastic") {
                const d = calculateStochastic(tc, p.kPeriod||14, p.dPeriod||3);
                if (_seriesRefs[0]) uLast(_seriesRefs[0], d.k);
                if (_seriesRefs[1]) uLast(_seriesRefs[1], d.d);
              } else if (_indType === "stoch_rsi") {
                const d = calculateStochRSI(tc, p.rsiPeriod||14, p.stochPeriod||14, p.kSmooth||3, p.dSmooth||3);
                if (d.length > 0) {
                  const last = d[d.length - 1] as any;
                  if (_seriesRefs[0]) _seriesRefs[0].update({ time: last.time as UTCTimestamp, value: last.k });
                  if (_seriesRefs[1]) _seriesRefs[1].update({ time: last.time as UTCTimestamp, value: last.d });
                }
              } else {
                const calc = buildCalc(tc);
                const fn = calc[_indType];
                if (fn && _seriesRefs[0]) { uLast(_seriesRefs[0], fn()); }
              }

            } else {
              // === FULL MODE: all candles + setData() + range save/restore ===
              // Used when a new candle period starts or a completed candle arrives.
              const tc = transformCandlesForPriceSource(candleDataRef.current, _priceSource);
              let savedRange: any = null;
              try { savedRange = _oscChartRef.timeScale().getVisibleLogicalRange(); } catch {}

              const toTS = (d: { time: any; value: number }[]) => d.map(v => ({ time: v.time as UTCTimestamp, value: v.value }));

              if (_indType === "macd") {
                const d = calculateMACD(tc, p.fast||12, p.slow||26, p.signal||9);
                if (_seriesRefs[0]) _seriesRefs[0].setData(d.map(v => ({ time: v.time as UTCTimestamp, value: v.signal })));
                if (_seriesRefs[1]) _seriesRefs[1].setData(d.map(v => ({ time: v.time as UTCTimestamp, value: v.macd })));
                if (_seriesRefs[2]) _seriesRefs[2].setData(d.map(v => ({ time: v.time as UTCTimestamp, value: v.histogram, color: v.histogram >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)" } as any)));
              } else if (_indType === "stochastic") {
                const d = calculateStochastic(tc, p.kPeriod||14, p.dPeriod||3);
                if (_seriesRefs[0]) _seriesRefs[0].setData(toTS(d.k));
                if (_seriesRefs[1]) _seriesRefs[1].setData(toTS(d.d));
              } else if (_indType === "stoch_rsi") {
                const d = calculateStochRSI(tc, p.rsiPeriod||14, p.stochPeriod||14, p.kSmooth||3, p.dSmooth||3);
                if (_seriesRefs[0]) _seriesRefs[0].setData(d.map((v: any) => ({ time: v.time as UTCTimestamp, value: v.k })));
                if (_seriesRefs[1]) _seriesRefs[1].setData(d.map((v: any) => ({ time: v.time as UTCTimestamp, value: v.d })));
              } else {
                const calc = buildCalc(tc);
                const fn = calc[_indType];
                if (fn && _seriesRefs[0]) { _seriesRefs[0].setData(toTS(fn())); }
              }

              // Restore visible range to preserve zoom/scroll
              if (savedRange) { try { _oscChartRef.timeScale().setVisibleLogicalRange(savedRange); } catch {} }
            }
          } catch (err) {
            console.warn(`[OSC-REFRESH] Error refreshing ${_indType} (${mode}):`, err);
          }
        });

        // Only fitContent on newly created charts, not on data refreshes
        if (isNewChart) {
          oscChart.timeScale().fitContent();
        }
      }
    });

    log(`✅ Updated ${enabledIndicators.length} indicators`);
  };

  // Keep the ref always pointing to the latest updateIndicators (captures latest `indicators` state)
  updateIndicatorsFnRef.current = updateIndicators;

  // Two-tier refresh dispatcher:
  // "light" = tail-slice + series.update() (fast, for forming candle updates, preserves zoom naturally)
  // "full"  = all candles + setData() + range save/restore (accurate, for new candle periods / completed candles)
  refreshOscillatorsFnRef.current = (mode: "light" | "full" = "full") => {
    if (oscillatorRefreshFnsRef.current.size === 0) return;
    oscillatorRefreshFnsRef.current.forEach((fn) => {
      try { fn(mode); } catch { /* non-fatal */ }
    });
  };

  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);

  // Update indicators when they change
  useEffect(() => {
    log("⚡ Indicators state changed! New indicators:", indicators);
    if (
      chartRef.current &&
      candlestickSeriesRef.current &&
      candleDataRef.current.length > 0
    ) {
      log(
        "🔄 Updating indicators:",
        indicators.length,
        "total,",
        indicators.filter((i) => i.enabled).length,
        "enabled",
      );
      updateIndicators(
        candleDataRef.current,
        chartRef.current,
        candlestickSeriesRef.current,
      );
    } else {
      log("⚠️ Chart not ready yet, skipping indicator update");
    }
  }, [indicators]); // Re-run when indicator config changes (add/remove/toggle)

  // Strategy signal markers ref
  const signalMarkersRef = useRef<Map<string, any>>(new Map());
  const lastSignalCountRef = useRef(0);

  // Generate and render strategy signals - runs when strategies change or triggered by interval
  const generateSignals = useCallback(() => {
    const enabledStrategies = arsenalStrategies.filter((s) => s.enabled);

    if (
      enabledStrategies.length === 0 ||
      candleDataRef.current.length < 20 ||
      !chartRef.current
    ) {
      // Clear existing signals if no strategies
      if (candlestickSeriesRef.current) {
        try {
          candlestickSeriesRef.current.setMarkers([]);
        } catch {}
      }
      if (setArsenalSignals) {
        setArsenalSignals([]);
      }
      lastSignalCountRef.current = 0;
      return;
    }

    // Import and use the strategy signal service dynamically
    import("@/lib/services/strategy-signal.service")
      .then(({ generateStrategySignals, getSignalColor }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allSignals: any[] = [];

        enabledStrategies.forEach((strategy) => {
          if (!strategy.config?.rules?.length) return;

          const candles = candleDataRef.current.map((c) => ({
            time: c.time as number,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));

          const signals = generateStrategySignals(strategy.config, candles);

          signals.forEach((signal) => {
            allSignals.push({
              ...signal,
              strategyId: strategy.id,
              strategyName: strategy.itemName,
            });
          });
        });

        // Only log if signal count changed
        if (allSignals.length !== lastSignalCountRef.current) {
          log(
            "📊 Generated signals:",
            allSignals.length,
            "from",
            enabledStrategies.length,
            "strategies",
          );
          lastSignalCountRef.current = allSignals.length;
        }

        // Update context with signals
        if (setArsenalSignals) {
          setArsenalSignals(allSignals);
        }

        // Render signal markers on chart
        if (candlestickSeriesRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const markers: any[] = allSignals.map((signal) => {
            const isBuy = signal.type === "buy" || signal.type === "strong_buy";
            const color = getSignalColor(signal.type);
            const size =
              signal.strength >= 4 ? 3 : signal.strength >= 2 ? 2 : 1;

            return {
              time: signal.time,
              position: isBuy ? "belowBar" : "aboveBar",
              color: color,
              shape: isBuy ? "arrowUp" : "arrowDown",
              text: signal.type.replace("_", " ").toUpperCase(),
              size: size,
            };
          });

          try {
            candlestickSeriesRef.current.setMarkers(markers);
          } catch {
            // Ignore marker errors during chart transitions
          }
        }
      })
      .catch((err) => {
        console.error("Error loading strategy service:", err);
      });
  }, [arsenalStrategies, setArsenalSignals]);

  // Generate signals when strategies change or candles load
  useEffect(() => {
    generateSignals();
  }, [generateSignals, candlesLoaded, signalUpdateTrigger]);

  // Live signal update interval - regenerate signals every 5 seconds when strategies are enabled
  useEffect(() => {
    const enabledStrategies = arsenalStrategies.filter((s) => s.enabled);
    if (enabledStrategies.length === 0 || !candlesLoaded) {
      return;
    }

    // Initial generation
    generateSignals();

    // Set up interval for live updates
    const intervalId = setInterval(() => {
      setSignalUpdateTrigger((prev) => prev + 1);
    }, 5000); // Update signals every 5 seconds

    return () => clearInterval(intervalId);
  }, [
    arsenalStrategies.filter((s) => s.enabled).length,
    candlesLoaded,
    generateSignals,
  ]);

  // Initialize chart and load historical data
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Track if this specific effect instance is still active
    let isEffectActive = true;
    let chartInstance: ReturnType<typeof createChart> | null = null;
    let resizeObserverInstance: ResizeObserver | null = null;

    // Reset mounted state when chart initializes
    isMountedRef.current = true;

    const initializeChart = async () => {
      setLoading(true);
      setError(null);
      setCandlesLoaded(false); // Reset candles loaded state

      try {
        // Create chart with TradingView-like settings
        // Use container dimensions for responsive sizing
        const containerWidth = chartContainerRef.current!.clientWidth;
        const containerHeight =
          chartContainerRef.current!.clientHeight ||
          (window.innerWidth < 768 ? 350 : 500);
        const chart = createChart(chartContainerRef.current!, {
          width: containerWidth,
          height: containerHeight,
          layout: {
            background: { color: "#131722" },
            textColor: "#B2B5BE",
            fontSize: 11,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            // @ts-expect-error attributionLogo is a newer lightweight-charts option not yet in types
            attributionLogo: false, // Hide watermark
          },
          grid: {
            vertLines: {
              color: "rgba(42, 46, 57, 0.6)",
              style: 0,
              visible: true,
            },
            horzLines: {
              color: "rgba(42, 46, 57, 0.6)",
              style: 0,
              visible: true,
            },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: "rgba(152, 158, 172, 0.8)",
              width: 1,
              style: 0,
              labelBackgroundColor: "#2A2E39",
            },
            horzLine: {
              color: "rgba(152, 158, 172, 0.8)",
              width: 1,
              style: 0,
              labelBackgroundColor: "#2A2E39",
            },
          },
          rightPriceScale: {
            borderColor: "#2A2E39",
            scaleMargins: {
              top: 0.1,
              bottom: 0.15,
            },
            mode: 0,
            autoScale: true,
            alignLabels: true,
            borderVisible: true,
            entireTextOnly: false,
          },
          leftPriceScale: {
            visible: false,
          },
          timeScale: {
            borderColor: "#2A2E39",
            timeVisible: true,
            secondsVisible: timeframe === "1" || timeframe === "5",
            rightOffset: 10,
            barSpacing: 8,
            minBarSpacing: 2,
            fixLeftEdge: false,
            fixRightEdge: false,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            borderVisible: true,
            visible: true,
            ticksVisible: false,
            tickMarkFormatter: (time: UTCTimestamp) => {
              const date = new Date(time * 1000);
              const day = date.getUTCDate().toString().padStart(2, "0");
              const month = (date.getUTCMonth() + 1)
                .toString()
                .padStart(2, "0");
              const hours = date.getUTCHours().toString().padStart(2, "0");
              const minutes = date.getUTCMinutes().toString().padStart(2, "0");
              return `${day}/${month} ${hours}:${minutes}`;
            },
          },
          localization: {
            timeFormatter: (time: number) => {
              const date = new Date(time * 1000);
              const day = date.getUTCDate().toString().padStart(2, "0");
              const month = (date.getUTCMonth() + 1)
                .toString()
                .padStart(2, "0");
              const year = date.getUTCFullYear();
              const hours = date.getUTCHours().toString().padStart(2, "0");
              const minutes = date.getUTCMinutes().toString().padStart(2, "0");
              return `${day}/${month}/${year} ${hours}:${minutes}`;
            },
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            axisDoubleClickReset: true,
            mouseWheel: true,
            pinch: true,
          },
          kineticScroll: {
            mouse: false,
            touch: true,
          },
        });

        chartRef.current = chart;
        chartInstance = chart; // Store local reference for cleanup

        // Early return if effect was cleaned up during async operations
        if (!isEffectActive) {
          chart.remove();
          return;
        }

        // Create candlestick series with TradingView colors and 5 decimal precision
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: "#22AB94",
          downColor: "#F23645",
          borderUpColor: "#22AB94",
          borderDownColor: "#F23645",
          wickUpColor: "#22AB94",
          wickDownColor: "#F23645",
          borderVisible: false,
          priceFormat: {
            type: "price",
            precision: 5,
            minMove: 0.00001,
          },
        });

        candlestickSeriesRef.current = candlestickSeries;

        // Initialize period separator primitive
        const periodSeparator = new PeriodSeparatorPrimitive({
          color: "#363a45",
          lineWidth: 1,
          lineStyle: "dashed",
          opacity: 0.4,
          separatorType: "auto",
        });
        periodSeparator.attach(chart, candlestickSeries);
        periodSeparator.setTimeframe(timeframe);
        periodSeparator.setVisible(showPeriodSeparators);
        candlestickSeries.attachPrimitive(periodSeparator);
        periodSeparatorRef.current = periodSeparator;

        // Attach drawing system to chart (only if effect is still active)
        if (isEffectActive && chartContainerRef.current) {
          chartDrawings.attach(
            chart,
            candlestickSeries,
            chartContainerRef.current,
          );
        }

        // Add volume series (if enabled)
        if (showVolume) {
          const volumeSeries = chart.addHistogramSeries({
            color: "rgba(34, 171, 148, 0.5)",
            priceFormat: {
              type: "volume",
            },
            priceScaleId: "",
          });
          chart.priceScale("").applyOptions({
            scaleMargins: {
              top: 0.85,
              bottom: 0,
            },
          });
          volumeSeriesRef.current = volumeSeries;
        }

        // Add bid price line (blue) - conditionally based on settings
        if (showBidAskLines) {
          bidPriceLineRef.current = candlestickSeries.createPriceLine({
            price: 0,
            color: "#2962ff",
            lineWidth: 3,
            lineStyle: 0, // Solid - more prominent
            axisLabelVisible: showPriceLabels,
            title: "BID",
          });

          // Add ask price line (red)
          askPriceLineRef.current = candlestickSeries.createPriceLine({
            price: 0,
            color: "#f23645",
            lineWidth: 3,
            lineStyle: 0, // Solid - more prominent
            axisLabelVisible: showPriceLabels,
            title: "ASK",
          });
        }

        // Fetch candles from SERVER (source of truth)
        // For 1m: Server gets from MongoDB (saved by websocket-price-streamer)
        // For other TFs: Server gets from Massive.com REST API
        // Request ALL available history - cleanup script manages how much is kept
        log(`📊 Loading candles from server: ${symbol} (${timeframe})`);
        // Don't send count - let server use admin settings (initialCandleCount)
        const response = await fetch("/api/trading/candles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, timeframe }), // Server uses admin settings for count
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch candles: ${response.status}`);
        }

        const data = await response.json();

        // Early return if effect was cleaned up during fetch
        if (!isEffectActive) return;

        // API returns time in SECONDS - use directly (LightweightCharts expects seconds)
        const candles: OHLCCandle[] = data.candles.map(
          (c: {
            time: number;
            open: number;
            high: number;
            low: number;
            close: number;
            volume?: number;
          }) => ({
            time: c.time, // Already in seconds - DO NOT multiply by 1000!
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || 0,
          }),
        );

        log(`📊 Received ${candles.length} candles from ${data.source}`);

        if (candles.length === 0) {
          throw new Error("No historical data available");
        }

        // Convert data based on chart type
        let processedCandles = candles;
        if (chartType === "heikinashi") {
          processedCandles = convertToHeikinAshi(candles);
          log(
            `🎨 Converted to Heikin Ashi: ${processedCandles.length} candles`,
          );
        } else if (chartType === "renko") {
          processedCandles = convertToRenko(candles);
          log(`🧱 Converted to Renko: ${processedCandles.length} bars`);
        } else if (chartType === "pointfigure") {
          processedCandles = convertToPointFigure(candles);
          log(
            `⭕ Converted to Point & Figure: ${processedCandles.length} columns`,
          );
        }

        // Deduplicate timestamps and ensure ascending order
        const uniqueCandles = new Map<number, OHLCCandle>();
        for (const candle of processedCandles) {
          const time = candle.time;
          if (
            !uniqueCandles.has(time) ||
            uniqueCandles.get(time)!.time < candle.time
          ) {
            uniqueCandles.set(time, candle);
          }
        }
        processedCandles = Array.from(uniqueCandles.values()).sort(
          (a, b) => a.time - b.time,
        );

        // Set data to chart
        let chartData: CandlestickData<UTCTimestamp>[];

        if (chartType === "line") {
          // For line chart, only use close prices
          const lineData = processedCandles.map((candle) => ({
            time: candle.time as UTCTimestamp,
            value: candle.close,
          }));

          // Remove candlestick series and create line series
          if (candlestickSeriesRef.current) {
            chart.removeSeries(candlestickSeriesRef.current as any);
          }

          const lineSeries = chart.addLineSeries({
            color: "#2962FF",
            lineWidth: 2,
            priceFormat: {
              type: "price",
              precision: 5,
              minMove: 0.00001,
            },
          });

          candlestickSeriesRef.current = lineSeries as any;
          (lineSeries as any).setData(lineData);

          // Add bid/ask price lines to line series - conditionally based on settings
          if (showBidAskLines) {
            bidPriceLineRef.current = lineSeries.createPriceLine({
              price: 0,
              color: "#2962ff",
              lineWidth: 3,
              lineStyle: 0, // Solid - more prominent
              axisLabelVisible: showPriceLabels,
              title: "BID",
            });

            askPriceLineRef.current = lineSeries.createPriceLine({
              price: 0,
              color: "#f23645",
              lineWidth: 3,
              lineStyle: 0, // Solid - more prominent
              axisLabelVisible: showPriceLabels,
              title: "ASK",
            });
          }

          // Create chartData for reference (use line data format but with OHLC structure)
          chartData = processedCandles.map((candle) => ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
        } else {
          // For candlestick-based charts
          chartData = processedCandles.map((candle) => ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));

          candlestickSeries.setData(chartData);
        }

        // Store candle data for indicator calculations
        candleDataRef.current = candles;
        setCandlesLoaded(true); // Trigger TP/SL zone rendering

        // Set volume data if enabled
        if (showVolume && volumeSeriesRef.current) {
          const volumeData = candles.map((candle) => ({
            time: candle.time as UTCTimestamp,
            value: candle.volume || 0,
            color: candle.close >= candle.open ? "#26a69a80" : "#ef535080",
          }));
          volumeSeriesRef.current.setData(volumeData);
        }

        // Calculate and display indicators
        updateIndicators(candles, chart, candlestickSeries);

        chart.timeScale().fitContent();

        // Store last candle for updates
        currentCandleRef.current = chartData[chartData.length - 1];

        // Store oldest candle time for lazy loading
        if (candles.length > 0) {
          oldestCandleTimeRef.current = candles[0].time;
          // Check if API indicated there's more history
          setHasMoreHistory(data.hasMore !== false);
        }

        // Initialize price lines with last candle's close price
        const lastClose = chartData[chartData.length - 1].close;
        if (bidPriceLineRef.current && askPriceLineRef.current) {
          bidPriceLineRef.current.applyOptions({
            price: lastClose - 0.0001,
            title: "BID (loading...)",
          });
          askPriceLineRef.current.applyOptions({
            price: lastClose + 0.0001,
            title: "ASK (loading...)",
          });
        }

        log(`✅ Chart initialized with ${candles.length} candles`);
        setLoading(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("❌ Error initializing chart:", err);
        setError(err.message || "Failed to load chart");
        setLoading(false);
      }
    };

    initializeChart();

    // Handle resize with ResizeObserver for better responsiveness
    const handleResize = () => {
      // Guard: Don't resize if effect is no longer active or chart is disposed
      if (!isEffectActive || !chartInstance || !chartContainerRef.current)
        return;

      const { clientWidth, clientHeight } = chartContainerRef.current;
      try {
        chartInstance.applyOptions({
          width: clientWidth,
          height: clientHeight,
        });
      } catch {
        // Chart may be disposed - silently ignore
      }
    };

    // Use ResizeObserver for container size changes
    resizeObserverInstance = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserverInstance.observe(chartContainerRef.current);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      // CRITICAL: Mark effect as inactive FIRST to stop all callbacks
      isEffectActive = false;
      isMountedRef.current = false;

      // Disconnect resize observer immediately to prevent callbacks
      window.removeEventListener("resize", handleResize);
      if (resizeObserverInstance) {
        resizeObserverInstance.disconnect();
        resizeObserverInstance = null;
      }

      // Detach drawing system before chart removal
      chartDrawings.detach();

      // Clear all refs BEFORE removing chart to prevent "Object is disposed" errors
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      bidPriceLineRef.current = null;
      askPriceLineRef.current = null;
      currentCandleRef.current = null;
      volumeSeriesRef.current = null;
      positionLinesRef.current.clear();
      tpSlSeriesRef.current.clear();
      // Clear oscillator refs to prevent refresh closures from accessing disposed charts
      refreshOscillatorsFnRef.current = null;
      oscillatorRefreshFnsRef.current.clear();
      oscillatorSeriesRef.current.clear();
      oscillatorChartsRef.current.forEach((osc) => { try { osc.remove(); } catch {} });
      oscillatorChartsRef.current.clear();
      wsActiveRef.current = false;

      // Remove chart last using local reference
      if (chartInstance) {
        try {
          chartInstance.remove();
        } catch {
          // Chart may already be disposed - ignore silently
        }
        chartInstance = null;
      }
    };
  }, [
    symbol,
    timeframe,
    showVolume,
    chartType,
    showBidAskLines,
    showPriceLabels,
    dataRefreshTrigger,
  ]); // Chart reinitializes when these change

  // Lazy loading: Load more candles when user scrolls to the left edge
  const loadMoreCandles = useCallback(async () => {
    if (isLoadingMore || !hasMoreHistory || !oldestCandleTimeRef.current)
      return;
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    setIsLoadingMore(true);

    try {
      log(`📜 Loading more candles before ${oldestCandleTimeRef.current}...`);

      const response = await fetch("/api/trading/candles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          timeframe,
          // No count - server uses admin lazyLoadBatchSize setting
          before: oldestCandleTimeRef.current,
        }),
      });

      if (!response.ok) {
        console.error("Failed to load more candles:", response.status);
        return;
      }

      const data = await response.json();
      const newCandles: OHLCCandle[] = data.candles.map(
        (c: {
          time: number;
          open: number;
          high: number;
          low: number;
          close: number;
        }) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }),
      );

      if (newCandles.length === 0) {
        setHasMoreHistory(false);
        return;
      }

      // Update oldest candle time
      oldestCandleTimeRef.current = newCandles[0].time;
      setHasMoreHistory(data.hasMore !== false && newCandles.length >= 500);

      // Get current chart data
      const currentData = candleDataRef.current || [];

      // Combine: new candles (older) + current candles (newer)
      // Deduplicate by timestamp
      const candleMap = new Map<number, OHLCCandle>();
      for (const c of newCandles) {
        candleMap.set(c.time, c);
      }
      for (const c of currentData) {
        candleMap.set(c.time, c);
      }

      const combinedCandles = Array.from(candleMap.values()).sort(
        (a, b) => a.time - b.time,
      );

      // Update the chart
      const chartData = combinedCandles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      candlestickSeriesRef.current?.setData(chartData);
      candleDataRef.current = combinedCandles;

      // Update volume if enabled
      if (showVolume && volumeSeriesRef.current) {
        const volumeData = combinedCandles.map((candle) => ({
          time: candle.time as UTCTimestamp,
          value: candle.volume || 0,
          color: candle.close >= candle.open ? "#26a69a80" : "#ef535080",
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      log(
        `✅ Loaded ${newCandles.length} more candles, total: ${combinedCandles.length}`,
      );
    } catch (error) {
      console.error("Error loading more candles:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [symbol, timeframe, isLoadingMore, hasMoreHistory, showVolume]);

  // Subscribe to visible time range changes for lazy loading
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const handleVisibleTimeRangeChange = () => {
      if (!hasMoreHistory || isLoadingMore || !oldestCandleTimeRef.current)
        return;

      const visibleRange = chart.timeScale().getVisibleRange();
      if (!visibleRange) return;

      // Check if user has scrolled close to the left edge (oldest candles)
      const oldestVisible = visibleRange.from as number;
      const oldestCandle = oldestCandleTimeRef.current;

      // If the oldest visible candle is within 50 candles of our oldest data, load more
      // For 1m: 50 candles = 50 minutes
      // For 5m: 50 candles = 250 minutes, etc.
      const tf = String(timeframe);
      const timeframeMinutes =
        tf === "1m" || tf === "1"
          ? 1
          : tf === "5m" || tf === "5"
            ? 5
            : tf === "15m" || tf === "15"
              ? 15
              : tf === "30m" || tf === "30"
                ? 30
                : tf === "1h" || tf === "60"
                  ? 60
                  : tf === "4h" || tf === "240"
                    ? 240
                    : tf === "1d" || tf === "D"
                      ? 1440
                      : 1;

      const bufferTime = 50 * timeframeMinutes * 60; // 50 candles worth of time in seconds

      if (oldestVisible <= oldestCandle + bufferTime) {
        loadMoreCandles();
      }
    };

    chart
      .timeScale()
      .subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      try {
        chart
          .timeScale()
          .unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
      } catch {
        // Chart may be disposed
      }
    };
  }, [hasMoreHistory, isLoadingMore, loadMoreCandles, timeframe]);

  // Subscribe to crosshair move to show OHLCV data
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    const chart = chartRef.current;
    const series = candlestickSeriesRef.current;

    const handleCrosshairMove = (param: any) => {
      if (!param || !param.time || !param.seriesData) {
        setOhlcvData(null);
        return;
      }

      const data = param.seriesData.get(series);
      if (!data) {
        setOhlcvData(null);
        return;
      }

      // Format the time - use UTC for daily/weekly/monthly to avoid timezone confusion
      const timestamp = param.time as number;
      const date = new Date(timestamp * 1000);

      // For daily/weekly/monthly candles, show only date in UTC (no time)
      // For intraday candles, show date + time in local timezone
      const isDailyOrHigher = ["D", "W", "M", "1d", "1w", "1M"].includes(
        timeframe,
      );
      const timeStr = isDailyOrHigher
        ? date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

      // Get OHLCV values
      const open = data.open ?? data.value ?? 0;
      const high = data.high ?? data.value ?? 0;
      const low = data.low ?? data.value ?? 0;
      const close = data.close ?? data.value ?? 0;
      const volume = data.volume;

      // Calculate change
      const change = close - open;
      const changePercent = open !== 0 ? (change / open) * 100 : 0;

      setOhlcvData({
        time: timeStr,
        open,
        high,
        low,
        close,
        volume,
        change,
        changePercent,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      try {
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
      } catch {}
    };
  }, [candlesLoaded]);

  // Update price lines with real-time prices (bid/ask lines only)
  // NOTE: For 1m timeframe, bid/ask is updated from forming candle poll (for perfect sync with candles)
  useEffect(() => {
    if (
      !isMountedRef.current ||
      !chartRef.current ||
      !candlestickSeriesRef.current
    )
      return;

    // Skip for 1m timeframe - forming candle poll handles bid/ask update for perfect sync
    const isOneMinute = timeframe === "1" || (timeframe as string) === "1m";
    if (isOneMinute) return;

    const currentPrice = prices.get(symbol);
    if (!currentPrice) return;

    // Update bid/ask price lines for non-1m timeframes
    try {
      if (bidPriceLineRef.current && askPriceLineRef.current) {
        bidPriceLineRef.current.applyOptions({
          price: currentPrice.bid,
          title: `BID ${currentPrice.bid.toFixed(5)}`,
        });

        askPriceLineRef.current.applyOptions({
          price: currentPrice.ask,
          title: `ASK ${currentPrice.ask.toFixed(5)}`,
        });
      }
    } catch {
      // Chart may be disposed, ignore
    }
  }, [prices, symbol, chartType, timeframe]);

  // REAL-TIME UPDATES: Get forming candle from server
  // Mode is controlled by admin panel:
  // - 'polling': Browsers poll every 200ms (reliable, more server load)
  // - 'websocket': Server pushes updates (efficient, 99% less load)
  useEffect(() => {
    if (
      !isMountedRef.current ||
      !chartRef.current ||
      !candlestickSeriesRef.current
    )
      return;

    // Real-time updates for all timeframes (server-aggregated)
    const isOneMinute = timeframe === "1" || (timeframe as string) === "1m";
    const isFiveMinute = timeframe === "5" || (timeframe as string) === "5m";
    const isFifteenMinute =
      timeframe === "15" || (timeframe as string) === "15m";
    const isThirtyMinute =
      timeframe === "30" || (timeframe as string) === "30m";
    const is1h = timeframe === "60" || (timeframe as string) === "1h";
    const is4h = timeframe === "240" || (timeframe as string) === "4h";
    const isD = timeframe === "D" || (timeframe as string) === "1d";
    const isW = timeframe === "W" || (timeframe as string) === "1w";
    const isM = timeframe === "M" || (timeframe as string) === "1M";
    // All timeframes now supported

    // Helper function to update chart with candle data
    const updateChartWithCandle = (
      candle: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
      },
      price?: { bid: number; ask: number },
    ) => {
      if (
        !isMountedRef.current ||
        !chartRef.current ||
        !candlestickSeriesRef.current
      )
        return;

      // Update bid/ask lines
      if (price && bidPriceLineRef.current && askPriceLineRef.current) {
        bidPriceLineRef.current.applyOptions({
          price: price.bid,
          title: `BID ${price.bid.toFixed(5)}`,
        });
        askPriceLineRef.current.applyOptions({
          price: price.ask,
          title: `ASK ${price.ask.toFixed(5)}`,
        });
      }

      // MERGE candle data instead of replacing
      // This prevents WebSocket updates from "shrinking" the candle if they have incomplete data
      const existing = currentCandleRef.current;
      const isSameCandle = existing && existing.time === candle.time;

      const candleData: CandlestickData<UTCTimestamp> = {
        time: candle.time as UTCTimestamp,
        // Keep the existing open if same candle (first price of period), otherwise use new
        open: isSameCandle ? existing.open : candle.open,
        // Always keep the HIGHEST high
        high: isSameCandle ? Math.max(existing.high, candle.high) : candle.high,
        // Always keep the LOWEST low
        low: isSameCandle ? Math.min(existing.low, candle.low) : candle.low,
        // Always use the latest close
        close: candle.close,
      };

      if (chartType === "line") {
        (candlestickSeriesRef.current as any).update({
          time: candle.time as UTCTimestamp,
          value: candle.close,
        });
      } else {
        candlestickSeriesRef.current?.update(candleData);
      }

      currentCandleRef.current = candleData;

      // Keep candleDataRef in sync with forming candle so indicators use the latest price
      let isNewPeriod = false;
      if (candleDataRef.current.length > 0) {
        const lastIdx = candleDataRef.current.length - 1;
        const lastRefTime = candleDataRef.current[lastIdx].time;
        if (lastRefTime === candle.time) {
          // Update existing candle in-place (forming candle update)
          candleDataRef.current[lastIdx] = {
            ...candleDataRef.current[lastIdx],
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
          };
        } else if (candle.time > lastRefTime) {
          // New candle period started
          isNewPeriod = true;
          candleDataRef.current.push({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: 0,
          });
          if (candleDataRef.current.length > 500) candleDataRef.current.shift();
        }
      }

      // Two-tier oscillator refresh (per-instance throttle, 250ms)
      // New candle period -> full refresh (accurate setData); forming update -> light refresh (fast series.update)
      const now = Date.now();
      if (isNewPeriod) {
        // Always do a full refresh immediately when a new candle period starts
        lastOscRefreshRef.current = now;
        try { refreshOscillatorsFnRef.current?.("full"); } catch {}
      } else if (now - lastOscRefreshRef.current > 250) {
        // Light refresh for forming candle updates (tail-slice + series.update, preserves zoom)
        lastOscRefreshRef.current = now;
        try { refreshOscillatorsFnRef.current?.("light"); } catch {}
      }
    };

    // ==== WEBSOCKET MODE ====
    if (priceUpdateMode === "websocket") {
      // Get WebSocket URL (same as useWebSocket hook)
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws?token=price-viewer&type=user`;

      let ws: WebSocket | null = null;
      let reconnectTimeout: NodeJS.Timeout | null = null;
      let isCleanedUp = false;

      const connect = () => {
        if (isCleanedUp) return;

        try {
          ws = new WebSocket(wsUrl);

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);

              // Handle data_updated events (refresh chart when historical data changes)
              if (message.type === "data_updated" && message.data) {
                const { symbol: updatedSymbol } = message.data;

                // Only refresh if this chart is showing the updated symbol
                if (updatedSymbol === symbol) {
                  console.log(
                    `🔄 [Chart] Data updated for ${updatedSymbol} - refreshing chart...`,
                  );
                  // Trigger chart reload by incrementing the refresh counter
                  setDataRefreshTrigger((prev) => prev + 1);
                }
              }

              // Handle price_update events
              if (message.type === "price_update" && message.data) {
                const {
                  prices,
                  formingCandles,
                  formingCandles5m,
                  formingCandles15m,
                  formingCandles30m,
                  formingCandles1h,
                  formingCandles4h,
                  formingCandlesD,
                  formingCandlesW,
                  formingCandlesM,
                  completedCandles,
                } = message.data;

                // Select the correct forming candle based on timeframe
                const is5m =
                  timeframe === "5" || (timeframe as string) === "5m";
                const is15m =
                  timeframe === "15" || (timeframe as string) === "15m";
                const is30m =
                  timeframe === "30" || (timeframe as string) === "30m";
                const is1h =
                  timeframe === "60" || (timeframe as string) === "1h";
                const is4h =
                  timeframe === "240" || (timeframe as string) === "4h";
                const isD = timeframe === "D" || (timeframe as string) === "1d";
                const isW = timeframe === "W" || (timeframe as string) === "1w";
                const isM = timeframe === "M" || (timeframe as string) === "1M";

                // Map timeframe to timeframe string used in completedCandles
                // MUST match the format used in websocket-price-streamer.ts saveCompletedHigherTimeframeCandle()
                const currentTf = isM
                  ? "1M"
                  : isW
                    ? "1w"
                    : isD
                      ? "1d"
                      : is4h
                        ? "4h"
                        : is1h
                          ? "1h"
                          : is30m
                            ? "30m"
                            : is15m
                              ? "15m"
                              : is5m
                                ? "5m"
                                : "1m";

                // ⭐ HANDLE COMPLETED CANDLES - REPLACE with authoritative data from WebSocket
                // This is critical for unified pipeline: completed candles are the SINGLE SOURCE OF TRUTH
                // They come from WebSocket which saved them to historical collection after augmenting with 1m data

                // Track completed candle timestamps to prevent forming candles from overwriting them
                const completedTimestamps = new Set<number>();

                // 🔍 DEBUG: Log when completed candles are received
                if (completedCandles && completedCandles.length > 0) {
                  console.log(
                    `📦 [Chart] Received ${completedCandles.length} completed candle(s) in WebSocket message`,
                  );

                  if (candlestickSeriesRef.current) {
                    for (const completed of completedCandles) {
                      // 🔍 DEBUG: Log each completed candle
                      console.log(
                        `   📥 Completed: ${completed.symbol} ${completed.timeframe} @ ${new Date(completed.time * 1000).toISOString()}`,
                      );

                      // Check if this completed candle is for our symbol and timeframe
                      if (
                        completed.symbol === symbol &&
                        completed.timeframe === currentTf
                      ) {
                        console.log(
                          `   🎯 MATCHED: ${symbol} ${currentTf} @ ${new Date(completed.time * 1000).toISOString()}`,
                        );

                        // Track this timestamp as "finalized" - forming candles should NOT overwrite it
                        completedTimestamps.add(completed.time);

                        // Update candleDataRef with the authoritative completed candle
                        const completedTime = Number(completed.time);
                        const existingIndex = candleDataRef.current.findIndex(
                          (c) => c.time === completedTime,
                        );

                        if (existingIndex >= 0) {
                          // Update existing candle in our local data
                          candleDataRef.current[existingIndex] = {
                            time: completedTime,
                            open: completed.open,
                            high: completed.high,
                            low: completed.low,
                            close: completed.close,
                            volume:
                              candleDataRef.current[existingIndex].volume || 0,
                          };
                          console.log(
                            `   📝 Updated candleDataRef at index ${existingIndex}`,
                          );
                        } else {
                          // Candle doesn't exist yet, add it
                          candleDataRef.current.push({
                            time: completedTime,
                            open: completed.open,
                            high: completed.high,
                            low: completed.low,
                            close: completed.close,
                            volume: 0,
                          });
                          // Sort by time
                          candleDataRef.current.sort((a, b) => a.time - b.time);
                          console.log(
                            `   📝 Added new candle to candleDataRef`,
                          );
                        }

                        // Use setData() to properly update historical candles (update() only works for last bar)
                        try {
                          if (chartType === "line") {
                            const lineData = candleDataRef.current.map((c) => ({
                              time: c.time as UTCTimestamp,
                              value: c.close,
                            }));
                            (
                              candlestickSeriesRef.current as unknown as ISeriesApi<"Line">
                            ).setData(lineData);
                          } else {
                            const candleData = candleDataRef.current.map(
                              (c) => ({
                                time: c.time as UTCTimestamp,
                                open: c.open,
                                high: c.high,
                                low: c.low,
                                close: c.close,
                              }),
                            );
                            candlestickSeriesRef.current?.setData(candleData);
                          }
                          console.log(
                            `   ✅ APPLIED via setData(): O:${completed.open.toFixed(5)} H:${completed.high.toFixed(5)} L:${completed.low.toFixed(5)} C:${completed.close.toFixed(5)}`,
                          );
                        } catch (updateError) {
                          console.error(
                            `   ❌ FAILED to apply completed candle:`,
                            updateError,
                          );
                        }

                        // Reset currentCandleRef - the next forming candle should be for a NEW timestamp
                        if (
                          currentCandleRef.current &&
                          currentCandleRef.current.time === completedTime
                        ) {
                          console.log(
                            `   🔄 Reset currentCandleRef (was at same timestamp)`,
                          );
                          currentCandleRef.current = null;
                        }
                      } else {
                        console.log(
                          `   ⏭️ Skipped (not our symbol/tf): watching ${symbol}/${currentTf}, received ${completed.symbol}/${completed.timeframe}`,
                        );
                      }
                    }
                  } else {
                    console.warn(
                      `   ⚠️ candlestickSeriesRef.current is null - cannot apply completed candles!`,
                    );
                  }

                  // Full oscillator refresh after completed candles are applied
                  // This ensures indicators reflect the finalized candle data immediately
                  try { refreshOscillatorsFnRef.current?.("full"); } catch {}
                }

                const candleSource = isM
                  ? formingCandlesM
                  : isW
                    ? formingCandlesW
                    : isD
                      ? formingCandlesD
                      : is4h
                        ? formingCandles4h
                        : is1h
                          ? formingCandles1h
                          : is30m
                            ? formingCandles30m
                            : is15m
                              ? formingCandles15m
                              : is5m
                                ? formingCandles5m
                                : formingCandles;

                // Find forming candle for current symbol
                const candle = candleSource?.find(
                  (c: { symbol: string }) => c.symbol === symbol,
                );
                const price = prices?.find(
                  (p: { symbol: string }) => p.symbol === symbol,
                );

                if (candle) {
                  // 🛡️ CRITICAL: Do NOT apply forming candle if we just finalized it as a completed candle
                  // This prevents stale forming candle data from overwriting the authoritative completed candle
                  if (completedTimestamps.has(candle.time)) {
                    // Skip this forming candle - it's stale data for a candle we just finalized
                    // The next WebSocket message will have the new forming candle for the next period
                    console.log(
                      `🛡️ [Chart] BLOCKED forming candle: ${symbol} ${currentTf} @ ${new Date(candle.time * 1000).toISOString()} | Reason: timestamp ${candle.time} was just finalized as completed`,
                    );
                  } else {
                    // 🔍 DEBUG: Log forming candle updates (throttled to avoid spam - only log every 5 seconds)
                    const now = Date.now();
                    const lastFormingLogKey = `lastFormingLog_${symbol}_${currentTf}`;
                    const lastFormingLog =
                      (window as unknown as Record<string, number>)[
                        lastFormingLogKey
                      ] || 0;
                    if (now - lastFormingLog > 5000) {
                      console.log(
                        `📊 [Chart] Forming candle: ${symbol} ${currentTf} @ ${new Date(candle.time * 1000).toISOString()} | O:${candle.open?.toFixed(5)} H:${candle.high?.toFixed(5)} L:${candle.low?.toFixed(5)} C:${candle.close?.toFixed(5)}`,
                      );
                      (window as unknown as Record<string, number>)[
                        lastFormingLogKey
                      ] = now;
                    }
                    updateChartWithCandle(candle, price);
                  }
                }
              }
            } catch {
              // Ignore parse errors
            }
          };

          ws.onopen = () => {
            wsActiveRef.current = true;
            // Subscribe to only the symbol this chart needs
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "subscribe_symbol",
                  symbol: symbol,
                }),
              );
            }
          };

          ws.onclose = () => {
            wsActiveRef.current = false;
            if (!isCleanedUp) {
              // Reconnect after 2 seconds
              reconnectTimeout = setTimeout(connect, 2000);
            }
          };

          ws.onerror = () => {
            // Will trigger onclose
          };
        } catch {
          // Retry after 3 seconds
          if (!isCleanedUp) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        }
      };

      // Initial connection
      connect();

      // Cleanup
      return () => {
        isCleanedUp = true;
        wsActiveRef.current = false;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (ws) {
          ws.close(1000, "Chart cleanup");
          ws = null;
        }
      };
    }

    // ==== POLLING MODE (default) ====
    const fetchFormingCandle = async () => {
      if (
        !isMountedRef.current ||
        !chartRef.current ||
        !candlestickSeriesRef.current
      )
        return;

      try {
        // For 1m: use dedicated forming-candle endpoint
        // For 5m: use candles endpoint which includes forming candle in response
        if (isOneMinute) {
          const response = await fetch(
            `/api/trading/forming-candle?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (isFiveMinute) {
          // For 5m, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-5m?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (isFifteenMinute) {
          // For 15m, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-15m?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (isThirtyMinute) {
          // For 30m, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-30m?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (is1h) {
          // For 1h, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-1h?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (is4h) {
          // For 4h, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-4h?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (isD) {
          // For Daily, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-1d?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (isW) {
          // For Weekly, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-1w?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        } else if (isM) {
          // For Monthly, use dedicated forming candle endpoint
          const response = await fetch(
            `/api/trading/forming-candle-1M?symbol=${encodeURIComponent(symbol)}`,
          );
          if (!response.ok) return;

          const data = await response.json();
          if (data.candle) {
            updateChartWithCandle(data.candle, data.price);
          }
        }
      } catch {
        // Ignore errors - forming candle updates are best-effort
      }
    };

    // Poll at configured interval (admin can change via Market Data settings)
    const intervalId = setInterval(fetchFormingCandle, pollingIntervalMs);

    // Fetch immediately
    fetchFormingCandle();

    return () => clearInterval(intervalId);
  }, [symbol, timeframe, chartType, priceUpdateMode, pollingIntervalMs]);

  // Poll server for FULL candle history - SERVER IS SOURCE OF TRUTH
  // This runs less frequently and gets historical + new candles
  useEffect(() => {
    if (
      !isMountedRef.current ||
      !chartRef.current ||
      !candlestickSeriesRef.current ||
      !currentCandleRef.current
    )
      return;

    // Determine poll interval based on timeframe
    // Less frequent since forming candle updates happen via fast poll above
    const pollIntervals: Record<string, number> = {
      "1": 5000, // 5 seconds for 1m (forming candle updates via fast poll)
      "5": 5000, // 5 seconds for 5m
      "15": 10000, // 10 seconds for 15m
      "30": 15000, // 15 seconds for 30m
      "60": 30000, // 30 seconds for 1h
      "240": 60000, // 1 minute for 4h
      D: 300000, // 5 minutes for daily
      W: 600000, // 10 minutes for weekly
      M: 900000, // 15 minutes for monthly
    };

    const pollInterval = pollIntervals[timeframe] || 5000;

    const fetchLatestCandles = async () => {
      if (
        !isMountedRef.current ||
        !chartRef.current ||
        !candlestickSeriesRef.current
      )
        return;

      try {
        // Fetch latest candles from server
        const response = await fetch("/api/trading/candles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, timeframe, count: 10 }), // Just get last 10 candles for updates
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data.candles || data.candles.length === 0) return;

        // Update chart with latest candles from server
        const latestCandles = data.candles;

        for (const candle of latestCandles) {
          try {
            const candleData: CandlestickData<UTCTimestamp> = {
              time: candle.time as UTCTimestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            };

            if (chartType === "line") {
              // For line chart, use simple value format
              (
                candlestickSeriesRef.current as ISeriesApi<"Candlestick">
              ).update({
                time: candle.time as UTCTimestamp,
                value: candle.close,
              } as any);
            } else {
              // For candlestick-based charts
              candlestickSeriesRef.current?.update(candleData);
            }

            // Update reference to latest candle
            currentCandleRef.current = candleData;
          } catch {
            // Ignore individual candle update errors
          }
        }

        // Update candleDataRef for indicators (time already in seconds from API)
        if (candleDataRef.current.length > 0 && latestCandles.length > 0) {
          const lastServerCandle = latestCandles[latestCandles.length - 1];
          const lastRefIndex = candleDataRef.current.length - 1;

          if (
            candleDataRef.current[lastRefIndex].time === lastServerCandle.time
          ) {
            // Update existing candle
            candleDataRef.current[lastRefIndex] = {
              time: lastServerCandle.time, // Already in seconds
              open: lastServerCandle.open,
              high: lastServerCandle.high,
              low: lastServerCandle.low,
              close: lastServerCandle.close,
              volume: lastServerCandle.volume || 0,
            };
          } else if (
            lastServerCandle.time > candleDataRef.current[lastRefIndex].time
          ) {
            // New candle - add it
            candleDataRef.current.push({
              time: lastServerCandle.time, // Already in seconds
              open: lastServerCandle.open,
              high: lastServerCandle.high,
              low: lastServerCandle.low,
              close: lastServerCandle.close,
              volume: lastServerCandle.volume || 0,
            });
            // Keep array size manageable
            if (candleDataRef.current.length > 500) {
              candleDataRef.current.shift();
            }
          }
        }

        // Full indicator refresh from polling -- but only when WebSocket is NOT active
        // (WebSocket path already handles light/full refreshes; avoid double-refresh)
        if (!wsActiveRef.current) {
          try { refreshOscillatorsFnRef.current?.("full"); } catch {}
        }
      } catch {
        // Network error or chart disposed - ignore
      }
    };

    // Start polling
    const intervalId = setInterval(fetchLatestCandles, pollInterval);

    // Also fetch immediately on mount
    fetchLatestCandles();

    return () => {
      clearInterval(intervalId);
    };
  }, [symbol, timeframe, chartType]);

  // Add/update position entry price lines on the chart
  useEffect(() => {
    if (
      !isMountedRef.current ||
      !chartRef.current ||
      !candlestickSeriesRef.current
    )
      return;

    const series = candlestickSeriesRef.current;

    // Remove old price lines
    positionLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch {
        // Line might already be removed or chart disposed
      }
    });
    positionLinesRef.current.clear();

    // Remove old TP/SL filled area series
    tpSlSeriesRef.current.forEach((areaSeries) => {
      try {
        if (chartRef.current) {
          chartRef.current.removeSeries(areaSeries);
        }
      } catch {
        // Series might already be removed or chart disposed
      }
    });
    tpSlSeriesRef.current.clear();

    // Add price lines for current symbol's positions (if enabled)
    if (showTradeMarkers) {
      const symbolPositions = positions.filter((p) => p.symbol === symbol);

      // Debug: Log positions with TP/SL and rendering state
      log(
        `📊 Drawing TP/SL for ${symbolPositions.length} positions:`,
        symbolPositions.map((p) => ({
          id: p._id,
          symbol: p.symbol,
          hasTP: !!p.takeProfit,
          hasSL: !!p.stopLoss,
          tp: p.takeProfit,
          sl: p.stopLoss,
        })),
      );
      log(`🎨 Chart state:`, {
        candlesLoaded,
        candleCount: candleDataRef.current.length,
        hasChart: !!chartRef.current,
        showTPSLLines,
        showTPSLZones,
        showTradeMarkers,
      });

      symbolPositions.forEach((position) => {
        try {
          // Entry price line
          const isProfit = position.unrealizedPnl >= 0;
          const entryLine = series.createPriceLine({
            price: position.entryPrice,
            color: position.side === "long" ? "#26a69a" : "#ef5350",
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: showPriceLabels,
            title: `${position.side === "long" ? "↑" : "↓"} ${position.quantity} lots`,
          });
          positionLinesRef.current.set(position._id, entryLine);

          // Take Profit filled area and line (light green zone)
          if (
            position.takeProfit &&
            showTPSLLines &&
            chartRef.current &&
            candleDataRef.current.length > 0 &&
            showTPSLZones
          ) {
            log(
              `✅ Drawing TP ZONE for position ${position._id}: TP=${position.takeProfit}, Candles=${candleDataRef.current.length}`,
            );
            // Create baseline series for TP zone (filled area from entry to TP)
            const tpAreaSeries = chartRef.current.addBaselineSeries({
              baseValue: { type: "price", price: position.entryPrice },
              topFillColor1: "rgba(34, 197, 94, 0.15)", // Light green
              topFillColor2: "rgba(34, 197, 94, 0.05)", // Lighter green
              topLineColor: "transparent",
              bottomFillColor1: "rgba(34, 197, 94, 0.05)",
              bottomFillColor2: "rgba(34, 197, 94, 0.15)",
              bottomLineColor: "transparent",
              lineWidth: 1,
              priceScaleId: "right",
              lastValueVisible: false,
              priceLineVisible: false,
            });

            // Set data to fill the area at TP price level
            const tpData = candleDataRef.current.map((candle) => ({
              time: candle.time as UTCTimestamp,
              value: position.takeProfit!,
            }));
            tpAreaSeries.setData(tpData as any);

            tpSlSeriesRef.current.set(
              `${position._id}-tp-area`,
              tpAreaSeries as any,
            );

            // TP line on top
            const tpLine = series.createPriceLine({
              price: position.takeProfit,
              color: "#22c55e", // Green
              lineWidth: 2,
              lineStyle: 0, // Solid
              axisLabelVisible: showPriceLabels,
              title: "🎯 Take Profit",
            });
            positionLinesRef.current.set(`${position._id}-tp`, tpLine);
          }

          // Stop Loss filled area and line (light red zone)
          if (
            position.stopLoss &&
            showTPSLLines &&
            chartRef.current &&
            candleDataRef.current.length > 0 &&
            showTPSLZones
          ) {
            log(
              `✅ Drawing SL ZONE for position ${position._id}: SL=${position.stopLoss}, Candles=${candleDataRef.current.length}`,
            );
            // Create baseline series for SL zone (filled area from entry to SL)
            const slAreaSeries = chartRef.current.addBaselineSeries({
              baseValue: { type: "price", price: position.entryPrice },
              topFillColor1: "rgba(239, 68, 68, 0.15)", // Light red
              topFillColor2: "rgba(239, 68, 68, 0.05)", // Lighter red
              topLineColor: "transparent",
              bottomFillColor1: "rgba(239, 68, 68, 0.05)",
              bottomFillColor2: "rgba(239, 68, 68, 0.15)",
              bottomLineColor: "transparent",
              lineWidth: 1,
              priceScaleId: "right",
              lastValueVisible: false,
              priceLineVisible: false,
            });

            // Set data to fill the area at SL price level
            const slData = candleDataRef.current.map((candle) => ({
              time: candle.time as UTCTimestamp,
              value: position.stopLoss!,
            }));
            slAreaSeries.setData(slData as any);

            tpSlSeriesRef.current.set(
              `${position._id}-sl-area`,
              slAreaSeries as any,
            );

            // SL line on top
            const slLine = series.createPriceLine({
              price: position.stopLoss,
              color: "#ef4444", // Red
              lineWidth: 2,
              lineStyle: 0, // Solid
              axisLabelVisible: showPriceLabels,
              title: "🛑 Stop Loss",
            });
            positionLinesRef.current.set(`${position._id}-sl`, slLine);
          }

          // Debug: Log why zones might not be drawn
          if (
            position.takeProfit &&
            showTPSLLines &&
            showTPSLZones &&
            (!chartRef.current || candleDataRef.current.length === 0)
          ) {
            log(`⚠️ TP ZONE skipped for position ${position._id}:`, {
              hasChart: !!chartRef.current,
              candleCount: candleDataRef.current.length,
              showLines: showTPSLLines,
              showZones: showTPSLZones,
              candlesLoaded,
            });
          }
          if (
            position.stopLoss &&
            showTPSLLines &&
            showTPSLZones &&
            (!chartRef.current || candleDataRef.current.length === 0)
          ) {
            log(`⚠️ SL ZONE skipped for position ${position._id}:`, {
              hasChart: !!chartRef.current,
              candleCount: candleDataRef.current.length,
              showLines: showTPSLLines,
              showZones: showTPSLZones,
              candlesLoaded,
            });
          }

          // If zones are off, still show TP/SL lines (if lines are enabled)
          if (position.takeProfit && showTPSLLines && !showTPSLZones) {
            const tpLine = series.createPriceLine({
              price: position.takeProfit,
              color: "#22c55e",
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: showPriceLabels,
              title: "🎯 Take Profit",
            });
            positionLinesRef.current.set(`${position._id}-tp`, tpLine);
          }

          if (position.stopLoss && showTPSLLines && !showTPSLZones) {
            const slLine = series.createPriceLine({
              price: position.stopLoss,
              color: "#ef4444",
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: showPriceLabels,
              title: "🛑 Stop Loss",
            });
            positionLinesRef.current.set(`${position._id}-sl`, slLine);
          }
        } catch (error) {
          console.error("Error adding position price line:", error);
        }
      });
    }

    // ========================================
    // PENDING ORDER MARKERS (LIMIT ORDERS)
    // ========================================
    if (showTradeMarkers && pendingOrders.length > 0) {
      const symbolPendingOrders = pendingOrders.filter(
        (o) => o.symbol === symbol,
      );

      log(
        `📋 Drawing ${symbolPendingOrders.length} pending orders for ${symbol}`,
      );

      symbolPendingOrders.forEach((order) => {
        try {
          // Pending order line (dashed yellow line)
          const pendingLine = series.createPriceLine({
            price: order.requestedPrice,
            color: "#fbbf24", // Amber/Yellow for pending
            lineWidth: 2,
            lineStyle: 2, // Dashed line
            axisLabelVisible: showPriceLabels,
            title: `⏳ ${order.side === "buy" ? "BUY" : "SELL"} LIMIT ${order.quantity}`,
          });
          positionLinesRef.current.set(`pending-${order._id}`, pendingLine);

          log(
            `✅ Drew pending order line: ${order.side} ${order.quantity} @ ${order.requestedPrice.toFixed(5)}`,
          );
        } catch (error) {
          console.error("Error adding pending order price line:", error);
        }
      });
    }

    // Cleanup
    return () => {
      positionLinesRef.current.forEach((line) => {
        try {
          series.removePriceLine(line);
        } catch {
          // Ignore
        }
      });
      positionLinesRef.current.clear();
      tpSlSeriesRef.current.forEach((areaSeries) => {
        try {
          if (chartRef.current) {
            chartRef.current.removeSeries(areaSeries);
          }
        } catch {
          // Ignore
        }
      });
      tpSlSeriesRef.current.clear();
    };
  }, [
    positions,
    pendingOrders,
    symbol,
    candlestickSeriesRef.current,
    showTradeMarkers,
    showPriceLabels,
    showTPSLZones,
    showTPSLLines,
    candlesLoaded,
    tpslVersion,
  ]);

  const currentPrice = prices.get(symbol);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Bottom panel (positions/account) height in fullscreen - resizable
  const [bottomPanelHeight, setBottomPanelHeight] = useState(280);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  // Panel visibility toggles for fullscreen
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);

  // Calculate oscillator height to avoid overlap
  const activeOscillators = indicators.filter(
    (ind) => ind.enabled && ind.displayType === "oscillator",
  );

  // Oscillator panel height - resizable
  const [oscillatorHeight, setOscillatorHeight] = useState(130);
  const isOscDraggingRef = useRef(false);
  const oscDragStartYRef = useRef(0);
  const oscDragStartHeightRef = useRef(0);

  // Handle drag to resize oscillators
  const handleOscDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isOscDraggingRef.current = true;
      oscDragStartYRef.current = e.clientY;
      oscDragStartHeightRef.current = oscillatorHeight;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [oscillatorHeight],
  );

  useEffect(() => {
    const handleOscMouseMove = (e: MouseEvent) => {
      if (!isOscDraggingRef.current) return;
      // Inverted: drag down = larger oscillator panel
      const deltaY = oscDragStartYRef.current - e.clientY;
      const newHeight = Math.min(
        Math.max(oscDragStartHeightRef.current + deltaY, 80),
        300,
      );
      setOscillatorHeight(newHeight);
    };

    const handleOscMouseUp = () => {
      if (isOscDraggingRef.current) {
        isOscDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleOscMouseMove);
    document.addEventListener("mouseup", handleOscMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleOscMouseMove);
      document.removeEventListener("mouseup", handleOscMouseUp);
    };
  }, []);

  // Resize oscillator charts when height changes
  useEffect(() => {
    oscillatorChartsRef.current.forEach((oscChart) => {
      try {
        oscChart.resize(oscChart.options().width || 400, oscillatorHeight);
      } catch {
        // Chart might not be ready
      }
    });
  }, [oscillatorHeight]);

  // Handle drag to resize bottom panel
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartYRef.current = e.clientY;
      dragStartHeightRef.current = bottomPanelHeight;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [bottomPanelHeight],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = dragStartYRef.current - e.clientY;
      const newHeight = Math.min(
        Math.max(dragStartHeightRef.current + deltaY, 100),
        500,
      );
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Handle fullscreen change and resize chart
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      // Resize chart after fullscreen transition
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          try {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight,
            });
          } catch {
            // Chart may be disposed
          }
          chartRef.current.timeScale().fitContent();
        }
      }, 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (fullscreenRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        fullscreenRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div
      ref={fullscreenRef}
      className={cn(
        "bg-[#131722] rounded-lg border border-[#2b2b43] overflow-hidden flex flex-col relative",
        isFullscreen &&
          "!fixed !inset-0 !z-[9999] !rounded-none !border-none !w-screen !h-screen",
      )}
      style={
        isFullscreen
          ? {
              width: "100vw",
              height: "100vh",
              position: "fixed",
              top: 0,
              left: 0,
            }
          : undefined
      }
    >
      {/* Portal container for dialogs in fullscreen */}
      <div
        ref={portalContainerRef}
        className="absolute inset-0 pointer-events-none z-[99999]"
      />
      {/* Top Header Bar - Minimal TradingView Style (single row) */}
      <div className="bg-[#131722] border-b border-[#2a2e39] flex-shrink-0">
        <div className="flex items-center h-[36px] px-2 gap-2">
          {/* Symbol with icon */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-[9px] font-bold text-white">
              {symbol.slice(0, 2)}
            </div>
            <span className="text-[13px] font-semibold text-white">
              {symbol}
            </span>
            <span className="text-[11px] text-[#787B86]">• Forex</span>
          </div>

          {/* OHLC Data */}
          {ohlcvData ? (
            <div className="flex items-center gap-2 text-[11px] font-mono ml-2">
              <span>
                <span className="text-[#787B86]">O</span>{" "}
                <span className="text-[#d1d4dc]">
                  {ohlcvData.open.toFixed(5)}
                </span>
              </span>
              <span>
                <span className="text-[#787B86]">H</span>{" "}
                <span className="text-[#26a69a]">
                  {ohlcvData.high.toFixed(5)}
                </span>
              </span>
              <span>
                <span className="text-[#787B86]">L</span>{" "}
                <span className="text-[#ef5350]">
                  {ohlcvData.low.toFixed(5)}
                </span>
              </span>
              <span>
                <span className="text-[#787B86]">C</span>{" "}
                <span
                  className={
                    ohlcvData.change >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"
                  }
                >
                  {ohlcvData.close.toFixed(5)}
                </span>
              </span>
              <span
                className={cn(
                  "font-semibold",
                  ohlcvData.change >= 0 ? "text-[#26a69a]" : "text-[#ef5350]",
                )}
              >
                {ohlcvData.change >= 0 ? "+" : ""}
                {ohlcvData.changePercent.toFixed(2)}%
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[#787B86] font-mono ml-2">
              Hover for OHLCV
            </span>
          )}

          <div className="flex-1" />

          {/* Market Status */}
          <div
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-semibold",
              marketOpen
                ? "bg-[#22AB94]/15 text-[#22AB94]"
                : "bg-[#F23645]/15 text-[#F23645]",
            )}
          >
            {marketOpen ? "● LIVE" : "● CLOSED"}
          </div>

          {/* Stale Warning */}
          {isStale && (
            <button
              onClick={forceRefresh}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
              title="Click to refresh prices"
            >
              ⚠ STALE
            </button>
          )}

          {/* Current Price + Bid/Ask */}
          {currentPrice && (
            <div className="flex items-center gap-1.5 ml-2">
              <button className="flex flex-col items-center px-2.5 py-0.5 bg-[#F23645]/10 hover:bg-[#F23645]/20 border border-[#F23645]/30 rounded transition-colors">
                <span className="text-[8px] text-[#F23645] font-medium leading-none">
                  SELL
                </span>
                <span className="text-[12px] text-[#F23645] font-bold tabular-nums leading-tight">
                  {currentPrice.bid.toFixed(5)}
                </span>
              </button>
              <div className="text-[9px] text-[#787B86] font-mono">
                {(
                  currentPrice.spread * (symbol.includes("JPY") ? 100 : 10000)
                ).toFixed(1)}
              </div>
              <button className="flex flex-col items-center px-2.5 py-0.5 bg-[#26a69a]/10 hover:bg-[#26a69a]/20 border border-[#26a69a]/30 rounded transition-colors">
                <span className="text-[8px] text-[#26a69a] font-medium leading-none">
                  BUY
                </span>
                <span className="text-[12px] text-[#26a69a] font-bold tabular-nums leading-tight">
                  {currentPrice.ask.toFixed(5)}
                </span>
              </button>
            </div>
          )}

          {/* Fullscreen toggle */}
          {isFullscreen && (
            <>
              <div className="w-px h-4 bg-[#363a45] mx-1" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRightPanel(!showRightPanel)}
                className={cn(
                  "h-6 w-6 p-0 hover:bg-[#2a2e39]",
                  showRightPanel ? "text-[#2962ff]" : "text-[#787b86]",
                )}
                title="Toggle Order Panel"
              >
                <PanelRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBottomPanel(!showBottomPanel)}
                className={cn(
                  "h-6 w-6 p-0 hover:bg-[#2a2e39]",
                  showBottomPanel ? "text-[#2962ff]" : "text-[#787b86]",
                )}
                title="Toggle Positions Panel"
              >
                <PanelBottom className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className={cn(
              "h-6 w-6 p-0 hover:bg-[#2a2e39]",
              isFullscreen ? "text-white bg-[#F23645]/20" : "text-[#787b86]",
            )}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      {/* Timeframe Dialog */}
      <Dialog open={timeframeDialogOpen} onOpenChange={setTimeframeDialogOpen}>
        <DialogContent
          className="bg-[#131722] border-[#2A2E39] text-white max-w-xs"
          style={{ zIndex: 99999 }}
          container={isFullscreen ? fullscreenRef.current : undefined}
        >
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#2962FF]" />
              Timeframe
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select chart timeframe
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: "1m", value: "1" as Timeframe },
              { label: "5m", value: "5" as Timeframe },
              { label: "15m", value: "15" as Timeframe },
              { label: "30m", value: "30" as Timeframe },
              { label: "1H", value: "60" as Timeframe },
              { label: "2H", value: "120" as Timeframe },
              { label: "4H", value: "240" as Timeframe },
              { label: "1D", value: "D" as Timeframe },
              { label: "1W", value: "W" as Timeframe },
              { label: "1M", value: "M" as Timeframe },
            ].map((tf) => (
              <Button
                key={tf.value}
                variant="ghost"
                onClick={() => {
                  setTimeframe(tf.value);
                  setTimeframeDialogOpen(false);
                }}
                className={cn(
                  "h-10 hover:bg-[#2A2E39]",
                  timeframe === tf.value &&
                    "bg-[#2962FF] text-white hover:bg-[#2962FF]",
                )}
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chart Type Dialog */}
      <Dialog open={chartTypeOpen} onOpenChange={setChartTypeOpen}>
        <DialogContent
          className="bg-[#131722] border-[#2A2E39] text-white max-w-xs"
          style={{ zIndex: 99999 }}
          container={isFullscreen ? fullscreenRef.current : undefined}
        >
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CandlestickChart className="h-5 w-5 text-[#2962FF]" />
              Chart Type
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select chart type
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 mt-4">
            {[
              {
                value: "candlestick",
                label: "Candlestick",
                icon: CandlestickChart,
              },
              { value: "line", label: "Line Chart", icon: LineChart },
              { value: "heikinashi", label: "Heikin Ashi", icon: BarChart },
              { value: "renko", label: "Renko Bars", icon: Grid },
              {
                value: "pointfigure",
                label: "Point & Figure",
                icon: CircleDot,
              },
            ].map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant="ghost"
                onClick={() => {
                  setChartType(value as typeof chartType);
                  setChartTypeOpen(false);
                }}
                className={cn(
                  "h-12 flex items-center justify-start gap-3 px-4 hover:bg-[#2A2E39]",
                  chartType === value &&
                    "bg-[#2962FF] text-white hover:bg-[#2962FF]",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          className="bg-[#131722] border-[#2b2b43] text-white max-w-sm"
          style={{ zIndex: 99999 }}
          container={isFullscreen ? fullscreenRef.current : undefined}
        >
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-500" />
              Chart Settings
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure chart appearance and display options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {/* Display Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#787b86] uppercase tracking-wide">
                Display
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">Show Volume</Label>
                  <p className="text-xs text-[#787b86]">
                    Display volume bars below chart
                  </p>
                </div>
                <Switch checked={showVolume} onCheckedChange={setShowVolume} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">Show Grid</Label>
                  <p className="text-xs text-[#787b86]">
                    Display chart grid lines
                  </p>
                </div>
                <Switch
                  checked={showGrid}
                  onCheckedChange={(v) => {
                    setShowGrid(v);
                    if (chartRef.current) {
                      try {
                        chartRef.current.applyOptions({
                          grid: {
                            vertLines: { visible: v },
                            horzLines: { visible: v },
                          },
                        });
                      } catch {
                        // Chart may be disposed
                      }
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">
                    Period Separators
                  </Label>
                  <p className="text-xs text-[#787b86]">
                    Show session/day divider lines
                  </p>
                </div>
                <Switch
                  checked={showPeriodSeparators}
                  onCheckedChange={setShowPeriodSeparators}
                />
              </div>
            </div>

            {/* Price Settings */}
            <div className="space-y-4 pt-4 border-t border-[#2b2b43]">
              <h4 className="text-sm font-semibold text-[#787b86] uppercase tracking-wide">
                Price
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">Bid/Ask Lines</Label>
                  <p className="text-xs text-[#787b86]">
                    Show bid/ask price lines
                  </p>
                </div>
                <Switch
                  checked={showBidAskLines}
                  onCheckedChange={setShowBidAskLines}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">Price Labels</Label>
                  <p className="text-xs text-[#787b86]">Show price on axis</p>
                </div>
                <Switch
                  checked={showPriceLabels}
                  onCheckedChange={setShowPriceLabels}
                />
              </div>
            </div>

            {/* Trading Settings */}
            <div className="space-y-4 pt-4 border-t border-[#2b2b43]">
              <h4 className="text-sm font-semibold text-[#787b86] uppercase tracking-wide">
                Trading
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">Position Markers</Label>
                  <p className="text-xs text-[#787b86]">
                    Show open position lines
                  </p>
                </div>
                <Switch
                  checked={showTradeMarkers}
                  onCheckedChange={setShowTradeMarkers}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">TP/SL Lines</Label>
                  <p className="text-xs text-[#787b86]">
                    Show take profit/stop loss
                  </p>
                </div>
                <Switch
                  checked={showTPSLLines}
                  onCheckedChange={setShowTPSLLines}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-white">TP/SL Zones</Label>
                  <p className="text-xs text-[#787b86]">Show colored zones</p>
                </div>
                <Switch
                  checked={showTPSLZones}
                  onCheckedChange={setShowTPSLZones}
                  disabled={!showTPSLLines}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content - Sidebar + Chart */}
      <div
        className={cn(
          "flex flex-1 min-h-0",
          isFullscreen ? "h-full" : "h-[650px]",
        )}
      >
        {/* Left Sidebar - TradingView Style Drawing Tools */}
        <ChartToolbar
          activeTool={chartDrawings.activeTool}
          onToolSelect={chartDrawings.setActiveTool}
          onClearAll={chartDrawings.clearAll}
          onDeleteSelected={chartDrawings.deleteSelected}
          hasSelection={chartDrawings.hasSelection}
          drawingsCount={chartDrawings.drawingsCount}
          defaultColor={chartDrawings.defaultColor}
          defaultLineWidth={chartDrawings.defaultLineWidth}
          onColorChange={chartDrawings.setDefaultColor}
          onLineWidthChange={chartDrawings.setDefaultLineWidth}
          onChartTypeClick={() => setChartTypeOpen(true)}
          onSettingsClick={() => setSettingsOpen(true)}
          indicatorManager={
            <AdvancedIndicatorManager
              indicators={indicators}
              onIndicatorsChange={setIndicators}
              portalContainer={isFullscreen ? fullscreenRef.current : undefined}
            />
          }
          className="w-[39px] h-full flex-shrink-0"
        />

        {/* Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chart - takes remaining space after oscillators */}
          <div
            className="relative min-h-0"
            style={{
              flex: `1 1 0`,
              minHeight: activeOscillators.length > 0
                ? (isFullscreen ? "200px" : "200px")
                : (isFullscreen ? "300px" : "350px"),
            }}
          >
            {/* Symbol + Timeframe Label (top-left corner like TradingView) */}
            <div className="absolute top-1.5 left-1.5 z-20 text-[11px] font-semibold text-[#787B86]">
              {symbol} •{" "}
              {timeframe === "D"
                ? "1D"
                : timeframe === "W"
                  ? "1W"
                  : timeframe === "M"
                    ? "1M"
                    : timeframe === "60"
                      ? "1H"
                      : timeframe === "120"
                        ? "2H"
                        : timeframe === "240"
                          ? "4H"
                          : `${timeframe}m`}
            </div>

            {/* Active Drawing Tool Indicator */}
            {chartDrawings.activeTool && (
              <div className="absolute top-2 right-2 z-30 bg-[#2962ff] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2">
                <Activity className="h-3 w-3 animate-pulse" />
                {chartDrawings.activeTool === "trend-line" && "Trend Line"}
                {chartDrawings.activeTool === "horizontal-line" && "H-Line"}
                {chartDrawings.activeTool === "vertical-line" && "V-Line"}
                {chartDrawings.activeTool === "rectangle" && "Rectangle"}
                {chartDrawings.activeTool === "arrow" && "Arrow"}
                {chartDrawings.activeTool === "fibonacci" && "Fibonacci"}
                {chartDrawings.activeTool === "ray" && "Ray"}
                {chartDrawings.activeTool === "extended-line" && "Ext Line"}
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#131722] z-20">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#2962ff] mx-auto mb-2" />
                  <p className="text-sm text-[#787b86]">Loading...</p>
                </div>
              </div>
            )}

            {/* Lazy loading indicator - Centered and Prominent */}
            {isLoadingMore && !loading && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-[#1e222d]/95 to-[#131722]/95 px-8 py-6 rounded-2xl border border-[#2962ff]/30 shadow-2xl shadow-[#2962ff]/20 backdrop-blur-sm">
                  {/* Animated spinner */}
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-[#2962ff]/20 rounded-full" />
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-[#2962ff] rounded-full animate-spin" />
                    <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-[#2962ff] animate-pulse" />
                  </div>
                  {/* Text */}
                  <div className="text-center">
                    <span className="text-sm font-medium text-white">
                      Loading History
                    </span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span
                        className="w-1.5 h-1.5 bg-[#2962ff] rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-[#2962ff] rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-[#2962ff] rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#131722] z-20">
                <div className="text-center text-[#f23645]">
                  <p className="text-sm">⚠️ {error}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.location.reload()}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Chart Container */}
            <div ref={chartContainerRef} className="absolute inset-0" />

            {/* New Drawing System is attached directly to the chart via primitives */}
          </div>

          {/* Oscillator Panels - Resizable, scrollable to prevent pushing timeframe bar off screen */}
          {activeOscillators.length > 0 && (
            <div className="flex flex-col min-h-0" style={{ maxHeight: "45%" }}>
              {/* Oscillator Drag Handle */}
              <div
                onMouseDown={handleOscDragStart}
                className="h-1.5 bg-[#1e222d] border-t border-[#2b2b43] cursor-ns-resize hover:bg-[#2962ff]/30 transition-colors flex items-center justify-center group flex-shrink-0"
              >
                <div className="w-10 h-0.5 rounded-full bg-[#787b86] group-hover:bg-[#2962ff]" />
              </div>

              <div className="flex-1 overflow-y-auto dark-scrollbar min-h-0">
                {activeOscillators.map((indicator) => (
                  <div
                    key={indicator.id}
                    className="border-t border-[#2b2b43] flex-shrink-0"
                  >
                    <div className="bg-[#1e222d] px-2 py-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#d1d4dc]">
                        {indicator.name}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: indicator.color }}
                      />
                    </div>
                    <div
                      id={`oscillator-${indicator.id}`}
                      style={{ height: `${oscillatorHeight}px`, width: "100%" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Timeframe Quick-Select Bar (TradingView style) */}
          <div className="h-[28px] bg-[#131722] border-t border-[#2a2e39] flex items-center justify-between px-2 flex-shrink-0">
            {/* Quick Timeframe Buttons */}
            <div className="flex items-center gap-0.5">
              {[
                { label: "1m", value: "1" as Timeframe },
                { label: "5m", value: "5" as Timeframe },
                { label: "15m", value: "15" as Timeframe },
                { label: "30m", value: "30" as Timeframe },
                { label: "1H", value: "60" as Timeframe },
                { label: "4H", value: "240" as Timeframe },
                { label: "1D", value: "D" as Timeframe },
                { label: "1W", value: "W" as Timeframe },
                { label: "1M", value: "M" as Timeframe },
              ].map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
                    timeframe === tf.value
                      ? "bg-[#2962FF] text-white"
                      : "text-[#787B86] hover:text-white hover:bg-[#2a2e39]",
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Right side: UTC Time display (uses state to avoid hydration mismatch) */}
            <div className="flex items-center gap-2 text-[10px] text-[#787B86] font-mono">
              <span>{utcTime} UTC</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Watchlist + Order Form (only in fullscreen) */}
        {isFullscreen && tradingProps && showRightPanel && (
          <div className="w-[380px] bg-[#0d0f14] border-l border-[#2b2b43] overflow-hidden flex-shrink-0 flex flex-col">
            {/* Watchlist */}
            <Watchlist className="h-[280px] border-0 rounded-none border-b border-[#2b2b43]" />

            {/* Order Form */}
            <div className="flex-1 overflow-y-auto dark-scrollbar p-3">
              <OrderForm
                competitionId={competitionId}
                availableCapital={tradingProps.availableCapital}
                defaultLeverage={tradingProps.defaultLeverage}
                openPositionsCount={tradingProps.openPositionsCount}
                maxPositions={tradingProps.maxPositions}
                currentEquity={tradingProps.currentEquity}
                existingUsedMargin={tradingProps.existingUsedMargin}
                currentBalance={tradingProps.currentBalance}
                marginThresholds={tradingProps.marginThresholds}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel - Positions & Account (only in fullscreen) */}
      {isFullscreen && tradingProps && showBottomPanel && (
        <>
          {/* Resizable Divider */}
          <div
            onMouseDown={handleDragStart}
            className="h-2 bg-[#0d0f14] border-y border-[#2b2b43] cursor-ns-resize hover:bg-[#2962ff]/30 transition-colors flex items-center justify-center group flex-shrink-0"
          >
            <GripHorizontal className="w-6 h-4 text-[#787b86] group-hover:text-[#2962ff]" />
          </div>

          {/* Bottom Content */}
          <div
            className="bg-[#0d0f14] overflow-hidden flex-shrink-0"
            style={{ height: bottomPanelHeight }}
          >
            <div className="flex h-full">
              {/* Positions Table */}
              <div className="flex-1 overflow-auto dark-scrollbar border-r border-[#2b2b43]">
                <div className="p-3">
                  <PositionsTable
                    positions={positions.map((p) => ({
                      _id: p._id,
                      symbol: p.symbol as ForexSymbol,
                      side: p.side,
                      quantity: p.quantity,
                      orderType: "market" as const,
                      entryPrice: p.entryPrice,
                      currentPrice: p.entryPrice,
                      unrealizedPnl: p.unrealizedPnl,
                      unrealizedPnlPercentage:
                        tradingProps.existingUsedMargin > 0
                          ? (p.unrealizedPnl /
                              tradingProps.existingUsedMargin) *
                            100
                          : 0,
                      stopLoss: p.stopLoss,
                      takeProfit: p.takeProfit,
                      marginUsed:
                        tradingProps.existingUsedMargin /
                        Math.max(positions.length, 1),
                      openedAt: new Date().toISOString(),
                    }))}
                    competitionId={competitionId}
                  />
                </div>
              </div>

              {/* Compact Account Overview for Fullscreen */}
              <div className="w-[400px] overflow-auto dark-scrollbar flex-shrink-0 bg-[#0d0f14]">
                <div className="p-2 h-full flex flex-col">
                  <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider mb-2 px-1">
                    Account
                  </div>
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    {/* Balance */}
                    <div className="bg-[#1e222d] rounded-lg p-2.5 border border-[#2b2b43]">
                      <div className="text-[10px] text-[#787b86] mb-0.5">
                        Balance
                      </div>
                      <div className="text-sm font-bold text-white tabular-nums">
                        ${tradingProps.currentBalance.toFixed(2)}
                      </div>
                    </div>
                    {/* Equity */}
                    <div className="bg-[#1e222d] rounded-lg p-2.5 border border-[#2b2b43]">
                      <div className="text-[10px] text-[#787b86] mb-0.5">
                        Equity
                      </div>
                      <div className="text-sm font-bold text-[#2962ff] tabular-nums">
                        ${tradingProps.currentEquity.toFixed(2)}
                      </div>
                    </div>
                    {/* Available */}
                    <div className="bg-[#1e222d] rounded-lg p-2.5 border border-[#2b2b43]">
                      <div className="text-[10px] text-[#787b86] mb-0.5">
                        Available
                      </div>
                      <div className="text-sm font-bold text-[#26a69a] tabular-nums">
                        ${tradingProps.availableCapital.toFixed(2)}
                      </div>
                    </div>
                    {/* Unrealized P&L */}
                    <div className="bg-[#1e222d] rounded-lg p-2.5 border border-[#2b2b43]">
                      <div className="text-[10px] text-[#787b86] mb-0.5">
                        P&L
                      </div>
                      <div
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          tradingProps.currentEquity -
                            tradingProps.currentBalance >=
                            0
                            ? "text-[#26a69a]"
                            : "text-[#ef5350]",
                        )}
                      >
                        {tradingProps.currentEquity -
                          tradingProps.currentBalance >=
                        0
                          ? "+"
                          : ""}
                        $
                        {(
                          tradingProps.currentEquity -
                          tradingProps.currentBalance
                        ).toFixed(2)}
                      </div>
                    </div>
                    {/* Used Margin */}
                    <div className="bg-[#1e222d] rounded-lg p-2.5 border border-[#2b2b43]">
                      <div className="text-[10px] text-[#787b86] mb-0.5">
                        Used Margin
                      </div>
                      <div className="text-sm font-bold text-[#f7931a] tabular-nums">
                        ${tradingProps.existingUsedMargin.toFixed(2)}
                      </div>
                    </div>
                    {/* Margin Level */}
                    <div className="bg-[#1e222d] rounded-lg p-2.5 border border-[#2b2b43]">
                      <div className="text-[10px] text-[#787b86] mb-0.5">
                        Margin Lvl
                      </div>
                      <div
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          tradingProps.existingUsedMargin > 0.01
                            ? (tradingProps.currentEquity /
                                tradingProps.existingUsedMargin) *
                                100 >
                              200
                              ? "text-[#26a69a]"
                              : "text-[#ef5350]"
                            : "text-[#787b86]",
                        )}
                      >
                        {tradingProps.existingUsedMargin > 0.01
                          ? `${((tradingProps.currentEquity / tradingProps.existingUsedMargin) * 100).toFixed(0)}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LightweightTradingChart;
