"use client";

import { motion } from "framer-motion";

interface PerformanceRingsProps {
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
}

interface RingDatum {
  label: string;
  value: number;
  max: number;
  displayValue: string;
  color: string;
  glow: string;
}

function AnimatedRing({
  datum,
  size = 100,
  strokeWidth = 8,
  delay = 0,
}: {
  datum: RingDatum;
  size?: number;
  strokeWidth?: number;
  delay?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(datum.value / datum.max, 1);

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="relative animate-neon-ring" style={{ "--ring-glow": datum.glow } as React.CSSProperties}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Animated arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={datum.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 1.2, delay: delay + 0.2, ease: "easeOut" }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm sm:text-base font-bold text-white" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            {datum.displayValue}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-gray-400 text-center leading-tight">{datum.label}</span>
    </motion.div>
  );
}

export default function PerformanceRings({
  winRate,
  profitFactor,
  avgWin,
  avgLoss,
  largestWin,
  largestLoss,
}: PerformanceRingsProps) {
  const rings: RingDatum[] = [
    {
      label: "Win Rate",
      value: winRate,
      max: 100,
      displayValue: `${winRate.toFixed(1)}%`,
      color: "#22C55E",
      glow: "rgba(34,197,94,0.5)",
    },
    {
      label: "Profit Factor",
      value: Math.min(profitFactor, 5),
      max: 5,
      displayValue: profitFactor.toFixed(2),
      color: "#3B82F6",
      glow: "rgba(59,130,246,0.5)",
    },
    {
      label: "Avg Win",
      value: Math.min(avgWin, 500),
      max: 500,
      displayValue: `$${avgWin.toFixed(0)}`,
      color: "#10B981",
      glow: "rgba(16,185,129,0.5)",
    },
    {
      label: "Avg Loss",
      value: Math.min(Math.abs(avgLoss), 500),
      max: 500,
      displayValue: `$${Math.abs(avgLoss).toFixed(0)}`,
      color: "#EF4444",
      glow: "rgba(239,68,68,0.5)",
    },
    {
      label: "Best Trade",
      value: Math.min(largestWin, 1000),
      max: 1000,
      displayValue: `$${largestWin.toFixed(0)}`,
      color: "#EAB308",
      glow: "rgba(234,179,8,0.5)",
    },
    {
      label: "Worst Trade",
      value: Math.min(Math.abs(largestLoss), 1000),
      max: 1000,
      displayValue: `$${Math.abs(largestLoss).toFixed(0)}`,
      color: "#F97316",
      glow: "rgba(249,115,22,0.5)",
    },
  ];

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        ⚡ Performance Metrics
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
        {rings.map((datum, i) => (
          <AnimatedRing
            key={datum.label}
            datum={datum}
            size={90}
            strokeWidth={7}
            delay={i * 0.08}
          />
        ))}
      </div>
    </motion.div>
  );
}
