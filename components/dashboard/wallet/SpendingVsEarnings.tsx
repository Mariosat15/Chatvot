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
  if (n >= 1000) {
    return `${(n / 1000).toFixed(2).replace(/\.?0+$/, "")}K`;
  }
  return formatVolts(n);
}

function CategoryList({
  title,
  slices,
  total,
  emptyLabel,
}: {
  title: string;
  slices: SpendingSlice[];
  total: number;
  emptyLabel: string;
}) {
  if (!slices.length) {
    return (
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <p className="text-xs text-slate-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <ul className="flex flex-col gap-2">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li key={s.key} className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-slate-300">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: s.color,
                      boxShadow: `0 0 8px ${s.color}`,
                    }}
                  />
                  <span className="truncate font-medium">{s.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {pct.toFixed(0)}%
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-slate-100">
                  {formatVolts(s.value)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: s.color,
                    boxShadow: `0 0 10px ${s.color}`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Spending vs Earnings — true comparison, not a second Credit Breakdown.
 * Reason: owner 6 Oct 2026 — the old donut mixed every bucket into one total
 * (same numbers as Credit Breakdown tiles). This panel answers one question:
 * how much went out vs how much came in, then what built each side.
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

  const arcs = useMemo(() => {
    if (combined <= 0) return [];
    const r = 54;
    const c = 2 * Math.PI * r;
    let angle = -90;
    return [
      { key: "spend", value: spendTotal, color: SPEND_RING, label: "Spending" },
      { key: "earn", value: earnTotal, color: EARN_RING, label: "Earnings" },
    ]
      .filter((s) => s.value > 0)
      .map((s) => {
        const share = s.value / combined;
        const len = share * c;
        const dash = `${len} ${c - len}`;
        const rot = angle;
        angle += share * 360;
        return { ...s, dash, rot, share };
      });
  }, [combined, earnTotal, spendTotal]);

  return (
    <AnalyticsCard
      title="Spending vs Earnings"
      subtitle="Money out versus money in for the selected period."
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
      bodyClassName="justify-center overflow-visible gap-4"
    >
      <div className="flex flex-1 flex-col items-center gap-4 overflow-visible sm:flex-row sm:items-center sm:gap-5">
        <div className="relative mx-auto flex h-[200px] w-[200px] shrink-0 items-center justify-center overflow-visible sm:mx-0">
          <svg
            viewBox="-20 -20 180 180"
            className="h-[188px] w-[188px] overflow-visible"
            style={{ overflow: "visible" }}
          >
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="14"
            />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="70"
                cy="70"
                r="54"
                fill="none"
                stroke={a.color}
                strokeWidth="14"
                strokeDasharray={a.dash}
                strokeLinecap="butt"
                transform={`rotate(${a.rot} 70 70)`}
                style={{ filter: `drop-shadow(0 0 6px ${a.color}aa)` }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
            <span
              className={`text-lg font-bold tabular-nums ${
                net >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {net >= 0 ? "+" : ""}
              {formatCompact(net)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Net (in − out)
            </span>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-pink-400/35 bg-pink-500/10 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-200/80">
                Spending
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-white sm:text-lg">
                {formatVolts(spendTotal)}
              </p>
              <p className="text-[10px] tabular-nums text-slate-400">
                {combined > 0
                  ? `${((spendTotal / combined) * 100).toFixed(0)}% of activity`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/80">
                Earnings
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-white sm:text-lg">
                {formatVolts(earnTotal)}
              </p>
              <p className="text-[10px] tabular-nums text-slate-400">
                {combined > 0
                  ? `${((earnTotal / combined) * 100).toFixed(0)}% of activity`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
            <CategoryList
              title="Where it went"
              slices={spendSlices}
              total={spendTotal}
              emptyLabel="No spending in this period"
            />
            <CategoryList
              title="Where it came from"
              slices={earnSlices}
              total={earnTotal}
              emptyLabel="No earnings in this period"
            />
          </div>
        </div>
      </div>
    </AnalyticsCard>
  );
}
