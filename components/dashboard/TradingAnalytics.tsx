"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

interface TradingAnalyticsProps {
  winLoss: { wins: number; losses: number; breakeven: number };
  tradesBySymbol: { symbol: string; count: number; pnl: number }[];
  tradesByHour: { hour: number; count: number; pnl: number }[];
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

// Reason: Deterministic color palette for the donut and symbol bars
const SYMBOL_COLORS = [
  "#3B82F6", "#22C55E", "#EAB308", "#A855F7", "#F97316",
  "#06B6D4", "#EC4899", "#10B981", "#F43F5E", "#8B5CF6",
];

function DonutChart({
  wins,
  losses,
  breakeven,
}: {
  wins: number;
  losses: number;
  breakeven: number;
}) {
  const total = wins + losses + breakeven || 1;
  const segments = [
    { value: wins, color: "#22C55E", label: "Wins" },
    { value: losses, color: "#EF4444", label: "Losses" },
    { value: breakeven, color: "#6B7280", label: "Breakeven" },
  ];

  const radius = 50;
  const strokeWidth = 14;
  const normalRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalRadius;

  let accumulated = 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={120} height={120} viewBox="0 0 100 100" className="-rotate-90">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = circumference * pct;
          const offset = circumference * accumulated;
          accumulated += pct;

          return (
            <motion.circle
              key={seg.label}
              cx={50}
              cy={50}
              r={normalRadius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
            />
          );
        })}
      </svg>
      {/* Center label */}
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-white font-[var(--font-geist-mono)]">
          {total}
        </span>
        <span className="text-[11px] text-gray-500 uppercase">trades</span>
      </div>
    </div>
  );
}

export default function TradingAnalytics({
  winLoss,
  tradesBySymbol,
  tradesByHour,
  totalTrades,
  winningTrades,
  losingTrades,
}: TradingAnalyticsProps) {
  const [tab, setTab] = useState<"symbols" | "hours">("symbols");

  // Sort symbols by trade count descending
  const topSymbols = useMemo(
    () => [...tradesBySymbol].sort((a, b) => b.count - a.count).slice(0, 8),
    [tradesBySymbol]
  );

  const maxCount = useMemo(
    () => Math.max(...topSymbols.map((s) => s.count), 1),
    [topSymbols]
  );

  // Trades by hour for heatmap-style bars
  const maxHour = useMemo(
    () => Math.max(...tradesByHour.map((h) => h.count), 1),
    [tradesByHour]
  );

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        🎯 Trading Analytics
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Win/Loss Donut */}
        <div className="flex flex-col items-center gap-3">
          <DonutChart
            wins={winLoss.wins}
            losses={winLoss.losses}
            breakeven={winLoss.breakeven}
          />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-400">{winLoss.wins}W</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-400">{winLoss.losses}L</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-gray-400">{winLoss.breakeven}B</span>
            </span>
          </div>
        </div>

        {/* Symbol / Hour tabs */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={() => setTab("symbols")}
              className={`px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                tab === "symbols"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Top Symbols
            </button>
            <button
              onClick={() => setTab("hours")}
              className={`px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                tab === "hours"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              By Hour
            </button>
          </div>

          {tab === "symbols" ? (
            <div className="space-y-2">
              {topSymbols.map((sym, i) => {
                const color = SYMBOL_COLORS[i % SYMBOL_COLORS.length];
                const pct = (sym.count / maxCount) * 100;
                const isProfitable = sym.pnl >= 0;

                return (
                  <motion.div
                    key={sym.symbol}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <span className="text-xs text-gray-300 w-16 truncate font-[var(--font-geist-mono)]">
                      {sym.symbol}
                    </span>
                    <div className="flex-1 h-4 rounded-full bg-gray-700/40 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 3)}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-400 w-8 text-right">
                      {sym.count}
                    </span>
                    <span
                      className={`text-[11px] font-medium w-14 text-right ${
                        isProfitable ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isProfitable ? "+" : ""}${sym.pnl.toFixed(0)}
                    </span>
                  </motion.div>
                );
              })}
              {topSymbols.length === 0 && (
                <div className="text-xs text-gray-500 text-center py-4">
                  No trades by symbol yet
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-end gap-0.5 h-28">
              {tradesByHour.map((h, i) => {
                const barPct = (h.count / maxHour) * 100;
                const isActive = h.count > 0;
                return (
                  <motion.div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <motion.div
                      className="w-full rounded-t transition-all"
                      style={{
                        background: isActive
                          ? `linear-gradient(to top, #A855F7, #C084FC)`
                          : "rgba(255,255,255,0.03)",
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(barPct, 2)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.02 }}
                    />
                    {i % 4 === 0 && (
                      <span className="text-[10px] text-gray-600 mt-1">
                        {String(h.hour).padStart(2, "0")}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
