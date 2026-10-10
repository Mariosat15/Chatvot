"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { AnalyticsCard, ChartRangeSelector } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";
import { WALLET_RED, WALLET_TEAL, type WalletRange } from "./wallet-tokens";

type FlowPoint = { date: string; net: number };

function formatAxisDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Daily Credit Flow — area + line around zero (desktop only).
 * Reason: owner 6 Oct 2026 — diverging bars were hard to read; wave chart
 * shows net movement continuously while keeping the zero baseline.
 */
export default function DailyCreditFlowPanel({
  data,
  range,
  onRangeChange,
}: {
  data: FlowPoint[];
  range: WalletRange;
  onRangeChange: (next: WalletRange) => void;
}) {
  // Reason: split so teal fills above zero and rose fills below without stacking.
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        net: d.net,
        gain: d.net > 0 ? d.net : 0,
        loss: d.net < 0 ? d.net : 0,
      })),
    [data],
  );

  return (
    <AnalyticsCard
      title="Daily Volt Flow"
      subtitle="Daily net volt movement in your wallet."
      icon={
        <WalletNeonIcon
          src={WALLET_ART.dailyFlow}
          size={32}
          ringClass="ring-cyan-400/45"
          bgClass="bg-transparent"
        />
      }
      accent="cyan"
      controls={<ChartRangeSelector value={range} onChange={onRangeChange} />}
      // Reason: same stretch gap as Wallet Balance Trend — grow into the row.
      bodyClassName="min-h-0 flex-1 pt-2"
    >
      {data.length < 1 ? (
        <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-slate-500">
          Daily volt flow will appear once you have activity
        </div>
      ) : (
        <div className="min-h-[200px] w-full flex-1 sm:min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="wallet-flow-gain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={WALLET_TEAL} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={WALLET_TEAL} stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="wallet-flow-loss" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={WALLET_RED} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={WALLET_RED} stopOpacity={0.04} />
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
                  Math.abs(v) >= 1000
                    ? `${(v / 1000).toFixed(1)}k`
                    : String(Math.round(v))
                }
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              <Tooltip
                filterNull
                contentStyle={{
                  background: "rgba(5,12,28,0.95)",
                  border: "1px solid rgba(0,229,255,0.35)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelFormatter={(label) => formatAxisDate(String(label))}
                // Reason: gain/loss areas are fill only — tooltip reports the net line.
                formatter={(value, name) => {
                  if (name !== "Net") return [undefined, undefined];
                  const n = Number(value);
                  return [n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2), "Net"];
                }}
              />
              <Area
                type="monotone"
                dataKey="gain"
                legendType="none"
                stroke="none"
                fill="url(#wallet-flow-gain)"
                fillOpacity={1}
                isAnimationActive={false}
                activeDot={false}
              />
              <Area
                type="monotone"
                dataKey="loss"
                legendType="none"
                stroke="none"
                fill="url(#wallet-flow-loss)"
                fillOpacity={1}
                isAnimationActive={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net"
                stroke="#67E8F9"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, fill: "#A5F3FC", stroke: "#0891B2" }}
                style={{ filter: "drop-shadow(0 0 6px rgba(103,232,249,0.55))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </AnalyticsCard>
  );
}
