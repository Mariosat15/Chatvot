"use client";

import { useMemo } from "react";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { AnalyticsCard } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";
import { WALLET_MAGENTA, WALLET_TEAL } from "./wallet-tokens";

export type SpendingSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const SPEND_RING = WALLET_MAGENTA;
const EARN_RING = WALLET_TEAL;

function sumSlices(slices: SpendingSlice[]): number {
  return slices.reduce((s, x) => s + Math.max(0, x.value), 0);
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const compact = `${(abs / 1000).toFixed(2).replace(/\.?0+$/, "")}K`;
    return n < 0 ? `-${compact}` : compact;
  }
  return formatVolts(n);
}

function SideColumn({
  title,
  total,
  shareLabel,
  accentClass,
  borderClass,
  slices,
  emptyLabel,
}: {
  title: string;
  total: number;
  shareLabel: string;
  accentClass: string;
  borderClass: string;
  slices: SpendingSlice[];
  emptyLabel: string;
}) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border ${borderClass} bg-black/20`}
    >
      <div className="border-b border-white/5 px-4 py-3">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${accentClass}`}
        >
          {title}
        </p>
        <p className="mt-1 text-xl font-bold tabular-nums text-white sm:text-2xl">
          {formatVolts(total)}
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
          {shareLabel}
        </p>
      </div>

      {slices.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/5 px-1 py-1">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <li
                key={s.key}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: s.color,
                      boxShadow: `0 0 8px ${s.color}`,
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {s.label}
                    </p>
                    <p className="text-[11px] tabular-nums text-slate-500">
                      {pct.toFixed(0)}% of {title.toLowerCase()}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">
                  {formatVolts(s.value)}
                </p>
                <div className="col-span-2 h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: s.color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Spending vs Earnings — platform earnings versus spending only.
 * Reason: owner 6 Oct 2026 — deposits and refunds are not earnings; the panel
 * must not mix them in. Layout is two equal columns under a single comparison
 * bar so desktop and mobile share one structured view.
 */
export default function SpendingVsEarnings({
  spendSlices,
  earnSlices,
}: {
  spendSlices: SpendingSlice[];
  earnSlices: SpendingSlice[];
}) {
  const spendTotal = useMemo(() => sumSlices(spendSlices), [spendSlices]);
  const earnTotal = useMemo(() => sumSlices(earnSlices), [earnSlices]);
  const combined = spendTotal + earnTotal;
  const net = earnTotal - spendTotal;
  const spendShare = combined > 0 ? (spendTotal / combined) * 100 : 50;
  const earnShare = combined > 0 ? (earnTotal / combined) * 100 : 50;

  return (
    <AnalyticsCard
      title="Spending vs Earnings"
      subtitle="Platform earnings versus spending. Deposits and refunds are excluded."
      icon={
        <WalletNeonIcon
          src={WALLET_ART.spending}
          size={32}
          ringClass="ring-pink-400/45"
          bgClass="bg-transparent"
        />
      }
      accent="magenta"
      className="overflow-visible"
      bodyClassName="justify-start overflow-visible gap-4"
    >
      {/* Comparison strip — one glance, then the two columns */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pink-300/90">
              Spending
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-white sm:text-xl">
              {formatVolts(spendTotal)}
            </p>
          </div>
          <div className="text-center">
            <p
              className={`text-base font-bold tabular-nums sm:text-lg ${
                net >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {net >= 0 ? "+" : ""}
              {formatCompact(net)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Net earnings − spending
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">
              Earnings
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-white sm:text-xl">
              {formatVolts(earnTotal)}
            </p>
          </div>
        </div>

        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${spendShare}%`,
              background: SPEND_RING,
              boxShadow: `0 0 12px ${SPEND_RING}88`,
            }}
          />
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${earnShare}%`,
              background: EARN_RING,
              boxShadow: `0 0 12px ${EARN_RING}88`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-slate-500">
          <span>{combined > 0 ? `${spendShare.toFixed(0)}%` : "—"}</span>
          <span>{combined > 0 ? `${earnShare.toFixed(0)}%` : "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <SideColumn
          title="Spending"
          total={spendTotal}
          shareLabel={
            combined > 0
              ? `${spendShare.toFixed(0)}% of this comparison`
              : "No activity in this period"
          }
          accentClass="text-pink-300/90"
          borderClass="border-pink-400/25"
          slices={spendSlices}
          emptyLabel="No spending in this period"
        />
        <SideColumn
          title="Earnings"
          total={earnTotal}
          shareLabel={
            combined > 0
              ? `${earnShare.toFixed(0)}% of this comparison`
              : "No activity in this period"
          }
          accentClass="text-emerald-300/90"
          borderClass="border-emerald-400/25"
          slices={earnSlices}
          emptyLabel="No earnings in this period"
        />
      </div>
    </AnalyticsCard>
  );
}
