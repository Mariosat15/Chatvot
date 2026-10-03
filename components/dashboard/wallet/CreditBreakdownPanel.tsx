"use client";

import {
  Bar,
  BarChart,
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
  purchases: number;
  gameEarnings: number;
  bonuses: number;
  prizes: number;
  withdrawals: number;
};

export type BreakdownTotals = {
  deposits: number;
  purchases: number;
  gameEarnings: number;
  bonuses: number;
  prizes: number;
  withdrawals: number;
};

const SERIES = [
  { key: "deposits", label: "Deposits", color: WALLET_CATEGORY.deposits },
  { key: "purchases", label: "Purchases", color: WALLET_CATEGORY.purchases },
  {
    key: "gameEarnings",
    label: "Game Earnings",
    color: WALLET_CATEGORY.gameEarnings,
  },
  { key: "bonuses", label: "Bonuses", color: WALLET_CATEGORY.bonuses },
  { key: "prizes", label: "Prizes", color: WALLET_CATEGORY.prizes },
  {
    key: "withdrawals",
    label: "Withdrawals",
    color: WALLET_CATEGORY.withdrawals,
  },
] as const;

function formatAxisDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Credit Breakdown — multi-series bars + six summary tiles (rebuild guide §7).
 */
export default function CreditBreakdownPanel({
  data,
  totals,
}: {
  data: BreakdownDay[];
  totals: BreakdownTotals;
}) {
  const summary = [
    { key: "deposits", label: "Total Deposits", value: totals.deposits },
    { key: "purchases", label: "Total Purchases", value: totals.purchases },
    { key: "gameEarnings", label: "Game Earnings", value: totals.gameEarnings },
    { key: "bonuses", label: "Bonuses", value: totals.bonuses },
    { key: "prizes", label: "Prizes Won", value: totals.prizes },
    { key: "withdrawals", label: "Withdrawals", value: totals.withdrawals },
  ] as const;

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
        <div className="h-[180px] w-full sm:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="18%"
            >
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
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
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
              {SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={12}
                  style={{ filter: `drop-shadow(0 0 5px ${s.color}99)` }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
