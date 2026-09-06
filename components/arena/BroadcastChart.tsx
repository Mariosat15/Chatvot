'use client';
// ─── BroadcastChart — lightweight-charts with Position Markers & Dynamic Symbols ──
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { CandleData, BubbleTrade, OpenPos } from './types';
import { CV, ARENA_TFS } from './constants';

interface BroadcastChartProps {
  symbol: string;
  tf: string;
  candles: CandleData[];
  bubbles: BubbleTrade[];
  /** All open positions (from all participants) */
  positions?: OpenPos[];
  /** Dynamic symbols from API — overrides ARENA_SYMS when provided */
  dynamicSymbols?: string[];
  onSymbolChange: (sym: string) => void;
  onTfChange: (tf: string) => void;
}

// Reason: Convert slash format "EUR/USD" to compact "EURUSD" for internal keys
const toKey = (s: string) => s.replace('/', '');
// Reason: Convert compact "EURUSD" to display "EUR/USD"
const toLabel = (s: string) =>
  s.includes('/') ? s : s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;

const BroadcastChart: React.FC<BroadcastChartProps> = ({
  symbol, tf, candles, bubbles, positions, dynamicSymbols,
  onSymbolChange, onTfChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLinesRef = useRef<any[]>([]);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);

  // Reason: Build dynamic symbol buttons from API symbols or fallback to defaults
  const symbolButtons = useMemo(() => {
    if (dynamicSymbols && dynamicSymbols.length > 0) {
      return dynamicSymbols.map(s => ({
        key: toKey(s),
        label: toLabel(s),
      }));
    }
    // Fallback — only forex pairs we know exist
    return [
      { label: 'EUR/USD', key: 'EURUSD' }, { label: 'GBP/USD', key: 'GBPUSD' },
      { label: 'USD/JPY', key: 'USDJPY' }, { label: 'USD/CAD', key: 'USDCAD' },
      { label: 'AUD/USD', key: 'AUDUSD' }, { label: 'NZD/USD', key: 'NZDUSD' },
    ];
  }, [dynamicSymbols]);

  // Reason: Filter positions to only those matching the current chart symbol
  const symbolPositions = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    const symSlash = toLabel(symbol);
    return positions.filter(p =>
      p.symbol === symSlash || p.symbol === symbol || toKey(p.symbol) === symbol
    );
  }, [positions, symbol]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import('lightweight-charts').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const chart = mod.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 340,
        layout: { background: { color: CV.bg1 }, textColor: CV.gray, fontSize: 11 },
        grid: {
          vertLines: { color: `${CV.bd0}80` },
          horzLines: { color: `${CV.bd0}80` },
        },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: CV.bd1 },
        timeScale: { borderColor: CV.bd1, timeVisible: true, secondsVisible: false },
      });

      const series = chart.addAreaSeries({
        lineColor: CV.teal,
        topColor: `${CV.teal}30`,
        bottomColor: 'transparent',
        lineWidth: 2,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      setLoaded(true);

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.resize(containerRef.current.clientWidth, 340);
        }
      });
      ro.observe(containerRef.current);

      return () => { ro.disconnect(); };
    });

    return () => {
      cancelled = true;
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, []);

  // Update candle data
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const data = candles.map(c => ({ time: c.time as number, value: c.close }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Reason: Draw position price lines on the chart for each user's open position
  // matching the current symbol. This lets viewers see WHERE traders entered.
  useEffect(() => {
    if (!seriesRef.current || !loaded) return;

    // Remove old price lines
    for (const line of priceLinesRef.current) {
      try { seriesRef.current.removePriceLine(line); } catch { /* safe */ }
    }
    priceLinesRef.current = [];

    // Add new price lines for matching positions
    for (const pos of symbolPositions) {
      if (!pos.entryPrice || pos.entryPrice <= 0) continue;

      const isLong = pos.side === 'long';
      const color = isLong ? CV.teal : CV.red;
      const label = `${isLong ? '▲' : '▼'} ${(pos.username || 'Trader').slice(0, 8)} @ ${pos.entryPrice.toFixed(5)}`;

      try {
        const line = seriesRef.current.createPriceLine({
          price: pos.entryPrice,
          color: color,
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: label,
        });
        priceLinesRef.current.push(line);
      } catch { /* series might not be ready */ }
    }
  }, [symbolPositions, loaded, candles]);

  // Bubble overlay (RAF) — for general trade activity
  const drawBubbles = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    bubbles.forEach((b, i) => {
      const x = (i / Math.max(bubbles.length, 1)) * canvas.offsetWidth * 0.8 + canvas.offsetWidth * 0.1;
      const y = canvas.offsetHeight * (b.side === 'long' ? 0.3 : 0.7) + (Math.random() - 0.5) * 40;
      const r = Math.min(20, Math.max(6, b.size * 3));

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = b.pnl >= 0 ? `${CV.teal}60` : `${CV.red}60`;
      ctx.fill();
      ctx.strokeStyle = b.pnl >= 0 ? CV.teal : CV.red;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = CV.lgt;
      ctx.textAlign = 'center';
      ctx.fillText(b.user.slice(0, 6), x, y - r - 4);
    });

    rafRef.current = requestAnimationFrame(drawBubbles);
  }, [bubbles]);

  useEffect(() => {
    if (loaded && bubbles.length > 0) {
      rafRef.current = requestAnimationFrame(drawBubbles);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [loaded, bubbles, drawBubbles]);

  return (
    <div style={{
      background: CV.bg2, borderRadius: 16, border: `1px solid ${CV.bd1}`,
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: `1px solid ${CV.bd0}`,
      }}>
        {/* Symbol buttons — dynamic from API */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {symbolButtons.map(s => (
            <button
              key={s.key}
              onClick={() => onSymbolChange(s.key)}
              style={{
                background: symbol === s.key ? `${CV.teal}20` : 'transparent',
                border: `1px solid ${symbol === s.key ? CV.teal : CV.bd1}`,
                color: symbol === s.key ? CV.teal : CV.gray,
                padding: '3px 10px', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {ARENA_TFS.map(t => (
            <button
              key={t.value}
              onClick={() => onTfChange(t.value)}
              style={{
                background: tf === t.value ? `${CV.blue}20` : 'transparent',
                border: `1px solid ${tf === t.value ? CV.blue : CV.bd1}`,
                color: tf === t.value ? CV.blue : CV.gray,
                padding: '3px 8px', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Position markers legend */}
      {symbolPositions.length > 0 && (
        <div style={{
          padding: '6px 16px', borderBottom: `1px solid ${CV.bd0}`,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ color: CV.gray, fontSize: 9, fontWeight: 600, letterSpacing: .5 }}>
            📍 OPEN POSITIONS ({symbolPositions.length})
          </span>
          {symbolPositions.slice(0, 6).map((pos, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 600,
              color: pos.side === 'long' ? CV.teal : CV.red,
              padding: '1px 6px', borderRadius: 4,
              background: pos.side === 'long' ? `${CV.teal}10` : `${CV.red}10`,
              border: `1px solid ${pos.side === 'long' ? CV.teal : CV.red}20`,
              fontFamily: '"SF Mono", Consolas, monospace',
            }}>
              {pos.side === 'long' ? '▲' : '▼'} {(pos.username || 'Trader').slice(0, 8)} @ {pos.entryPrice.toFixed(5)}
            </span>
          ))}
          {symbolPositions.length > 6 && (
            <span style={{ color: CV.gray, fontSize: 9 }}>+{symbolPositions.length - 6} more</span>
          )}
        </div>
      )}

      {/* Chart area */}
      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 340 }} />
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};

export default BroadcastChart;
