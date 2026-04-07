"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, security/detect-object-injection */

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";

// Reason: Lightweight Charts is a browser-only library. This component
// must be imported with next/dynamic { ssr: false } in the parent layout.
// The `any` types are necessary because chart instances are created via
// dynamic import() and Lightweight Charts doesn't export usable ref types.

interface EquityChartProps {
  data: { date: string; balance: number; change: number }[];
}

// Reason: Renamed from "Equity Curve" to "Wallet Balance" because this chart
// tracks wallet balance history (from WalletTransaction.balanceAfter), not
// trading equity. Uses ⚡ (Volt) branding to match the credits system.
export default function EquityChart({ data }: EquityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; value: number; change: number } | null>(null);

  const filteredData = useMemo(() => {
    if (!data || data.length < 2) return [];
    if (range === "all") return data;

    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return data.slice(-days);
  }, [data, range]);

  const lastBalance = filteredData[filteredData.length - 1]?.balance ?? 0;
  const firstBalance = filteredData[0]?.balance ?? 0;
  const totalChange = lastBalance - firstBalance;
  const totalChangePct = firstBalance > 0 ? (totalChange / firstBalance) * 100 : 0;
  const isPositive = totalChange >= 0;

  useEffect(() => {
    if (!containerRef.current || filteredData.length < 2) return;

    let chart: any;
    let area: any;

    // Reason: Dynamic import ensures Lightweight Charts doesn't SSR
    import("lightweight-charts").then((mod) => {
      if (!containerRef.current) return;

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      // Reason: Shorter chart on narrow screens to save vertical space
      const chartHeight = containerRef.current.clientWidth < 500 ? 200 : 260;
      chart = mod.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: chartHeight,
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
          scaleMargins: { top: 0.1, bottom: 0.05 },
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

      // Reason: Yellow/amber Volt branding for the wallet balance chart
      const lineColor = isPositive ? "#EAB308" : "#F59E0B";
      const topColor = isPositive ? "rgba(234,179,8,0.25)" : "rgba(245,158,11,0.25)";
      const bottomColor = isPositive ? "rgba(234,179,8,0.02)" : "rgba(245,158,11,0.02)";

      area = chart.addAreaSeries({
        lineColor,
        topColor,
        bottomColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: lineColor,
        crosshairMarkerBorderColor: "#fff",
        crosshairMarkerBorderWidth: 2,
      });

      // Reason: Parse dates to YYYY-MM-DD format for Lightweight Charts time
      const chartData = filteredData.map((d) => {
        const dateStr = d.date.length === 10 ? d.date : d.date.slice(0, 10);
        return { time: dateStr, value: d.balance };
      });

      area.setData(chartData);
      chart.timeScale().fitContent();

      chartRef.current = chart;
      seriesRef.current = area;

      // Crosshair hover handler
      chart.subscribeCrosshairMove((param: any) => {
        if (!param || !param.time || !param.seriesData?.size) {
          setHoveredPoint(null);
          return;
        }
        const val = param.seriesData.get(area);
        if (val) {
          const matchIdx = filteredData.findIndex(
            (d) => d.date.slice(0, 10) === String(param.time)
          );
          setHoveredPoint({
            date: String(param.time),
            value: val.value,
            change: matchIdx >= 0 ? filteredData[matchIdx].change : 0,
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
  }, [filteredData, isPositive]);

  if (!data || data.length < 2) {
    return (
      <motion.div
        className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          ⚡ Wallet Balance
        </h3>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Make a deposit to start tracking your wallet balance
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            ⚡ Wallet Balance
          </h3>
          {hoveredPoint ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-yellow-400" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                {hoveredPoint.value.toFixed(2)} ⚡
              </span>
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  hoveredPoint.change >= 0
                    ? "text-green-400 bg-green-500/10"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {hoveredPoint.change >= 0 ? "+" : ""}{hoveredPoint.change.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-yellow-400" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                {lastBalance.toFixed(2)} ⚡
              </span>
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  isPositive
                    ? "text-green-400 bg-green-500/10"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {isPositive ? "+" : ""}{totalChangePct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-gray-700/40 rounded-lg p-0.5 flex-shrink-0">
          {(["7d", "30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
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
      <div ref={containerRef} className="w-full" style={{ minHeight: 200 }} />
    </motion.div>
  );
}
