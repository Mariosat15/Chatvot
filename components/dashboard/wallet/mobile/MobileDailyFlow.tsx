"use client";

import Image from "next/image";
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
import { WALLET_GOLD, WALLET_RED, WALLET_TEAL } from "../wallet-tokens";

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
 * Daily Volt Flow — compact positive/negative bars around zero.
 */
export default function MobileDailyFlow({ data }: { data: FlowPoint[] }) {
  return (
    <section
      aria-label="Daily volt flow"
      className="rounded-[18px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)] p-4"
    >
      <div className="mb-2 flex items-start gap-2">
        <Image
          src={WALLET_ART.dailyFlow}
          alt=""
          width={28}
          height={28}
          className="mt-0.5 h-7 w-7 shrink-0 object-contain mix-blend-screen"
        />
        <div>
          <h2 className="text-sm font-bold text-white">Daily Credit Flow</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Green = Volts in · Red = Volts out
          </p>
        </div>
      </div>

      {data.length < 1 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
          Daily flow will appear once you have activity
        </div>
      ) : (
        <div className="mt-2 h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickCount={4}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Tooltip
                contentStyle={{
                  background: "rgba(8,14,28,0.96)",
                  border: "1px solid rgba(0,229,255,0.3)",
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelFormatter={(v) => formatAxisDate(String(v))}
                formatter={(value: number) => [
                  `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)} ⚡`,
                  "Net",
                ]}
              />
              <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {data.map((d, i) => (
                  <Cell key={`${d.date}-${i}`} fill={barColor(d.net)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
