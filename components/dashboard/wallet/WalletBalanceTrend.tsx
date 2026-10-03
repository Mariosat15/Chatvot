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
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { AnalyticsCard, ChartRangeSelector } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";
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
      icon={
        <WalletNeonIcon
          src={WALLET_ART.balance}
          size={32}
          ringClass="ring-amber-400/45"
          bgClass="bg-amber-500/15"
        />
      }
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
                  <stop offset="0%" stopColor={WALLET_GOLD} stopOpacity={0.55} />
                  <stop offset="55%" stopColor={WALLET_GOLD} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={WALLET_GOLD} stopOpacity={0.02} />
                </linearGradient>
                <filter id="walletGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.07)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                orientation="right"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
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
                  border: `1px solid ${WALLET_GOLD}99`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fff",
                  boxShadow: `0 0 18px ${WALLET_GOLD}55`,
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
                strokeWidth={3}
                fill="url(#walletGoldFill)"
                filter="url(#walletGoldGlow)"
                dot={{ r: 3, fill: WALLET_GOLD, stroke: "#fff", strokeWidth: 1 }}
                activeDot={{
                  r: 6,
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
