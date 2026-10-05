"use client";

import Image from "next/image";
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
import { ChartRangeSelector } from "../AnalyticsCard";
import { WALLET_GOLD, type WalletRange } from "../wallet-tokens";

type Point = { date: string; balance: number; change?: number };

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
 * Full-width mobile balance trend — tall chart, sparse axes, shared range.
 */
export default function MobileWalletTrend({
  data,
  range,
  onRangeChange,
}: {
  data: Point[];
  range: WalletRange;
  onRangeChange: (next: WalletRange) => void;
}) {
  return (
    <section
      aria-label="Wallet balance trend"
      className="rounded-[18px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)] p-4"
    >
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Image
            src={WALLET_ART.trend}
            alt=""
            width={28}
            height={28}
            className="mt-0.5 h-7 w-7 shrink-0 object-contain"
          />
          <div>
            <h2 className="text-sm font-bold text-white">Wallet Balance Trend</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              See how your Volt balance changes over time.
            </p>
          </div>
        </div>
        <ChartRangeSelector value={range} onChange={onRangeChange} />
      </div>

      {data.length < 2 ? (
        <div className="flex h-[230px] items-center justify-center text-sm text-slate-500">
          Make a deposit to start tracking your wallet balance
        </div>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="mwGoldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={WALLET_GOLD} stopOpacity={0.55} />
                  <stop offset="55%" stopColor={WALLET_GOLD} stopOpacity={0.16} />
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
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickCount={4}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(8,14,28,0.96)",
                  border: "1px solid rgba(250,204,21,0.35)",
                  borderRadius: 12,
                  fontSize: 13,
                  padding: "10px 12px",
                }}
                labelFormatter={(v) => formatTipDate(String(v))}
                formatter={(value: number, _name, item) => {
                  const change = (item?.payload as Point | undefined)?.change;
                  const lines = [`${Number(value).toFixed(2)} ⚡`];
                  if (typeof change === "number" && change !== 0) {
                    lines.push(
                      `${change >= 0 ? "+" : ""}${change.toFixed(2)} change`,
                    );
                  }
                  return [lines.join(" · "), "Balance"];
                }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={WALLET_GOLD}
                strokeWidth={2.5}
                fill="url(#mwGoldFill)"
                activeDot={{ r: 5, strokeWidth: 0, fill: WALLET_GOLD }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
