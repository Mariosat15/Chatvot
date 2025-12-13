'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { useDragScroll } from '@/hooks/useDragScroll';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { getRecentCandles, OHLCCandle, Timeframe } from '@/lib/services/forex-historical.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
  Grid3x3,
  Activity,
  BarChart,
  Grid,
  CircleDot
} from 'lucide-react';
import AdvancedIndicatorManager, { CustomIndicator } from './AdvancedIndicatorManager';
import DrawingToolsPanel from './DrawingToolsPanel';
import { DrawingTool, DrawingObject } from '@/lib/services/drawing-tools.service';
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

const LightweightTradingChart = ({ competitionId, positions = [], pendingOrders = [] }: LightweightTradingChartProps) => {
  // Debug: Log positions received by chart component
  useEffect(() => {
    console.log('🎨 LightweightTradingChart received positions:', positions.length);
    console.log('📊 Positions with TP/SL:', positions.map(p => ({
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
  const [activeTool, setActiveTool] = useState<DrawingTool | null>(null);
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [signalUpdateTrigger, setSignalUpdateTrigger] = useState(0);
  
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
    console.log('📊 Arsenal indicators changed:', arsenalIndicators);
    
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
      console.log('📊 Updated chart indicators:', newIndicators.map(i => ({ id: i.id, type: i.type })));
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
  const drawingPointsRef = useRef<{ time: number; price: number }[]>([]);
  const drawingLinesRef = useRef<any[]>([]);

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
    console.log(`🎨 hexToRgba: ${hex} @ ${opacity}% → ${result}`);
    return result;
  };

  // Helper function to apply offset to data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyOffset = (data: any[], offset: number = 0): any[] => {
    if (offset === 0) return data;
    
    console.log(`📊 Applying offset ${offset} to ${data.length} data points`);
    
    if (offset > 0) {
      // Shift forward: remove last N points
      const result = data.slice(0, -offset);
      console.log(`   → Shifted forward, result: ${result.length} points`);
      return result;
    } else {
      // Shift backward: remove first N points
      const result = data.slice(Math.abs(offset));
      console.log(`   → Shifted backward, result: ${result.length} points`);
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
    
    console.log(`💱 Transforming ${candles.length} candles for price source: ${priceSource}`);
    
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
    console.log('🔄 updateIndicators called with', indicators.length, 'indicators');
    console.log('📊 Enabled indicators:', indicators.filter(i => i.enabled).map(i => i.type));
    
    // Clear existing indicator series
    indicatorSeriesRef.current.forEach(series => {
      try {
        chart.removeSeries(series);
      } catch (e) {
        console.warn('Could not remove series:', e);
      }
    });
    indicatorSeriesRef.current.clear();

    // Clear existing oscillator charts
    oscillatorChartsRef.current.forEach(oscChart => {
      try {
        oscChart.remove();
      } catch (e) {
        console.warn('Could not remove oscillator chart:', e);
      }
    });
    oscillatorChartsRef.current.clear();

    const enabledIndicators = indicators.filter(ind => ind.enabled);
    console.log('✅ Processing', enabledIndicators.length, 'enabled indicators');

    enabledIndicators.forEach(indicator => {
      console.log(`📈 Adding indicator: ${indicator.type} - ${indicator.name}`);
      console.log('   Settings:', {
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
          
          console.log(`📊 S/R Indicator: Found ${levelIndex} levels`);
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
    
    console.log(`✅ Updated ${enabledIndicators.length} indicators`);
  };

  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);

  // Update indicators when they change
  useEffect(() => {
    console.log('⚡ Indicators state changed! New indicators:', indicators);
    if (chartRef.current && candlestickSeriesRef.current && candleDataRef.current.length > 0) {
      console.log('🔄 Updating indicators:', indicators.length, 'total,', indicators.filter(i => i.enabled).length, 'enabled');
      updateIndicators(candleDataRef.current, chartRef.current, candlestickSeriesRef.current);
    } else {
      console.log('⚠️ Chart not ready yet, skipping indicator update');
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
        console.log('📊 Generated signals:', allSignals.length, 'from', enabledStrategies.length, 'strategies');
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

  // Setup drawing tool click handler
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) {
      console.log('⚠️ Chart or series not ready for drawing handler');
      return;
    }

    console.log('🎨 Setting up drawing handler, activeTool:', activeTool);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleChartClick = (param: any) => {
      console.log('🖱️ Chart clicked!', { activeTool, hasParam: !!param, hasTime: !!param?.time });
      
      if (!activeTool) {
        console.log('⚠️ No active tool, ignoring click');
        return;
      }
      
      if (!candlestickSeriesRef.current) {
        console.log('⚠️ No candlestick series ref');
        return;
      }

      const time = param.time;
      const seriesData = param.seriesData.get(candlestickSeriesRef.current);
      const price = seriesData?.close;

      console.log('📊 Click data:', { time, price, hasSeriesData: !!seriesData });

      if (!time || !price) {
        console.log('⚠️ Missing time or price, time:', time, 'price:', price);
        return;
      }

      drawingPointsRef.current.push({ time, price });
      console.log('✅ Drawing point added:', { tool: activeTool, time, price, points: drawingPointsRef.current.length });

      // For tools that need 2 points
      if (activeTool === 'trend-line' || activeTool === 'fibonacci') {
        if (drawingPointsRef.current.length === 2) {
          const [start, end] = drawingPointsRef.current;
          
          if (activeTool === 'trend-line') {
            // Draw trend line
            const line = candlestickSeriesRef.current?.createPriceLine({
              price: start.price,
              color: '#2962ff',
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: true,
              title: 'Trend Line',
            });
            drawingLinesRef.current.push(line);
            console.log('✅ Trend line drawn');
            
            // Create new drawing object
            const newDrawing: DrawingObject = {
              id: `drawing_${Date.now()}`,
              type: activeTool,
              points: [start, end],
              color: '#2962ff',
              lineWidth: 2,
              lineStyle: 0,
            };
            setDrawings(prev => [...prev, newDrawing]);
          } else if (activeTool === 'fibonacci') {
            // Draw Fibonacci retracement levels
            const diff = end.price - start.price;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors = ['#808080', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA15E'];
            
            levels.forEach((level, idx) => {
              const levelPrice = start.price + (diff * level);
              const line = candlestickSeriesRef.current?.createPriceLine({
                price: levelPrice,
                color: colors[idx],
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: true,
                title: `${(level * 100).toFixed(1)}%`,
              });
              drawingLinesRef.current.push(line);
            });
            console.log('✅ Fibonacci levels drawn');
            
            const newDrawing: DrawingObject = {
              id: `drawing_${Date.now()}`,
              type: activeTool,
              points: [start, end],
              color: '#2962ff',
              lineWidth: 1,
              lineStyle: 2,
            };
            setDrawings(prev => [...prev, newDrawing]);
          }
          
          // Reset points and deselect tool
          drawingPointsRef.current = [];
          setActiveTool(null);
        }
      } else if (activeTool === 'horizontal-line') {
        // Draw horizontal line
        const line = candlestickSeriesRef.current?.createPriceLine({
          price: price,
          color: '#2962ff',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'H-Line',
        });
        drawingLinesRef.current.push(line);
        console.log('✅ Horizontal line drawn at', price);
        
        const newDrawing: DrawingObject = {
          id: `drawing_${Date.now()}`,
          type: activeTool,
          points: [{ time, price }],
          color: '#2962ff',
          lineWidth: 2,
          lineStyle: 0,
        };
        setDrawings(prev => [...prev, newDrawing]);
        
        drawingPointsRef.current = [];
        setActiveTool(null);
      }
    };

    chartRef.current.subscribeClick(handleChartClick);
    console.log('✅ Drawing handler subscribed for tool:', activeTool);

    return () => {
      if (chartRef.current) {
        console.log('🧹 Unsubscribing drawing handler for tool:', activeTool);
        chartRef.current.unsubscribeClick(handleChartClick);
      }
    };
  }, [activeTool]); // Re-subscribe when activeTool changes

  // Initialize chart and load historical data
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const initializeChart = async () => {
      setLoading(true);
      setError(null);
      setCandlesLoaded(false); // Reset candles loaded state

      try {
        // Create chart with TradingView-like settings
        // Responsive height: smaller on mobile, larger on desktop
        const chartHeight = window.innerWidth < 768 ? 350 : 500;
        const chart = createChart(chartContainerRef.current!, {
          width: chartContainerRef.current!.clientWidth,
          height: chartHeight,
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
        console.log(`📊 Loading historical data: ${symbol} (${timeframe})`);
        const candles = await getRecentCandles(symbol, timeframe, 300);

        if (candles.length === 0) {
          throw new Error('No historical data available');
        }

        // Convert data based on chart type
        let processedCandles = candles;
        if (chartType === 'heikinashi') {
          processedCandles = convertToHeikinAshi(candles);
          console.log(`🎨 Converted to Heikin Ashi: ${processedCandles.length} candles`);
        } else if (chartType === 'renko') {
          processedCandles = convertToRenko(candles);
          console.log(`🧱 Converted to Renko: ${processedCandles.length} bars`);
        } else if (chartType === 'pointfigure') {
          processedCandles = convertToPointFigure(candles);
          console.log(`⭕ Converted to Point & Figure: ${processedCandles.length} columns`);
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

        console.log(`✅ Chart initialized with ${candles.length} candles`);
        setLoading(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error('❌ Error initializing chart:', err);
        setError(err.message || 'Failed to load chart');
        setLoading(false);
      }
    };

    initializeChart();

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe, showVolume, chartType, showBidAskLines, showPriceLabels]); // Chart reinitializes when these change

  // Update chart with real-time prices
  useEffect(() => {
    if (!candlestickSeriesRef.current || !currentCandleRef.current) return;

    const currentPrice = prices.get(symbol);
    if (!currentPrice) return;

    const now = Date.now();
    
    // Update price lines immediately (no throttle for precision)
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
    } catch (error) {
      // Series type mismatch during chart type transition - chart will reinitialize
      console.log('📊 Chart type transition in progress, skipping update');
    }
  }, [prices, symbol, timeframe, chartType]);

  // Add/update position entry price lines on the chart
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    const series = candlestickSeriesRef.current;

    // Remove old price lines
    positionLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch (error) {
        // Line might already be removed
      }
    });
    positionLinesRef.current.clear();

    // Remove old TP/SL filled area series
    tpSlSeriesRef.current.forEach((areaSeries) => {
      try {
        if (chartRef.current) {
          chartRef.current.removeSeries(areaSeries);
        }
      } catch (error) {
        // Series might already be removed
      }
    });
    tpSlSeriesRef.current.clear();

    // Add price lines for current symbol's positions (if enabled)
    if (showTradeMarkers) {
      const symbolPositions = positions.filter((p) => p.symbol === symbol);
      
      // Debug: Log positions with TP/SL and rendering state
      console.log(`📊 Drawing TP/SL for ${symbolPositions.length} positions:`, 
        symbolPositions.map(p => ({
          id: p._id,
          symbol: p.symbol,
          hasTP: !!p.takeProfit,
          hasSL: !!p.stopLoss,
          tp: p.takeProfit,
          sl: p.stopLoss
        }))
      );
      console.log(`🎨 Chart state:`, {
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
            console.log(`✅ Drawing TP ZONE for position ${position._id}: TP=${position.takeProfit}, Candles=${candleDataRef.current.length}`);
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
            console.log(`✅ Drawing SL ZONE for position ${position._id}: SL=${position.stopLoss}, Candles=${candleDataRef.current.length}`);
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
            console.log(`⚠️ TP ZONE skipped for position ${position._id}:`, {
              hasChart: !!chartRef.current,
              candleCount: candleDataRef.current.length,
              showLines: showTPSLLines,
              showZones: showTPSLZones,
              candlesLoaded
            });
          }
          if (position.stopLoss && showTPSLLines && showTPSLZones && (!chartRef.current || candleDataRef.current.length === 0)) {
            console.log(`⚠️ SL ZONE skipped for position ${position._id}:`, {
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
      
      console.log(`📋 Drawing ${symbolPendingOrders.length} pending orders for ${symbol}`);
      
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
          
          console.log(`✅ Drew pending order line: ${order.side} ${order.quantity} @ ${order.requestedPrice.toFixed(5)}`);
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

  return (
    <div className="space-y-2">
      {/* Top Bar - Symbol and Price */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between bg-[#131722] rounded-t-lg px-3 sm:px-4 py-2 border-b border-[#2b2b43]">
        {/* Left: Symbol Selector */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Select value={symbol} onValueChange={(value) => setSymbol(value as ForexSymbol)}>
            <SelectTrigger className="bg-[#1e222d] border-[#2b2b43] text-white font-semibold w-[120px] sm:min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1e222d] border-[#2b2b43]">
              {Object.keys(FOREX_PAIRS).map((sym) => (
                <SelectItem key={sym} value={sym} className="text-white hover:bg-[#2a2e39]">
                  {sym}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Market Status Badge */}
          <div className={cn(
            "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
            marketOpen ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
          )}>
            {marketOpen ? '● OPEN' : '● CLOSED'}
          </div>
        </div>

        {/* Right: Price Display */}
        {currentPrice && (
          <div 
            ref={priceDisplayRef}
            className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Bid */}
            <div className="text-center flex-shrink-0">
              <div className="text-xs text-[#787b86] mb-0.5">BID</div>
              <div className="text-sm sm:text-base font-mono font-bold text-[#2962ff]">
                {currentPrice.bid.toFixed(5)}
              </div>
            </div>
            
            {/* Mid */}
            <div className="text-center flex-shrink-0">
              <div className="text-xs text-[#787b86] mb-0.5">MID</div>
              <div className="text-base sm:text-lg font-mono font-bold text-white">
                {currentPrice.mid.toFixed(5)}
              </div>
            </div>
            
            {/* Ask */}
            <div className="text-center flex-shrink-0">
              <div className="text-xs text-[#787b86] mb-0.5">ASK</div>
              <div className="text-sm sm:text-base font-mono font-bold text-[#f23645]">
                {currentPrice.ask.toFixed(5)}
              </div>
            </div>

            {/* Spread */}
            <div className="text-center border-l border-[#2b2b43] pl-2 sm:pl-4 flex-shrink-0">
              <div className="text-xs text-[#787b86] mb-0.5">SPREAD</div>
              <div className="text-sm sm:text-base font-mono text-[#787b86]">
                {((currentPrice.spread / currentPrice.mid) * 10000).toFixed(1)} pips
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar - Chart Tools */}
      <div 
        ref={toolbarRef}
        className="bg-[#131722] px-2 sm:px-4 py-2 border-b border-[#2b2b43] overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-center justify-between gap-2 min-w-max">
          {/* Left: Timeframes */}
          <div className="flex items-center gap-1">
            {[
              { label: '1m', value: '1' as Timeframe },
              { label: '5m', value: '5' as Timeframe },
              { label: '15m', value: '15' as Timeframe },
              { label: '1h', value: '60' as Timeframe },
              { label: '4h', value: '240' as Timeframe },
              { label: '1D', value: 'D' as Timeframe },
            ].map((tf) => (
              <Button
                key={tf.value}
                size="sm"
                variant="ghost"
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "h-7 px-2 sm:px-3 text-xs font-medium hover:bg-[#2a2e39] flex-shrink-0",
                  timeframe === tf.value 
                    ? 'bg-[#2a2e39] text-white' 
                    : 'text-[#787b86]'
                )}
              >
                {tf.label}
              </Button>
            ))}

            <div className="w-px h-5 bg-[#2b2b43] mx-1 sm:mx-2" />

            {/* Chart Type Selector */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="h-7 w-auto px-2 text-xs bg-transparent border-none hover:bg-[#2a2e39] text-[#787b86]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e222d] border-[#2b2b43] min-w-[160px]">
                <SelectItem value="candlestick" className="text-xs text-white hover:bg-[#2a2e39] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Candlestick
                  </div>
                </SelectItem>
                <SelectItem value="line" className="text-xs text-white hover:bg-[#2a2e39] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Minus className="h-3.5 w-3.5" />
                    Line Chart
                  </div>
                </SelectItem>
                <SelectItem value="heikinashi" className="text-xs text-white hover:bg-[#2a2e39] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <BarChart className="h-3.5 w-3.5" />
                    Heikin Ashi
                  </div>
                </SelectItem>
                <SelectItem value="renko" className="text-xs text-white hover:bg-[#2a2e39] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Grid className="h-3.5 w-3.5" />
                    Renko Bars
                  </div>
                </SelectItem>
                <SelectItem value="pointfigure" className="text-xs text-white hover:bg-[#2a2e39] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-3.5 w-3.5" />
                    Point & Figure
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Volume Toggle */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowVolume(!showVolume)}
              className={cn(
                "h-7 px-2 sm:px-3 text-xs hover:bg-[#2a2e39] flex-shrink-0",
                showVolume && "bg-[#2a2e39]"
              )}
              title="Toggle Volume"
            >
              <BarChart3 className={cn("h-4 w-4", showVolume ? "text-white" : "text-[#787b86]")} />
            </Button>

            {/* Grid Toggle */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowGrid(!showGrid);
                if (chartRef.current) {
                  chartRef.current.applyOptions({
                    grid: {
                      vertLines: { visible: !showGrid },
                      horzLines: { visible: !showGrid },
                    },
                  });
                }
              }}
              className={cn(
                "h-7 px-2 sm:px-3 text-xs hover:bg-[#2a2e39] flex-shrink-0",
                showGrid && "bg-[#2a2e39]"
              )}
              title="Toggle Grid"
            >
              <Grid3x3 className={cn("h-4 w-4", showGrid ? "text-white" : "text-[#787b86]")} />
            </Button>
          </div>

          {/* Right: Tools */}
          <div className="flex items-center gap-1">
            <AdvancedIndicatorManager
              indicators={indicators}
              onIndicatorsChange={setIndicators}
            />
            
            <div className="w-px h-5 bg-[#2b2b43] mx-1" />
            
            <DrawingToolsPanel
              activeTool={activeTool}
              drawings={drawings}
              onToolSelect={setActiveTool}
              onClearDrawings={() => {
                // Remove all price lines from chart
                drawingLinesRef.current.forEach(line => {
                  if (line && candlestickSeriesRef.current) {
                    try {
                      candlestickSeriesRef.current.removePriceLine(line);
                    } catch (e) {
                      console.warn('Could not remove price line:', e);
                    }
                  }
                });
                drawingLinesRef.current = [];
                drawingPointsRef.current = [];
                setDrawings([]);
                setActiveTool(null);
                console.log('🗑️ Cleared all drawings');
              }}
            />
            
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 sm:px-3 text-xs hover:bg-[#2a2e39] text-[#787b86] hidden sm:flex flex-shrink-0"
                  title="Chart Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-[#1e222d] border-[#2b2b43] w-[340px] sm:w-[420px]">
                <SheetHeader className="pb-6 border-b border-[#2b2b43]">
                  <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-500" />
                    Chart Display
                  </SheetTitle>
                  <p className="text-sm text-[#787b86] mt-1">Customize your trading view</p>
                </SheetHeader>
                <div className="mt-8 space-y-8 px-1">
                  {/* Bid/Ask Price Lines */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="bid-ask-lines" className="text-base font-semibold text-white flex items-center gap-2">
                        💰 Bid & Ask Lines
                      </Label>
                      <p className="text-sm text-[#787b86] leading-relaxed">
                        Display real-time bid and ask price levels
                      </p>
                    </div>
                    <Switch
                      id="bid-ask-lines"
                      checked={showBidAskLines}
                      onCheckedChange={setShowBidAskLines}
                      className="mt-1"
                    />
                  </div>

                  {/* Price Axis Labels */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="price-labels" className="text-base font-semibold text-white flex items-center gap-2">
                        🏷️ Price Axis Labels
                      </Label>
                      <p className="text-sm text-[#787b86] leading-relaxed">
                        Show price values on the right axis
                      </p>
                    </div>
                    <Switch
                      id="price-labels"
                      checked={showPriceLabels}
                      onCheckedChange={setShowPriceLabels}
                      className="mt-1"
                    />
                  </div>

                  {/* Position Markers */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="trade-markers" className="text-base font-semibold text-white flex items-center gap-2">
                        📍 Position Markers
                      </Label>
                      <p className="text-sm text-[#787b86] leading-relaxed">
                        Highlight your active trades on the chart
                      </p>
                    </div>
                    <Switch
                      id="trade-markers"
                      checked={showTradeMarkers}
                      onCheckedChange={setShowTradeMarkers}
                      className="mt-1"
                    />
                  </div>

                  {/* TP/SL Lines & Labels */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="tpsl-lines" className="text-base font-semibold text-white flex items-center gap-2">
                        📏 TP/SL Lines & Labels
                      </Label>
                      <p className="text-sm text-[#787b86] leading-relaxed">
                        Show Take Profit and Stop Loss price lines
                      </p>
                    </div>
                    <Switch
                      id="tpsl-lines"
                      checked={showTPSLLines}
                      onCheckedChange={setShowTPSLLines}
                      className="mt-1"
                    />
                  </div>

                  {/* TP/SL Visual Zones */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="tpsl-zones" className="text-base font-semibold text-white flex items-center gap-2">
                        🎨 TP/SL Visual Zones
                      </Label>
                      <p className="text-sm text-[#787b86] leading-relaxed">
                        Show colored profit/loss zones for TP/SL
                      </p>
                    </div>
                    <Switch
                      id="tpsl-zones"
                      checked={showTPSLZones}
                      onCheckedChange={setShowTPSLZones}
                      className="mt-1"
                      disabled={!showTPSLLines}
                    />
                  </div>

                  {/* Edit TP/SL Instructions */}
                  <div className="mt-4 p-3 bg-[#0a0e27] rounded-lg border border-[#2b2b43]">
                    <p className="text-xs font-semibold text-blue-400 mb-1">💡 How to Edit TP/SL</p>
                    <p className="text-xs text-[#787b86] leading-relaxed">
                      Click the <span className="text-white font-semibold">Edit</span> button in the Open Positions table to adjust Take Profit and Stop Loss levels for any position.
                    </p>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (chartContainerRef.current) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    chartContainerRef.current.requestFullscreen();
                  }
                }
              }}
              className="h-7 px-2 sm:px-3 text-xs hover:bg-[#2a2e39] text-[#787b86] flex-shrink-0"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

       {/* Chart Container */}
       <div className="rounded-b-lg overflow-hidden bg-[#131722] border border-[#2b2b43] border-t-0">
         {/* Main Chart */}
         <div className="relative">
           {/* Active Drawing Tool Indicator */}
           {activeTool && (
             <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-[#2962ff] text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
               <Activity className="h-4 w-4 animate-pulse" />
               <span className="text-sm font-semibold">
                 {activeTool === 'horizontal-line' && 'Click on chart to draw horizontal line'}
                 {activeTool === 'trend-line' && `Click ${drawingPointsRef.current.length === 0 ? 'first' : 'second'} point for trend line`}
                 {activeTool === 'fibonacci' && `Click ${drawingPointsRef.current.length === 0 ? 'start' : 'end'} point for Fibonacci`}
                 {activeTool === 'vertical-line' && 'Click on chart to draw vertical line'}
                 {activeTool === 'rectangle' && 'Click two corners for rectangle'}
                 {activeTool === 'text' && 'Click to place text label'}
                 {activeTool === 'arrow' && 'Click two points for arrow'}
               </span>
             </div>
           )}

           {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#131722] z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#2962ff] mx-auto mb-2" />
                <p className="text-sm text-[#787b86]">Loading chart data from Massive.com...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#131722] z-10">
              <div className="text-center text-[#f23645]">
                <p className="text-sm">⚠️ {error}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.location.reload()}
                  className="mt-2 hover:bg-[#2a2e39]"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

           <div 
             ref={chartContainerRef} 
             style={{ 
               height: '500px', 
               width: '100%',
               cursor: activeTool ? 'crosshair' : 'default'
             }}
           />
        </div>

        {/* Oscillator Panels */}
        {indicators.filter(ind => ind.enabled && ind.displayType === 'oscillator').map(indicator => (
          <div key={indicator.id} className="border-t border-[#2b2b43]">
            <div className="bg-[#1e222d] px-2 py-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-[#d1d4dc]">{indicator.name}</span>
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: indicator.color }}
              />
            </div>
            <div 
              id={`oscillator-${indicator.id}`}
              style={{ height: '150px', width: '100%' }}
            />
          </div>
        ))}
      </div>
      
      {/* Legend & Attribution */}
      <div className="flex items-center justify-between bg-[#131722] px-4 py-2 rounded-b-lg border border-[#2b2b43] border-t-0 text-xs">
        <div className="flex items-center gap-4 text-[#787b86]">
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 h-0.5 bg-[#2962ff]" style={{ borderTop: '2px dashed #2962ff' }}></span>
            <span>Bid Price</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 h-0.5 bg-[#f23645]" style={{ borderTop: '2px dashed #f23645' }}></span>
            <span>Ask Price</span>
          </span>
          <span className="ml-4 text-[#787b86]">
            <span className="font-semibold text-[#2962ff]">100% REAL PRICES</span> • Powered by Massive.com
          </span>
        </div>
        
        <div className="text-[#787b86] text-xs">
          TradingView Lightweight Charts™
        </div>
      </div>
    </div>
  );
};

export default LightweightTradingChart;

