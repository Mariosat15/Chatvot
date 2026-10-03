"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import { AnalyticsCard, ChartRangeSelector } from "./AnalyticsCard";
import WalletNeonIcon from "./WalletNeonIcon";
import { WALLET_GOLD, WALLET_RED, WALLET_TEAL, type WalletRange } from "./wallet-tokens";

type FlowPoint = { date: string; net: number };

function formatAxisDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function barColor(net: number): string {
  if (net > 0) return WALLET_TEAL;
  if (net < 0) return WALLET_RED;
  return WALLET_GOLD;
}

/**
 * Daily Credit Flow — positive/negative bars around zero (rebuild guide §9, §18).
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
  return (
    <AnalyticsCard
      title="Daily Credit Flow"
      subtitle="Daily net credit movement in your wallet."
      icon={
        <WalletNeonIcon
          src={WALLET_ART.netMovement}
          size={32}
          ringClass="ring-cyan-400/45"
          bgClass="bg-cyan-500/15"
        />
      }
      accent="cyan"
      controls={<ChartRangeSelector value={range} onChange={onRangeChange} />}
      bodyClassName="pt-2"
    >
      {data.length < 1 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
          Daily credit flow will appear once you have activity
        </div>
      ) : (
        <div className="h-[240px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
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
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,12,28,0.95)",
                  border: "1px solid rgba(0,229,255,0.35)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fff",
                }}
                labelFormatter={(label) => formatAxisDate(String(label))}
                formatter={(value) => [
                  Number(value) >= 0
                    ? `+${Number(value).toFixed(2)}`
                    : Number(value).toFixed(2),
                  "Net",
                ]}
              />
              <Bar
                dataKey="net"
                radius={[4, 4, 4, 4]}
                maxBarSize={20}
                style={{ filter: "drop-shadow(0 0 6px rgba(16,185,129,0.35))" }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={barColor(entry.net)}
                    style={{
                      filter: `drop-shadow(0 0 6px ${barColor(entry.net)}88)`,
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AnalyticsCard>
  );
}
