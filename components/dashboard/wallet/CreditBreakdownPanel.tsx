"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { AnalyticsCard } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";
import {
  presentKeysFromRows,
  readFiniteNumber,
  resolveCategories,
  type ResolvedWalletCategory,
} from "./wallet-categories";

/** One day of credit activity — keys come from the category catalog + live data. */
export type BreakdownDay = { date: string } & Record<string, number>;

/** Period (or all-time fallback) totals keyed by category UI key. */
export type BreakdownTotals = Record<string, number>;

function formatAxisDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Credit Breakdown — stacked area over the period + summary tiles.
 * Reason: owner 6 Oct 2026 — series and tiles resolve from wallet-categories
 * plus any numeric keys on the data, so a new bucket appears without editing
 * this panel (desktop and mobile share it).
 */
export default function CreditBreakdownPanel({
  data,
  totals,
  categories: categoriesProp,
}: {
  data: BreakdownDay[];
  totals: BreakdownTotals;
  /** Optional — when omitted, resolved from data + totals (agnostic fallback). */
  categories?: ResolvedWalletCategory[];
}) {
  const categories = useMemo(() => {
    if (categoriesProp?.length) return categoriesProp;
    return resolveCategories([
      ...presentKeysFromRows(data as Array<Record<string, unknown>>),
      ...Object.keys(totals),
    ]);
  }, [categoriesProp, data, totals]);

  // Reason: hide empty series so the legend matches what the eye can see.
  const activeSeries = useMemo(
    () =>
      categories.filter(
        (s) =>
          s.chart && data.some((d) => readFiniteNumber(d, s.key) > 0),
      ),
    [categories, data],
  );

  const chartSeries = activeSeries.length
    ? activeSeries
    : categories.filter((s) => s.chart);

  const summary = useMemo(
    () =>
      categories
        .filter((c) => c.summary)
        .map((c) => ({
          key: c.key,
          label: c.label,
          value: readFiniteNumber(totals, c.key),
          color: c.color,
          always: c.alwaysShowInSummary,
        }))
        .filter((row) => row.value > 0 || row.always),
    [categories, totals],
  );

  return (
    <AnalyticsCard
      title="Volt Breakdown"
      subtitle="See how your volts are sourced and used."
      icon={
        <WalletNeonIcon
          src={WALLET_ART.breakdown}
          size={32}
          ringClass="ring-cyan-400/45"
          bgClass="bg-transparent"
        />
      }
      accent="cyan"
      bodyClassName="gap-3 pt-2"
    >
      {data.length < 1 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">
          Your volt breakdown will appear here
        </div>
      ) : (
        <div className="h-[200px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                {chartSeries.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`wallet-bd-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={s.color}
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="100%"
                      stopColor={s.color}
                      stopOpacity={0.06}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) =>
                  v >= 1000
                    ? `${(v / 1000).toFixed(1)}k`
                    : String(Math.round(v))
                }
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,12,28,0.95)",
                  border: "1px solid rgba(0,229,255,0.35)",
                  borderRadius: 10,
                  fontSize: 11,
                  color: "#fff",
                }}
                labelFormatter={(label) => formatAxisDate(String(label))}
                formatter={(value, name) => [
                  Number(value).toFixed(2),
                  String(name),
                ]}
              />
              <Legend
                // Reason: 10px + tight line-height clipped labels like "GM Earnings".
                wrapperStyle={{ fontSize: 11, paddingTop: 8, lineHeight: "18px" }}
                iconType="circle"
                iconSize={8}
              />
              {chartSeries.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stackId="credits"
                  stroke={s.color}
                  strokeWidth={1.75}
                  fill={`url(#wallet-bd-${s.key})`}
                  fillOpacity={1}
                  // Reason: soft glow without clipping — area fills stay inside the plot.
                  style={{ filter: `drop-shadow(0 0 4px ${s.color}66)` }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div
        className="grid gap-2.5 sm:gap-3"
        // Reason: auto-fill keeps a balanced grid when a 7th/8th bucket appears.
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, 1fr))",
        }}
      >
        {summary.map((row) => (
          <div
            key={row.key}
            className="flex min-h-[72px] items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3 sm:min-h-[80px] sm:gap-3 sm:px-3.5 sm:py-3.5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full sm:h-3 sm:w-3"
              style={{
                background: row.color,
                boxShadow: `0 0 10px ${row.color}`,
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] text-slate-400 sm:text-xs">
                {row.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white sm:text-base">
                {formatVolts(row.value)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </AnalyticsCard>
  );
}
