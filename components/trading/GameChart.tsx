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
  
  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const bidPriceLineRef = useRef<any>(null);
  const askPriceLineRef = useRef<any>(null);
  const positionLinesRef = useRef<Map<string, any>>(new Map());
  const isMountedRef = useRef(true);
  
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
    
    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#6b7280', width: 1, style: 2 },
        horzLine: { color: '#6b7280', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });
    
    chartRef.current = chart;
    
    // Create series based on chart type
    if (chartType === 'line') {
      const series = chart.addLineSeries({
        color: '#2962ff',
        lineWidth: 2,
      });
      candlestickSeriesRef.current = series as any;
    } else {
      const series = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      candlestickSeriesRef.current = series;
      
      // Add bid/ask price lines
      bidPriceLineRef.current = series.createPriceLine({
        price: 0,
        color: '#2962ff',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'BID',
      });
      
      askPriceLineRef.current = series.createPriceLine({
        price: 0,
        color: '#f23645',
        lineWidth: 1,
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
  }, [chartType]);
  
  // Load candles
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;
    
    const loadCandles = async () => {
      setIsLoading(true);
      setCandlesLoaded(false);
      
      try {
        const response = await fetch(
          `/api/trading/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch candles');
        
        const data = await response.json();
        
        if (!isMountedRef.current || !candlestickSeriesRef.current) return;
        
        if (chartType === 'line') {
          const lineData = data.candles.map((c: any) => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }));
          (candlestickSeriesRef.current as any).setData(lineData);
        } else {
          const candleData: CandlestickData<UTCTimestamp>[] = data.candles.map((c: any) => ({
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
            <SelectContent className="bg-dark-300 border-purple-500/50">
              {Object.keys(FOREX_PAIRS).map((pair) => (
                <SelectItem key={pair} value={pair} className="text-white hover:bg-purple-600/50">
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
      
      {/* Chart Container */}
      <div className="relative flex-1 min-h-[300px] md:min-h-[400px]">
        <div ref={chartContainerRef} className="absolute inset-0" />
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/60 text-sm">Loading chart...</span>
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
