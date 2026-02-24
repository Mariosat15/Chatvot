'use client';
// ─── BroadcastChart — lightweight-charts with Trade Bubble Overlay ────────────
import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { CandleData, BubbleTrade } from './types';
import { CV, ARENA_SYMS, ARENA_TFS } from './constants';

interface BroadcastChartProps {
  symbol: string;
  tf: string;
  candles: CandleData[];
  bubbles: BubbleTrade[];
  onSymbolChange: (sym: string) => void;
  onTfChange: (tf: string) => void;
}

const BroadcastChart: React.FC<BroadcastChartProps> = ({ symbol, tf, candles, bubbles, onSymbolChange, onTfChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);

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

  // Update data
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const data = candles.map(c => ({ time: c.time as number, value: c.close }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Bubble overlay (RAF)
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

      // Label
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
        <div style={{ display: 'flex', gap: 4 }}>
          {ARENA_SYMS.map(s => (
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
