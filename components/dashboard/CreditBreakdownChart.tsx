"use client";
/* eslint-disable */

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";

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

const INCOME_CATEGORIES = [
  { key: "deposits", label: "Deposits", color: "#22c55e" },
  { key: "wins", label: "Wins", color: "#facc15" },
  { key: "gmEarnings", label: "GM Earnings", color: "#a78bfa" },
  { key: "refunds", label: "Refunds", color: "#60a5fa" },
] as const;

const SPENDING_CATEGORIES = [
  { key: "entries", label: "Entries", color: "#ef4444" },
  { key: "withdrawals", label: "Withdrawals", color: "#fb923c" },
  { key: "marketplace", label: "Marketplace", color: "#f472b6" },
] as const;

// Reason: Paired side-by-side bar chart showing daily income (green) vs spending (red)
// with proper spacing so bars never overlay numbers or axis labels.
export default function CreditBreakdownChart({ data }: CreditBreakdownChartProps) {
  const [range, setRange] = useState<"7d" | "30d">("30d");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!data || data.length < 1) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const days = range === "7d" ? 7 : 30;
    return sorted.slice(-days);
  }, [data, range]);

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

  // Calculate max value for Y-axis scaling
  const maxBar = useMemo(() => {
    let max = 1;
    for (const d of filtered) {
      const income = d.deposits + d.wins + d.gmEarnings + d.refunds;
      const spending = d.entries + d.withdrawals + d.marketplace + d.other;
      max = Math.max(max, income, spending);
    }
    return max;
  }, [filtered]);

  // Compute nice Y-axis ticks
  const yTicks = useMemo(() => {
    const niceMax = niceNum(maxBar, true);
    const step = niceNum(niceMax / 4, false);
    const ticks: number[] = [];
    for (let v = 0; v <= niceMax; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    if (ticks[ticks.length - 1] < maxBar) {
      ticks.push(ticks[ticks.length - 1] + step);
    }
    return ticks;
  }, [maxBar]);

  const yMax = yTicks[yTicks.length - 1] || 1;

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
  const chartHeight = 200;

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
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[10px]">
        {INCOME_CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
            {c.label}
          </span>
        ))}
        {SPENDING_CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
            {c.label}
          </span>
        ))}
      </div>

      {/* SVG Chart */}
      <div ref={chartRef} className="relative" onMouseLeave={() => setHoveredIdx(null)}>
        <svg
          width="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
        >
          {/* Grid lines and Y-axis labels */}
          {yTicks.map((tick) => {
            const y = CHART_TOP + chartHeight - (tick / yMax) * chartHeight;
            return (
              <g key={tick}>
                <line x1={Y_AXIS_W} y1={y} x2={SVG_W - PAD_R} y2={y} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
                <text x={Y_AXIS_W - 4} y={y + 3} textAnchor="end" fill="#6b7280" fontSize="9" fontFamily="var(--font-geist-mono), monospace">
                  {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {filtered.map((day, idx) => {
            const income = day.deposits + day.wins + day.gmEarnings + day.refunds;
            const spending = day.entries + day.withdrawals + day.marketplace + day.other;
            const groupW = (SVG_W - Y_AXIS_W - PAD_R) / filtered.length;
            const barW = Math.max(groupW * 0.35, 3);
            const gap = Math.max(groupW * 0.06, 1);
            const groupX = Y_AXIS_W + idx * groupW + (groupW - barW * 2 - gap) / 2;
            const isHovered = hoveredIdx === idx;
            const dimmed = hoveredIdx !== null && !isHovered;

            // Income bar (stacked segments)
            const incomeH = yMax > 0 ? (income / yMax) * chartHeight : 0;
            const incomeY = CHART_TOP + chartHeight - incomeH;
            // Spending bar
            const spendingH = yMax > 0 ? (spending / yMax) * chartHeight : 0;
            const spendingY = CHART_TOP + chartHeight - spendingH;

            return (
              <g
                key={day.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                className="cursor-pointer"
                opacity={dimmed ? 0.35 : 1}
              >
                {/* Hover background */}
                {isHovered && (
                  <rect
                    x={Y_AXIS_W + idx * groupW}
                    y={CHART_TOP}
                    width={groupW}
                    height={chartHeight}
                    fill="white"
                    opacity="0.03"
                    rx="2"
                  />
                )}

                {/* Income stacked bar */}
                {incomeH > 0 && renderStackedBar(day, "income", groupX, incomeY, barW, incomeH, chartHeight, yMax)}

                {/* Spending stacked bar */}
                {spendingH > 0 && renderStackedBar(day, "spending", groupX + barW + gap, spendingY, barW, spendingH, chartHeight, yMax)}
              </g>
            );
          })}

          {/* X-axis date labels */}
          {filtered.map((day, idx) => {
            const groupW = (SVG_W - Y_AXIS_W - PAD_R) / filtered.length;
            const centerX = Y_AXIS_W + idx * groupW + groupW / 2;
            // Only show every Nth label to avoid overlap
            const showEvery = filtered.length <= 7 ? 1 : filtered.length <= 15 ? 2 : 5;
            if (idx % showEvery !== 0 && idx !== filtered.length - 1) return null;
            return (
              <text
                key={day.date}
                x={centerX}
                y={SVG_H - 2}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="8"
                fontFamily="var(--font-geist-mono), monospace"
              >
                {formatShortDate(day.date)}
              </text>
            );
          })}

          {/* Baseline */}
          <line x1={Y_AXIS_W} y1={CHART_TOP + chartHeight} x2={SVG_W - PAD_R} y2={CHART_TOP + chartHeight} stroke="#4b5563" strokeWidth="0.5" />
        </svg>
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
            {INCOME_CATEGORIES.map((c) => {
              const val = (hovered as any)[c.key];
              if (!val || val === 0) return null;
              return (
                <div key={c.key} className="text-gray-400">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: c.color }} />
                  {c.label}: <span className="font-medium" style={{ color: c.color }}>{val.toFixed(2)}</span>
                </div>
              );
            })}
            {SPENDING_CATEGORIES.map((c) => {
              const val = (hovered as any)[c.key];
              if (!val || val === 0) return null;
              return (
                <div key={c.key} className="text-gray-400">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: c.color }} />
                  {c.label}: <span className="font-medium" style={{ color: c.color }}>{val.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Summary totals */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <SummaryChip label="Deposits" value={totals.deposits} color="#22c55e" />
        <SummaryChip label="Wins" value={totals.wins} color="#facc15" />
        <SummaryChip label="Entries" value={totals.entries} color="#ef4444" />
        <SummaryChip label="Withdrawals" value={totals.withdrawals} color="#fb923c" />
        <SummaryChip label="Marketplace" value={totals.marketplace} color="#f472b6" />
      </div>
    </motion.div>
  );
}

// ─── SVG Layout Constants ───────────────────────────────────────────
const SVG_W = 600;
const SVG_H = 260;
const Y_AXIS_W = 45;
const PAD_R = 10;
const CHART_TOP = 10;

// ─── Helpers ────────────────────────────────────────────────────────

function renderStackedBar(
  day: DayData,
  type: "income" | "spending",
  x: number,
  _y: number,
  w: number,
  totalH: number,
  chartHeight: number,
  yMax: number,
) {
  const categories = type === "income" ? INCOME_CATEGORIES : SPENDING_CATEGORIES;
  const segments: { key: string; value: number; color: string }[] = [];
  for (const c of categories) {
    const val = (day as any)[c.key];
    if (val > 0) segments.push({ key: c.key, value: val, color: c.color });
  }

  // Build from bottom up
  let offsetY = CHART_TOP + chartHeight;
  return segments.map((seg) => {
    const segH = yMax > 0 ? (seg.value / yMax) * chartHeight : 0;
    offsetY -= segH;
    return (
      <rect
        key={`${type}-${seg.key}`}
        x={x}
        y={offsetY}
        width={w}
        height={Math.max(segH, 0.5)}
        fill={seg.color}
        rx="1.5"
        className="transition-opacity duration-150"
      />
    );
  });
}

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * Math.pow(10, exponent);
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold" style={{ color, fontFamily: "var(--font-geist-mono), monospace" }}>
        {value.toFixed(2)}
      </p>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
