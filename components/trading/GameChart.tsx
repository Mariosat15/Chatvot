'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp, PriceFormat } from 'lightweight-charts';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { cn } from '@/lib/utils';
import { CandlestickChart, LineChart, Clock, Zap } from 'lucide-react';

// Position interface for Game mode
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

interface GameChartProps {
  competitionId: string;
  positions?: Position[];
}

// Simple timeframes for Game mode
const TIMEFRAMES = [
  { value: '1', label: '1m', icon: '⚡' },
  { value: '5', label: '5m', icon: '🔥' },
  { value: '15', label: '15m', icon: '💎' },
] as const;

type ChartType = 'candle' | 'line';

// Get decimal places for symbol
function getDecimals(symbol: string): number {
  return symbol.includes('JPY') ? 3 : 5;
}

// Format price with correct decimals
function formatPrice(price: number, symbol: string): string {
  const decimals = getDecimals(symbol);
  return price.toFixed(decimals);
}

export default function GameChart({ competitionId, positions = [] }: GameChartProps) {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol } = useChartSymbol();
  
  // Chart state
  const [timeframe, setTimeframe] = useState<string>('1');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [isLoading, setIsLoading] = useState(true);
  const [candlesLoaded, setCandlesLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const bidPriceLineRef = useRef<any>(null);
  const askPriceLineRef = useRef<any>(null);
  const positionLinesRef = useRef<Map<string, any>>(new Map());
  const isMountedRef = useRef(true);
  const oldestCandleTimeRef = useRef<number | null>(null);
  const allCandlesRef = useRef<any[]>([]);
  
  // Get decimal places for current symbol
  const decimals = getDecimals(symbol);
  
  // Get current price
  const currentPrice = prices.get(symbol);
  
  // Filter positions for current symbol
  const symbolPositions = useMemo(() => 
    positions.filter(p => p.symbol === symbol), 
    [positions, symbol]
  );
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);
  
  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    isMountedRef.current = true;
    
    // Price format based on symbol
    const priceFormat: PriceFormat = {
      type: 'price',
      precision: decimals,
      minMove: decimals === 3 ? 0.001 : 0.00001,
    };
    
    // Create chart - GAMING STYLE with neon effects
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a855f7',
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(139, 92, 246, 0.08)' },
        horzLines: { color: 'rgba(139, 92, 246, 0.08)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { 
          color: '#a855f7', 
          width: 1, 
          style: 2, 
          labelBackgroundColor: '#7c3aed',
        },
        horzLine: { 
          color: '#a855f7', 
          width: 1, 
          style: 2, 
          labelBackgroundColor: '#7c3aed',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        timeVisible: true,
        secondsVisible: timeframe === '1',
        tickMarkFormatter: (time: UTCTimestamp) => {
          const date = new Date(time * 1000);
          const hours = date.getUTCHours().toString().padStart(2, '0');
          const minutes = date.getUTCMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        },
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price, symbol),
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false,
          });
        },
      },
      handleScroll: { vertTouchDrag: false },
    });
    
    chartRef.current = chart;
    
    // Create series based on chart type - NEON GAMING STYLE
    if (chartType === 'line') {
      const series = chart.addLineSeries({
        color: '#a855f7',
        lineWidth: 3,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 8,
        crosshairMarkerBorderColor: '#ffffff',
        crosshairMarkerBackgroundColor: '#a855f7',
        priceFormat,
      });
      candlestickSeriesRef.current = series as any;
    } else {
      const series = chart.addCandlestickSeries({
        upColor: '#00ff88',
        downColor: '#ff3366',
        borderUpColor: '#00ff88',
        borderDownColor: '#ff3366',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff3366',
        priceFormat,
      });
      candlestickSeriesRef.current = series;
      
      // Add bid/ask price lines with correct decimals
      bidPriceLineRef.current = series.createPriceLine({
        price: 0,
        color: '#00d4ff',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'BID',
      });
      
      askPriceLineRef.current = series.createPriceLine({
        price: 0,
        color: '#ff00ff',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'ASK',
      });
    }
    
    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartType, symbol, decimals, timeframe]);
  
  // Load candles
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;
    
    const loadCandles = async () => {
      setIsLoading(true);
      setCandlesLoaded(false);
      setHasMoreHistory(true);
      oldestCandleTimeRef.current = null;
      allCandlesRef.current = [];
      
      try {
        const response = await fetch(
          `/api/trading/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch candles');
        
        const data = await response.json();
        
        if (!isMountedRef.current || !candlestickSeriesRef.current) return;
        
        const candles = data.candles || [];
        allCandlesRef.current = candles;
        
        if (candles.length > 0) {
          oldestCandleTimeRef.current = candles[0].time;
          setHasMoreHistory(data.hasMore !== false);
        }
        
        if (chartType === 'line') {
          const lineData = candles.map((c: any) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }));
          (candlestickSeriesRef.current as any).setData(lineData);
        } else {
          const candleData: CandlestickData<UTCTimestamp>[] = candles.map((c: any) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          candlestickSeriesRef.current.setData(candleData);
        }
        
        chartRef.current?.timeScale().fitContent();
        setCandlesLoaded(true);
      } catch (error) {
        console.error('Failed to load candles:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCandles();
  }, [symbol, timeframe, chartType]);
  
  // Update bid/ask price lines with correct decimals
  useEffect(() => {
    if (!currentPrice || !bidPriceLineRef.current || !askPriceLineRef.current) return;
    
    bidPriceLineRef.current.applyOptions({
      price: currentPrice.bid,
      title: `BID`,
    });
    
    askPriceLineRef.current.applyOptions({
      price: currentPrice.ask,
      title: `ASK`,
    });
  }, [currentPrice]);
  
  // WebSocket for real-time candle updates
  useEffect(() => {
    if (!isMountedRef.current || !chartRef.current || !candlestickSeriesRef.current || !candlesLoaded) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
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
            
            if (message.type === 'price_update' && message.data) {
              const { prices, formingCandles, formingCandles5m, formingCandles15m } = message.data;
              
              const is5m = timeframe === '5';
              const is15m = timeframe === '15';
              const candleSource = is15m ? formingCandles15m : (is5m ? formingCandles5m : formingCandles);
              
              const candle = candleSource?.find((c: { symbol: string }) => c.symbol === symbol);
              const price = prices?.find((p: { symbol: string }) => p.symbol === symbol);
              
              if (candle && candlestickSeriesRef.current) {
                if (price && bidPriceLineRef.current && askPriceLineRef.current) {
                  bidPriceLineRef.current.applyOptions({
                    price: price.bid,
                    title: `BID`,
                  });
                  askPriceLineRef.current.applyOptions({
                    price: price.ask,
                    title: `ASK`,
                  });
                }
                
                if (chartType === 'line') {
                  (candlestickSeriesRef.current as any).update({
                    time: candle.time as UTCTimestamp,
                    value: candle.close,
                  });
                } else {
                  candlestickSeriesRef.current.update({
                    time: candle.time as UTCTimestamp,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                  });
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        };
        
        ws.onopen = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'subscribe_symbol',
              symbol: symbol,
            }));
          }
        };
        
        ws.onclose = () => {
          if (!isCleanedUp) {
            reconnectTimeout = setTimeout(connect, 2000);
          }
        };
        
        ws.onerror = () => {};
      } catch {
        if (!isCleanedUp) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };
    
    connect();
    
    return () => {
      isCleanedUp = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [symbol, timeframe, chartType, candlesLoaded]);
  
  // Load more candles when scrolling left
  const loadMoreCandles = useCallback(async () => {
    if (isLoadingMore || !hasMoreHistory || !oldestCandleTimeRef.current) return;
    if (!chartRef.current || !candlestickSeriesRef.current) return;
    
    setIsLoadingMore(true);
    
    try {
      const response = await fetch('/api/trading/candles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          before: oldestCandleTimeRef.current,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch more candles');
      
      const data = await response.json();
      const newCandles = data.candles || [];
      
      if (newCandles.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      
      oldestCandleTimeRef.current = newCandles[0].time;
      setHasMoreHistory(data.hasMore !== false);
      
      const existingCandles = allCandlesRef.current;
      const mergedCandles = [...newCandles, ...existingCandles];
      allCandlesRef.current = mergedCandles;
      
      if (chartType === 'line') {
        const lineData = mergedCandles.map((c: any) => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }));
        (candlestickSeriesRef.current as any).setData(lineData);
      } else {
        const candleData: CandlestickData<UTCTimestamp>[] = mergedCandles.map((c: any) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candlestickSeriesRef.current.setData(candleData);
      }
    } catch (error) {
      console.error('Failed to load more candles:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [symbol, timeframe, isLoadingMore, hasMoreHistory, chartType]);
  
  // Subscribe to visible time range changes for lazy loading
  useEffect(() => {
    if (!chartRef.current || !candlesLoaded) return;
    
    const chart = chartRef.current;
    
    const handleVisibleTimeRangeChange = () => {
      if (!hasMoreHistory || isLoadingMore || !oldestCandleTimeRef.current) return;
      
      const visibleRange = chart.timeScale().getVisibleRange();
      if (!visibleRange) return;
      
      const oldestVisible = visibleRange.from as number;
      const oldestCandle = oldestCandleTimeRef.current;
      const timeframeMinutes = timeframe === '1' ? 1 : (timeframe === '5' ? 5 : 15);
      const bufferTime = 50 * timeframeMinutes * 60;
      
      if (oldestVisible <= oldestCandle + bufferTime) {
        loadMoreCandles();
      }
    };
    
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
      } catch {}
    };
  }, [hasMoreHistory, isLoadingMore, loadMoreCandles, timeframe, candlesLoaded]);
  
  // Draw position lines
  useEffect(() => {
    if (!candlestickSeriesRef.current || !candlesLoaded) return;
    
    const series = candlestickSeriesRef.current;
    
    positionLinesRef.current.forEach((lines) => {
      if (lines.entry) series.removePriceLine(lines.entry);
      if (lines.tp) series.removePriceLine(lines.tp);
      if (lines.sl) series.removePriceLine(lines.sl);
    });
    positionLinesRef.current.clear();
    
    symbolPositions.forEach((position) => {
      const isLong = position.side === 'long';
      const entryColor = isLong ? '#fbbf24' : '#a78bfa';
      
      const lines: any = {};
      
      lines.entry = series.createPriceLine({
        price: position.entryPrice,
        color: entryColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isLong ? '📈 ENTRY' : '📉 ENTRY',
      });
      
      if (position.takeProfit) {
        lines.tp = series.createPriceLine({
          price: position.takeProfit,
          color: '#00ff88',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: '🎯 TP',
        });
      }
      
      if (position.stopLoss) {
        lines.sl = series.createPriceLine({
          price: position.stopLoss,
          color: '#ff3366',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: '🛑 SL',
        });
      }
      
      positionLinesRef.current.set(position._id, lines);
    });
  }, [symbolPositions, candlesLoaded]);
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#0a0a15] via-[#0f0f1a] to-[#1a0a20] rounded-xl overflow-hidden">
      {/* Gaming Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-purple-500/30">
        {/* Live Price Display */}
        <div className="flex items-center gap-4">
          {currentPrice && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-cyan-400 uppercase tracking-wider">Bid</span>
                <span className="text-lg font-mono font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                  {formatPrice(currentPrice.bid, symbol)}
                </span>
              </div>
              <div className="w-px h-8 bg-purple-500/30" />
              <div className="flex flex-col">
                <span className="text-[10px] text-pink-400 uppercase tracking-wider">Ask</span>
                <span className="text-lg font-mono font-bold text-pink-400 drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]">
                  {formatPrice(currentPrice.ask, symbol)}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-lg">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400 text-xs font-bold">
                  {((currentPrice.ask - currentPrice.bid) / (decimals === 3 ? 0.01 : 0.0001)).toFixed(1)}
                </span>
                <span className="text-gray-500 text-[10px]">pips</span>
              </div>
            </>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Current Time */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-dark-400/50 rounded-lg">
            <Clock className="w-3 h-3 text-purple-400" />
            <span className="text-purple-300 text-xs font-mono">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
          
          {/* Timeframe Selector - Gaming Style */}
          <div className="flex bg-dark-400/50 rounded-lg p-0.5 border border-purple-500/30">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1",
                  timeframe === tf.value
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-gray-400 hover:text-white hover:bg-dark-400"
                )}
              >
                <span>{tf.icon}</span>
                <span>{tf.label}</span>
              </button>
            ))}
          </div>
          
          {/* Chart Type Toggle */}
          <div className="flex bg-dark-400/50 rounded-lg p-0.5 border border-purple-500/30">
            <button
              onClick={() => setChartType('candle')}
              className={cn(
                "p-1.5 rounded-md transition-all",
                chartType === 'candle' 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg" 
                  : "hover:bg-dark-400"
              )}
              title="Candlestick"
            >
              <CandlestickChart className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={cn(
                "p-1.5 rounded-md transition-all",
                chartType === 'line' 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg" 
                  : "hover:bg-dark-400"
              )}
              title="Line"
            >
              <LineChart className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Chart Container with Neon Glow */}
      <div className="relative flex-1 min-h-[350px]">
        <div 
          ref={chartContainerRef} 
          className="absolute inset-0"
        />
        
        {/* Neon border effect */}
        <div className="absolute inset-0 pointer-events-none border border-purple-500/20 rounded-lg" 
          style={{ boxShadow: 'inset 0 0 30px rgba(139, 92, 246, 0.1)' }} 
        />
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a15]/90 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-purple-500/30 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-purple-400 text-sm font-medium">Loading chart...</span>
            </div>
          </div>
        )}
        
        {/* Loading More Indicator */}
        {isLoadingMore && (
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 bg-purple-600/90 px-4 py-2 rounded-full shadow-lg shadow-purple-500/30">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-xs font-medium">Loading history...</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer - Position Summary */}
      {symbolPositions.length > 0 && (
        <div className="p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-t border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-purple-300 text-sm">
              📊 {symbolPositions.length} position{symbolPositions.length > 1 ? 's' : ''} on {symbol}
            </span>
            <span className={cn(
              "font-bold font-mono",
              symbolPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0
                ? "text-green-400 drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]"
                : "text-red-400 drop-shadow-[0_0_10px_rgba(255,51,102,0.5)]"
            )}>
              {symbolPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0 ? '+' : ''}
              ${symbolPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
