"use client";

import { cn } from "@/lib/utils";
import {
  WALLET_CYAN,
  WALLET_GOLD,
  WALLET_MAGENTA,
  WALLET_ORANGE,
  WALLET_TEAL,
  type WalletRange,
} from "./wallet-tokens";

type Accent = "cyan" | "gold" | "magenta" | "orange" | "teal" | "neutral";

type AccentStyle = {
  border: string;
  glow: string;
  iconBg: string;
  iconText: string;
};

const ACCENT_MAP = new Map<Accent, AccentStyle>([
  [
    "cyan",
    {
      border: "border-cyan-400/35",
      glow: "shadow-[0_0_18px_rgba(0,229,255,0.08)]",
      iconBg: "bg-cyan-500/15 ring-1 ring-cyan-400/40",
      iconText: "text-cyan-300",
    },
  ],
  [
    "gold",
    {
      border: "border-amber-400/40",
      glow: "shadow-[0_0_18px_rgba(250,204,21,0.1)]",
      iconBg: "bg-amber-500/15 ring-1 ring-amber-400/45",
      iconText: "text-amber-300",
    },
  ],
  [
    "magenta",
    {
      border: "border-pink-400/40",
      glow: "shadow-[0_0_18px_rgba(236,72,153,0.1)]",
      iconBg: "bg-pink-500/15 ring-1 ring-pink-400/45",
      iconText: "text-pink-300",
    },
  ],
  [
    "orange",
    {
      border: "border-orange-400/40",
      glow: "shadow-[0_0_18px_rgba(249,115,22,0.1)]",
      iconBg: "bg-orange-500/15 ring-1 ring-orange-400/45",
      iconText: "text-orange-300",
    },
  ],
  [
    "teal",
    {
      border: "border-emerald-400/40",
      glow: "shadow-[0_0_18px_rgba(16,185,129,0.1)]",
      iconBg: "bg-emerald-500/15 ring-1 ring-emerald-400/45",
      iconText: "text-emerald-300",
    },
  ],
  [
    "neutral",
    {
      border: "border-cyan-400/25",
      glow: "shadow-[0_0_14px_rgba(0,229,255,0.06)]",
      iconBg: "bg-cyan-500/10 ring-1 ring-cyan-400/30",
      iconText: "text-cyan-300",
    },
  ],
]);

/**
 * Shared glass analytics card — same header height / radius / padding
 * for every Wallet Analytics panel (rebuild guide §21).
 */
export function AnalyticsCard({
  title,
  subtitle,
  icon,
  controls,
  accent = "neutral",
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  controls?: React.ReactNode;
  accent?: Accent;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  // Reason: Map lookup — object indexing trips detect-object-injection.
  const a = ACCENT_MAP.get(accent) ?? ACCENT_MAP.get("neutral")!;
  return (
    <section
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[16px] border",
        "bg-[linear-gradient(135deg,rgba(9,22,45,0.96)_0%,rgba(3,10,25,0.96)_100%)]",
        a.border,
        a.glow,
        className,
      )}
    >
      <div className="flex min-h-[56px] items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? (
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                a.iconBg,
                a.iconText,
              )}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-white sm:text-base">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400 sm:text-xs">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {controls}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col p-4 sm:p-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function ChartRangeSelector({
  value,
  onChange,
}: {
  value: WalletRange;
  onChange: (next: WalletRange) => void;
}) {
  const options: WalletRange[] = ["7d", "30d", "90d", "all"];
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-cyan-500/25 bg-black/35 p-0.5">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all sm:text-[11px]",
              active
                ? "bg-cyan-500/30 text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.45)] ring-1 ring-cyan-400/80"
                : "text-slate-400 hover:text-white",
            )}
          >
            {opt === "all" ? "All" : opt.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export function Sparkline({
  points,
  color,
  width = 72,
  height = 26,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden className="opacity-40">
        <line
          x1={4}
          y1={height / 2}
          x2={width - 4}
          y2={height / 2}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / span) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export const ACCENT_HEX: Record<Accent, string> = {
  cyan: WALLET_CYAN,
  gold: WALLET_GOLD,
  magenta: WALLET_MAGENTA,
  orange: WALLET_ORANGE,
  teal: WALLET_TEAL,
  neutral: WALLET_CYAN,
};
