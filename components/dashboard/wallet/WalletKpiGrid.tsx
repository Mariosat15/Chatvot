"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { ACCENT_HEX, Sparkline } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";
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

const ART: Record<KpiItem["accent"], string> = {
  gold: WALLET_ART.balance,
  magenta: WALLET_ART.spend,
  cyan: WALLET_ART.gameEarnings,
  orange: WALLET_ART.prizes,
};

const BORDER: Record<KpiItem["accent"], string> = {
  gold: "border-amber-400/45",
  magenta: "border-pink-400/45",
  cyan: "border-cyan-400/45",
  orange: "border-orange-400/45",
};

const GLOW: Record<KpiItem["accent"], string> = {
  gold: "shadow-[0_0_20px_rgba(250,204,21,0.18)]",
  magenta: "shadow-[0_0_20px_rgba(236,72,153,0.18)]",
  cyan: "shadow-[0_0_20px_rgba(0,229,255,0.18)]",
  orange: "shadow-[0_0_20px_rgba(249,115,22,0.18)]",
};

const RING: Record<KpiItem["accent"], string> = {
  gold: "ring-amber-400/50",
  magenta: "ring-pink-400/50",
  cyan: "ring-cyan-400/50",
  orange: "ring-orange-400/50",
};

// Reason: owner 3 Oct 2026 — no fill behind neon plates (black canvas knock-out).
const ICON_BG: Record<KpiItem["accent"], string> = {
  gold: "bg-transparent",
  magenta: "bg-transparent",
  cyan: "bg-transparent",
  orange: "bg-transparent",
};

const SPARK: Record<KpiItem["accent"], string> = {
  gold: WALLET_GOLD,
  magenta: WALLET_MAGENTA,
  cyan: WALLET_CYAN,
  orange: WALLET_ORANGE,
};

/**
 * Four KPI cards — neon tiles match Overview KPI row (owner target).
 */
export default function WalletKpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
      {items.map((item) => {
        const artSrc = ART[item.accent];
        const up = (item.deltaPct ?? 0) >= 0;
        return (
          <div
            key={item.key}
            className={cn(
              "relative flex min-h-[96px] items-center gap-3 overflow-hidden rounded-[16px] border px-4 py-3.5 backdrop-blur-md",
              "bg-[linear-gradient(135deg,rgba(9,22,45,0.72)_0%,rgba(3,10,25,0.78)_100%)]",
              BORDER[item.accent],
              GLOW[item.accent],
            )}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-35 blur-2xl"
              style={{ background: ACCENT_HEX[item.accent] }}
              aria-hidden
            />
            {/* Watermark — same depth cue as Overview KPI. */}
            <div
              className="pointer-events-none absolute -right-2 top-1/2 h-24 w-24 -translate-y-1/2 opacity-[0.08]"
              aria-hidden
            >
              <Image
                src={artSrc}
                alt=""
                fill
                sizes="96px"
                className="object-contain"
              />
            </div>
            <WalletNeonIcon
              src={artSrc}
              size={56}
              ringClass={RING[item.accent]}
              bgClass={ICON_BG[item.accent]}
            />
            <div className="relative z-10 min-w-0 flex-1">
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
