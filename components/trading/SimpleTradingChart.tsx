'use client';

import { useEffect, useRef, useState } from 'react';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SymbolSelector, SymbolSelectorButton } from './SymbolSelector';

interface SimpleTradingChartProps {
  competitionId: string;
}

// Map our symbols to TradingView format
// Dynamic mapping - converts any forex pair to TradingView format
function getTradingViewSymbol(symbol: ForexSymbol): string {
  return `FX:${symbol.replace('/', '')}`;
}

const SimpleTradingChart = ({ competitionId }: SimpleTradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { prices, subscribe, unsubscribe, marketOpen, marketStatus } = usePrices();
  const { symbol, setSymbol } = useChartSymbol();
  const [interval, setInterval] = useState<string>('5');
  const [symbolDialogOpen, setSymbolDialogOpen] = useState(false);

  // Subscribe to price updates
  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [symbol, subscribe, unsubscribe]);

  // Initialize TradingView widget
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear previous content
    chartContainerRef.current.innerHTML = '';

    const tvSymbol = getTradingViewSymbol(symbol);

    // Create widget div
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '500px';
    widgetDiv.style.width = '100%';

    // Create script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: 'rgba(26, 29, 46, 1)',
      gridColor: 'rgba(45, 55, 72, 0.3)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    chartContainerRef.current.appendChild(widgetDiv);
    chartContainerRef.current.appendChild(script);
  }, [symbol, interval]);

  const currentPrice = prices.get(symbol);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Symbol Selector */}
        <div className="flex-1 min-w-[200px]">
          <SymbolSelectorButton
            symbol={symbol}
            onClick={() => setSymbolDialogOpen(true)}
            className="w-full justify-start bg-gray-800 border border-gray-700 h-10"
          />
          <SymbolSelector
            open={symbolDialogOpen}
            onOpenChange={setSymbolDialogOpen}
            selectedSymbol={symbol}
            onSelectSymbol={setSymbol}
          />
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2">
          {[
            { label: '1m', value: '1' },
            { label: '5m', value: '5' },
            { label: '15m', value: '15' },
            { label: '1h', value: '60' },
            { label: '4h', value: '240' },
            { label: '1D', value: 'D' },
          ].map((tf) => (
            <Button
              key={tf.value}
              size="sm"
              variant={interval === tf.value ? 'default' : 'ghost'}
              onClick={() => setInterval(tf.value)}
              className={interval === tf.value ? 'bg-yellow-500 text-gray-900' : 'text-gray-400'}
            >
              {tf.label}
            </Button>
          ))}
        </div>

        {/* Market Status */}
        <div className={cn(
          "px-3 py-1 rounded text-xs font-medium",
          marketOpen ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
        )}>
          {marketStatus}
        </div>

        {/* Current Price */}
        {currentPrice && (
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-500">Live Price (REAL)</div>
            <div className="text-lg font-bold text-yellow-500">
              {currentPrice.mid.toFixed(5)}
            </div>
            <div className="text-xs text-gray-400">
              Bid: {currentPrice.bid.toFixed(5)} | Ask: {currentPrice.ask.toFixed(5)}
            </div>
          </div>
        )}
      </div>

      {/* TradingView Chart */}
      <div 
        ref={chartContainerRef} 
        className="tradingview-widget-container rounded-lg overflow-hidden bg-[#1a1d2e]"
        style={{ height: '500px', width: '100%' }}
      />
      
      {/* Attribution */}
      <div className="text-xs text-gray-500 text-center">
        Chart data provided by TradingView | Live prices from Massive.com
      </div>
    </div>
  );
};

export default SimpleTradingChart;

