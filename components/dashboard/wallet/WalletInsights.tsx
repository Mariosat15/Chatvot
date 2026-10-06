"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART, walletArtForKey } from "@/lib/services/games/wallet-assets";
import { Sparkline } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";

export type InsightItem = {
  key: string;
  label: string;
  value: number;
  deltaPct: number | null;
  spark: number[];
  /** From the category catalog — keeps the strip data-agnostic. */
  color: string;
};

/**
 * Wallet Insights — neon tiles driven by the shared model / catalog.
 * Reason: owner 6 Oct 2026 — tile count follows insight-flagged categories
 * plus Net Movement; no hard-coded key union.
 */
export default function WalletInsights({ items }: { items: InsightItem[] }) {
  return (
    <section className="rounded-[16px] border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(9,22,45,0.68)_0%,rgba(3,10,25,0.76)_100%)] p-4 shadow-[0_0_22px_rgba(0,229,255,0.1)] backdrop-blur-md sm:p-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <WalletNeonIcon
            src={WALLET_ART.insights}
            size={36}
            ringClass="ring-amber-400/45"
            bgClass="bg-transparent"
          />
          <div>
            <h3 className="text-base font-semibold text-white">Wallet Insights</h3>
            <p className="text-[11px] text-slate-400 sm:text-xs">
              Key metrics and transaction summary for the selected period.
            </p>
          </div>
        </div>
        <Link
          href="/wallet"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 shadow-[0_0_12px_rgba(250,204,21,0.2)] transition-colors hover:border-amber-300/70 hover:bg-amber-500/25"
        >
          View All Transactions
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
        }}
      >
        {items.map((item) => {
          const color = item.color;
          const up = (item.deltaPct ?? 0) >= 0;
          return (
            <div
              key={item.key}
              className="rounded-xl border bg-black/40 px-2.5 py-2.5 shadow-[0_0_12px_rgba(0,0,0,0.25)]"
              style={{ borderColor: `${color}66` }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <WalletNeonIcon
                  src={walletArtForKey(item.key)}
                  size={24}
                  ringClass="ring-white/20"
                  bgClass="bg-transparent"
                />
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
