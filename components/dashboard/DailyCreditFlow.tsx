"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, security/detect-object-injection */

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";

// Reason: Lightweight Charts is a browser-only library. This component
// must be imported with next/dynamic { ssr: false } in the parent layout.
// The `any` types are necessary because chart instances are created via
// dynamic import() and Lightweight Charts doesn't export usable ref types.

interface DailyCreditFlowProps {
  data: {
    date: string;
    inflow: number;
    outflow: number;
    net: number;
    transactions: number;
  }[];
}

// Reason: Replaces "Daily P&L" with a more relevant credit flow visualization.
// Shows daily inflows (deposits, wins, refunds, GM earnings) vs outflows
// (entries, withdrawals, marketplace purchases) as a stacked histogram.
export default function DailyCreditFlow({ data }: DailyCreditFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [range, setRange] = useState<"7d" | "30d">("30d");
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    inflow: number;
    outflow: number;
    net: number;
    transactions: number;
  } | null>(null);

  // Sort oldest→newest, limit by selected range
  const filteredData = useMemo(() => {
    if (!data || data.length < 1) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const days = range === "7d" ? 7 : 30;
    return sorted.slice(-days);
  }, [data, range]);

  const totalNet = useMemo(
    () => filteredData.reduce((s, d) => s + d.net, 0),
    [filteredData],
  );
  const totalInflow = useMemo(
    () => filteredData.reduce((s, d) => s + d.inflow, 0),
    [filteredData],
  );
  const totalOutflow = useMemo(
    () => filteredData.reduce((s, d) => s + d.outflow, 0),
    [filteredData],
  );

  useEffect(() => {
    if (!containerRef.current || filteredData.length < 1) return;

    let chart: any;
    let netSeries: any;

    // Dynamic import ensures Lightweight Charts doesn't SSR
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

      // Net credit flow as a histogram — green bars for positive (inflow > outflow),
      // red bars for negative (outflow > inflow)
      netSeries = chart.addHistogramSeries({
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        priceScaleId: "right",
      });

      const chartData = filteredData.map((d) => {
        const dateStr = d.date.length === 10 ? d.date : d.date.slice(0, 10);
        return {
          time: dateStr,
          value: d.net,
          color:
            d.net >= 0
              ? "rgba(250, 204, 21, 0.85)" // yellow for positive net (on-brand ⚡)
              : "rgba(239, 68, 68, 0.75)", // red for negative net
        };
      });

      netSeries.setData(chartData);
      chart.timeScale().fitContent();

      chartRef.current = chart;

      // Crosshair hover handler
      chart.subscribeCrosshairMove((param: any) => {
        if (!param || !param.time || !param.seriesData?.size) {
          setHoveredPoint(null);
          return;
        }
        const val = param.seriesData.get(netSeries);
        if (val) {
          const matchIdx = filteredData.findIndex(
            (d) => d.date.slice(0, 10) === String(param.time),
          );
          if (matchIdx >= 0) {
            setHoveredPoint(filteredData[matchIdx]);
          }
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
          💰 Daily Credit Flow
        </h3>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Your credit activity will appear here
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
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            💰 Daily Credit Flow
          </h3>
          {hoveredPoint ? (
            <div className="mt-1">
              <span
                className={`text-lg font-bold ${
                  hoveredPoint.net >= 0 ? "text-yellow-400" : "text-red-400"
                }`}
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {hoveredPoint.net >= 0 ? "+" : ""}
                {hoveredPoint.net.toFixed(2)} ⚡
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-green-400/80">
                  ↑ {hoveredPoint.inflow.toFixed(0)}
                </span>
                <span className="text-[10px] text-red-400/80">
                  ↓ {hoveredPoint.outflow.toFixed(0)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {hoveredPoint.transactions} txns
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <span
                className={`text-lg font-bold ${
                  totalNet >= 0 ? "text-yellow-400" : "text-red-400"
                }`}
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {totalNet >= 0 ? "+" : ""}
                {totalNet.toFixed(2)} ⚡
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-green-400/80">
                  ↑ {totalInflow.toFixed(0)}
                </span>
                <span className="text-[10px] text-red-400/80">
                  ↓ {totalOutflow.toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-gray-700/40 rounded-lg p-0.5">
          {(["7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                range === r
                  ? "bg-gray-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="w-full" style={{ minHeight: 220 }} />
    </motion.div>
  );
}
