"use client";

/**
 * Trading-scoped metrics on the profile (X7 step 3 / Q13).
 * Total Profit lives here — never as a platform-wide headline.
 */

import { TrendingUp, TrendingDown } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TradingPerformanceCardProps {
  combinedStats: any;
}

export default function TradingPerformanceCard({
  combinedStats,
}: TradingPerformanceCardProps) {
  const pnl = Number(combinedStats?.totalPnL) || 0;
  const trades = Number(combinedStats?.totalTrades) || 0;
  const winRate = Number(combinedStats?.winRate) || 0;
  const profitFactor = Number(combinedStats?.profitFactor) || 0;
  const positive = pnl >= 0;

  if (trades === 0 && pnl === 0) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/30 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Trading
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          No closed trades yet. Trading P&amp;L stays on this card — it is never
          mixed into cross-game standing above.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card/30 p-4 sm:p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Trading
        </p>
        <p className="text-xs text-muted-foreground">
          Simulated contest capital — not credits won
        </p>
      </div>

      <div className="flex items-center gap-2">
        {positive ? (
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        ) : (
          <TrendingDown className="w-5 h-5 text-rose-400" />
        )}
        <p
          className={`text-2xl font-semibold tabular-nums ${
            positive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {positive ? "+" : ""}
          {pnl.toFixed(2)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            Total Profit
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Trades</p>
          <p className="font-medium tabular-nums">{trades}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Win rate</p>
          <p className="font-medium tabular-nums">{winRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Profit factor</p>
          <p className="font-medium tabular-nums">
            {profitFactor === 999 ? "∞" : profitFactor.toFixed(2)}
          </p>
        </div>
      </div>
    </section>
  );
}
