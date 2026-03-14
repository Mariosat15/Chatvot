"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DayData {
  date: string;
  deposits: number;
  wins: number;
  gmEarnings: number;
  refunds: number;
  entries: number;
  withdrawals: number;
  marketplace: number;
  other: number;
}

interface CreditBreakdownChartProps {
  data: DayData[];
}

// Reason: Categorized stacked bar chart showing daily income (green) vs spending (red)
// so the user can visually see where credits come from and where they go.
export default function CreditBreakdownChart({ data }: CreditBreakdownChartProps) {
  const [range, setRange] = useState<"7d" | "30d">("30d");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!data || data.length < 1) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const days = range === "7d" ? 7 : 30;
    return sorted.slice(-days);
  }, [data, range]);

  // Totals for summary header
  const totals = useMemo(() => {
    const t = {
      deposits: 0, wins: 0, gmEarnings: 0, refunds: 0,
      entries: 0, withdrawals: 0, marketplace: 0, other: 0,
    };
    for (const d of filtered) {
      t.deposits += d.deposits;
      t.wins += d.wins;
      t.gmEarnings += d.gmEarnings;
      t.refunds += d.refunds;
      t.entries += d.entries;
      t.withdrawals += d.withdrawals;
      t.marketplace += d.marketplace;
      t.other += d.other;
    }
    return t;
  }, [filtered]);

  const totalIncome = totals.deposits + totals.wins + totals.gmEarnings + totals.refunds;
  const totalSpending = totals.entries + totals.withdrawals + totals.marketplace + totals.other;
  const totalNet = totalIncome - totalSpending;

  // Max bar height for scaling
  const maxBar = useMemo(() => {
    let max = 1;
    for (const d of filtered) {
      const income = d.deposits + d.wins + d.gmEarnings + d.refunds;
      const spending = d.entries + d.withdrawals + d.marketplace + d.other;
      max = Math.max(max, income, spending);
    }
    return max;
  }, [filtered]);

  const barHeight = 160; // px

  if (!data || data.length === 0) {
    return (
      <motion.div
        className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          📊 Credit Breakdown
        </h3>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Your credit breakdown will appear here
        </div>
      </motion.div>
    );
  }

  const hovered = hoveredIdx !== null ? filtered[hoveredIdx] : null;

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            📊 Credit Breakdown
          </h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span
              className={`text-lg font-bold ${totalNet >= 0 ? "text-yellow-400" : "text-red-400"}`}
              style={{ fontFamily: "var(--font-geist-mono), monospace" }}
            >
              {totalNet >= 0 ? "+" : ""}{totalNet.toFixed(2)} ⚡
            </span>
            <span className="text-xs text-gray-500">
              <span className="text-green-400">↑{totalIncome.toFixed(0)}</span>{" "}
              <span className="text-red-400">↓{totalSpending.toFixed(0)}</span>
            </span>
          </div>
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

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Deposits</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Wins</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> GM Earnings</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Refunds</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Entries</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Withdrawals</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" /> Marketplace</span>
      </div>

      {/* Bar chart area */}
      <div className="relative" style={{ height: barHeight + 40 }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-500 font-[var(--font-geist-mono)] w-8">
          <span>{maxBar.toFixed(0)}</span>
          <span>{(maxBar / 2).toFixed(0)}</span>
          <span>0</span>
        </div>

        {/* Bars */}
        <div className="ml-9 flex items-end gap-[2px] h-full pb-5" style={{ height: barHeight }}>
          {filtered.map((day, idx) => {
            const income = day.deposits + day.wins + day.gmEarnings + day.refunds;
            const spending = day.entries + day.withdrawals + day.marketplace + day.other;
            const incomeH = maxBar > 0 ? (income / maxBar) * barHeight : 0;
            const spendingH = maxBar > 0 ? (spending / maxBar) * barHeight : 0;
            const barW = Math.max(100 / filtered.length - 1, 2);

            return (
              <div
                key={day.date}
                className="relative flex flex-col items-center cursor-pointer group"
                style={{ flex: `0 0 ${barW}%`, minWidth: 4 }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Income bar (green, stacked) */}
                <div
                  className="w-full rounded-t-sm transition-all duration-200"
                  style={{
                    height: incomeH,
                    background: `linear-gradient(to top, #22c55e, #86efac)`,
                    opacity: hoveredIdx !== null && hoveredIdx !== idx ? 0.4 : 1,
                  }}
                />
                {/* Spending bar (red, beside income) */}
                <div
                  className="w-full rounded-t-sm transition-all duration-200 -mt-px"
                  style={{
                    height: spendingH,
                    background: `linear-gradient(to top, #ef4444, #fca5a5)`,
                    opacity: hoveredIdx !== null && hoveredIdx !== idx ? 0.4 : 1,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Date labels */}
        <div className="ml-9 flex justify-between text-[9px] text-gray-600 mt-1">
          {filtered.length > 0 && (
            <>
              <span>{formatShortDate(filtered[0].date)}</span>
              {filtered.length > 7 && (
                <span>{formatShortDate(filtered[Math.floor(filtered.length / 2)].date)}</span>
              )}
              <span>{formatShortDate(filtered[filtered.length - 1].date)}</span>
            </>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <motion.div
          className="mt-3 bg-gray-900/90 rounded-lg border border-gray-700/50 p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <p className="text-xs text-gray-400 font-medium mb-2">
            {new Date(hovered.date + "T00:00:00").toLocaleDateString("en-GB", {
              weekday: "short", day: "numeric", month: "short",
            })}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div className="text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              Deposits: <span className="text-green-400 font-medium">{hovered.deposits.toFixed(2)}</span>
            </div>
            <div className="text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />
              Entries: <span className="text-red-400 font-medium">{hovered.entries.toFixed(2)}</span>
            </div>
            <div className="text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1.5" />
              Wins: <span className="text-yellow-400 font-medium">{hovered.wins.toFixed(2)}</span>
            </div>
            <div className="text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1.5" />
              Withdrawals: <span className="text-orange-400 font-medium">{hovered.withdrawals.toFixed(2)}</span>
            </div>
            <div className="text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-400 mr-1.5" />
              GM: <span className="text-purple-400 font-medium">{hovered.gmEarnings.toFixed(2)}</span>
            </div>
            <div className="text-gray-400">
              <span className="inline-block w-2 h-2 rounded-full bg-pink-400 mr-1.5" />
              Marketplace: <span className="text-pink-400 font-medium">{hovered.marketplace.toFixed(2)}</span>
            </div>
            {hovered.refunds > 0 && (
              <div className="text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5" />
                Refunds: <span className="text-blue-400 font-medium">{hovered.refunds.toFixed(2)}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Summary totals */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryChip label="Deposits" value={totals.deposits} color="text-green-400" />
        <SummaryChip label="Wins" value={totals.wins} color="text-yellow-400" />
        <SummaryChip label="Entries" value={totals.entries} color="text-red-400" />
        <SummaryChip label="Withdrawals" value={totals.withdrawals} color="text-orange-400" />
        {totals.gmEarnings > 0 && (
          <SummaryChip label="GM Earnings" value={totals.gmEarnings} color="text-purple-400" />
        )}
        {totals.marketplace > 0 && (
          <SummaryChip label="Marketplace" value={totals.marketplace} color="text-pink-400" />
        )}
      </div>
    </motion.div>
  );
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${color}`} style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        {value.toFixed(2)}
      </p>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
