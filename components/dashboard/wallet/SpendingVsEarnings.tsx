"use client";

import { useMemo } from "react";
import { formatVolts } from "@/lib/utils/format-volts";
import { WalletPanel, WalletPanelHeader } from "./WalletChrome";

export type SpendingSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * Donut + legend for Spending vs Earnings — mock layout.
 * Values are absolute credit amounts for the selected window.
 */
export default function SpendingVsEarnings({ slices }: { slices: SpendingSlice[] }) {
  const total = useMemo(
    () => slices.reduce((s, x) => s + Math.max(0, x.value), 0),
    [slices],
  );

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let angle = -90;
    const r = 54;
    const c = 2 * Math.PI * r;
    return slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const share = s.value / total;
        const len = share * c;
        const dash = `${len} ${c - len}`;
        const rot = angle;
        angle += share * 360;
        return { ...s, dash, rot, share };
      });
  }, [slices, total]);

  return (
    <WalletPanel tone="magenta" className="flex h-full flex-col">
      <WalletPanelHeader
        title="Spending vs Earnings"
        subtitle="Where credits came from and where they went."
      />
      <div className="flex flex-1 flex-col items-center gap-5 p-4 sm:flex-row sm:items-stretch sm:p-5">
        <div className="relative mx-auto h-40 w-40 shrink-0 sm:mx-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-0">
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
                className="drop-shadow-[0_0_6px_currentColor]"
                style={{ color: a.color }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-white">
              {total >= 1000
                ? `${(total / 1000).toFixed(2).replace(/\.?0+$/, "")}K`
                : formatVolts(total)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Total Credits
            </span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <li key={s.key} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-slate-300">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
                    />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-200">
                    {pct.toFixed(1)}% · {formatVolts(s.value)}
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
    </WalletPanel>
  );
}
