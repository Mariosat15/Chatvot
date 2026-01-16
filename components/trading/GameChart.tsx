'use client';

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { TrendingUp, TrendingDown, Star, Zap, Trophy, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrices } from '@/contexts/PriceProvider';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
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

interface RealtimePrice {
  bid: number;
  ask: number;
  mid: number;
}

function GameChartInner({ competitionId, positions = [] }: GameChartProps) {
  const { prices, subscribe, unsubscribe } = usePrices();
  const { symbol, setSymbol } = useChartSymbol();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [visibleCandles, setVisibleCandles] = useState<number>(10); // Zoom control
  const [chartType, setChartType] = useState<'line' | 'candle'>('line'); // Chart type toggle
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '30m' | '1h'>('1m'); // Timeframe
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPriceRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0); // Throttle updates
  
  // Real-time WebSocket price - use REF for fast updates (no React re-renders)
  const wsPriceRef = useRef<RealtimePrice | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Force update counter - only used to trigger re-renders when needed
  const [, forceUpdate] = useState(0);
  const lastForceUpdateRef = useRef<number>(0);
  
  // Price display ref for direct DOM updates (bypasses React)
  const priceDisplayRef = useRef<HTMLDivElement>(null);
  
  // DEBUG: Count WebSocket messages received
  const wsMessageCountRef = useRef<number>(0);
  const [wsMessageCount, setWsMessageCount] = useState(0);
  
  // Memoize expensive position calculations
  const { symbolPositions, totalPnL, hasPositions, entryPrice, positionSide } = useMemo(() => {
    const filtered = positions.filter((p) => p.symbol === symbol);
    const pnl = filtered.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    return {
      symbolPositions: filtered,
      totalPnL: pnl,
      hasPositions: filtered.length > 0,
      entryPrice: filtered.length > 0 ? filtered[0].entryPrice : null,
      positionSide: filtered.length > 0 ? filtered[0].side : null,
    };
  }, [positions, symbol]);

  // Get current price - prefer WebSocket price (faster), fallback to PriceProvider (polling)
  const pollPrice = prices.get(symbol);
  const currentPrice = wsPriceRef.current || pollPrice;

  // Subscribe to price updates via PriceProvider (fallback)
  useEffect(() => {
    subscribe(symbol);
    return () => {
      unsubscribe(symbol);
    };
  }, [symbol, subscribe, unsubscribe]);

  // WebSocket connection for FAST real-time prices (same as Professional mode)
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;
    
    const connect = () => {
      if (isCleanedUp) return;
      
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?token=price-viewer&type=user`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle price_update events (same format as Professional mode)
            if (message.type === 'price_update' && message.data) {
              const { prices } = message.data;
              
              // Find our symbol's price
              const priceData = prices?.find(
                (p: { symbol: string }) => p.symbol === symbol
              );
              
              if (priceData) {
                // Update price REF (no React re-render!)
                wsPriceRef.current = {
                  bid: priceData.bid,
                  ask: priceData.ask,
                  mid: (priceData.bid + priceData.ask) / 2,
                };
                
                // DEBUG: Count messages
                wsMessageCountRef.current++;
                
                // DIRECT DOM UPDATE for price display (bypasses React completely!)
                if (priceDisplayRef.current) {
                  priceDisplayRef.current.textContent = priceData.bid.toFixed(5);
                }
                
                // Force React re-render only every 500ms (for other UI elements)
                const now = Date.now();
                if (now - lastForceUpdateRef.current > 500) {
                  lastForceUpdateRef.current = now;
                  setWsMessageCount(wsMessageCountRef.current);
                  forceUpdate(n => n + 1);
                }
              }
            }
          } catch (e) {
            console.error('🎮 GameChart WS parse error:', e);
          }
        };
        
        ws.onerror = (e) => {
          console.error('🎮 GameChart WS error:', e);
          setWsConnected(false);
          ws.close();
        };
        
        ws.onopen = () => {
          console.log('🎮 GameChart WS connected! Subscribing to:', symbol);
          setWsConnected(true);
          // Subscribe to only the symbol this chart needs
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'subscribe_symbol',
              symbol: symbol,
            }));
          }
        };
        
        ws.onclose = () => {
          setWsConnected(false);
          if (!isCleanedUp) {
            // Reconnect after 2 seconds
            reconnectTimeout = setTimeout(connect, 2000);
          }
        };
      } catch {
        // Reconnect on error
        if (!isCleanedUp) {
          reconnectTimeout = setTimeout(connect, 2000);
        }
      }
    };
    
    connect();
    
    return () => {
      isCleanedUp = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      wsPriceRef.current = null;
    };
  }, [symbol]);

  // Load historical candles with selected timeframe - using same API as Professional mode
  useEffect(() => {
    const loadHistoricalCandles = async () => {
      try {
        // Map timeframe to API format (same as Professional mode)
        const timeframeMap: Record<string, string> = {
          '1m': '1',
          '5m': '5',
          '15m': '15',
          '30m': '30',
          '1h': '60'
        };
        
        const apiTimeframe = timeframeMap[timeframe];
        const count = Math.max(60, visibleCandles + 10);
        
        // Use the same candles API as Professional mode for consistency
        const response = await fetch(`/api/trading/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${apiTimeframe}&count=${count}`);
        
        if (!response.ok) {
          console.error('❌ Game Mode: Failed to fetch candles:', response.status);
          return;
        }
        
        const data = await response.json();
        const historicalCandles = data.candles || [];
        
        if (historicalCandles.length > 0) {
          // Convert to our Candle format and keep last N candles based on zoom
          const formattedCandles: Candle[] = historicalCandles
            .slice(-visibleCandles) // Show N candles based on zoom level
            .map((c: { time: number; open: number; high: number; low: number; close: number }) => ({
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
          
        }
      } catch (error) {
        console.error('❌ Game Mode: Error loading historical candles:', error);
      }
    };

    loadHistoricalCandles();
  }, [symbol, visibleCandles, timeframe]);

  // Get interval in milliseconds for the selected timeframe
  const getTimeframeIntervalMs = useMemo(() => {
    const intervals: Record<string, number> = {
      '1m': 60000,      // 1 minute
      '5m': 300000,     // 5 minutes
      '15m': 900000,    // 15 minutes
      '30m': 1800000,   // 30 minutes
      '1h': 3600000,    // 1 hour
    };
    return intervals[timeframe] || 60000;
  }, [timeframe]);

  // Update current candle with real-time price ticks (throttled for performance)
  useEffect(() => {
    const latestPrice = prices.get(symbol);
    if (!latestPrice || candles.length === 0) return;

    const now = Date.now();
    
    // Throttle candle updates to max once per 500ms for performance
    // Price lines update in real-time, candle drawing is less critical
    if (now - lastUpdateRef.current < 500) return;
    lastUpdateRef.current = now;

    const bid = latestPrice.bid;
    const ask = latestPrice.ask;

    // Calculate price change based on BID (same as Professional mode)
    if (lastPriceRef.current > 0) {
      const change = ((bid - lastPriceRef.current) / lastPriceRef.current) * 100;
      setPriceChange(change);
    }
    lastPriceRef.current = bid;

    // Update candles (throttled) - use timeframe interval for candle boundaries
    const intervalMs = getTimeframeIntervalMs;
    
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      
      const newCandles = [...prev];
      const lastCandle = newCandles[newCandles.length - 1];
      
      // Calculate current candle boundary based on timeframe interval
      const currentPeriod = Math.floor(now / intervalMs) * intervalMs;
      const lastCandlePeriod = Math.floor(lastCandle.time / intervalMs) * intervalMs;

      // If we're in the same period, update the last candle
      if (currentPeriod === lastCandlePeriod) {
        lastCandle.high = Math.max(lastCandle.high, ask);
        lastCandle.low = Math.min(lastCandle.low, bid);
        lastCandle.close = bid; // Use BID for close (same as Professional mode)
        lastCandle.isUp = lastCandle.close >= lastCandle.open;
      } else {
        // New period, create a new candle
        const previousClose = lastCandle.close;
        const newCandle: Candle = {
          time: currentPeriod,
          open: bid, // Use BID for open (same as Professional mode)
          high: ask,
          low: bid,
          close: bid, // Use BID for close (same as Professional mode)
          isUp: bid >= previousClose,
        };
        
        newCandles.push(newCandle);
        
        // Keep only last N candles based on zoom level
        if (newCandles.length > visibleCandles) {
          newCandles.shift();
        }
      }

      return newCandles;
    });
    // Note: setCandles triggers re-render automatically, no forceUpdate needed
  }, [prices, symbol, candles.length, visibleCandles, getTimeframeIntervalMs]);

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

    // Draw current price line with "NOW" indicator - use LIVE price from PriceProvider
    if (candles.length > 0 && currentPrice) {
      const lastCandle = candles[candles.length - 1];
      // Use BID price for the price line (same as Professional mode)
      const livePrice = currentPrice.bid;
      const yPrice = paddingTop + chartHeight - ((livePrice - minPrice) / priceRange) * chartHeight;
      
      // Determine color based on price direction
      let lineColor = '#6b7280'; // Default gray
      if (candles.length > 1) {
        const prevCandle = candles[candles.length - 2];
        lineColor = livePrice > prevCandle.close ? '#22c55e' : '#ef4444';
      } else {
        lineColor = livePrice >= lastCandle.open ? '#22c55e' : '#ef4444';
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
      
      // Price label on the right - show LIVE price
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = lineColor;
      ctx.fillText(livePrice.toFixed(5), rect.width - paddingRight + 5, yPrice + 4);
      
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
  // Note: Don't include currentPrice in dependencies - price line updates via separate mechanism
  // Canvas redraws only on structural changes (candles, positions, settings)
  }, [candles, hasPositions, totalPnL, symbolPositions, entryPrice, positionSide, visibleCandles, chartType, timeframe]);

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  // Determine if price is going up based on BID price vs candle open (same as Professional mode)
  const isGoingUp = currentPrice && lastCandle 
    ? currentPrice.bid >= lastCandle.open 
    : (lastCandle?.isUp ?? false);

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

        {/* Fun Gaming Header - SAME FORMAT AS PROFESSIONAL MODE */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 border-x-2 border-purple-600">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Star className="size-4 text-yellow-400 animate-spin hidden sm:block" style={{ animationDuration: '3s' }} />
              <span className="text-white font-bold text-xs sm:text-sm">🎮 {symbol}</span>
              {/* WebSocket status indicator */}
              <span className={cn(
                "w-2 h-2 rounded-full ml-1",
                wsConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
              )} title={wsConnected ? "Live" : "Reconnecting..."} />
              <span className="text-[10px] text-white/70">{wsPriceRef.current ? `⚡${wsMessageCount}` : '📡0'}</span>
            </div>
            
            {/* Price display - BID is main price (DIRECT DOM UPDATE for speed!) */}
            {currentPrice && (
              <div className="flex items-center gap-2 md:gap-4 text-xs font-mono">
                <div 
                  ref={priceDisplayRef}
                  className={cn(
                    "font-bold text-sm md:text-base transition-colors",
                    isGoingUp ? "text-green-400" : "text-red-400"
                  )}
                >
                  {currentPrice.bid.toFixed(5)}
                </div>
                <div className="flex items-center gap-1 text-white/60">
                  <span>A:</span>
                  <span className="text-[#f23645]">{currentPrice.ask.toFixed(5)}</span>
                </div>
                <div className="flex items-center gap-1 text-white/60">
                  <span>S:</span>
                  <span className="text-yellow-400">{((currentPrice.ask - currentPrice.bid) * (symbol.includes('JPY') ? 100 : 10000)).toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Price Info Panel - BID is main price (same as Professional mode) */}
      {currentPrice && (
        <div className="bg-gradient-to-r from-dark-200 to-dark-300 border-x-2 md:border-x-4 border-purple-600 p-2 md:p-3">
          <div className="flex items-center justify-between gap-2">
            {/* Main BID Price */}
            <div className="text-center flex-1">
              <p className="text-[10px] text-dark-600">
                BID {wsPriceRef.current ? '⚡' : '📡'}
              </p>
              <div className={cn(
                "text-lg md:text-2xl font-bold font-mono",
                isGoingUp ? "text-green-400" : "text-red-400"
              )}>
                {currentPrice.bid.toFixed(5)}
              </div>
            </div>
            
            {/* ASK */}
            <div className="text-center flex-1">
              <p className="text-[10px] text-dark-600">ASK</p>
              <div className="text-sm md:text-lg font-bold font-mono text-[#f23645]">
                {currentPrice.ask.toFixed(5)}
              </div>
            </div>
            
            {/* Spread */}
            <div className="text-center flex-1">
              <p className="text-[10px] text-dark-600">SPREAD</p>
              <div className="text-sm md:text-lg font-bold font-mono text-yellow-400">
                {((currentPrice.ask - currentPrice.bid) * (symbol.includes('JPY') ? 100 : 10000)).toFixed(1)}p
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
        
        {/* REAL-TIME BID PRICE OVERLAY - Updates independently of canvas */}
        {currentPrice && (
          <div 
            className="absolute right-6 md:right-8 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none"
          >
            <div className={cn(
              "px-2 py-1 rounded text-xs md:text-sm font-bold font-mono shadow-lg animate-pulse",
              isGoingUp ? "bg-green-500 text-white" : "bg-red-500 text-white"
            )}>
              {currentPrice.bid.toFixed(5)}
            </div>
          </div>
        )}
        
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
              <span className="font-bold">💡 How to Read:</span> Each colorful bar is a &quot;candle&quot;! 
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

// Memoize to prevent re-renders when parent re-renders but props haven't changed
const GameChart = memo(GameChartInner, (prevProps, nextProps) => {
  // Only re-render if positions or competitionId changed
  if (prevProps.competitionId !== nextProps.competitionId) return false;
  if (prevProps.positions?.length !== nextProps.positions?.length) return false;
  
  // Check if any position data changed
  const prevIds = prevProps.positions?.map(p => `${p._id}-${p.unrealizedPnl.toFixed(2)}`).join(',') || '';
  const nextIds = nextProps.positions?.map(p => `${p._id}-${p.unrealizedPnl.toFixed(2)}`).join(',') || '';
  return prevIds === nextIds;
});

export default GameChart;

