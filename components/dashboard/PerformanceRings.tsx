"use client";

import { motion } from "framer-motion";

interface PerformanceRingsProps {
  winRate: number;
  roi?: number;
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

function RingSVG({ datum, size, strokeWidth, delay }: { datum: RingDatum; size: number; strokeWidth: number; delay: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(datum.value / datum.max, 1);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={datum.color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - pct) }}
        transition={{ duration: 1.2, delay: delay + 0.2, ease: "easeOut" }}
      />
    </svg>
  );
}

function RingCenter({ displayValue }: { displayValue: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-xs sm:text-base font-bold text-white" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        {displayValue}
      </span>
    </div>
  );
}

// Reason: Renders ring at `size` on mobile and `smSize` on sm+ breakpoint
// using CSS classes to swap visibility, avoiding JS resize listeners.
function AnimatedRing({
  datum,
  size = 100,
  smSize,
  strokeWidth = 8,
  delay = 0,
}: {
  datum: RingDatum;
  size?: number;
  smSize?: number;
  strokeWidth?: number;
  delay?: number;
}) {
  const actualSmSize = smSize || size;

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 sm:gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* Mobile ring */}
      <div className={`relative animate-neon-ring ${smSize ? "sm:hidden" : ""}`} style={{ "--ring-glow": datum.glow } as React.CSSProperties}>
        <RingSVG datum={datum} size={size} strokeWidth={strokeWidth} delay={delay} />
        <RingCenter displayValue={datum.displayValue} />
      </div>
      {/* Desktop ring (only rendered when smSize differs) */}
      {smSize && (
        <div className="relative animate-neon-ring hidden sm:block" style={{ "--ring-glow": datum.glow } as React.CSSProperties}>
          <RingSVG datum={datum} size={actualSmSize} strokeWidth={strokeWidth + 1} delay={delay} />
          <RingCenter displayValue={datum.displayValue} />
        </div>
      )}
      <span className="text-xs text-gray-400 text-center leading-tight">{datum.label}</span>
    </motion.div>
  );
}

export default function PerformanceRings({
  winRate,
  roi,
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
    ...(roi !== undefined
      ? [
          {
            label: "ROI",
            // Reason: ROI can be negative; use absolute value for ring fill,
            // capped at 100% for visual consistency. Color switches red/cyan.
            value: Math.min(Math.abs(roi), 100),
            max: 100,
            displayValue: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
            color: roi >= 0 ? "#06B6D4" : "#EF4444",
            glow: roi >= 0 ? "rgba(6,182,212,0.5)" : "rgba(239,68,68,0.5)",
          },
        ]
      : []),
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

  const hasData = winRate > 0 || profitFactor > 0 || avgWin > 0 || Math.abs(avgLoss) > 0 || largestWin > 0 || Math.abs(largestLoss) > 0;

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
      {!hasData ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 mb-1">No performance data yet</p>
          <p className="text-xs text-gray-500">Complete trades to see your metrics here</p>
        </div>
      ) : (
        <div className={`grid gap-3 sm:gap-4 ${rings.length <= 6 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"}`}>
          {rings.map((datum, i) => (
            <AnimatedRing
              key={datum.label}
              datum={datum}
              size={70}
              smSize={90}
              strokeWidth={6}
              delay={i * 0.08}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
