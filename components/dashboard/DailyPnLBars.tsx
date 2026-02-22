"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";

// Reason: Lightweight Charts is a browser-only library. This component
// must be imported with next/dynamic { ssr: false } in the parent layout.

interface DailyPnLChartProps {
  data: { date: string; pnl: number; trades: number }[];
}

export default function DailyPnLChart({ data }: DailyPnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    pnl: number;
    trades: number;
  } | null>(null);

  // Reason: Sort oldest→newest, limit by selected range
  const filteredData = useMemo(() => {
    if (!data || data.length < 1) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    if (range === "all") return sorted;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return sorted.slice(-days);
  }, [data, range]);

  const totalPnL = useMemo(
    () => filteredData.reduce((s, d) => s + d.pnl, 0),
    [filteredData]
  );
  const profitDays = useMemo(
    () => filteredData.filter((d) => d.pnl > 0).length,
    [filteredData]
  );
  const lossDays = useMemo(
    () => filteredData.filter((d) => d.pnl < 0).length,
    [filteredData]
  );

  useEffect(() => {
    if (!containerRef.current || filteredData.length < 1) return;

    let chart: any;
    let histogram: any;

    // Reason: Dynamic import ensures Lightweight Charts doesn't SSR
    import("lightweight-charts").then((mod) => {
      if (!containerRef.current) return;

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      chart = mod.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 220,
        layout: {
          background: { color: "transparent" },
          textColor: "#6B7280",
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderVisible: false,
          timeVisible: false,
        },
        crosshair: {
          vertLine: { color: "rgba(255,255,255,0.15)", width: 1, style: 3 },
          horzLine: { color: "rgba(255,255,255,0.15)", width: 1, style: 3 },
        },
        handleScroll: { mouseWheel: false, pressedMouseMove: false },
        handleScale: { mouseWheel: false, pinch: false },
      });

      histogram = chart.addHistogramSeries({
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        priceScaleId: "right",
      });

      // Reason: Each bar gets its own color — green for profit, red for loss
      const chartData = filteredData.map((d) => {
        const dateStr = d.date.length === 10 ? d.date : d.date.slice(0, 10);
        return {
          time: dateStr,
          value: d.pnl,
          color:
            d.pnl >= 0
              ? "rgba(34, 197, 94, 0.85)"
              : "rgba(239, 68, 68, 0.85)",
        };
      });

      histogram.setData(chartData);
      chart.timeScale().fitContent();

      chartRef.current = chart;
      seriesRef.current = histogram;

      // Crosshair hover handler
      chart.subscribeCrosshairMove((param: any) => {
        if (!param || !param.time || !param.seriesData?.size) {
          setHoveredPoint(null);
          return;
        }
        const val = param.seriesData.get(histogram);
        if (val) {
          const matchIdx = filteredData.findIndex(
            (d) => d.date.slice(0, 10) === String(param.time)
          );
          setHoveredPoint({
            date: String(param.time),
            pnl: val.value,
            trades: matchIdx >= 0 ? filteredData[matchIdx].trades : 0,
          });
        }
      });

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        chart.remove();
      };
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [filteredData]);

  if (!data || data.length === 0) {
    return (
      <motion.div
        className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          📊 Daily P&L
        </h3>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Start trading to see your daily P&L
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            📊 Daily P&L
          </h3>
          {hoveredPoint ? (
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-lg font-bold font-[var(--font-geist-mono)] ${
                  hoveredPoint.pnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {hoveredPoint.pnl >= 0 ? "+" : ""}${hoveredPoint.pnl.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500 font-[var(--font-geist-mono)]">
                {hoveredPoint.trades} trades
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-lg font-bold font-[var(--font-geist-mono)] ${
                  totalPnL >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500">
                <span className="text-green-400">▲{profitDays}d</span>
                {" "}
                <span className="text-red-400">▼{lossDays}d</span>
              </span>
            </div>
          )}
        </div>

        {/* Range selector — same style as equity chart */}
        <div className="flex items-center gap-1 bg-gray-700/40 rounded-lg p-0.5">
          {(["7d", "30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                range === r
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {r === "all" ? "All" : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="w-full" style={{ minHeight: 220 }} />
    </motion.div>
  );
}
