"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";

type Tone = "gold" | "magenta" | "cyan" | "orange" | "green" | "red" | "pink";

type ToneStyle = {
  border: string;
  glow: string;
  glass: string;
  spark: string;
};

const TONE = new Map<Tone, ToneStyle>([
  [
    "gold",
    {
      border: "border-amber-400/70",
      glow: "shadow-[0_0_16px_rgba(251,191,36,0.22)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(251,191,36,0.14)_0%,#07101f_48%,rgba(180,120,20,0.1)_100%)]",
      spark: "#FBBF24",
    },
  ],
  [
    "magenta",
    {
      border: "border-fuchsia-400/70",
      glow: "shadow-[0_0_16px_rgba(232,121,249,0.22)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(232,121,249,0.14)_0%,#07101f_48%,rgba(140,40,140,0.12)_100%)]",
      spark: "#E879F9",
    },
  ],
  [
    "cyan",
    {
      border: "border-cyan-400/70",
      glow: "shadow-[0_0_16px_rgba(34,211,238,0.22)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(34,211,238,0.14)_0%,#07101f_48%,rgba(20,120,160,0.12)_100%)]",
      spark: "#22D3EE",
    },
  ],
  [
    "orange",
    {
      border: "border-orange-400/70",
      glow: "shadow-[0_0_16px_rgba(251,146,60,0.22)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(251,146,60,0.14)_0%,#07101f_48%,rgba(180,80,20,0.12)_100%)]",
      spark: "#FB923C",
    },
  ],
  [
    "green",
    {
      border: "border-emerald-400/70",
      glow: "shadow-[0_0_16px_rgba(52,211,153,0.2)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(52,211,153,0.12)_0%,#07101f_48%,rgba(20,100,60,0.1)_100%)]",
      spark: "#34D399",
    },
  ],
  [
    "red",
    {
      border: "border-rose-400/70",
      glow: "shadow-[0_0_16px_rgba(251,113,133,0.2)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(251,113,133,0.12)_0%,#07101f_48%,rgba(140,40,60,0.1)_100%)]",
      spark: "#FB7185",
    },
  ],
  [
    "pink",
    {
      border: "border-pink-400/70",
      glow: "shadow-[0_0_16px_rgba(244,114,182,0.2)]",
      glass:
        "bg-[linear-gradient(110deg,rgba(244,114,182,0.12)_0%,#07101f_48%,rgba(140,40,100,0.1)_100%)]",
      spark: "#F472B6",
    },
  ],
]);

function toneOf(tone: Tone): ToneStyle {
  return TONE.get(tone) ?? TONE.get("cyan")!;
}

/** Neon glass panel shell used across Wallet Analytics. */
export function WalletPanel({
  children,
  className,
  tone = "cyan",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const t = toneOf(tone);
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-sm",
        t.border,
        t.glow,
        t.glass,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function WalletPanelHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-wide text-white sm:text-base">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

/** 7D / 30D / 90D / All range chips matching the mock. */
export function WalletRangeChips({
  value,
  onChange,
  options = ["7d", "30d", "90d", "all"] as const,
}: {
  value: string;
  onChange: (next: string) => void;
  options?: readonly string[];
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-500/20 bg-black/30 p-0.5">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors sm:text-[11px]",
              active
                ? "bg-cyan-500/25 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.45)] ring-1 ring-cyan-400/70"
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

function Sparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 88;
  const h = 28;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 opacity-90"
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export type WalletKpi = {
  key: string;
  label: string;
  value: number;
  deltaPct: number | null;
  tone: Tone;
  art: string;
  spark: number[];
};

export function WalletKpiRow({ items }: { items: WalletKpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const t = toneOf(item.tone);
        const up = (item.deltaPct ?? 0) >= 0;
        return (
          <div
            key={item.key}
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5",
              t.border,
              t.glow,
              t.glass,
            )}
          >
            <div className="relative h-12 w-12 shrink-0">
              <Image
                src={item.art}
                alt=""
                fill
                sizes="48px"
                className="object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                {item.label}
              </p>
              <p className="truncate text-xl font-bold tabular-nums text-white sm:text-2xl">
                {formatVolts(item.value)}
              </p>
              {item.deltaPct != null ? (
                <p
                  className={cn(
                    "mt-0.5 text-[11px] font-semibold",
                    up ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {up ? "↑" : "↓"}
                  {Math.abs(item.deltaPct).toFixed(1)}% vs last period
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-slate-500">— vs last period</p>
              )}
            </div>
            <Sparkline points={item.spark} color={t.spark} />
          </div>
        );
      })}
    </div>
  );
}

export type WalletInsight = {
  key: string;
  label: string;
  value: number;
  deltaPct: number | null;
  tone: Tone;
  art: string;
  spark: number[];
};

export function WalletInsightsRow({ items }: { items: WalletInsight[] }) {
  return (
    <WalletPanel tone="cyan" className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src={WALLET_ART.insights}
              alt=""
              fill
              sizes="40px"
              className="object-contain"
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Wallet Insights</h3>
            <p className="text-xs text-slate-400">
              Key metrics and transaction summary for the selected period.
            </p>
          </div>
        </div>
        <Link
          href="/wallet"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-300/70 hover:bg-cyan-500/20"
        >
          View All Transactions
          <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => {
          const t = toneOf(item.tone);
          const up = (item.deltaPct ?? 0) >= 0;
          return (
            <div
              key={item.key}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                t.border,
                "bg-black/35",
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <div className="relative h-7 w-7 shrink-0">
                  <Image
                    src={item.art}
                    alt=""
                    fill
                    sizes="28px"
                    className="object-contain"
                  />
                </div>
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.label}
                </span>
              </div>
              <p className="text-sm font-bold tabular-nums text-white">
                {formatVolts(item.value)}
              </p>
              <div className="mt-1 flex items-center justify-between gap-1">
                {item.deltaPct != null ? (
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      up ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {up ? "↑" : "↓"}
                    {Math.abs(item.deltaPct).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600">—</span>
                )}
                <Sparkline points={item.spark} color={t.spark} />
              </div>
            </div>
          );
        })}
      </div>
    </WalletPanel>
  );
}
