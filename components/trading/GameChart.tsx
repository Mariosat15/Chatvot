'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, BarChart3, LineChart, CandlestickChart } from 'lucide-react';

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
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
] as const;

type ChartType = 'candle' | 'line';

export default function GameChart({ competitionId, positions = [] }: GameChartProps) {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol, setSymbol } = useChartSymbol();
  
  // Chart state
  const [timeframe, setTimeframe] = useState<string>('1');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [isLoading, setIsLoading] = useState(true);
  const [candlesLoaded, setCandlesLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  
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
  
  // Get current price
  const currentPrice = prices.get(symbol);
  
  // Filter positions for current symbol
  const symbolPositions = useMemo(() => 
    positions.filter(p => p.symbol === symbol), 
    [positions, symbol]
  );
  
  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);
  
  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    isMountedRef.current = true;
    
    // Create chart - GAMING STYLE
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0f0f1a' }, // Darker gaming background
        textColor: '#e0e0e0',
      },
      grid: {
        vertLines: { color: 'rgba(139, 92, 246, 0.1)' }, // Purple tint
        horzLines: { color: 'rgba(139, 92, 246, 0.1)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#a855f7', width: 1, style: 2, labelBackgroundColor: '#a855f7' },
        horzLine: { color: '#a855f7', width: 1, style: 2, labelBackgroundColor: '#a855f7' },
      },
      rightPriceScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(139, 92, 246, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });
    
    chartRef.current = chart;
    
    // Create series based on chart type - GAMING STYLE
    if (chartType === 'line') {
      const series = chart.addLineSeries({
        color: '#a855f7', // Purple gaming color
        lineWidth: 3,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 6,
        crosshairMarkerBorderColor: '#ffffff',
        crosshairMarkerBackgroundColor: '#a855f7',
      });
      candlestickSeriesRef.current = series as any;
    } else {
      const series = chart.addCandlestickSeries({
        // Bright gaming colors
        upColor: '#22c55e', // Bright green
        downColor: '#ef4444', // Bright red
        borderUpColor: '#4ade80', // Lighter green border
        borderDownColor: '#f87171', // Lighter red border
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      candlestickSeriesRef.current = series;
      
      // Add bid/ask price lines - Gaming colors
      bidPriceLineRef.current = series.createPriceLine({
        price: 0,
        color: '#3b82f6', // Bright blue
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '💰 BID',
      });
      
      askPriceLineRef.current = series.createPriceLine({
        price: 0,
        color: '#f43f5e', // Bright rose
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '💎 ASK',
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
  }, [chartType]);
  
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
        
        // Track oldest candle for lazy loading
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
        
        // Fit content
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
  
  // Update bid/ask price lines
  useEffect(() => {
    if (!currentPrice || !bidPriceLineRef.current || !askPriceLineRef.current) return;
    
    bidPriceLineRef.current.applyOptions({
      price: currentPrice.bid,
      title: `BID ${currentPrice.bid.toFixed(5)}`,
    });
    
    askPriceLineRef.current.applyOptions({
      price: currentPrice.ask,
      title: `ASK ${currentPrice.ask.toFixed(5)}`,
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
              
              // Select candle source based on timeframe
              const is5m = timeframe === '5';
              const is15m = timeframe === '15';
              const candleSource = is15m ? formingCandles15m : (is5m ? formingCandles5m : formingCandles);
              
              // Find candle for current symbol
              const candle = candleSource?.find((c: { symbol: string }) => c.symbol === symbol);
              const price = prices?.find((p: { symbol: string }) => p.symbol === symbol);
              
              if (candle && candlestickSeriesRef.current) {
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
                
                // Update candle
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
        
        ws.onerror = () => {
          // Will trigger onclose
        };
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
  
  // Load more candles when scrolling left (lazy loading)
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
      
      // Update oldest candle time
      oldestCandleTimeRef.current = newCandles[0].time;
      setHasMoreHistory(data.hasMore !== false);
      
      // Merge new candles with existing
      const existingCandles = allCandlesRef.current;
      const mergedCandles = [...newCandles, ...existingCandles];
      allCandlesRef.current = mergedCandles;
      
      // Update chart
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
      
      // Calculate timeframe in minutes
      const timeframeMinutes = timeframe === '1' ? 1 : (timeframe === '5' ? 5 : 15);
      
      // Load more when user scrolls close to the oldest loaded candle
      const bufferTime = 50 * timeframeMinutes * 60; // 50 candles worth of time in seconds
      
      if (oldestVisible <= oldestCandle + bufferTime) {
        loadMoreCandles();
      }
    };
    
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
      } catch {
        // Chart may be disposed
      }
    };
  }, [hasMoreHistory, isLoadingMore, loadMoreCandles, timeframe, candlesLoaded]);
  
  // Draw position lines (entry, TP, SL)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !candlesLoaded) return;
    
    const series = candlestickSeriesRef.current;
    
    // Clear old position lines
    positionLinesRef.current.forEach((lines) => {
      if (lines.entry) series.removePriceLine(lines.entry);
      if (lines.tp) series.removePriceLine(lines.tp);
      if (lines.sl) series.removePriceLine(lines.sl);
    });
    positionLinesRef.current.clear();
    
    // Draw new position lines
    symbolPositions.forEach((position) => {
      const isLong = position.side === 'long';
      const entryColor = isLong ? '#fbbf24' : '#a78bfa';
      
      const lines: any = {};
      
      // Entry line
      lines.entry = series.createPriceLine({
        price: position.entryPrice,
        color: entryColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isLong ? '📈 LONG' : '📉 SHORT',
      });
      
      // Take Profit line
      if (position.takeProfit) {
        lines.tp = series.createPriceLine({
          price: position.takeProfit,
          color: '#22c55e',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: '🎯 TP',
        });
      }
      
      // Stop Loss line
      if (position.stopLoss) {
        lines.sl = series.createPriceLine({
          price: position.stopLoss,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: '🛑 SL',
        });
      }
      
      positionLinesRef.current.set(position._id, lines);
    });
  }, [symbolPositions, candlesLoaded]);
  
  // Calculate price change
  const priceChange = useMemo(() => {
    if (!currentPrice) return 0;
    // Simple approximation - in reality would need previous close
    return 0;
  }, [currentPrice]);
  
  const isGoingUp = currentPrice && currentPrice.bid > (currentPrice.ask - currentPrice.spread);

  return (
    <div className="flex flex-col h-full bg-[#131722] rounded-lg overflow-hidden border-2 border-purple-500/50">
      {/* Header */}
      <div className="flex items-center justify-between p-2 md:p-3 bg-gradient-to-r from-purple-600 to-pink-600 border-b border-purple-500/50">
        {/* Symbol Selector */}
        <div className="flex items-center gap-2">
          <Select value={symbol} onValueChange={(value) => setSymbol(value as ForexSymbol)}>
            <SelectTrigger className="w-[120px] md:w-[140px] h-8 bg-dark-400 border-purple-500/50 text-white font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-purple-500 shadow-xl shadow-purple-500/20 z-50">
              {Object.keys(FOREX_PAIRS).map((pair) => (
                <SelectItem key={pair} value={pair} className="text-white hover:bg-purple-600 focus:bg-purple-600 cursor-pointer">
                  🎮 {pair}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Price Display */}
          {currentPrice && (
            <div className="hidden md:flex items-center gap-2 text-xs font-mono">
              <span className={cn(
                "font-bold text-sm",
                isGoingUp ? "text-green-400" : "text-red-400"
              )}>
                {currentPrice.bid.toFixed(5)}
              </span>
              <span className="text-white/60">|</span>
              <span className="text-[#f23645]">{currentPrice.ask.toFixed(5)}</span>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Timeframe Selector */}
          <div className="flex bg-dark-400 rounded-md p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-2 py-1 text-xs font-bold rounded transition-all",
                  timeframe === tf.value
                    ? "bg-purple-600 text-white"
                    : "text-white/60 hover:text-white"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
          
          {/* Chart Type Toggle */}
          <div className="flex bg-dark-400 rounded-md p-0.5">
            <button
              onClick={() => setChartType('candle')}
              className={cn(
                "p-1.5 rounded transition-all",
                chartType === 'candle' ? "bg-purple-600" : "hover:bg-dark-500"
              )}
              title="Candlestick"
            >
              <CandlestickChart className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={cn(
                "p-1.5 rounded transition-all",
                chartType === 'line' ? "bg-purple-600" : "hover:bg-dark-500"
              )}
              title="Line"
            >
              <LineChart className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Chart Container - Gaming Glow Effect */}
      <div className="relative flex-1 min-h-[300px] md:min-h-[400px]">
        <div 
          ref={chartContainerRef} 
          className="absolute inset-0"
          style={{
            filter: 'drop-shadow(0 0 2px rgba(168, 85, 247, 0.3))',
          }}
        />
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/60 text-sm">Loading chart...</span>
            </div>
          </div>
        )}
        
        {/* Loading More Indicator */}
        {isLoadingMore && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 bg-purple-600/90 px-3 py-1 rounded-full">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-white text-xs">Loading history...</span>
            </div>
          </div>
        )}
        
        {/* Mobile Price Display */}
        {currentPrice && (
          <div className="absolute top-2 left-2 md:hidden z-10">
            <div className={cn(
              "px-2 py-1 rounded text-sm font-bold font-mono",
              isGoingUp ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
            )}>
              {currentPrice.bid.toFixed(5)}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer - Position Summary */}
      {symbolPositions.length > 0 && (
        <div className="p-2 bg-dark-300 border-t border-purple-500/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">
              {symbolPositions.length} position{symbolPositions.length > 1 ? 's' : ''} on {symbol}
            </span>
            <span className={cn(
              "font-bold",
              symbolPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0
                ? "text-green-400"
                : "text-red-400"
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
