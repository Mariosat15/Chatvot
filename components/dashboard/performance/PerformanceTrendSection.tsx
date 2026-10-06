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
import { PerfCard, PerfEmpty, PerfSection } from "./PerformanceChrome";
import { PERF, PERF_SECTION_ICON } from "./performance-assets";
import { TREND_SERIES, type TrendSeriesKey } from "./performance-trend";
import type { PerformanceAnalyticsModel } from "./usePerformanceAnalyticsModel";

/**
 * Activity over time — trades closed, scored rounds, contests finished.
 *
 * Reason: the period control here IS the header range (one `range` state), so the
 * chart and the cards above it can never describe different periods.
 */
export default function PerformanceTrendSection({
  model,
  height = 280,
}: {
  model: PerformanceAnalyticsModel;
  height?: number;
}) {
  const [hidden, setHidden] = useState<Set<TrendSeriesKey>>(() => new Set());
  const { points, totals } = model.trend;
  const totalsByKey = new Map(TREND_SERIES.map((s) => [s.key, totals[s.key]]));
  const anyActivity = TREND_SERIES.some((s) => (totalsByKey.get(s.key) ?? 0) > 0);

  const toggle = (key: TrendSeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visible = TREND_SERIES.filter(
    (s) => (totalsByKey.get(s.key) ?? 0) > 0 && !hidden.has(s.key),
  );

  return (
    <PerfSection
      title="Performance Trend"
      subtitle="Things you completed each period: trades, scored rounds, competitions and 1v1s."
      icon={PERF_SECTION_ICON.trend}
      controls={<ChartRangeSelector value={model.range} onChange={model.setRange} />}
      testId="trend"
    >
      {!anyActivity ? (
        <PerfEmpty>No activity in this period yet.</PerfEmpty>
      ) : (
        <PerfCard accent="cyan">
          <div className="p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Trend series">
              {TREND_SERIES.map((s) => {
                const total = totalsByKey.get(s.key) ?? 0;
                const empty = total === 0;
                const on = !empty && !hidden.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={empty}
                    aria-pressed={on}
                    onClick={() => toggle(s.key)}
                    title={empty ? "Nothing in this period" : undefined}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      on ? "border-white/25 bg-white/[0.08] text-white" : "border-white/10 text-[#8ea4c5]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: s.color,
                        opacity: on ? 1 : 0.4,
                        boxShadow: on ? `0 0 8px ${s.color}` : undefined,
                      }}
                    />
                    {s.label}
                    <span className="tabular-nums text-[#8ea4c5]">{total.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    {TREND_SERIES.map((s) => (
                      <linearGradient
                        key={s.key}
                        id={`perf-fill-${s.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={s.color} stopOpacity={s.key === "overall" ? 0.38 : 0.22} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="rgba(142,164,197,0.12)" vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: PERF.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: PERF.muted, fontSize: 11 }}
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
                    labelStyle={{ color: PERF.text }}
                  />
                  {visible.map((s) => (
                    <Area
                      key={`fill-${s.key}`}
                      type="monotone"
                      dataKey={s.key}
                      stroke="none"
                      fill={`url(#perf-fill-${s.key})`}
                      fillOpacity={1}
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
                      strokeWidth={s.key === "overall" ? 3 : 2.1}
                      dot={false}
                      activeDot={{ r: 4, fill: s.color, stroke: "#041025", strokeWidth: 1 }}
                      isAnimationActive={false}
                      style={{ filter: `drop-shadow(0 0 7px ${s.color}aa)` }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PerfCard>
      )}
    </PerfSection>
  );
}
