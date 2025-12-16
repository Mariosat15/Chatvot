'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { useDragScroll } from '@/hooks/useDragScroll';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { getRecentCandles, OHLCCandle, Timeframe } from '@/lib/services/forex-historical.service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
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
  Clock
} from 'lucide-react';
import AdvancedIndicatorManager, { CustomIndicator } from './AdvancedIndicatorManager';
import DrawingToolsPanel from './DrawingToolsPanel';
import DrawingCanvas, { DrawingToolType, DrawingItem, DrawingCanvasHandle } from './DrawingCanvas';
import { useTradingArsenal } from '@/contexts/TradingArsenalContext';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateWilliamsR,
  calculateCCI,
  calculateADX,
  calculateMFI,
  calculateParabolicSAR,
  calculatePivotPoints
} from '@/lib/services/indicators.service';

interface Position {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface PendingOrder {
  _id: string;
  symbol: string;
  side: 'buy' | 'sell';
  requestedPrice: number;
  quantity: number;
}

interface LightweightTradingChartProps {
  competitionId: string;
  positions?: Position[];
  pendingOrders?: PendingOrder[];
}

// Debug logging - disable in production
const DEBUG = process.env.NODE_ENV === 'development' && false; // Set to true only when debugging
const log = (...args: unknown[]): void => { if (DEBUG) console.log(...args); };

const LightweightTradingChart = ({ competitionId, positions = [], pendingOrders = [] }: LightweightTradingChartProps) => {
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
    log('🎨 LightweightTradingChart received positions:', positions.length);
    log('📊 Positions with TP/SL:', positions.map(p => ({
      id: p._id,
      symbol: p.symbol,
      hasTP: !!p.takeProfit,
      hasSL: !!p.stopLoss,
      tp: p.takeProfit,
      sl: p.stopLoss
    })));
  }, [positions]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  // Drag-to-scroll refs for horizontal scrollable areas
  const priceDisplayRef = useDragScroll<HTMLDivElement>();
  const toolbarRef = useDragScroll<HTMLDivElement>();
  
  // Store position price lines and filled areas
  const positionLinesRef = useRef<Map<string, any>>(new Map());
  const tpSlSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  
  const { prices, subscribe, unsubscribe, marketOpen, marketStatus } = usePrices();
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
  
  const [timeframe, setTimeframe] = useState<Timeframe>('5');
  const [loading, setLoading] = useState(true);
  const [candlesLoaded, setCandlesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(false);
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'renko' | 'heikinashi' | 'pointfigure'>('candlestick');
  const [showGrid, setShowGrid] = useState(true);
  const [indicators, setIndicators] = useState<CustomIndicator[]>([]);
  const [activeTool, setActiveTool] = useState<DrawingToolType>(null);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [drawingColor, setDrawingColor] = useState('#2962ff');
  const [drawingLineWidth, setDrawingLineWidth] = useState(2);
  const [drawingTextSize, setDrawingTextSize] = useState(14);
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [symbolDialogOpen, setSymbolDialogOpen] = useState(false);
  const [timeframeDialogOpen, setTimeframeDialogOpen] = useState(false);
  const [signalUpdateTrigger, setSignalUpdateTrigger] = useState(0);
  const drawingCanvasRef = useRef<DrawingCanvasHandle>(null);
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
  
  // Chart display settings - Load from localStorage
  const [showBidAskLines, setShowBidAskLines] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chart-show-bid-ask');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showPriceLabels, setShowPriceLabels] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chart-show-labels');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showTradeMarkers, setShowTradeMarkers] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chart-show-markers');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showTPSLZones, setShowTPSLZones] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chart-show-tpsl-zones');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [showTPSLLines, setShowTPSLLines] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chart-show-tpsl-lines');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chart-show-bid-ask', JSON.stringify(showBidAskLines));
    }
  }, [showBidAskLines]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chart-show-labels', JSON.stringify(showPriceLabels));
    }
  }, [showPriceLabels]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chart-show-markers', JSON.stringify(showTradeMarkers));
    }
  }, [showTradeMarkers]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chart-show-tpsl-zones', JSON.stringify(showTPSLZones));
    }
  }, [showTPSLZones]);

  // Sync arsenal indicators with chart indicators
  useEffect(() => {
    log('📊 Arsenal indicators changed:', arsenalIndicators);
    
    // Convert arsenal indicators to chart CustomIndicator format
    const chartIndicators: CustomIndicator[] = arsenalIndicators
      .filter(ai => ai.enabled)
      .map(ai => ({
        id: ai.id,
        type: ai.type,
        name: ai.itemName,
        displayType: ai.displayType,
        enabled: ai.enabled,
        color: ai.color || '#3b82f6',
        lineWidth: ai.lineWidth || 2,
        lineStyle: 0,
        parameters: ai.parameters || { period: 20 },
      }));
    
    // Merge with existing indicators (keep user-added ones, replace arsenal ones)
    setIndicators(prev => {
      const existingNonArsenal = prev.filter(i => !i.id.startsWith('arsenal-'));
      const newIndicators = [...existingNonArsenal, ...chartIndicators];
      log('📊 Updated chart indicators:', newIndicators.map(i => ({ id: i.id, type: i.type })));
      return newIndicators;
    });
  }, [arsenalIndicators, arsenalIndicators.length, arsenalIndicators.map(a => a.enabled).join(',')]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chart-show-tpsl-lines', JSON.stringify(showTPSLLines));
    }
  }, [showTPSLLines]);

  const lastUpdateRef = useRef<number>(0);
  const currentCandleRef = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const bidPriceLineRef = useRef<any>(null);
  const askPriceLineRef = useRef<any>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const oscillatorChartsRef = useRef<Map<string, IChartApi>>(new Map());
  const candleDataRef = useRef<OHLCCandle[]>([]);

  // Convert OHLC to Heikin Ashi
  const convertToHeikinAshi = (candles: OHLCCandle[]): OHLCCandle[] => {
    if (candles.length === 0) return [];
    
    const haCandles: OHLCCandle[] = [];
    let prevHA = { open: candles[0].open, close: candles[0].close };
    
    for (const candle of candles) {
      const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
      const haOpen = (prevHA.open + prevHA.close) / 2;
      const haHigh = Math.max(candle.high, haOpen, haClose);
      const haLow = Math.min(candle.low, haOpen, haClose);
      
      haCandles.push({
        time: candle.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: candle.volume
      });
      
      prevHA = { open: haOpen, close: haClose };
    }
    
    return haCandles;
  };

  // Convert OHLC to Renko bars (brick size: 0.0005 for forex)
  const convertToRenko = (candles: OHLCCandle[], brickSize: number = 0.0005): OHLCCandle[] => {
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
          const brickClose = currentBrick + (direction * brickSize);
          
          renkoBars.push({
            time: currentTime + (i * timeIncrement),
            open: brickOpen,
            high: Math.max(brickOpen, brickClose),
            low: Math.min(brickOpen, brickClose),
            close: brickClose,
            volume: volume / bricksToCreate
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
  const convertToPointFigure = (candles: OHLCCandle[], boxSize: number = 0.0005, reversal: number = 3): OHLCCandle[] => {
    if (candles.length === 0) return [];
    
    const pfColumns: OHLCCandle[] = [];
    let direction: 'X' | 'O' | null = null; // X = rising, O = falling
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
          direction = 'X';
        } else if (currentColumn - low >= boxSize) {
          direction = 'O';
        }
      }
      
      if (direction === 'X') {
        // Check for continuation (new X's)
        const boxes = Math.floor((high - currentColumn) / boxSize);
        if (boxes > 0) {
          const newHigh = currentColumn + (boxes * boxSize);
          pfColumns.push({
            time: columnStart + (columnCount * timeIncrement),
            open: currentColumn,
            high: newHigh,
            low: currentColumn,
            close: newHigh,
            volume: volume
          });
          currentColumn = newHigh;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }
        
        // Check for reversal (switch to O's)
        if (currentColumn - low >= reversal * boxSize) {
          direction = 'O';
          const newLow = currentColumn - (reversal * boxSize);
          pfColumns.push({
            time: candle.time + (columnCount * timeIncrement),
            open: currentColumn,
            high: currentColumn,
            low: newLow,
            close: newLow,
            volume: volume
          });
          currentColumn = newLow;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }
      } else if (direction === 'O') {
        // Check for continuation (new O's)
        const boxes = Math.floor((currentColumn - low) / boxSize);
        if (boxes > 0) {
          const newLow = currentColumn - (boxes * boxSize);
          pfColumns.push({
            time: columnStart + (columnCount * timeIncrement),
            open: currentColumn,
            high: currentColumn,
            low: newLow,
            close: newLow,
            volume: volume
          });
          currentColumn = newLow;
          columnStart = candle.time;
          columnCount++;
          volume = 0;
        }
        
        // Check for reversal (switch to X's)
        if (high - currentColumn >= reversal * boxSize) {
          direction = 'X';
          const newHigh = currentColumn + (reversal * boxSize);
          pfColumns.push({
            time: candle.time + (columnCount * timeIncrement),
            open: currentColumn,
            high: newHigh,
            low: currentColumn,
            close: newHigh,
            volume: volume
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
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
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
  const getPriceFromCandle = (candle: OHLCCandle, priceSource: string = 'close'): number => {
    switch (priceSource) {
      case 'open':
        return candle.open;
      case 'high':
        return candle.high;
      case 'low':
        return candle.low;
      case 'hl2':
        return (candle.high + candle.low) / 2;
      case 'hlc3':
        return (candle.high + candle.low + candle.close) / 3;
      case 'ohlc4':
        return (candle.open + candle.high + candle.low + candle.close) / 4;
      case 'close':
      default:
        return candle.close;
    }
  };

  // Helper function to transform candles based on price source
  const transformCandlesForPriceSource = (candles: OHLCCandle[], priceSource: string = 'close'): OHLCCandle[] => {
    if (priceSource === 'close') return candles; // Default, no transformation needed
    
    log(`💱 Transforming ${candles.length} candles for price source: ${priceSource}`);
    
    return candles.map(candle => {
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
  const updateIndicators = (candles: OHLCCandle[], chart: IChartApi, mainSeries: ISeriesApi<any>) => {
    log('🔄 updateIndicators called with', indicators.length, 'indicators');
    log('📊 Enabled indicators:', indicators.filter(i => i.enabled).map(i => i.type));
    
    // Clear existing indicator series
    indicatorSeriesRef.current.forEach(series => {
      try {
        chart.removeSeries(series);
      } catch {
        // Series might already be removed or chart disposed
      }
    });
    indicatorSeriesRef.current.clear();

    // Clear existing oscillator charts
    oscillatorChartsRef.current.forEach(oscChart => {
      try {
        oscChart.remove();
      } catch {
        // Oscillator chart might already be removed
      }
    });
    oscillatorChartsRef.current.clear();

    const enabledIndicators = indicators.filter(ind => ind.enabled);
    log('✅ Processing', enabledIndicators.length, 'enabled indicators');

    enabledIndicators.forEach(indicator => {
      log(`📈 Adding indicator: ${indicator.type} - ${indicator.name}`);
      log('   Settings:', {
        priceSource: indicator.priceSource || 'close',
        opacity: indicator.opacity,
        lineWidth: indicator.lineWidth,
        lineStyle: indicator.lineStyle,
        customLabel: indicator.customLabel,
        offset: indicator.offset,
        precision: indicator.precision,
        colors: indicator.colors,
        visibility: indicator.visibility,
        levels: indicator.levels
      });
      
      if (indicator.displayType === 'overlay') {
        // Transform candles based on price source
        const transformedCandles = transformCandlesForPriceSource(candles, indicator.priceSource || 'close');
        
        // Overlay indicators (on main chart)
        if (indicator.type === 'sma') {
          const smaData = calculateSMA(transformedCandles, indicator.parameters.period);
          const offsetData = applyOffset(smaData, indicator.offset || 0);
          
          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: 'right',
            priceFormat: {
              type: 'price',
              precision: indicator.precision || 5,
            },
          });
          
          lineSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        }
        else if (indicator.type === 'ema') {
          const emaData = calculateEMA(transformedCandles, indicator.parameters.period);
          const offsetData = applyOffset(emaData, indicator.offset || 0);
          
          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: 'right',
            priceFormat: {
              type: 'price',
              precision: indicator.precision || 5,
            },
          });
          
          lineSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        }
        else if (indicator.type === 'bb') {
          const bbData = calculateBollingerBands(transformedCandles, indicator.parameters.period, indicator.parameters.stdDev);
          const offsetData = applyOffset(bbData, indicator.offset || 0);
          
          // Upper band (only if visible)
          if (indicator.visibility?.upper !== false) {
            const upperColor = indicator.colors?.upper || indicator.color;
            const upperSeries = chart.addLineSeries({
              color: hexToRgba(upperColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || 'BB'} Upper`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            upperSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.upper
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_upper`, upperSeries);
          }
          
          // Middle band (only if visible)
          if (indicator.visibility?.middle !== false) {
            const middleColor = indicator.colors?.middle || indicator.color;
            const middleSeries = chart.addLineSeries({
              color: hexToRgba(middleColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: 2 as any, // Dashed
              title: `${indicator.customLabel || 'BB'} Middle`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            middleSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.middle
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_middle`, middleSeries);
          }
          
          // Lower band (only if visible)
          if (indicator.visibility?.lower !== false) {
            const lowerColor = indicator.colors?.lower || indicator.color;
            const lowerSeries = chart.addLineSeries({
              color: hexToRgba(lowerColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || 'BB'} Lower`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            lowerSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.lower
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_lower`, lowerSeries);
          }
        }
        else if (indicator.type === 'wma') {
          const wmaData = calculateSMA(transformedCandles, indicator.parameters.period);
          const offsetData = applyOffset(wmaData, indicator.offset || 0);
          
          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: 'right',
            priceFormat: {
              type: 'price',
              precision: indicator.precision || 5,
            },
          });
          
          lineSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        }
        else if (indicator.type === 'keltner') {
          // Keltner Channels - similar to Bollinger Bands
          const bbData = calculateBollingerBands(transformedCandles, indicator.parameters.period || 20, indicator.parameters.multiplier || 2);
          const offsetData = applyOffset(bbData, indicator.offset || 0);
          
          // Upper band (only if visible)
          if (indicator.visibility?.upper !== false) {
            const upperColor = indicator.colors?.upper || indicator.color;
            const upperSeries = chart.addLineSeries({
              color: hexToRgba(upperColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || 'Keltner'} Upper`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            upperSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.upper
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_upper`, upperSeries);
          }
          
          // Middle band (only if visible)
          if (indicator.visibility?.middle !== false) {
            const middleColor = indicator.colors?.middle || indicator.color;
            const middleSeries = chart.addLineSeries({
              color: hexToRgba(middleColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: 2 as any,
              title: `${indicator.customLabel || 'Keltner'} Middle`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            middleSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.middle
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_middle`, middleSeries);
          }
          
          // Lower band (only if visible)
          if (indicator.visibility?.lower !== false) {
            const lowerColor = indicator.colors?.lower || indicator.color;
            const lowerSeries = chart.addLineSeries({
              color: hexToRgba(lowerColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              lineStyle: indicator.lineStyle as any,
              title: `${indicator.customLabel || 'Keltner'} Lower`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            lowerSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.lower
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_lower`, lowerSeries);
          }
        }
        else if (indicator.type === 'sar') {
          const sarData = calculateParabolicSAR(transformedCandles, indicator.parameters.acceleration || 0.02, indicator.parameters.maximum || 0.2);
          const offsetData = applyOffset(sarData, indicator.offset || 0);
          
          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: 'right',
            priceFormat: {
              type: 'price',
              precision: indicator.precision || 5,
            },
          });
          
          lineSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        }
        else if (indicator.type === 'pivot') {
          const pivotData = calculatePivotPoints(transformedCandles);
          const offsetData = applyOffset(pivotData, indicator.offset || 0);
          
          // Pivot point
          const pivotSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: 2 as any,
            title: `${indicator.customLabel || 'Pivot'} PP`,
            priceScaleId: 'right',
            priceFormat: {
              type: 'price',
              precision: indicator.precision || 5,
            },
          });
          pivotSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.pivot
          })));
          indicatorSeriesRef.current.set(`${indicator.id}_pivot`, pivotSeries);
          
          // Support/Resistance levels
          ['r1', 'r2', 's1', 's2'].forEach(level => {
            const series = chart.addLineSeries({
              color: hexToRgba(level.startsWith('r') ? '#f23645' : '#00e676', indicator.opacity || 100),
              lineWidth: 1,
              lineStyle: 2 as any,
              title: `${indicator.customLabel || 'Pivot'} ${level.toUpperCase()}`,
              priceScaleId: 'right',
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            series.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: (d as any)[level]
            })));
            indicatorSeriesRef.current.set(`${indicator.id}_${level}`, series);
          });
        }
        else if (indicator.type === 'vwap') {
          const vwapData = calculateEMA(transformedCandles, indicator.parameters.period || 20);
          const offsetData = applyOffset(vwapData, indicator.offset || 0);
          
          const lineSeries = chart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            lineStyle: indicator.lineStyle as any,
            title: indicator.customLabel || indicator.name,
            priceScaleId: 'right',
            priceFormat: {
              type: 'price',
              precision: indicator.precision || 5,
            },
          });
          
          lineSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          indicatorSeriesRef.current.set(indicator.id, lineSeries);
        }
        else if (indicator.type === 'support_resistance') {
          // Auto Support & Resistance - Detect key levels from price data
          const period = indicator.parameters.period || 20;
          const strength = indicator.parameters.strength || 3; // Minimum touches to be considered valid
          
          // Find swing highs and lows
          const levels: { price: number; type: 'support' | 'resistance'; strength: number; time: number | string }[] = [];
          const closes = transformedCandles.map(c => c.close);
          const highs = candles.map(c => c.high);
          const lows = candles.map(c => c.low);
          
          // Simple level detection - find areas where price bounced multiple times
          const levelMap = new Map<number, { touches: number; type: 'support' | 'resistance' }>();
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
                levelMap.set(roundedPrice, { touches: 1, type: 'support' });
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
                levelMap.set(roundedPrice, { touches: 1, type: 'resistance' });
              }
            }
          }
          
          // Filter levels with enough touches and draw them
          let levelIndex = 0;
          const firstTime = candles[0]?.time || 0;
          const lastTime = candles[candles.length - 1]?.time || 0;
          
          levelMap.forEach((value, price) => {
            if (value.touches >= Math.max(1, strength - 1)) {
              const color = value.type === 'support' ? '#00e676' : '#f23645';
              
              const lineSeries = chart.addLineSeries({
                color: hexToRgba(color, indicator.opacity || 80),
                lineWidth: indicator.lineWidth as any || 2,
                lineStyle: 2 as any, // Dashed
                title: `${value.type.charAt(0).toUpperCase() + value.type.slice(1)} ${price.toFixed(precision)}`,
                priceScaleId: 'right',
                priceFormat: {
                  type: 'price',
                  precision: precision,
                },
              });
              
              // Create a horizontal line across the entire chart
              lineSeries.setData([
                { time: firstTime as UTCTimestamp, value: price },
                { time: lastTime as UTCTimestamp, value: price },
              ]);
              
              indicatorSeriesRef.current.set(`${indicator.id}_level_${levelIndex}`, lineSeries);
              levelIndex++;
            }
          });
          
          log(`📊 S/R Indicator: Found ${levelIndex} levels`);
        }
        else {
          console.warn(`⚠️ Unknown overlay indicator type: ${indicator.type}`);
        }
      }
      else if (indicator.displayType === 'oscillator') {
        // Transform candles based on price source
        const transformedCandles = transformCandlesForPriceSource(candles, indicator.priceSource || 'close');
        
        // Oscillator indicators (separate panels)
        const container = document.getElementById(`oscillator-${indicator.id}`);
        if (!container) return;

        const oscChart = createChart(container, {
          width: container.clientWidth,
          height: 150,
          layout: {
            background: { color: '#131722' },
            textColor: '#d1d4dc',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: '#1e222d' },
            horzLines: { color: '#1e222d' },
          },
          timeScale: {
            borderColor: '#2b2b43',
            timeVisible: false,
            secondsVisible: false,
          },
          rightPriceScale: {
            borderColor: '#2b2b43',
          },
        });

        oscillatorChartsRef.current.set(indicator.id, oscChart);

        if (indicator.type === 'rsi') {
          const rsiData = calculateRSI(transformedCandles, indicator.parameters.period);
          const offsetData = applyOffset(rsiData, indicator.offset || 0);
          
          const rsiSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          
          rsiSeries.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));

          // Add custom overbought/oversold lines
          const overbought = indicator.levels?.overbought || 70;
          const oversold = indicator.levels?.oversold || 30;
          
          const overboughtLine = rsiSeries.createPriceLine({
            price: overbought,
            color: hexToRgba('#f23645', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          const oversoldLine = rsiSeries.createPriceLine({
            price: oversold,
            color: hexToRgba('#00e676', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        }
        else if (indicator.type === 'macd') {
          const macdData = calculateMACD(
            transformedCandles,
            indicator.parameters.fast,
            indicator.parameters.slow,
            indicator.parameters.signal
          );
          const offsetData = applyOffset(macdData, indicator.offset || 0);

          // MACD line (only if visible)
          if (indicator.visibility?.main !== false) {
            const macdSeries = oscChart.addLineSeries({
              color: hexToRgba(indicator.color, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              title: `${indicator.customLabel || 'MACD'}`,
            });
            macdSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.macd
            })));
          }

          // Signal line (only if visible)
          if (indicator.visibility?.signal !== false) {
            const signalColor = indicator.colors?.signal || '#f23645';
            const signalSeries = oscChart.addLineSeries({
              color: hexToRgba(signalColor, indicator.opacity || 100),
              lineWidth: indicator.lineWidth as any,
              title: 'Signal',
            });
            signalSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.signal
            })));
          }

          // Histogram (only if visible)
          if (indicator.visibility?.histogram !== false) {
            const positiveColor = indicator.colors?.positive || '#26a69a';
            const negativeColor = indicator.colors?.negative || '#ef5350';
            
            const histogramSeries = oscChart.addHistogramSeries({
              priceFormat: {
                type: 'price',
                precision: indicator.precision || 5,
              },
            });
            histogramSeries.setData(offsetData.map(d => ({
              time: d.time as UTCTimestamp,
              value: d.histogram,
              color: hexToRgba(d.histogram >= 0 ? positiveColor : negativeColor, indicator.opacity || 100)
            })));
          }
        }
        else if (indicator.type === 'stoch') {
          const stochData = calculateStochastic(
            transformedCandles,
            indicator.parameters.kPeriod,
            indicator.parameters.dPeriod
          );
          const offsetKData = applyOffset(stochData.k, indicator.offset || 0);
          const offsetDData = applyOffset(stochData.d, indicator.offset || 0);

          // %K line
          const kSeries = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: `${indicator.customLabel || 'Stoch'} %K`,
          });
          kSeries.setData(offsetKData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));

          // %D line
          const dColor = indicator.colors?.signal || '#f23645';
          const dSeries = oscChart.addLineSeries({
            color: hexToRgba(dColor, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: '%D',
          });
          dSeries.setData(offsetDData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));

          // Add overbought/oversold lines
          const overboughtLine = kSeries.createPriceLine({
            price: 80,
            color: hexToRgba('#f23645', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: '80',
          });
          const oversoldLine = kSeries.createPriceLine({
            price: 20,
            color: hexToRgba('#00e676', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: '20',
          });
        }
        else if (indicator.type === 'williamsR') {
          const williamsData = calculateWilliamsR(transformedCandles, indicator.parameters.period || 14);
          const offsetData = applyOffset(williamsData, indicator.offset || 0);
          
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          
          // Add custom reference lines
          const overbought = indicator.levels?.overbought || -20;
          const oversold = indicator.levels?.oversold || -80;
          
          series.createPriceLine({
            price: overbought,
            color: hexToRgba('#f23645', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          series.createPriceLine({
            price: oversold,
            color: hexToRgba('#00e676', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        }
        else if (indicator.type === 'cci') {
          const cciData = calculateCCI(transformedCandles, indicator.parameters.period || 20);
          const offsetData = applyOffset(cciData, indicator.offset || 0);
          
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          
          // Add custom reference lines
          const overbought = indicator.levels?.overbought || 100;
          const oversold = indicator.levels?.oversold || -100;
          
          series.createPriceLine({
            price: overbought,
            color: hexToRgba('#f23645', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          series.createPriceLine({
            price: oversold,
            color: hexToRgba('#00e676', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        }
        else if (indicator.type === 'adx') {
          const adxData = calculateADX(transformedCandles, indicator.parameters.period || 14);
          const offsetData = applyOffset(adxData, indicator.offset || 0);
          
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || 'ADX',
          });
          series.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          
          // Add custom threshold line
          const threshold = indicator.levels?.threshold || 25;
          series.createPriceLine({
            price: threshold,
            color: hexToRgba('#787b86', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(threshold),
          });
        }
        else if (indicator.type === 'mfi') {
          const mfiData = calculateMFI(transformedCandles, indicator.parameters.period || 14);
          const offsetData = applyOffset(mfiData, indicator.offset || 0);
          
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || indicator.name,
          });
          series.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value
          })));
          
          // Add custom overbought/oversold lines
          const overbought = indicator.levels?.overbought || 80;
          const oversold = indicator.levels?.oversold || 20;
          
          series.createPriceLine({
            price: overbought,
            color: hexToRgba('#f23645', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(overbought),
          });
          series.createPriceLine({
            price: oversold,
            color: hexToRgba('#00e676', 70),
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: String(oversold),
          });
        }
        else if (indicator.type === 'atr') {
          // ATR - calculate as simple volatility indicator
          const rsiData = calculateRSI(transformedCandles, indicator.parameters.period || 14);
          const offsetData = applyOffset(rsiData, indicator.offset || 0);
          
          const series = oscChart.addLineSeries({
            color: hexToRgba(indicator.color, indicator.opacity || 100),
            lineWidth: indicator.lineWidth as any,
            title: indicator.customLabel || 'ATR',
          });
          series.setData(offsetData.map(d => ({
            time: d.time as UTCTimestamp,
            value: d.value / 100 // Scale for ATR visualization
          })));
        }
        else {
          console.warn(`⚠️ Unknown oscillator indicator type: ${indicator.type}`);
        }

        oscChart.timeScale().fitContent();
      }
    });
    
    log(`✅ Updated ${enabledIndicators.length} indicators`);
  };

  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);

  // Update indicators when they change
  useEffect(() => {
    log('⚡ Indicators state changed! New indicators:', indicators);
    if (chartRef.current && candlestickSeriesRef.current && candleDataRef.current.length > 0) {
      log('🔄 Updating indicators:', indicators.length, 'total,', indicators.filter(i => i.enabled).length, 'enabled');
      updateIndicators(candleDataRef.current, chartRef.current, candlestickSeriesRef.current);
    } else {
      log('⚠️ Chart not ready yet, skipping indicator update');
    }
  }, [indicators]); // Re-run when indicators change

  // Strategy signal markers ref
  const signalMarkersRef = useRef<Map<string, any>>(new Map());
  const lastSignalCountRef = useRef(0);
  
  // Generate and render strategy signals - runs when strategies change or triggered by interval
  const generateSignals = useCallback(() => {
    const enabledStrategies = arsenalStrategies.filter(s => s.enabled);
    
    if (enabledStrategies.length === 0 || candleDataRef.current.length < 20 || !chartRef.current) {
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
    import('@/lib/services/strategy-signal.service').then(({ generateStrategySignals, getSignalColor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allSignals: any[] = [];
      
      enabledStrategies.forEach(strategy => {
        if (!strategy.config?.rules?.length) return;
        
        const candles = candleDataRef.current.map(c => ({
          time: c.time as number,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        
        const signals = generateStrategySignals(strategy.config, candles);
        
        signals.forEach(signal => {
          allSignals.push({
            ...signal,
            strategyId: strategy.id,
            strategyName: strategy.itemName,
          });
        });
      });
      
      // Only log if signal count changed
      if (allSignals.length !== lastSignalCountRef.current) {
        log('📊 Generated signals:', allSignals.length, 'from', enabledStrategies.length, 'strategies');
        lastSignalCountRef.current = allSignals.length;
      }
      
      // Update context with signals
      if (setArsenalSignals) {
        setArsenalSignals(allSignals);
      }
      
      // Render signal markers on chart
      if (candlestickSeriesRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: any[] = allSignals.map(signal => {
          const isBuy = signal.type === 'buy' || signal.type === 'strong_buy';
          const color = getSignalColor(signal.type);
          const size = signal.strength >= 4 ? 3 : signal.strength >= 2 ? 2 : 1;
          
          return {
            time: signal.time,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: color,
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: signal.type.replace('_', ' ').toUpperCase(),
            size: size,
          };
        });
        
        try {
          candlestickSeriesRef.current.setMarkers(markers);
        } catch (err) {
          // Ignore marker errors during chart transitions
        }
      }
    }).catch(err => {
      console.error('Error loading strategy service:', err);
    });
  }, [arsenalStrategies, setArsenalSignals]);
  
  // Generate signals when strategies change or candles load
  useEffect(() => {
    generateSignals();
  }, [generateSignals, candlesLoaded, signalUpdateTrigger]);
  
  // Live signal update interval - regenerate signals every 5 seconds when strategies are enabled
  useEffect(() => {
    const enabledStrategies = arsenalStrategies.filter(s => s.enabled);
    if (enabledStrategies.length === 0 || !candlesLoaded) {
      return;
    }
    
    // Initial generation
    generateSignals();
    
    // Set up interval for live updates
    const intervalId = setInterval(() => {
      setSignalUpdateTrigger(prev => prev + 1);
    }, 5000); // Update signals every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [arsenalStrategies.filter(s => s.enabled).length, candlesLoaded, generateSignals]);

  // Initialize chart and load historical data
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initializeChart = async () => {
      setLoading(true);
      setError(null);
      setCandlesLoaded(false); // Reset candles loaded state

      try {
        // Create chart with TradingView-like settings
        // Use container dimensions for responsive sizing
        const containerWidth = chartContainerRef.current!.clientWidth;
        const containerHeight = chartContainerRef.current!.clientHeight || (window.innerWidth < 768 ? 350 : 500);
        const chart = createChart(chartContainerRef.current!, {
          width: containerWidth,
          height: containerHeight,
          layout: {
            background: { color: '#131722' },
            textColor: '#d1d4dc',
            fontSize: 12,
            fontFamily: "'Trebuchet MS', Arial, sans-serif",
          },
          grid: {
            vertLines: { 
              color: '#1e222d',
              style: 1,
              visible: true,
            },
            horzLines: { 
              color: '#1e222d',
              style: 1,
              visible: true,
            },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: '#758696',
              width: 1,
              style: 3,
              labelBackgroundColor: '#131722',
            },
            horzLine: {
              color: '#758696',
              width: 1,
              style: 3,
              labelBackgroundColor: '#131722',
            },
          },
          rightPriceScale: {
            borderColor: '#2b2b43',
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
            mode: 0, // Normal price scale
            autoScale: true,
            alignLabels: true,
            borderVisible: true,
            entireTextOnly: false,
          },
          leftPriceScale: {
            visible: false,
          },
          timeScale: {
            borderColor: '#2b2b43',
            timeVisible: true,
            secondsVisible: timeframe === '1' || timeframe === '5',
            rightOffset: 12,
            barSpacing: 6,
            fixLeftEdge: false,
            fixRightEdge: false,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            borderVisible: true,
            visible: true,
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

        // Create candlestick series with TradingView colors and 5 decimal precision
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          priceFormat: {
            type: 'price',
            precision: 5,
            minMove: 0.00001,
          },
        });

        candlestickSeriesRef.current = candlestickSeries;

        // Add volume series (if enabled)
        if (showVolume) {
          const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: '',
          });
          volumeSeriesRef.current = volumeSeries;
        }

        // Add bid price line (blue) - conditionally based on settings
        if (showBidAskLines) {
          bidPriceLineRef.current = candlestickSeries.createPriceLine({
            price: 0,
            color: '#2962ff',
            lineWidth: 3,
            lineStyle: 0, // Solid - more prominent
            axisLabelVisible: showPriceLabels,
            title: 'BID',
          });

          // Add ask price line (red)
          askPriceLineRef.current = candlestickSeries.createPriceLine({
            price: 0,
            color: '#f23645',
            lineWidth: 3,
            lineStyle: 0, // Solid - more prominent
            axisLabelVisible: showPriceLabels,
            title: 'ASK',
          });
        }

        // Fetch historical data from Massive.com
        log(`📊 Loading historical data: ${symbol} (${timeframe})`);
        const candles = await getRecentCandles(symbol, timeframe, 500);

        if (candles.length === 0) {
          throw new Error('No historical data available');
        }

        // Convert data based on chart type
        let processedCandles = candles;
        if (chartType === 'heikinashi') {
          processedCandles = convertToHeikinAshi(candles);
          log(`🎨 Converted to Heikin Ashi: ${processedCandles.length} candles`);
        } else if (chartType === 'renko') {
          processedCandles = convertToRenko(candles);
          log(`🧱 Converted to Renko: ${processedCandles.length} bars`);
        } else if (chartType === 'pointfigure') {
          processedCandles = convertToPointFigure(candles);
          log(`⭕ Converted to Point & Figure: ${processedCandles.length} columns`);
        }

        // Deduplicate timestamps and ensure ascending order
        const uniqueCandles = new Map<number, OHLCCandle>();
        for (const candle of processedCandles) {
          const time = candle.time;
          if (!uniqueCandles.has(time) || uniqueCandles.get(time)!.time < candle.time) {
            uniqueCandles.set(time, candle);
          }
        }
        processedCandles = Array.from(uniqueCandles.values()).sort((a, b) => a.time - b.time);

        // Set data to chart
        let chartData: CandlestickData<UTCTimestamp>[];
        
        if (chartType === 'line') {
          // For line chart, only use close prices
          const lineData = processedCandles.map(candle => ({
            time: candle.time as UTCTimestamp,
            value: candle.close,
          }));
          
          // Remove candlestick series and create line series
          if (candlestickSeriesRef.current) {
            chart.removeSeries(candlestickSeriesRef.current as any);
          }
          
          const lineSeries = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            priceFormat: {
              type: 'price',
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
              color: '#2962ff',
              lineWidth: 3,
              lineStyle: 0, // Solid - more prominent
              axisLabelVisible: showPriceLabels,
              title: 'BID',
            });
            
            askPriceLineRef.current = lineSeries.createPriceLine({
              price: 0,
              color: '#f23645',
              lineWidth: 3,
              lineStyle: 0, // Solid - more prominent
              axisLabelVisible: showPriceLabels,
              title: 'ASK',
            });
          }
          
          // Create chartData for reference (use line data format but with OHLC structure)
          chartData = processedCandles.map(candle => ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
        } else {
          // For candlestick-based charts
          chartData = processedCandles.map(candle => ({
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
          const volumeData = candles.map(candle => ({
            time: candle.time as UTCTimestamp,
            value: candle.volume || 0,
            color: candle.close >= candle.open ? '#26a69a80' : '#ef535080',
          }));
          volumeSeriesRef.current.setData(volumeData);
        }

        // Calculate and display indicators
        updateIndicators(candles, chart, candlestickSeries);

        chart.timeScale().fitContent();

        // Store last candle for updates
        currentCandleRef.current = chartData[chartData.length - 1];

        // Initialize price lines with last candle's close price
        const lastClose = chartData[chartData.length - 1].close;
        if (bidPriceLineRef.current && askPriceLineRef.current) {
          bidPriceLineRef.current.applyOptions({
            price: lastClose - 0.0001,
            title: 'BID (loading...)',
          });
          askPriceLineRef.current.applyOptions({
            price: lastClose + 0.0001,
            title: 'ASK (loading...)',
          });
        }

        log(`✅ Chart initialized with ${candles.length} candles`);
        setLoading(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error('❌ Error initializing chart:', err);
        setError(err.message || 'Failed to load chart');
        setLoading(false);
      }
    };

    initializeChart();

    // Handle resize with ResizeObserver for better responsiveness
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const { clientWidth, clientHeight } = chartContainerRef.current;
        try {
          chartRef.current.applyOptions({
            width: clientWidth,
            height: clientHeight,
          });
        } catch {
          // Chart may be disposed
        }
      }
    };

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      // Store reference and clear refs before removing to prevent "Object is disposed" errors
      const chart = chartRef.current;
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      if (chart) {
        try {
          chart.remove();
        } catch (e) {
          // Chart may already be disposed - ignore
          console.warn('Chart already disposed:', e);
        }
      }
    };
  }, [symbol, timeframe, showVolume, chartType, showBidAskLines, showPriceLabels]); // Chart reinitializes when these change

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
      
      // Format the time
      const timestamp = param.time as number;
      const date = new Date(timestamp * 1000);
      const timeStr = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

  // Update chart with real-time prices
  useEffect(() => {
    // Check if component is still mounted and chart is valid
    if (!isMountedRef.current || !chartRef.current || !candlestickSeriesRef.current || !currentCandleRef.current) return;

    const currentPrice = prices.get(symbol);
    if (!currentPrice) return;

    const now = Date.now();
    
    // Update price lines immediately (no throttle for precision)
    // Wrap in try-catch to prevent "Object is disposed" errors
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
      return;
    }
    
    // Throttle candle updates to once per second
    if (now - lastUpdateRef.current < 1000) return;
    lastUpdateRef.current = now;

    const mid = currentPrice.mid;
    const currentTime = Math.floor(now / 1000) as UTCTimestamp;

    // Determine candle window based on timeframe
    let candleWindow = 60; // 1 minute default
    switch (timeframe) {
      case '1': candleWindow = 60; break;
      case '5': candleWindow = 300; break;
      case '15': candleWindow = 900; break;
      case '60': candleWindow = 3600; break;
      case '240': candleWindow = 14400; break;
      case 'D': candleWindow = 86400; break;
    }

    const candleTime = (Math.floor(currentTime / candleWindow) * candleWindow) as UTCTimestamp;
    const lastCandle = currentCandleRef.current;

    try {
      // If same candle period, update current candle
      if (lastCandle.time === candleTime) {
        if (chartType === 'line') {
          // For line chart, use simple value format
          const updatedLine = {
            time: candleTime,
            value: mid,
          };
          (candlestickSeriesRef.current as any).update(updatedLine);
          // Store as candlestick format for reference
          currentCandleRef.current = {
            time: candleTime,
            open: lastCandle.open,
            high: Math.max(lastCandle.high, mid),
            low: Math.min(lastCandle.low, mid),
            close: mid,
          };
        } else {
          // For candlestick-based charts
          const updatedCandle: CandlestickData<UTCTimestamp> = {
            time: candleTime,
            open: lastCandle.open,
            high: Math.max(lastCandle.high, mid),
            low: Math.min(lastCandle.low, mid),
            close: mid,
          };
          candlestickSeriesRef.current.update(updatedCandle);
          currentCandleRef.current = updatedCandle;
          
          // Update candleDataRef with latest candle data for strategy signals
          if (candleDataRef.current.length > 0) {
            const lastIndex = candleDataRef.current.length - 1;
            if (candleDataRef.current[lastIndex].time === candleTime) {
              candleDataRef.current[lastIndex] = updatedCandle;
            }
          }
        }
      } else {
        // New candle period, create new candle
        if (chartType === 'line') {
          // For line chart, use simple value format
          const newLine = {
            time: candleTime,
            value: mid,
          };
          (candlestickSeriesRef.current as any).update(newLine);
          // Store as candlestick format for reference
          currentCandleRef.current = {
            time: candleTime,
            open: mid,
            high: mid,
            low: mid,
            close: mid,
          };
        } else {
          // For candlestick-based charts
          const newCandle: CandlestickData<UTCTimestamp> = {
            time: candleTime,
            open: mid,
            high: mid,
            low: mid,
            close: mid,
          };
          candlestickSeriesRef.current.update(newCandle);
          currentCandleRef.current = newCandle;
          
          // Add new candle to candleDataRef for strategy signals
          if (candleDataRef.current.length > 0) {
            candleDataRef.current.push(newCandle);
            // Keep array size manageable (last 500 candles)
            if (candleDataRef.current.length > 500) {
              candleDataRef.current.shift();
            }
          }
        }
      }
    } catch {
      // Series type mismatch or disposed chart during transition - ignore
    }
  }, [prices, symbol, timeframe, chartType]);

  // Add/update position entry price lines on the chart
  useEffect(() => {
    if (!isMountedRef.current || !chartRef.current || !candlestickSeriesRef.current) return;

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
      log(`📊 Drawing TP/SL for ${symbolPositions.length} positions:`, 
        symbolPositions.map(p => ({
          id: p._id,
          symbol: p.symbol,
          hasTP: !!p.takeProfit,
          hasSL: !!p.stopLoss,
          tp: p.takeProfit,
          sl: p.stopLoss
        }))
      );
      log(`🎨 Chart state:`, {
        candlesLoaded,
        candleCount: candleDataRef.current.length,
        hasChart: !!chartRef.current,
        showTPSLLines,
        showTPSLZones,
        showTradeMarkers
      });
      
      symbolPositions.forEach((position) => {
        try {
          // Entry price line
          const isProfit = position.unrealizedPnl >= 0;
          const entryLine = series.createPriceLine({
            price: position.entryPrice,
            color: position.side === 'long' ? '#26a69a' : '#ef5350',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: showPriceLabels,
            title: `${position.side === 'long' ? '↑' : '↓'} ${position.quantity} lots`,
          });
          positionLinesRef.current.set(position._id, entryLine);

          // Take Profit filled area and line (light green zone)
          if (position.takeProfit && showTPSLLines && chartRef.current && candleDataRef.current.length > 0 && showTPSLZones) {
            log(`✅ Drawing TP ZONE for position ${position._id}: TP=${position.takeProfit}, Candles=${candleDataRef.current.length}`);
            // Create baseline series for TP zone (filled area from entry to TP)
            const tpAreaSeries = chartRef.current.addBaselineSeries({
              baseValue: { type: 'price', price: position.entryPrice },
              topFillColor1: 'rgba(34, 197, 94, 0.15)', // Light green
              topFillColor2: 'rgba(34, 197, 94, 0.05)', // Lighter green
              topLineColor: 'transparent',
              bottomFillColor1: 'rgba(34, 197, 94, 0.05)',
              bottomFillColor2: 'rgba(34, 197, 94, 0.15)',
              bottomLineColor: 'transparent',
              lineWidth: 1,
              priceScaleId: 'right',
              lastValueVisible: false,
              priceLineVisible: false,
            });

            // Set data to fill the area at TP price level
            const tpData = candleDataRef.current.map((candle) => ({
              time: candle.time as UTCTimestamp,
              value: position.takeProfit!,
            }));
            tpAreaSeries.setData(tpData as any);
            
            tpSlSeriesRef.current.set(`${position._id}-tp-area`, tpAreaSeries as any);

            // TP line on top
            const tpLine = series.createPriceLine({
              price: position.takeProfit,
              color: '#22c55e', // Green
              lineWidth: 2,
              lineStyle: 0, // Solid
              axisLabelVisible: showPriceLabels,
              title: '🎯 Take Profit',
            });
            positionLinesRef.current.set(`${position._id}-tp`, tpLine);
          }

          // Stop Loss filled area and line (light red zone)
          if (position.stopLoss && showTPSLLines && chartRef.current && candleDataRef.current.length > 0 && showTPSLZones) {
            log(`✅ Drawing SL ZONE for position ${position._id}: SL=${position.stopLoss}, Candles=${candleDataRef.current.length}`);
            // Create baseline series for SL zone (filled area from entry to SL)
            const slAreaSeries = chartRef.current.addBaselineSeries({
              baseValue: { type: 'price', price: position.entryPrice },
              topFillColor1: 'rgba(239, 68, 68, 0.15)', // Light red
              topFillColor2: 'rgba(239, 68, 68, 0.05)', // Lighter red
              topLineColor: 'transparent',
              bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
              bottomFillColor2: 'rgba(239, 68, 68, 0.15)',
              bottomLineColor: 'transparent',
              lineWidth: 1,
              priceScaleId: 'right',
              lastValueVisible: false,
              priceLineVisible: false,
            });

            // Set data to fill the area at SL price level
            const slData = candleDataRef.current.map((candle) => ({
              time: candle.time as UTCTimestamp,
              value: position.stopLoss!,
            }));
            slAreaSeries.setData(slData as any);
            
            tpSlSeriesRef.current.set(`${position._id}-sl-area`, slAreaSeries as any);

            // SL line on top
            const slLine = series.createPriceLine({
              price: position.stopLoss,
              color: '#ef4444', // Red
              lineWidth: 2,
              lineStyle: 0, // Solid
              axisLabelVisible: showPriceLabels,
              title: '🛑 Stop Loss',
            });
            positionLinesRef.current.set(`${position._id}-sl`, slLine);
          }

          // Debug: Log why zones might not be drawn
          if (position.takeProfit && showTPSLLines && showTPSLZones && (!chartRef.current || candleDataRef.current.length === 0)) {
            log(`⚠️ TP ZONE skipped for position ${position._id}:`, {
              hasChart: !!chartRef.current,
              candleCount: candleDataRef.current.length,
              showLines: showTPSLLines,
              showZones: showTPSLZones,
              candlesLoaded
            });
          }
          if (position.stopLoss && showTPSLLines && showTPSLZones && (!chartRef.current || candleDataRef.current.length === 0)) {
            log(`⚠️ SL ZONE skipped for position ${position._id}:`, {
              hasChart: !!chartRef.current,
              candleCount: candleDataRef.current.length,
              showLines: showTPSLLines,
              showZones: showTPSLZones,
              candlesLoaded
            });
          }

          // If zones are off, still show TP/SL lines (if lines are enabled)
          if (position.takeProfit && showTPSLLines && !showTPSLZones) {
            const tpLine = series.createPriceLine({
              price: position.takeProfit,
              color: '#22c55e',
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: showPriceLabels,
              title: '🎯 Take Profit',
            });
            positionLinesRef.current.set(`${position._id}-tp`, tpLine);
          }

          if (position.stopLoss && showTPSLLines && !showTPSLZones) {
            const slLine = series.createPriceLine({
              price: position.stopLoss,
              color: '#ef4444',
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: showPriceLabels,
              title: '🛑 Stop Loss',
            });
            positionLinesRef.current.set(`${position._id}-sl`, slLine);
          }
        } catch (error) {
          console.error('Error adding position price line:', error);
        }
      });
    }

    // ========================================
    // PENDING ORDER MARKERS (LIMIT ORDERS)
    // ========================================
    if (showTradeMarkers && pendingOrders.length > 0) {
      const symbolPendingOrders = pendingOrders.filter((o) => o.symbol === symbol);
      
      log(`📋 Drawing ${symbolPendingOrders.length} pending orders for ${symbol}`);
      
      symbolPendingOrders.forEach((order) => {
        try {
          // Pending order line (dashed yellow line)
          const pendingLine = series.createPriceLine({
            price: order.requestedPrice,
            color: '#fbbf24', // Amber/Yellow for pending
            lineWidth: 2,
            lineStyle: 2, // Dashed line
            axisLabelVisible: showPriceLabels,
            title: `⏳ ${order.side === 'buy' ? 'BUY' : 'SELL'} LIMIT ${order.quantity}`,
          });
          positionLinesRef.current.set(`pending-${order._id}`, pendingLine);
          
          log(`✅ Drew pending order line: ${order.side} ${order.quantity} @ ${order.requestedPrice.toFixed(5)}`);
        } catch (error) {
          console.error('Error adding pending order price line:', error);
        }
      });
    }

    // Cleanup
    return () => {
      positionLinesRef.current.forEach((line) => {
        try {
          series.removePriceLine(line);
        } catch (error) {
          // Ignore
        }
      });
      positionLinesRef.current.clear();
      tpSlSeriesRef.current.forEach((areaSeries) => {
        try {
          if (chartRef.current) {
            chartRef.current.removeSeries(areaSeries);
          }
        } catch (error) {
          // Ignore
        }
      });
      tpSlSeriesRef.current.clear();
    };
  }, [positions, pendingOrders, symbol, candlestickSeriesRef.current, showTradeMarkers, showPriceLabels, showTPSLZones, showTPSLLines, candlesLoaded]);

  const currentPrice = prices.get(symbol);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
        isFullscreen && "!fixed !inset-0 !z-[9999] !rounded-none !border-none !w-screen !h-screen"
      )}
      style={isFullscreen ? { width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 } : undefined}
    >
      {/* Portal container for dialogs in fullscreen */}
      <div ref={portalContainerRef} className="absolute inset-0 pointer-events-none z-[99999]" />
      {/* Top Bar - Compact Header */}
      <div className="flex items-center justify-between bg-[#0d0f14] px-3 py-2 border-b border-[#2b2b43] flex-shrink-0">
        {/* Left: Symbol & Market Status */}
        <div className="flex items-center gap-3">
          {/* Symbol Selector Button */}
          <Button
            variant="ghost"
            onClick={() => setSymbolDialogOpen(true)}
            className="bg-[#1e222d] border border-[#2b2b43] text-white font-bold h-8 px-3 hover:bg-[#2a2e39] flex items-center gap-2"
          >
            <span>{symbol}</span>
            <ChevronDown className="h-3 w-3 text-[#787b86]" />
          </Button>

          {/* Symbol Selector Dialog */}
          <Dialog open={symbolDialogOpen} onOpenChange={setSymbolDialogOpen}>
            <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-xs" style={{ zIndex: 99999 }} container={isFullscreen ? fullscreenRef.current : undefined}>
              <DialogHeader>
                <DialogTitle className="text-white">Select Symbol</DialogTitle>
                <DialogDescription className="sr-only">Choose a currency pair to trade</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1 mt-4 max-h-[300px] overflow-y-auto">
                {Object.keys(FOREX_PAIRS).map((sym) => (
                  <Button
                    key={sym}
                    variant="ghost"
                    onClick={() => {
                      setSymbol(sym as ForexSymbol);
                      setSymbolDialogOpen(false);
                    }}
                    className={cn(
                      "h-10 justify-start px-4 hover:bg-[#2a2e39]",
                      symbol === sym && "bg-[#2962ff] text-white hover:bg-[#2962ff]"
                    )}
                  >
                    {sym}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          
          <div className={cn(
            "px-2 py-0.5 rounded text-[10px] font-semibold",
            marketOpen ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          )}>
            {marketOpen ? '● LIVE' : '● CLOSED'}
          </div>
        </div>

        {/* Center: Price Display */}
        {currentPrice && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-[#787b86]">B:</span>
              <span className="text-[#2962ff] font-bold">{currentPrice.bid.toFixed(5)}</span>
            </div>
            <div className="text-white font-bold text-sm">{currentPrice.mid.toFixed(5)}</div>
            <div className="flex items-center gap-1">
              <span className="text-[#787b86]">A:</span>
              <span className="text-[#f23645] font-bold">{currentPrice.ask.toFixed(5)}</span>
            </div>
            <div className="text-[#787b86] text-[10px]">
              {((currentPrice.spread / currentPrice.mid) * 10000).toFixed(1)}p
            </div>
          </div>
        )}

        {/* Right: Fullscreen */}
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleFullscreen}
          className={cn(
            "h-7 w-7 p-0 hover:bg-[#2a2e39]",
            isFullscreen ? "text-white bg-red-500/20 hover:bg-red-500/40" : "text-[#787b86]"
          )}
          title={isFullscreen ? "Exit Fullscreen (ESC)" : "Fullscreen"}
        >
          {isFullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Content - Sidebar + Chart */}
      <div className={cn("flex flex-1 min-h-0", isFullscreen ? "h-full" : "h-[900px]")}>
        {/* Left Sidebar - Tools */}
        <div className="w-12 bg-[#0d0f14] border-r border-[#2b2b43] flex flex-col items-center py-2 gap-1 overflow-y-auto">
          {/* Timeframe Selector */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTimeframeDialogOpen(true)}
            className="h-8 w-10 p-0 hover:bg-[#2a2e39] text-white bg-[#2962ff] text-[9px] font-bold"
            title="Timeframe"
          >
            {timeframe === 'D' ? '1D' : timeframe === 'W' ? '1W' : timeframe === 'M' ? '1M' : `${timeframe}m`}
          </Button>

          {/* Timeframe Dialog */}
          <Dialog open={timeframeDialogOpen} onOpenChange={setTimeframeDialogOpen}>
            <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-xs" style={{ zIndex: 99999 }} container={isFullscreen ? fullscreenRef.current : undefined}>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Timeframe
                </DialogTitle>
                <DialogDescription className="sr-only">Select chart timeframe</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: '1m', value: '1' as Timeframe },
                  { label: '5m', value: '5' as Timeframe },
                  { label: '15m', value: '15' as Timeframe },
                  { label: '30m', value: '30' as Timeframe },
                  { label: '1H', value: '60' as Timeframe },
                  { label: '2H', value: '120' as Timeframe },
                  { label: '4H', value: '240' as Timeframe },
                  { label: '1D', value: 'D' as Timeframe },
                  { label: '1W', value: 'W' as Timeframe },
                  { label: '1M', value: 'M' as Timeframe },
                ].map((tf) => (
                  <Button
                    key={tf.value}
                    variant="ghost"
                    onClick={() => {
                      setTimeframe(tf.value);
                      setTimeframeDialogOpen(false);
                    }}
                    className={cn(
                      "h-10 hover:bg-[#2a2e39]",
                      timeframe === tf.value && "bg-[#2962ff] text-white hover:bg-[#2962ff]"
                    )}
                  >
                    {tf.label}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <div className="w-8 h-px bg-[#2b2b43] my-1" />

          {/* Chart Type Dialog */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setChartTypeOpen(true)}
            className="h-8 w-10 p-0 hover:bg-[#2a2e39] text-[#787b86]"
            title={`Chart Type: ${chartType}`}
          >
            <CandlestickChart className="h-4 w-4" />
          </Button>

          {/* Chart Type Dialog */}
          <Dialog open={chartTypeOpen} onOpenChange={setChartTypeOpen}>
            <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-xs" style={{ zIndex: 99999 }} container={isFullscreen ? fullscreenRef.current : undefined}>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <CandlestickChart className="h-5 w-5 text-blue-500" />
                  Chart Type
                </DialogTitle>
                <DialogDescription className="sr-only">Select chart type</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 mt-4">
                {[
                  { value: 'candlestick', label: 'Candlestick', icon: CandlestickChart },
                  { value: 'line', label: 'Line Chart', icon: LineChart },
                  { value: 'heikinashi', label: 'Heikin Ashi', icon: BarChart },
                  { value: 'renko', label: 'Renko Bars', icon: Grid },
                  { value: 'pointfigure', label: 'Point & Figure', icon: CircleDot },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="ghost"
                    onClick={() => {
                      setChartType(value as typeof chartType);
                      setChartTypeOpen(false);
                    }}
                    className={cn(
                      "h-12 flex items-center justify-start gap-3 px-4 hover:bg-[#2a2e39]",
                      chartType === value && "bg-[#2962ff] text-white hover:bg-[#2962ff]"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Volume */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowVolume(!showVolume)}
            className={cn("h-8 w-10 p-0 hover:bg-[#2a2e39]", showVolume ? "text-white bg-[#2a2e39]" : "text-[#787b86]")}
            title="Volume"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>

          {/* Grid */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowGrid(!showGrid);
              if (chartRef.current) {
                try {
                  chartRef.current.applyOptions({
                    grid: { vertLines: { visible: !showGrid }, horzLines: { visible: !showGrid } },
                  });
                } catch {
                  // Chart may be disposed
                }
              }
            }}
            className={cn("h-8 w-10 p-0 hover:bg-[#2a2e39]", showGrid ? "text-white bg-[#2a2e39]" : "text-[#787b86]")}
            title="Grid"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>

          <div className="w-8 h-px bg-[#2b2b43] my-1" />

          {/* Drawing Tools */}
          <DrawingToolsPanel
            activeTool={activeTool}
            drawings={drawings}
            onToolSelect={setActiveTool}
            onClearDrawings={() => {
              drawingCanvasRef.current?.clearAllDrawings();
              setActiveTool(null);
            }}
            onDeleteSelected={() => {
              drawingCanvasRef.current?.deleteSelectedDrawing();
            }}
            selectedDrawingId={selectedDrawingId}
            onColorChange={setDrawingColor}
            onLineWidthChange={setDrawingLineWidth}
            onTextSizeChange={setDrawingTextSize}
            onUpdateSelectedDrawing={(updates) => {
              if (selectedDrawingId) {
                setDrawings(drawings.map(d => 
                  d.id === selectedDrawingId ? { ...d, ...updates } : d
                ));
              }
            }}
            currentColor={drawingColor}
            currentLineWidth={drawingLineWidth}
            currentTextSize={drawingTextSize}
            portalContainer={isFullscreen ? fullscreenRef.current : undefined}
          />

          <div className="w-8 h-px bg-[#2b2b43] my-1" />

          {/* Indicators */}
          <AdvancedIndicatorManager
            indicators={indicators}
            onIndicatorsChange={setIndicators}
            portalContainer={isFullscreen ? fullscreenRef.current : undefined}
          />

          {/* Settings Dialog */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-10 p-0 hover:bg-[#2a2e39] text-[#787b86]"
            title="Chart Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Settings Dialog */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-sm" style={{ zIndex: 99999 }} container={isFullscreen ? fullscreenRef.current : undefined}>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-500" />
                  Chart Settings
                </DialogTitle>
                <DialogDescription className="sr-only">Configure chart appearance and display options</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                {/* Display Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-[#787b86] uppercase tracking-wide">Display</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">Show Volume</Label>
                      <p className="text-xs text-[#787b86]">Display volume bars below chart</p>
                    </div>
                    <Switch checked={showVolume} onCheckedChange={setShowVolume} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">Show Grid</Label>
                      <p className="text-xs text-[#787b86]">Display chart grid lines</p>
                    </div>
                    <Switch checked={showGrid} onCheckedChange={(v) => {
                      setShowGrid(v);
                      if (chartRef.current) {
                        try {
                          chartRef.current.applyOptions({
                            grid: { vertLines: { visible: v }, horzLines: { visible: v } },
                          });
                        } catch {
                          // Chart may be disposed
                        }
                      }
                    }} />
                  </div>
                </div>

                {/* Price Settings */}
                <div className="space-y-4 pt-4 border-t border-[#2b2b43]">
                  <h4 className="text-sm font-semibold text-[#787b86] uppercase tracking-wide">Price</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">Bid/Ask Lines</Label>
                      <p className="text-xs text-[#787b86]">Show bid/ask price lines</p>
                    </div>
                    <Switch checked={showBidAskLines} onCheckedChange={setShowBidAskLines} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">Price Labels</Label>
                      <p className="text-xs text-[#787b86]">Show price on axis</p>
                    </div>
                    <Switch checked={showPriceLabels} onCheckedChange={setShowPriceLabels} />
                  </div>
                </div>

                {/* Trading Settings */}
                <div className="space-y-4 pt-4 border-t border-[#2b2b43]">
                  <h4 className="text-sm font-semibold text-[#787b86] uppercase tracking-wide">Trading</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">Position Markers</Label>
                      <p className="text-xs text-[#787b86]">Show open position lines</p>
                    </div>
                    <Switch checked={showTradeMarkers} onCheckedChange={setShowTradeMarkers} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">TP/SL Lines</Label>
                      <p className="text-xs text-[#787b86]">Show take profit/stop loss</p>
                    </div>
                    <Switch checked={showTPSLLines} onCheckedChange={setShowTPSLLines} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-white">TP/SL Zones</Label>
                      <p className="text-xs text-[#787b86]">Show colored zones</p>
                    </div>
                    <Switch checked={showTPSLZones} onCheckedChange={setShowTPSLZones} disabled={!showTPSLLines} />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chart Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chart */}
          <div className="flex-1 relative">
            {/* OHLCV Data Legend */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-3 text-xs font-mono bg-[#131722]/95 px-3 py-1.5 rounded border border-[#2b2b43]">
              <span className="text-[#d1d4dc] font-bold">{symbol}</span>
              {ohlcvData ? (
                <>
                  <span className="text-[#787b86]">{ohlcvData.time}</span>
                  <span><span className="text-[#787b86]">O</span> <span className="text-[#d1d4dc]">{ohlcvData.open.toFixed(5)}</span></span>
                  <span><span className="text-[#787b86]">H</span> <span className="text-[#22c55e]">{ohlcvData.high.toFixed(5)}</span></span>
                  <span><span className="text-[#787b86]">L</span> <span className="text-[#ef4444]">{ohlcvData.low.toFixed(5)}</span></span>
                  <span><span className="text-[#787b86]">C</span> <span className={ohlcvData.change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{ohlcvData.close.toFixed(5)}</span></span>
                  <span className={ohlcvData.change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                    {ohlcvData.change >= 0 ? '+' : ''}{ohlcvData.changePercent.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-[#787b86]">Hover for OHLCV</span>
              )}
            </div>

            {/* Active Drawing Tool Indicator */}
            {activeTool && (
              <div className="absolute top-2 right-2 z-30 bg-[#2962ff] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2">
                <Activity className="h-3 w-3 animate-pulse" />
                {activeTool === 'freehand' && 'Freehand'}
                {activeTool === 'trend-line' && 'Trend Line'}
                {activeTool === 'horizontal-line' && 'H-Line'}
                {activeTool === 'vertical-line' && 'V-Line'}
                {activeTool === 'rectangle' && 'Rectangle'}
                {activeTool === 'arrow' && 'Arrow'}
                {activeTool === 'fibonacci' && 'Fibonacci'}
                {activeTool === 'ray' && 'Ray'}
                {activeTool === 'extended-line' && 'Ext Line'}
                {activeTool === 'text' && 'Text'}
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

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#131722] z-20">
                <div className="text-center text-[#f23645]">
                  <p className="text-sm">⚠️ {error}</p>
                  <Button size="sm" variant="ghost" onClick={() => window.location.reload()} className="mt-2">Retry</Button>
                </div>
              </div>
            )}

            {/* Chart Container */}
            <div 
              ref={chartContainerRef} 
              className="absolute inset-0"
            />

            {/* Drawing Canvas Overlay */}
            {!loading && chartRef.current && candlestickSeriesRef.current && (
              <DrawingCanvas
                ref={drawingCanvasRef}
                chart={chartRef.current}
                series={candlestickSeriesRef.current}
                activeTool={activeTool}
                onToolComplete={() => setActiveTool(null)}
                drawings={drawings}
                onDrawingsChange={setDrawings}
                containerRef={chartContainerRef}
                drawingColor={drawingColor}
                drawingLineWidth={drawingLineWidth}
                drawingTextSize={drawingTextSize}
                onSelectionChange={setSelectedDrawingId}
              />
            )}
          </div>

          {/* Oscillator Panels */}
          {indicators.filter(ind => ind.enabled && ind.displayType === 'oscillator').map(indicator => (
            <div key={indicator.id} className="border-t border-[#2b2b43]">
              <div className="bg-[#1e222d] px-2 py-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-[#d1d4dc]">{indicator.name}</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: indicator.color }} />
              </div>
              <div id={`oscillator-${indicator.id}`} style={{ height: '120px', width: '100%' }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default LightweightTradingChart;

