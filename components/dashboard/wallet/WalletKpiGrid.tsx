"use client";

import {
  Coins,
  Gamepad2,
  ShoppingCart,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVolts } from "@/lib/utils/format-volts";
import { ACCENT_HEX, Sparkline } from "./AnalyticsCard";
import {
  WALLET_GOLD,
  WALLET_MAGENTA,
  WALLET_CYAN,
  WALLET_ORANGE,
} from "./wallet-tokens";

export type KpiItem = {
  key: string;
  label: string;
  value: number;
  deltaPct: number | null;
  accent: "gold" | "magenta" | "cyan" | "orange";
  spark: number[];
};

const ICONS: Record<KpiItem["accent"], LucideIcon> = {
  gold: Coins,
  magenta: ShoppingCart,
  cyan: Gamepad2,
  orange: Trophy,
};

const BORDER: Record<KpiItem["accent"], string> = {
  gold: "border-amber-400/45",
  magenta: "border-pink-400/45",
  cyan: "border-cyan-400/45",
  orange: "border-orange-400/45",
};

const GLOW: Record<KpiItem["accent"], string> = {
  gold: "shadow-[0_0_16px_rgba(250,204,21,0.12)]",
  magenta: "shadow-[0_0_16px_rgba(236,72,153,0.12)]",
  cyan: "shadow-[0_0_16px_rgba(0,229,255,0.12)]",
  orange: "shadow-[0_0_16px_rgba(249,115,22,0.12)]",
};

const CHIP: Record<KpiItem["accent"], string> = {
  gold: "bg-amber-500/15 ring-1 ring-amber-400/50 text-amber-300",
  magenta: "bg-pink-500/15 ring-1 ring-pink-400/50 text-pink-300",
  cyan: "bg-cyan-500/15 ring-1 ring-cyan-400/50 text-cyan-300",
  orange: "bg-orange-500/15 ring-1 ring-orange-400/50 text-orange-300",
};

const SPARK: Record<KpiItem["accent"], string> = {
  gold: WALLET_GOLD,
  magenta: WALLET_MAGENTA,
  cyan: WALLET_CYAN,
  orange: WALLET_ORANGE,
};

/**
 * Four compact KPI cards — rebuild guide §4–5.
 * Height ~90–110px; Lucide icons match the reference mock chips.
 */
export default function WalletKpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
      {items.map((item) => {
        const Icon = ICONS[item.accent];
        const up = (item.deltaPct ?? 0) >= 0;
        return (
          <div
            key={item.key}
            className={cn(
              "relative flex min-h-[96px] items-center gap-3 overflow-hidden rounded-[16px] border px-4 py-3.5",
              "bg-[linear-gradient(135deg,rgba(9,22,45,0.96)_0%,rgba(3,10,25,0.96)_100%)]",
              BORDER[item.accent],
              GLOW[item.accent],
            )}
          >
            {/* Decorative corner glow */}
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
              style={{ background: ACCENT_HEX[item.accent] }}
              aria-hidden
            />
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                CHIP[item.accent],
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {item.label}
              </p>
              <p className="truncate text-[22px] font-bold tabular-nums leading-tight text-white sm:text-[24px]">
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
            <Sparkline points={item.spark} color={SPARK[item.accent]} />
          </div>
        );
      })}
    </div>
  );
}
