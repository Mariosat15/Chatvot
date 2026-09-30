"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Gamepad2,
  Gift,
  Lightbulb,
  ShoppingCart,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVolts } from "@/lib/utils/format-volts";
import { Sparkline } from "./AnalyticsCard";
import { WALLET_CATEGORY } from "./wallet-tokens";

export type InsightItem = {
  key:
    | "deposits"
    | "withdrawals"
    | "purchases"
    | "gameEarnings"
    | "bonuses"
    | "prizes"
    | "net";
  label: string;
  value: number;
  deltaPct: number | null;
  spark: number[];
};

const ICONS: Record<InsightItem["key"], LucideIcon> = {
  deposits: ArrowDownToLine,
  withdrawals: ArrowUpFromLine,
  purchases: ShoppingCart,
  gameEarnings: Gamepad2,
  bonuses: Gift,
  prizes: Trophy,
  net: Coins,
};

const COLORS: Record<InsightItem["key"], string> = {
  deposits: WALLET_CATEGORY.deposits,
  withdrawals: WALLET_CATEGORY.withdrawals,
  purchases: WALLET_CATEGORY.purchases,
  gameEarnings: WALLET_CATEGORY.gameEarnings,
  bonuses: WALLET_CATEGORY.bonuses,
  prizes: WALLET_CATEGORY.prizes,
  net: WALLET_CATEGORY.net,
};

const BORDERS: Record<InsightItem["key"], string> = {
  deposits: "border-emerald-400/40",
  withdrawals: "border-rose-400/40",
  purchases: "border-amber-400/40",
  gameEarnings: "border-cyan-400/40",
  bonuses: "border-fuchsia-400/40",
  prizes: "border-orange-400/40",
  net: "border-emerald-400/40",
};

/**
 * Wallet Insights — seven compact cards (rebuild guide §12).
 */
export default function WalletInsights({ items }: { items: InsightItem[] }) {
  return (
    <section className="rounded-[16px] border border-cyan-400/25 bg-[linear-gradient(135deg,rgba(9,22,45,0.96)_0%,rgba(3,10,25,0.96)_100%)] p-4 shadow-[0_0_18px_rgba(0,229,255,0.06)] sm:p-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/40 text-amber-300">
            <Lightbulb className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Wallet Insights</h3>
            <p className="text-[11px] text-slate-400 sm:text-xs">
              Key metrics and transaction summary for the selected period.
            </p>
          </div>
        </div>
        <Link
          href="/wallet"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/45 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-300/70 hover:bg-amber-500/20"
        >
          View All Transactions
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const color = COLORS[item.key];
          const up = (item.deltaPct ?? 0) >= 0;
          return (
            <div
              key={item.key}
              className={cn(
                "rounded-xl border bg-black/35 px-2.5 py-2.5",
                BORDERS[item.key],
              )}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: `${color}22`,
                    boxShadow: `0 0 10px ${color}33`,
                    color,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
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
                <Sparkline
                  points={item.spark}
                  color={color}
                  width={56}
                  height={22}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
