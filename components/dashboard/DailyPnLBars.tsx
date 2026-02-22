"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface DailyPnLBarsProps {
  data: { date: string; pnl: number; trades: number }[];
}

export default function DailyPnLBars({ data }: DailyPnLBarsProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Reason: Show max 30 days, sorted by date, newest first visually (right)
  const displayData = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-30);
  }, [data]);

  const maxAbs = useMemo(
    () => Math.max(...displayData.map((d) => Math.abs(d.pnl)), 1),
    [displayData]
  );

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
        <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
          No trading data yet
        </div>
      </motion.div>
    );
  }

  const totalPnL = displayData.reduce((s, d) => s + d.pnl, 0);
  const profitDays = displayData.filter((d) => d.pnl > 0).length;
  const lossDays = displayData.filter((d) => d.pnl < 0).length;

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          📊 Daily P&L
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">▲ {profitDays}d</span>
          <span className="text-red-400">▼ {lossDays}d</span>
          <span className={`font-semibold ${totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Bars container */}
      <div className="relative h-36">
        {/* Zero line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-600/40" />

        {/* Bars */}
        <div className="flex items-center h-full gap-px relative">
          {displayData.map((d, i) => {
            const isProfit = d.pnl >= 0;
            const barPct = (Math.abs(d.pnl) / maxAbs) * 48; // 48% max from center
            const isHovered = hoveredIdx === i;

            return (
              <div
                key={d.date}
                className="flex-1 relative h-full flex items-center justify-center cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Bar */}
                <motion.div
                  className="w-full relative rounded-sm"
                  style={{
                    position: "absolute",
                    ...(isProfit
                      ? { bottom: "50%", background: "linear-gradient(to top, #22C55E, #4ADE80)" }
                      : { top: "50%", background: "linear-gradient(to bottom, #EF4444, #F87171)" }),
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(barPct, 1)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.02 }}
                >
                  {isHovered && (
                    <div className="absolute inset-0 bg-white/20 rounded-sm" />
                  )}
                </motion.div>

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap pointer-events-none">
                    <div className="text-[10px] text-gray-400">{d.date}</div>
                    <div
                      className={`text-sm font-bold font-[var(--font-geist-mono)] ${
                        isProfit ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isProfit ? "+" : ""}${d.pnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-500">{d.trades} trades</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
