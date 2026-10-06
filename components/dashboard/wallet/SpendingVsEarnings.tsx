"use client";

import { useMemo } from "react";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { AnalyticsCard } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";

export type SpendingSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * Spending vs Earnings — donut + horizontal breakdown (rebuild guide §10).
 * Reason: owner 6 Oct 2026 — drop-shadow was clipped by a tight viewBox /
 * container; pad the SVG and keep overflow visible so the ring reads round.
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

  const totalLabel =
    total >= 1000
      ? `${(total / 1000).toFixed(2).replace(/\.?0+$/, "")}K`
      : formatVolts(total);

  return (
    <AnalyticsCard
      title="Spending vs Earnings"
      subtitle="Compare your spending with earnings and prizes."
      icon={
        <WalletNeonIcon
          src={WALLET_ART.spending}
          size={32}
          ringClass="ring-pink-400/45"
          bgClass="bg-transparent"
        />
      }
      accent="magenta"
      // Reason: section defaults to overflow-hidden which squares off the ring glow.
      className="overflow-visible"
      bodyClassName="justify-center overflow-visible"
    >
      <div className="flex flex-1 flex-col items-center gap-5 overflow-visible sm:flex-row sm:items-center">
        {/* Reason: outer box is larger than the ring so glow is not squared off. */}
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
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums text-white">
              {totalLabel}
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
                      style={{
                        background: s.color,
                        boxShadow: `0 0 8px ${s.color}`,
                      }}
                    />
                    <span className="truncate font-medium">{s.label}</span>
                    <span className="tabular-nums text-slate-400">
                      {pct.toFixed(1)}%
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
    </AnalyticsCard>
  );
}
