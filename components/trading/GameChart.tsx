'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Star, Zap, Trophy, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { getRecentCandles, OHLCCandle } from '@/lib/services/forex-historical.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FOREX_PAIRS, ForexSymbol } from '@/lib/services/pnl-calculator.service';

interface Position {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  takeProfit?: number;
  stopLoss?: number;
  currentPrice: number;
}

interface GameChartProps {
  competitionId: string;
  positions?: Position[];
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isUp: boolean;
}

export default function GameChart({ competitionId, positions = [] }: GameChartProps) {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol, setSymbol } = useChartSymbol();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [forceUpdate, setForceUpdate] = useState<number>(0); // Force re-render
  const [visibleCandles, setVisibleCandles] = useState<number>(10); // Zoom control
  const [chartType, setChartType] = useState<'line' | 'candle'>('line'); // Chart type toggle
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '30m' | '1h'>('1m'); // Timeframe
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPriceRef = useRef<number>(0);
  
  // Calculate P&L and hasPositions from props
  const symbolPositions = positions.filter((p) => p.symbol === symbol);
  const totalPnL = symbolPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const hasPositions = symbolPositions.length > 0;
  
  // Get entry price from first position (for profit/loss zones)
  const entryPrice = symbolPositions.length > 0 ? symbolPositions[0].entryPrice : null;
  const positionSide = symbolPositions.length > 0 ? symbolPositions[0].side : null;

  // Get current price
  const currentPrice = prices.get(symbol);

  // Subscribe to price updates (CRITICAL - same as Professional mode!)
  useEffect(() => {
    console.log('🎮 Game Mode: Subscribing to price updates for', symbol);
    subscribe(symbol);
    return () => {
      console.log('🎮 Game Mode: Unsubscribing from', symbol);
      unsubscribe(symbol);
    };
  }, [symbol, subscribe, unsubscribe]);

  // Load historical candles with selected timeframe
  useEffect(() => {
    const loadHistoricalCandles = async () => {
      try {
        // Map timeframe to API format (Timeframe type from service)
        const timeframeMap = {
          '1m': '1' as const,
          '5m': '5' as const,
          '15m': '15' as const,
          '30m': '30' as const,
          '1h': '60' as const
        };
        
        const apiTimeframe = timeframeMap[timeframe];
        console.log(`📊 Game Mode: Loading ${timeframe} candles for ${symbol}`);
        
        // Fetch enough candles to support zoom (fetch more than max zoom)
        const historicalCandles = await getRecentCandles(symbol, apiTimeframe as any, Math.max(60, visibleCandles + 10));
        
        if (historicalCandles.length > 0) {
          // Convert to our Candle format and keep last N candles based on zoom
          const formattedCandles: Candle[] = historicalCandles
            .slice(-visibleCandles) // Show N candles based on zoom level
            .map((c: OHLCCandle) => ({
              time: c.time * 1000, // Convert to milliseconds
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              isUp: c.close >= c.open,
            }));
          
          setCandles(formattedCandles);
          
          // Set last price for change calculation
          if (formattedCandles.length > 0) {
            lastPriceRef.current = formattedCandles[formattedCandles.length - 1].close;
          }
          
          console.log(`✅ Game Mode: Loaded ${formattedCandles.length} ${timeframe} candles`);
        }
      } catch (error) {
        console.error('❌ Game Mode: Error loading historical candles:', error);
      }
    };

    loadHistoricalCandles();
  }, [symbol, visibleCandles, timeframe]);

  // Update current candle with LIVE real-time price ticks (immediate updates!)
  useEffect(() => {
    // Get fresh price from the prices Map (this triggers on every price update)
    const latestPrice = prices.get(symbol);
    if (!latestPrice || candles.length === 0) return;

    const mid = latestPrice.mid;
    const bid = latestPrice.bid;
    const ask = latestPrice.ask;
    
    console.log(`🎮 Game Mode: Price tick - ${symbol} @ ${mid.toFixed(5)}`);
    
    // Calculate price change
    if (lastPriceRef.current > 0) {
      const change = ((mid - lastPriceRef.current) / lastPriceRef.current) * 100;
      setPriceChange(change);
    }
    lastPriceRef.current = mid;

    // Update IMMEDIATELY on every price tick (no delay!)
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      
      const newCandles = [...prev];
      const lastCandle = newCandles[newCandles.length - 1];
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000) * 60000;
      const lastCandleMinute = Math.floor(lastCandle.time / 60000) * 60000;

      // If we're in the same minute, update the last candle LIVE
      if (currentMinute === lastCandleMinute) {
        lastCandle.high = Math.max(lastCandle.high, ask);
        lastCandle.low = Math.min(lastCandle.low, bid);
        lastCandle.close = mid;
        lastCandle.isUp = lastCandle.close >= lastCandle.open;
        console.log(`📊 Updated candle: O:${lastCandle.open.toFixed(5)} H:${lastCandle.high.toFixed(5)} L:${lastCandle.low.toFixed(5)} C:${lastCandle.close.toFixed(5)}`);
      } else {
        // New minute, create a new candle
        const previousClose = lastCandle.close;
        const newCandle: Candle = {
          time: currentMinute,
          open: mid,
          high: ask,
          low: bid,
          close: mid,
          isUp: mid >= previousClose,
        };
        
        newCandles.push(newCandle);
        
        // Keep only last N candles based on zoom level
        if (newCandles.length > visibleCandles) {
          newCandles.shift();
        }
        
        console.log(`🆕 New candle created for ${new Date(currentMinute).toLocaleTimeString()}`);
      }

      return newCandles;
    });
    
    // Force re-render to update the canvas
    setForceUpdate(prev => prev + 1);
  }, [prices, symbol]); // Triggers on EVERY price update in the prices Map!

  // Draw gaming candles
  useEffect(() => {
    if (!canvasRef.current || candles.length < 1) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas with dark background
    ctx.fillStyle = '#1a1d2e';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Find min/max prices from all candles
    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 0.0001;

    const paddingLeft = 60; // More space for price labels
    const paddingRight = 80; // Space for current price label only
    const paddingTop = 20;
    const paddingBottom = 55; // Extra space for "NOW" indicator, time and date labels
    const chartWidth = rect.width - paddingLeft - paddingRight;
    const chartHeight = rect.height - paddingTop - paddingBottom;
    
    // Calculate candle spacing based on visible candles
    const candleSpacing = chartWidth / Math.min(candles.length, visibleCandles);
    const candleWidth = Math.min(candleSpacing * 0.7, 50); // Max 50px wide, 70% of spacing

    // Draw price grid lines (subtle)
    ctx.strokeStyle = '#2a2e3e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = paddingTop + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(rect.width - paddingRight, y);
      ctx.stroke();
      
      // Price labels on left (with enough space)
      const price = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(5), paddingLeft - 8, y + 4);
    }

    // Draw profit/loss zones if there's an entry price
    if (entryPrice !== null && positionSide !== null) {
      const entryY = paddingTop + chartHeight - ((entryPrice - minPrice) / priceRange) * chartHeight;
      
      // Green zone (profit) and Red zone (loss)
      if (positionSide === 'long') {
        // Long: Green above entry (winning), Red below entry (losing)
        // Green zone (profit)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'; // Semi-transparent green
        ctx.fillRect(paddingLeft, paddingTop, chartWidth, entryY - paddingTop);
        
        // Red zone (loss)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'; // Semi-transparent red
        ctx.fillRect(paddingLeft, entryY, chartWidth, paddingTop + chartHeight - entryY);
      } else {
        // Short: Green below entry (winning), Red above entry (losing)
        // Red zone (loss)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)'; // Semi-transparent red
        ctx.fillRect(paddingLeft, paddingTop, chartWidth, entryY - paddingTop);
        
        // Green zone (profit)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'; // Semi-transparent green
        ctx.fillRect(paddingLeft, entryY, chartWidth, paddingTop + chartHeight - entryY);
      }
    }

    // Draw chart based on type
    if (chartType === 'line') {
      // Draw smooth line chart
      ctx.beginPath();
      ctx.strokeStyle = '#8b5cf6'; // Purple
      ctx.lineWidth = 3;
      ctx.shadowColor = '#8b5cf6';
      ctx.shadowBlur = 8;
      
      candles.forEach((candle, i) => {
        const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
        const yClose = paddingTop + chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight;
        
        if (i === 0) {
          ctx.moveTo(x, yClose);
        } else {
          ctx.lineTo(x, yClose);
        }
      });
      
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Add gradient fill under the line
      ctx.lineTo(paddingLeft + (candles.length - 1) * candleSpacing + candleSpacing / 2, paddingTop + chartHeight);
      ctx.lineTo(paddingLeft + candleSpacing / 2, paddingTop + chartHeight);
      ctx.closePath();
      
      const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw dots on each data point
      candles.forEach((candle, i) => {
        const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
        const yClose = paddingTop + chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, yClose, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#a78bfa';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else {
      // Draw gaming candles
      candles.forEach((candle, i) => {
        const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
        
        // Calculate positions
        const yHigh = paddingTop + chartHeight - ((candle.high - minPrice) / priceRange) * chartHeight;
        const yLow = paddingTop + chartHeight - ((candle.low - minPrice) / priceRange) * chartHeight;
        const yOpen = paddingTop + chartHeight - ((candle.open - minPrice) / priceRange) * chartHeight;
        const yClose = paddingTop + chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight;
        
        const bodyTop = Math.min(yOpen, yClose);
        const bodyBottom = Math.max(yOpen, yClose);
        const bodyHeight = Math.max(2, bodyBottom - bodyTop);

        // Gaming colors
        const upColor = '#22c55e'; // Bright green
        const downColor = '#ef4444'; // Bright red
        const color = candle.isUp ? upColor : downColor;
        
        // Draw wick (thin line)
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();
        
        // Draw body with rounded corners (gaming style)
        const radius = 3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight, radius);
        ctx.fill();
        
        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Add border for extra pop
        ctx.strokeStyle = candle.isUp ? '#34d399' : '#f87171';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw gamified position entry markers 🎮
    symbolPositions.forEach((position) => {
      const entryPrice = position.entryPrice;
      if (entryPrice < minPrice || entryPrice > maxPrice) return; // Out of visible range
      
      console.log('🎮 Drawing position:', { 
        symbol: position.symbol, 
        entry: entryPrice, 
        tp: position.takeProfit, 
        sl: position.stopLoss,
        minPrice,
        maxPrice
      });
      
      const yEntry = paddingTop + chartHeight - ((entryPrice - minPrice) / priceRange) * chartHeight;
      const isProfit = position.unrealizedPnl >= 0;
      const isLong = position.side === 'long';
      
      // Gaming style horizontal line (dashed) - ENTRY LINE
      const entryColor = isLong ? '#fbbf24' : '#a78bfa'; // Yellow for long, purple for short
      ctx.strokeStyle = entryColor;
      ctx.lineWidth = 5; // Thicker for more prominence
      ctx.shadowColor = entryColor;
      ctx.shadowBlur = 12;
      ctx.setLineDash([12, 6]); // Distinctive dash pattern
      ctx.beginPath();
      ctx.moveTo(paddingLeft, yEntry);
      ctx.lineTo(rect.width - paddingRight, yEntry);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      
      // Gaming badge on the left
      const badgeX = paddingLeft - 30;
      const badgeY = yEntry;
      
      // Badge background (circle with glow)
      ctx.shadowColor = isLong ? '#fbbf24' : '#a78bfa';
      ctx.shadowBlur = 15;
      ctx.fillStyle = isLong ? '#fbbf24' : '#a78bfa';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Badge icon (emoji)
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(isLong ? '↑' : '↓', badgeX, badgeY);
      
      // Draw Take Profit line if set (NO LABEL)
      if (position.takeProfit) {
        const tpValue = position.takeProfit;
        console.log('🎯 Drawing TP line at:', tpValue);
        
        // Draw TP line even if slightly outside range (for visibility)
        const yTP = paddingTop + chartHeight - ((tpValue - minPrice) / priceRange) * chartHeight;
        
        // TP line (green dashed) - THICKER & MORE VISIBLE
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 15;
        ctx.setLineDash([18, 10]); // Longer dashes for distinction
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yTP);
        ctx.lineTo(rect.width - paddingRight, yTP);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
      
      // Draw Stop Loss line if set (NO LABEL)
      if (position.stopLoss) {
        const slValue = position.stopLoss;
        console.log('🛑 Drawing SL line at:', slValue);
        
        // Draw SL line even if slightly outside range (for visibility)
        const ySL = paddingTop + chartHeight - ((slValue - minPrice) / priceRange) * chartHeight;
        
        // SL line (red dashed) - THICKER & MORE VISIBLE
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.setLineDash([6, 12]); // Short dashes, LONGER gaps for distinction
        ctx.beginPath();
        ctx.moveTo(paddingLeft, ySL);
        ctx.lineTo(rect.width - paddingRight, ySL);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
    });

    // Draw current price line with "NOW" indicator
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const yPrice = paddingTop + chartHeight - ((lastCandle.close - minPrice) / priceRange) * chartHeight;
      
      // Determine color based on comparison with previous candle
      let lineColor = '#6b7280'; // Default gray
      if (candles.length > 1) {
        const prevCandle = candles[candles.length - 2];
        lineColor = lastCandle.close > prevCandle.close ? '#22c55e' : '#ef4444';
      } else {
        lineColor = lastCandle.isUp ? '#22c55e' : '#ef4444';
      }
      
      // Current price line - THIN & SUBTLE
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.setLineDash([4, 4]); // Short, tight dashes
      ctx.beginPath();
      ctx.moveTo(paddingLeft, yPrice);
      ctx.lineTo(rect.width - paddingRight, yPrice);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      
      // Price label on the right (transparent background)
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = lineColor;
      ctx.fillText(lastCandle.close.toFixed(5), rect.width - paddingRight + 5, yPrice + 4);
      
      // Time indicator at bottom showing "NOW" for the rightmost candle
      const lastCandleX = paddingLeft + (candles.length - 1) * candleSpacing + candleSpacing / 2;
      const timeY = paddingTop + chartHeight + 15;
      
      ctx.fillStyle = lineColor;
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('▼ NOW', lastCandleX, timeY);
    }

    // Draw time/date labels on X-axis for better context
    ctx.fillStyle = '#d1d5db'; // Lighter gray for better visibility
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    
    // Show time labels for the visible candles
    const labelInterval = Math.max(2, Math.floor(candles.length / 5)); // Show ~3-5 time labels
    
    for (let i = 0; i < candles.length; i += labelInterval) {
      const candle = candles[i];
      if (!candle) continue;
      
      const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
      const yTime = paddingTop + chartHeight + 28; // Position for time
      const yDate = paddingTop + chartHeight + 40; // Position for date
      
      const date = new Date(candle.time);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      // Show time
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${hours}:${minutes}`, x, yTime);
      
      // Show date (smaller, below time)
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#9ca3af'; // Slightly darker for date
      ctx.fillText(`${month}/${day}`, x, yDate);
      ctx.fillStyle = '#d1d5db'; // Reset color
    }
  }, [candles, hasPositions, totalPnL, symbolPositions, forceUpdate, entryPrice, positionSide, visibleCandles, chartType, timeframe]); // forceUpdate triggers redraw on every price tick

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const isGoingUp = lastCandle?.isUp ?? false;

  return (
    <div className="relative space-y-2 md:space-y-3">
      {/* Chart Controls - Separate Module Above Chart - MOBILE OPTIMIZED */}
      <div className="bg-gradient-to-br from-dark-200 to-dark-300 rounded-lg md:rounded-xl border-2 border-purple-500/50 p-2 md:p-4 shadow-xl">
        {/* Chart Type Toggle */}
        <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-2 md:mb-3">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 md:px-5 md:py-2.5 text-sm md:text-base font-bold rounded-md md:rounded-lg transition-all ${
              chartType === 'line'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                : 'bg-dark-400 text-dark-600 hover:bg-dark-500'
            }`}
          >
            📈 <span className="hidden sm:inline">Line</span>
          </button>
          <button
            onClick={() => setChartType('candle')}
            className={`px-3 py-1.5 md:px-5 md:py-2.5 text-sm md:text-base font-bold rounded-md md:rounded-lg transition-all ${
              chartType === 'candle'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                : 'bg-dark-400 text-dark-600 hover:bg-dark-500'
            }`}
          >
            🕯️ <span className="hidden sm:inline">Candles</span>
          </button>
        </div>

        {/* Timeframe Selector - Mobile Optimized */}
        <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
          <span className="text-xs md:text-sm text-purple-400 font-bold hidden md:inline">⏱️ Timeframe:</span>
          {(['1m', '5m', '15m', '30m', '1h'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-bold rounded-md md:rounded-lg transition-all ${
                timeframe === tf
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-lg ring-1 md:ring-2 ring-yellow-400 scale-105'
                  : 'bg-dark-400 text-dark-600 hover:bg-dark-500 hover:text-white'
              }`}
            >
              {tf === '1m' && '⚡ '} 
              {tf === '5m' && '🔥 '} 
              {tf === '15m' && '💫 '} 
              {tf === '30m' && '⭐ '} 
              {tf === '1h' && '🌟 '} 
              <span className="hidden sm:inline">{tf.toUpperCase()}</span>
              <span className="sm:hidden">{tf[0].toUpperCase()}{tf.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {/* Symbol Selector - Choose Your Weapon - FIRST ELEMENT */}
        <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-2 border-purple-500/50 rounded-t-xl p-3 md:p-4">
        <h3 className="text-center text-base md:text-lg font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2 mb-3">
          🎯 Choose Your Weapon
        </h3>
        <Select value={symbol} onValueChange={(value) => setSymbol(value as ForexSymbol)}>
          <SelectTrigger className="w-full bg-gradient-to-r from-purple-600 to-pink-600 border-2 border-purple-400 text-white text-center text-lg md:text-xl font-bold h-12 md:h-14 shadow-lg hover:shadow-purple-500/50 transition-all">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-2 border-purple-500">
            {Object.keys(FOREX_PAIRS).map((sym) => (
              <SelectItem 
                key={sym} 
                value={sym} 
                className="text-white hover:bg-gradient-to-r hover:from-purple-600 hover:to-pink-600 text-base md:text-lg font-bold py-3 md:py-4 cursor-pointer justify-center"
              >
                <div className="w-full text-center font-black">💱 {sym}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

        {/* Fun Gaming Header - MOBILE OPTIMIZED */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 border-x-2 border-purple-600">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Star className="size-4 text-yellow-400 animate-spin hidden sm:block" style={{ animationDuration: '3s' }} />
              <span className="text-white font-bold text-xs sm:text-sm">🎮 {symbol}</span>
            </div>
            
            {currentPrice && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full font-bold text-xs",
                isGoingUp ? "bg-green-500" : "bg-red-500"
              )}>
                {isGoingUp ? (
                  <>
                    <TrendingUp className="size-3" />
                    <span>{priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="size-3" />
                    <span>{priceChange.toFixed(2)}%</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Price Info Panel - MOBILE OPTIMIZED */}
      {currentPrice && lastCandle && (
        <div className="bg-gradient-to-r from-dark-200 to-dark-300 border-x-2 md:border-x-4 border-purple-600 p-2 md:p-4">
          {/* Mobile: Show only Mid and Move in one row */}
          <div className="md:hidden flex items-center justify-around gap-2">
            {/* Mid Price */}
            <div className="text-center flex-1">
              <p className="text-xs text-dark-600 mb-0.5">💰 Price</p>
              <div className={cn(
                "text-base font-bold font-mono",
                isGoingUp ? "text-green-400" : "text-red-400"
              )}>
                {currentPrice.mid.toFixed(5)}
              </div>
            </div>
            
            {/* Movement */}
            <div className="text-center flex-1">
              <p className="text-xs text-dark-600 mb-0.5">📊 Change</p>
              <div className={cn(
                "text-base font-bold flex items-center justify-center gap-1",
                isGoingUp ? "text-green-400" : "text-red-400"
              )}>
                {isGoingUp ? '📈' : '📉'}
                <span>{isGoingUp ? '+' : ''}{priceChange.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Desktop: Show all 4 metrics */}
          <div className="hidden md:grid grid-cols-4 gap-4">
            {/* Mid Price */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1">💰 Mid</p>
              <div className={cn(
                "text-xl font-bold font-mono",
                isGoingUp ? "text-green-400" : "text-red-400"
              )}>
                {currentPrice.mid.toFixed(5)}
              </div>
            </div>
            
            {/* High */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1">⬆️ High</p>
              <div className="text-xl font-bold font-mono text-green-400">
                {lastCandle.high.toFixed(5)}
              </div>
            </div>
            
            {/* Low */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1">⬇️ Low</p>
              <div className="text-xl font-bold font-mono text-red-400">
                {lastCandle.low.toFixed(5)}
              </div>
            </div>
            
            {/* Movement */}
            <div className="text-center">
              <p className="text-xs text-dark-600 mb-1">🎯 Move</p>
              <div className={cn(
                "text-xl font-bold flex items-center justify-center gap-1",
                isGoingUp ? "text-green-400" : "text-red-400"
              )}>
                {isGoingUp ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                {isGoingUp ? '📈' : '📉'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gaming Chart - MOBILE OPTIMIZED */}
      <div className="relative bg-gradient-to-b from-dark-200 to-dark-300 border-x-2 md:border-x-4 border-purple-600 p-2 md:p-4">
        <canvas
          ref={canvasRef}
          className="w-full h-[400px] sm:h-[450px] md:h-[500px] rounded-lg"
        />
        
        {/* Chart Legend - MOBILE HIDDEN */}
        {chartType === 'candle' && (
          <div className="hidden md:flex mt-3 items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded border-2 border-green-300"></div>
              <span className="text-green-400 font-semibold">Green = Price UP! 🚀</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded border-2 border-red-300"></div>
              <span className="text-red-400 font-semibold">Red = Price DOWN! 📉</span>
            </div>
          </div>
        )}
        {chartType === 'line' && (
          <div className="hidden md:flex mt-3 items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-purple-500 rounded"></div>
              <span className="text-purple-400 font-semibold">Purple Line = Price Movement! 📊</span>
            </div>
          </div>
        )}
        
        {/* Emoji Explanation - MOBILE HIDDEN */}
        <div className="hidden md:block mt-2 bg-purple-900/30 rounded-lg p-2 border border-purple-500/30">
          <p className="text-center text-xs text-purple-200">
            <span className="font-bold">📊 Emoji Guide:</span>{' '}
            {hasPositions ? (
              <>
                <span className="text-green-400 font-semibold">😊 = Winning Trade (Profit!)</span>
                {' • '}
                <span className="text-red-400 font-semibold">😢 = Losing Trade (Loss)</span>
                {' • '}
                <span className="text-gray-400 font-semibold">😐 = Break Even</span>
              </>
            ) : (
              <>
                <span className="text-green-400 font-semibold">📈 = Price Going UP</span>
                {' • '}
                <span className="text-red-400 font-semibold">📉 = Price Going DOWN</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Fun Bottom Bar - MOBILE HIDDEN */}
      <div className="hidden md:block bg-gradient-to-r from-purple-600 to-pink-600 rounded-b-lg p-2 md:p-3">
        <div className="grid grid-cols-3 gap-2 text-white text-xs">
          <div className="flex flex-col items-center">
            <Trophy className="size-4 md:size-5 text-yellow-400 mb-1" />
            <span className="font-bold">Trade & Win!</span>
          </div>
          <div className="flex flex-col items-center">
            <Zap className="size-4 md:size-5 text-yellow-400 mb-1" />
            <span className="font-bold">Real Prices!</span>
          </div>
          <div className="flex flex-col items-center">
            <Star className="size-4 md:size-5 text-yellow-400 mb-1" />
            <span className="font-bold">Super Fun!</span>
          </div>
        </div>
      </div>

      {/* Zoom Controls - MOBILE OPTIMIZED */}
      <div className="mt-2 md:mt-3 flex items-center justify-center gap-2 md:gap-3 bg-dark-300 rounded-lg p-2 md:p-3 border border-dark-400">
        <button
          onClick={() => setVisibleCandles(prev => Math.max(5, prev - 5))}
          disabled={visibleCandles <= 5}
          className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-bold rounded-md md:rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          🔍 <span className="hidden sm:inline">Zoom In</span>
        </button>
        <span className="text-light-900 font-bold text-xs md:text-sm">
          {visibleCandles} <span className="hidden sm:inline">{chartType === 'line' ? 'Points' : 'Candles'}</span>
        </span>
        <button
          onClick={() => setVisibleCandles(prev => Math.min(50, prev + 5))}
          disabled={visibleCandles >= 50}
          className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-500/90 hover:to-pink-500/90 text-white font-bold rounded-md md:rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          🔎 <span className="hidden sm:inline">Zoom Out</span>
        </button>
      </div>

      {/* Simple Helper - MOBILE HIDDEN */}
      <div className="hidden md:block mt-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg p-2 md:p-3 border-2 border-blue-500/50">
        <p className="text-center text-xs md:text-sm text-blue-300">
          {chartType === 'line' ? (
            <>
              <span className="font-bold">💡 How to Read:</span> Follow the{' '}
              <span className="text-purple-400 font-bold">purple line 📊</span> to see price movement!{' '}
              Line going <span className="text-green-400 font-bold">UP ⬆️</span> means price is rising,{' '}
              going <span className="text-red-400 font-bold">DOWN ⬇️</span> means price is falling!
            </>
          ) : (
            <>
              <span className="font-bold">💡 How to Read:</span> Each colorful bar is a "candle"! 
              <span className="text-green-400 font-bold"> Green bars 📈</span> mean price went UP! 
              <span className="text-red-400 font-bold"> Red bars 📉</span> mean price went DOWN!
            </>
          )}
        </p>
      </div>
      </div>
      {/* End Chart Container */}
    </div>
  );
}

