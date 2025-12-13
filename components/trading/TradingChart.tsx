'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface TradingChartProps {
  competitionId: string;
}

const TradingChart = ({ competitionId }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { prices, subscribe, unsubscribe } = usePrices();

  const [symbol, setSymbol] = useState<ForexSymbol>('EUR/USD');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1d2e' },
        textColor: '#8892b0',
      },
      grid: {
        vertLines: { color: '#2d3748' },
        horzLines: { color: '#2d3748' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Load historical data
  useEffect(() => {
    const loadChartData = async () => {
      setIsLoading(true);

      try {
        const response = await fetch('/api/trading/candles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, timeframe, count: 100 }),
        });

        if (response.ok) {
          const data = await response.json();
          if (candlestickSeriesRef.current && data.candles) {
            const formattedCandles = data.candles.map((candle: any) => ({
              time: (candle.timestamp / 1000) as Time,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }));

            candlestickSeriesRef.current.setData(formattedCandles);
            chartRef.current?.timeScale().fitContent();
          }
        }
      } catch (error) {
        console.error('Error loading chart data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChartData();
  }, [symbol, timeframe]);

  // Update chart with real-time prices
  useEffect(() => {
    const currentPrice = prices.get(symbol);
    if (!currentPrice || !candlestickSeriesRef.current || isLoading) return;

    console.log(`📊 Chart Update: ${symbol} @ ${currentPrice.mid.toFixed(5)}`);

    // Use current timestamp rounded to the nearest timeframe interval
    const getTimeframeSeconds = () => {
      switch (timeframe) {
        case '1m': return 60;
        case '5m': return 300;
        case '15m': return 900;
        case '1h': return 3600;
        default: return 300;
      }
    };

    const intervalSeconds = getTimeframeSeconds();
    const now = Math.floor(Date.now() / 1000);
    const roundedTime = Math.floor(now / intervalSeconds) * intervalSeconds;

    const latestCandle: CandlestickData = {
      time: roundedTime as Time,
      open: currentPrice.mid,
      high: currentPrice.mid,
      low: currentPrice.mid,
      close: currentPrice.mid,
    };

    try {
      candlestickSeriesRef.current.update(latestCandle);
    } catch (error) {
      // If update fails, it's likely because the time is too old
      // This is expected and can be safely ignored
      console.debug('Chart update skipped:', error);
    }
  }, [prices, symbol, isLoading, timeframe]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Symbol Selector */}
        <div className="flex-1 min-w-[200px]">
          <Select value={symbol} onValueChange={(value) => setSymbol(value as ForexSymbol)}>
            <SelectTrigger className="bg-dark-300 border-dark-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(FOREX_PAIRS).map((sym) => (
                <SelectItem key={sym} value={sym}>
                  {sym}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
            <Button
              key={tf}
              size="sm"
              variant={timeframe === tf ? 'default' : 'ghost'}
              onClick={() => setTimeframe(tf)}
              className={timeframe === tf ? 'bg-primary' : ''}
            >
              {tf}
            </Button>
          ))}
        </div>

        {/* Current Price */}
        {prices.get(symbol) && (
          <div className="ml-auto">
            <div className="text-xs text-dark-600">Current Price</div>
            <div className="text-lg font-bold text-light-900">
              {prices.get(symbol)!.mid.toFixed(5)}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-100/50 z-10 rounded-lg">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
      </div>
    </div>
  );
};

export default TradingChart;

