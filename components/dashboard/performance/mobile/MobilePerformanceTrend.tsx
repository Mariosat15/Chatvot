"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartRangeSelector } from "@/components/dashboard/wallet/AnalyticsCard";
import { PerfEmpty } from "../PerformanceChrome";
import { PERF, PERF_SECTION_ICON } from "../performance-assets";
import { TREND_SERIES, type TrendSeriesKey } from "../performance-trend";
import type { PerformanceAnalyticsModel } from "../usePerformanceAnalyticsModel";
import type { WalletRange } from "@/components/dashboard/wallet/wallet-tokens";
import { MobilePerfHeading, MobilePerfPlate } from "./mobile-perf-shell";

/**
 * Default Overall only. Extra series are opt-in pills so the phone chart stays readable.
 */
export default function MobilePerformanceTrend({ model }: { model: PerformanceAnalyticsModel }) {
  const [hidden, setHidden] = useState<Set<TrendSeriesKey>>(
    () => new Set(TREND_SERIES.filter((s) => s.key !== "overall").map((s) => s.key)),
  );
  const { points, totals } = model.trend;
  const anyActivity = TREND_SERIES.some((s) => totals[s.key] > 0);

  const toggle = (key: TrendSeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visible = TREND_SERIES.filter((s) => totals[s.key] > 0 && !hidden.has(s.key));

  return (
    <section data-perf-section="trend">
      <MobilePerfHeading
        title="Performance Trend"
        subtitle="Things you completed each period."
        icon={PERF_SECTION_ICON.trend}
      />
      <div className="mb-2.5">
        <ChartRangeSelector
          value={model.range as WalletRange}
          onChange={(next) => model.setRange(next)}
        />
      </div>
      {!anyActivity ? (
        <PerfEmpty>No activity in this period yet.</PerfEmpty>
      ) : (
        <MobilePerfPlate accent="cyan" className="p-3">
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Trend series">
            {TREND_SERIES.map((s) => {
              const empty = totals[s.key] === 0;
              const on = !empty && !hidden.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={empty}
                  aria-pressed={on}
                  onClick={() => toggle(s.key)}
                  className={`min-h-[44px] rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-35 ${
                    on ? "border-white/25 bg-white/[0.08] text-white" : "border-white/10 text-[#8ea4c5]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  {TREND_SERIES.map((s) => (
                    <linearGradient key={s.key} id={`mperf-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={s.key === "overall" ? 0.4 : 0.22} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="rgba(142,164,197,0.12)" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: PERF.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: PERF.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(5,12,28,0.95)",
                    border: "1px solid rgba(0,217,255,0.35)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#fff",
                  }}
                />
                {visible.map((s) => (
                  <Area
                    key={`fill-${s.key}`}
                    type="monotone"
                    dataKey={s.key}
                    stroke="none"
                    fill={`url(#mperf-fill-${s.key})`}
                    isAnimationActive={false}
                    legendType="none"
                    tooltipType="none"
                  />
                ))}
                {visible.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={s.key === "overall" ? 3 : 2}
                    dot={false}
                    activeDot={{ r: 5, fill: s.color, stroke: "#041025", strokeWidth: 1 }}
                    isAnimationActive={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </MobilePerfPlate>
      )}
    </section>
  );
}
