"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartRangeSelector } from "@/components/dashboard/wallet/AnalyticsCard";
import { PerfCard, PerfEmpty, PerfSection } from "./PerformanceChrome";
import { PERF, PERF_SECTION_ICON } from "./performance-assets";
import { TREND_SERIES, type TrendSeriesKey } from "./performance-model";
import type { PerformanceAnalyticsModel } from "./usePerformanceAnalyticsModel";

/**
 * Activity over time — trades closed, scored rounds, contests finished.
 *
 * Reason: the period control here IS the header range (one `range` state), so the
 * chart and the cards above it can never describe different periods.
 */
export default function PerformanceTrendSection({
  model,
  height = 260,
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
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      on ? "border-white/20 bg-white/[0.06] text-white" : "border-white/10 text-[#8ea4c5]"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: s.color, opacity: on ? 1 : 0.4 }}
                    />
                    {s.label}
                    <span className="tabular-nums text-[#8ea4c5]">{total.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="rgba(142,164,197,0.08)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: PERF.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: PERF.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: PERF.bg2,
                      border: "1px solid rgba(0,217,255,0.3)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: PERF.text }}
                  />
                  {visible.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={s.key === "overall" ? 2.75 : 1.75}
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PerfCard>
      )}
    </PerfSection>
  );
}
