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
import { WALLET_CATEGORY } from "./wallet-tokens";

export type BreakdownDay = {
  date: string;
  deposits: number;
  contestEntries: number;
  marketplace: number;
  gmSpend: number;
  gmEarnings: number;
  giftCredits: number;
  prizes: number;
  withdrawals: number;
  refunds: number;
};

export type BreakdownTotals = {
  deposits: number;
  contestEntries: number;
  marketplace: number;
  gmSpend: number;
  gmEarnings: number;
  giftCredits: number;
  giftCreditsOut: number;
  prizes: number;
  withdrawals: number;
  refunds: number;
};

const SERIES = [
  { key: "deposits", label: "Deposits", color: WALLET_CATEGORY.deposits },
  {
    key: "contestEntries",
    label: "Contest Entries",
    color: WALLET_CATEGORY.contestEntries,
  },
  {
    key: "marketplace",
    label: "Marketplace",
    color: WALLET_CATEGORY.marketplace,
  },
  { key: "gmSpend", label: "GM Spend", color: WALLET_CATEGORY.gmSpend },
  {
    key: "gmEarnings",
    label: "GM Earnings",
    color: WALLET_CATEGORY.gmEarnings,
  },
  {
    key: "giftCredits",
    label: "Gift Credits",
    color: WALLET_CATEGORY.giftCredits,
  },
  { key: "prizes", label: "Prizes", color: WALLET_CATEGORY.prizes },
  {
    key: "withdrawals",
    label: "Withdrawals",
    color: WALLET_CATEGORY.withdrawals,
  },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

function formatAxisDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Credit Breakdown — stacked area over the period + summary tiles.
 * Reason: owner 6 Oct 2026 — sparse multi-series bars were unreadable; area
 * shows category mix over time without hairline columns.
 */
export default function CreditBreakdownPanel({
  data,
  totals,
}: {
  data: BreakdownDay[];
  totals: BreakdownTotals;
}) {
  // Reason: hide empty series so the legend matches what the eye can see.
  const activeSeries = useMemo(
    () =>
      SERIES.filter((s) =>
        data.some((d) => (d[s.key as SeriesKey] || 0) > 0),
      ),
    [data],
  );

  const summary = [
    { key: "deposits", label: "Total Deposits", value: totals.deposits },
    {
      key: "contestEntries",
      label: "Contest Entries",
      value: totals.contestEntries,
    },
    { key: "marketplace", label: "Marketplace", value: totals.marketplace },
    { key: "gmSpend", label: "GM Spend", value: totals.gmSpend },
    { key: "gmEarnings", label: "GM Earnings", value: totals.gmEarnings },
    { key: "giftCredits", label: "Gift Credits", value: totals.giftCredits },
    { key: "prizes", label: "Prizes Won", value: totals.prizes },
    { key: "withdrawals", label: "Withdrawals", value: totals.withdrawals },
  ].filter(
    (row) =>
      row.value > 0 ||
      ["deposits", "prizes", "giftCredits"].includes(row.key),
  );

  return (
    <AnalyticsCard
      title="Credit Breakdown"
      subtitle="See how your credits are sourced and used."
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
          Your credit breakdown will appear here
        </div>
      ) : (
        <div className="h-[200px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                {SERIES.map((s) => (
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
                wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                iconType="circle"
                iconSize={8}
              />
              {(activeSeries.length ? activeSeries : SERIES).map((s) => (
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {summary.map((row) => {
          const color =
            WALLET_CATEGORY[row.key as keyof typeof WALLET_CATEGORY] ??
            "#94A3B8";
          return (
            <div
              key={row.key}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-2"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              />
              <div className="min-w-0">
                <p className="truncate text-[10px] text-slate-400">{row.label}</p>
                <p className="text-xs font-semibold tabular-nums text-white">
                  {formatVolts(row.value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </AnalyticsCard>
  );
}
