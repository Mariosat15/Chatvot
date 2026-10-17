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
 * Daily Volt Flow — desktop-parity positive/negative bars with glow.
 */
export default function MobileDailyFlow({ data }: { data: FlowPoint[] }) {
  return (
    <section
      aria-label="Daily volt flow"
      className="rounded-[18px] border border-cyan-400/25 bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)] p-4 shadow-[0_0_22px_rgba(0,229,255,0.1)]"
    >
      <div className="mb-2 flex items-start gap-2">
        <Image
          src={WALLET_ART.dailyFlow}
          alt=""
          width={28}
          height={28}
          className="mt-0.5 h-7 w-7 shrink-0 object-contain"
        />
        <div>
          <h2 className="text-sm font-bold text-white">Daily Volt Flow</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Green = Volts in · Red = Volts out
          </p>
        </div>
      </div>

      {data.length < 1 ? (
        <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">
          Daily flow will appear once you have activity
        </div>
      ) : (
        <div className="mt-2 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
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
                interval="preserveStartEnd"
              />
              <YAxis
                orientation="right"
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
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
                labelFormatter={(v) => formatAxisDate(String(v))}
                formatter={(value: number) => [
                  `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)} ⚡`,
                  "Net",
                ]}
              />
              <Bar dataKey="net" radius={[4, 4, 4, 4]} maxBarSize={18}>
                {data.map((d, i) => (
                  <Cell
                    key={`${d.date}-${i}`}
                    fill={barColor(d.net)}
                    style={{
                      filter: `drop-shadow(0 0 6px ${barColor(d.net)}88)`,
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
