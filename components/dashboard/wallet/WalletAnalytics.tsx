"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Calendar } from "lucide-react";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import {
  WalletInsightsRow,
  WalletKpiRow,
  WalletPanel,
  WalletPanelHeader,
  type WalletInsight,
  type WalletKpi,
} from "./WalletChrome";
import SpendingVsEarnings from "./SpendingVsEarnings";

const EquityChart = dynamic(() => import("../EquityChart"), { ssr: false });
const DailyCreditFlow = dynamic(() => import("../DailyCreditFlow"), {
  ssr: false,
});
const CreditBreakdownChart = dynamic(() => import("../CreditBreakdownChart"), {
  ssr: false,
});

type Props = {
  overview: ComprehensiveDashboardData["overview"];
  charts: ComprehensiveDashboardData["charts"];
};

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

type BreakdownRow =
  ComprehensiveDashboardData["charts"]["dailyCreditBreakdown"][number];

// Reason: allow-list read — avoids dynamic indexing that trips object-injection.
type BreakdownMetric =
  | "entries"
  | "marketplace"
  | "withdrawals"
  | "wins"
  | "gmEarnings"
  | "deposits"
  | "refunds";

function metricOf(row: BreakdownRow, key: BreakdownMetric): number {
  switch (key) {
    case "entries":
      return Number(row.entries) || 0;
    case "marketplace":
      return Number(row.marketplace) || 0;
    case "withdrawals":
      return Number(row.withdrawals) || 0;
    case "wins":
      return Number(row.wins) || 0;
    case "gmEarnings":
      return Number(row.gmEarnings) || 0;
    case "deposits":
      return Number(row.deposits) || 0;
    case "refunds":
      return Number(row.refunds) || 0;
  }
}

function halfSums(
  rows: ComprehensiveDashboardData["charts"]["dailyCreditBreakdown"],
  key: BreakdownMetric,
): { current: number; previous: number; spark: number[] } {
  if (!rows.length) return { current: 0, previous: 0, spark: [] };
  const mid = Math.floor(rows.length / 2);
  const prev = rows.slice(0, mid);
  const cur = rows.slice(mid);
  const sum = (list: typeof rows) =>
    list.reduce((s, r) => s + metricOf(r, key), 0);
  const spark = rows.map((r) => metricOf(r, key));
  return { current: sum(cur), previous: sum(prev), spark };
}

function formatRangeLabel(history: { date: string }[]): string {
  if (!history.length) return "All time";
  const first = history[0]?.date;
  const last = history[history.length - 1]?.date;
  if (!first || !last) return "All time";
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  return `${fmt(first)} – ${fmt(last)}`;
}

/**
 * Wallet Analytics — owner mock (30 Sep 2026).
 * Desktop dashboard `?tab=wallet`. Reuses chart series already on the payload;
 * chrome and neon art are new.
 */
export default function WalletAnalytics({ overview, charts }: Props) {
  const breakdown = useMemo(
    () => charts.dailyCreditBreakdown ?? [],
    [charts.dailyCreditBreakdown],
  );
  const history = useMemo(
    () => charts.walletBalanceHistory ?? [],
    [charts.walletBalanceHistory],
  );
  const totals = charts.allTimeTotals;

  const rangeLabel = useMemo(() => formatRangeLabel(history), [history]);

  const kpis: WalletKpi[] = useMemo(() => {
    const balSpark = history.map((h) => h.balance);
    const mid = Math.floor(history.length / 2);
    const balPrev = history[Math.max(0, mid - 1)]?.balance ?? 0;
    const balCur = history[history.length - 1]?.balance ?? overview.creditBalance;

    const spend = halfSums(breakdown, "entries");
    const market = halfSums(breakdown, "marketplace");
    const withdraw = halfSums(breakdown, "withdrawals");
    const spendCur = spend.current + market.current + withdraw.current;
    const spendPrev = spend.previous + market.previous + withdraw.previous;
    const spendSpark = breakdown.map(
      (d) => d.entries + d.marketplace + d.withdrawals,
    );

    const wins = halfSums(breakdown, "wins");
    const gm = halfSums(breakdown, "gmEarnings");

    return [
      {
        key: "balance",
        label: "Credit Balance",
        value: overview.creditBalance,
        deltaPct: pctChange(balCur, balPrev),
        tone: "gold",
        art: WALLET_ART.balance,
        spark: balSpark.slice(-14),
      },
      {
        key: "spend",
        label: "Total Spend",
        value: overview.totalSpent,
        deltaPct: pctChange(spendCur, spendPrev),
        tone: "magenta",
        art: WALLET_ART.spend,
        spark: spendSpark.slice(-14),
      },
      {
        key: "game",
        label: "Game Earnings",
        value: wins.current || totals.wins || 0,
        deltaPct: pctChange(wins.current, wins.previous),
        tone: "cyan",
        art: WALLET_ART.gameEarnings,
        spark: wins.spark.slice(-14),
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: overview.totalPrizesWon,
        deltaPct: pctChange(
          wins.current + gm.current,
          wins.previous + gm.previous,
        ),
        tone: "orange",
        art: WALLET_ART.prizes,
        spark: breakdown.map((d) => d.wins + d.gmEarnings).slice(-14),
      },
    ];
  }, [breakdown, history, overview, totals.wins]);

  const insights: WalletInsight[] = useMemo(() => {
    const deposits = halfSums(breakdown, "deposits");
    const withdrawals = halfSums(breakdown, "withdrawals");
    const purchases = halfSums(breakdown, "marketplace");
    const entries = halfSums(breakdown, "entries");
    const wins = halfSums(breakdown, "wins");
    const refunds = halfSums(breakdown, "refunds");
    const flow = charts.dailyCreditFlow ?? [];
    const mid = Math.floor(flow.length / 2);
    const netSpark = flow.map((d) => d.net);
    const netCur = flow.slice(mid).reduce((s, d) => s + d.net, 0);
    const netPrev = flow.slice(0, mid).reduce((s, d) => s + d.net, 0);

    const purchaseCur = purchases.current + entries.current;
    const purchasePrev = purchases.previous + entries.previous;
    const purchaseFallback = totals.marketplace + totals.entries;

    return [
      {
        key: "deposits",
        label: "Deposits",
        value: deposits.current || totals.deposits,
        deltaPct: pctChange(deposits.current, deposits.previous),
        tone: "green",
        art: WALLET_ART.deposits,
        spark: deposits.spark.slice(-10),
      },
      {
        key: "withdrawals",
        label: "Withdrawals",
        value: withdrawals.current || totals.withdrawals,
        deltaPct: pctChange(withdrawals.current, withdrawals.previous),
        tone: "red",
        art: WALLET_ART.withdrawals,
        spark: withdrawals.spark.slice(-10),
      },
      {
        key: "purchases",
        label: "Purchases",
        // Reason: parentheses required — `a + b || c` would short-circuit on a alone.
        value: purchaseCur || purchaseFallback,
        deltaPct: pctChange(purchaseCur, purchasePrev),
        tone: "gold",
        art: WALLET_ART.purchases,
        spark: breakdown.map((d) => d.marketplace + d.entries).slice(-10),
      },
      {
        key: "game",
        label: "Game Earnings",
        value: wins.current || totals.wins,
        deltaPct: pctChange(wins.current, wins.previous),
        tone: "cyan",
        art: WALLET_ART.gameEarnings,
        spark: wins.spark.slice(-10),
      },
      {
        key: "bonuses",
        label: "Bonuses",
        value: refunds.current || totals.refunds,
        deltaPct: pctChange(refunds.current, refunds.previous),
        tone: "pink",
        art: WALLET_ART.bonuses,
        spark: refunds.spark.slice(-10),
      },
      {
        key: "net",
        label: "Net Movement",
        value: netCur,
        deltaPct: pctChange(netCur, netPrev),
        tone: "green",
        art: WALLET_ART.netMovement,
        spark: netSpark.slice(-10),
      },
    ];
  }, [breakdown, charts.dailyCreditFlow, totals]);

  const spendSlices = useMemo(() => {
    const purchases = totals.marketplace + totals.entries;
    return [
      { key: "purchases", label: "Purchases", value: purchases, color: "#EAB308" },
      { key: "prizes", label: "Prizes Won", value: totals.wins, color: "#FB923C" },
      {
        key: "withdrawals",
        label: "Withdrawals",
        value: totals.withdrawals,
        color: "#F472B6",
      },
      {
        key: "deposits",
        label: "Deposits",
        value: totals.deposits,
        color: "#34D399",
      },
      {
        key: "gm",
        label: "GM Earnings",
        value: totals.gmEarnings,
        color: "#22D3EE",
      },
      {
        key: "bonuses",
        label: "Bonuses",
        value: totals.refunds,
        color: "#E879F9",
      },
    ].filter((s) => s.value > 0);
  }, [totals]);

  return (
    <div className="relative space-y-4 sm:space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#050B18]/80">
        <div className="pointer-events-none absolute inset-0 opacity-45">
          <Image
            src={WALLET_ART.backdrop}
            alt=""
            fill
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050B18] via-[#050B18]/85 to-[#050B18]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050B18] via-transparent to-[#050B18]/50" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
              <Image
                src={WALLET_ART.header}
                alt=""
                fill
                sizes="64px"
                className="object-contain drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Wallet Analytics
              </h2>
              <p className="mt-1 max-w-xl text-sm text-slate-300">
                Track your credits, spending, earnings and overall wallet activity.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-black/40 px-3.5 py-2 text-xs font-medium text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.2)]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
            <span className="tabular-nums">{rangeLabel}</span>
          </div>
        </div>
      </div>

      <WalletKpiRow items={kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WalletPanel tone="gold" className="min-h-[320px]">
          <WalletPanelHeader
            title="Wallet Balance Trend"
            subtitle="How your credit balance moved over time."
          />
          <div className="p-3 sm:p-4">
            {/*
              Reason: EquityChart owns the 7d/30d/90d/all chips (mock range
              control). embedded strips its old grey card chrome so only the
              neon WalletPanel border shows.
            */}
            <EquityChart data={history} embedded defaultRange="30d" />
          </div>
        </WalletPanel>

        <WalletPanel tone="cyan" className="min-h-[320px]">
          <WalletPanelHeader
            title="Credit Breakdown"
            subtitle="Daily mix of deposits, prizes, spend and withdrawals."
          />
          <div className="p-3 sm:p-4">
            <CreditBreakdownChart
              data={breakdown}
              allTimeTotals={totals}
              embedded
            />
          </div>
        </WalletPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WalletPanel tone="cyan" className="min-h-[300px]">
          <WalletPanelHeader
            title="Daily Credit Flow"
            subtitle="Net credit movement each day — inflows up, outflows down."
          />
          <div className="p-3 sm:p-4">
            <DailyCreditFlow data={charts.dailyCreditFlow} embedded />
          </div>
        </WalletPanel>

        <SpendingVsEarnings
          slices={
            spendSlices.length
              ? spendSlices
              : [
                  {
                    key: "empty",
                    label: "No activity yet",
                    value: 1,
                    color: "#334155",
                  },
                ]
          }
        />
      </div>

      <WalletInsightsRow items={insights} />
    </div>
  );
}
