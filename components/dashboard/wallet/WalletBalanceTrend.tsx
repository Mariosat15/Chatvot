"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { AnalyticsCard, ChartRangeSelector } from "./AnalyticsCard";
import { WALLET_GOLD, type WalletRange } from "./wallet-tokens";

type Point = { date: string; balance: number };

function formatAxisDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTipDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Wallet Balance Trend — gold area+line, fills the card (rebuild guide §6).
 * Range is controlled by the page so every panel stays in sync (§27).
 */
export default function WalletBalanceTrend({
  data,
  range,
  onRangeChange,
}: {
  data: Point[];
  range: WalletRange;
  onRangeChange: (next: WalletRange) => void;
}) {
  return (
    <AnalyticsCard
      title="Wallet Balance Trend"
      subtitle="Track your wallet balance over time with daily changes."
      icon={<BarChart3 className="h-4 w-4" />}
      accent="gold"
      controls={<ChartRangeSelector value={range} onChange={onRangeChange} />}
      bodyClassName="pt-2"
    >
      {data.length < 2 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
          Make a deposit to start tracking your wallet balance
        </div>
      ) : (
        <div className="h-[240px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="walletGoldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={WALLET_GOLD} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={WALLET_GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                orientation="right"
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
                }
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,12,28,0.95)",
                  border: `1px solid ${WALLET_GOLD}66`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelFormatter={(label) => formatTipDate(String(label))}
                formatter={(value) => [
                  Number(value).toFixed(2),
                  "Balance",
                ]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={WALLET_GOLD}
                strokeWidth={2.5}
                fill="url(#walletGoldFill)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: WALLET_GOLD,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </AnalyticsCard>
  );
}
