"use client";

import { useMemo, useState } from "react";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import WalletAnalyticsHeader from "./WalletAnalyticsHeader";
import WalletBackdrop from "./WalletBackdrop";
import WalletKpiGrid, { type KpiItem } from "./WalletKpiGrid";
import WalletBalanceTrend from "./WalletBalanceTrend";
import CreditBreakdownPanel, {
  type BreakdownDay,
  type BreakdownTotals,
} from "./CreditBreakdownPanel";
import DailyCreditFlowPanel from "./DailyCreditFlowPanel";
import SpendingVsEarnings, { type SpendingSlice } from "./SpendingVsEarnings";
import WalletInsights, { type InsightItem } from "./WalletInsights";
import {
  WALLET_CATEGORY,
  sliceByRange,
  type WalletRange,
} from "./wallet-tokens";

type Props = {
  overview: ComprehensiveDashboardData["overview"];
  charts: ComprehensiveDashboardData["charts"];
};

type RawBreakdown =
  ComprehensiveDashboardData["charts"]["dailyCreditBreakdown"][number];

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function halfWindow<T>(rows: T[]): { prev: T[]; cur: T[] } {
  const mid = Math.floor(rows.length / 2);
  return { prev: rows.slice(0, mid), cur: rows.slice(mid) };
}

function sumField(rows: RawBreakdown[], pick: (r: RawBreakdown) => number): number {
  return rows.reduce((s, r) => s + (pick(r) || 0), 0);
}

function toBreakdownDay(r: RawBreakdown): BreakdownDay {
  return {
    date: r.date,
    deposits: r.deposits || 0,
    // Reason: marketplace + contest entries are both player spend.
    purchases: (r.marketplace || 0) + (r.entries || 0),
    gameEarnings: r.gmEarnings || 0,
    bonuses: r.refunds || 0,
    prizes: r.wins || 0,
    withdrawals: r.withdrawals || 0,
  };
}

function formatRangeLabel(history: { date: string }[]): string {
  if (!history.length) return "All time";
  const first = history[0]?.date;
  const last = history[history.length - 1]?.date;
  if (!first || !last) return "All time";
  const fmt = (iso: string) => {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
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
 * Wallet Analytics — rebuilt to match owner reference (rebuild guide).
 * One global period drives every chart and the insights strip.
 */
export default function WalletAnalytics({ overview, charts }: Props) {
  const [range, setRange] = useState<WalletRange>("30d");

  const historyAll = useMemo(
    () => charts.walletBalanceHistory ?? [],
    [charts.walletBalanceHistory],
  );
  const breakdownAll = useMemo(
    () => charts.dailyCreditBreakdown ?? [],
    [charts.dailyCreditBreakdown],
  );
  const flowAll = useMemo(
    () => charts.dailyCreditFlow ?? [],
    [charts.dailyCreditFlow],
  );
  const totals = charts.allTimeTotals;

  const history = useMemo(
    () => sliceByRange(historyAll, range),
    [historyAll, range],
  );
  const breakdownRaw = useMemo(
    () => sliceByRange(breakdownAll, range),
    [breakdownAll, range],
  );
  const flow = useMemo(() => sliceByRange(flowAll, range), [flowAll, range]);

  const breakdownDays = useMemo(
    () => breakdownRaw.map(toBreakdownDay),
    [breakdownRaw],
  );

  const breakdownTotals: BreakdownTotals = useMemo(() => {
    const empty: BreakdownTotals = {
      deposits: 0,
      purchases: 0,
      gameEarnings: 0,
      bonuses: 0,
      prizes: 0,
      withdrawals: 0,
    };
    for (const d of breakdownDays) {
      empty.deposits += d.deposits;
      empty.purchases += d.purchases;
      empty.gameEarnings += d.gameEarnings;
      empty.bonuses += d.bonuses;
      empty.prizes += d.prizes;
      empty.withdrawals += d.withdrawals;
    }
    // Reason: if the window is empty, fall back to all-time so tiles are not blank.
    if (breakdownDays.length === 0) {
      return {
        deposits: totals.deposits,
        purchases: totals.marketplace + totals.entries,
        gameEarnings: totals.gmEarnings,
        bonuses: totals.refunds,
        prizes: totals.wins,
        withdrawals: totals.withdrawals,
      };
    }
    return empty;
  }, [breakdownDays, totals]);

  const rangeLabel = useMemo(() => formatRangeLabel(history), [history]);

  const kpis: KpiItem[] = useMemo(() => {
    const { prev: hPrev, cur: hCur } = halfWindow(history);
    const balPrev = hPrev[hPrev.length - 1]?.balance ?? history[0]?.balance ?? 0;
    const balCur =
      hCur[hCur.length - 1]?.balance ??
      history[history.length - 1]?.balance ??
      overview.creditBalance;

    const { prev: bPrev, cur: bCur } = halfWindow(breakdownRaw);
    const spendCur =
      sumField(bCur, (r) => r.entries + r.marketplace + r.withdrawals);
    const spendPrev =
      sumField(bPrev, (r) => r.entries + r.marketplace + r.withdrawals);
    const gameCur = sumField(bCur, (r) => r.gmEarnings);
    const gamePrev = sumField(bPrev, (r) => r.gmEarnings);
    const prizeCur = sumField(bCur, (r) => r.wins);
    const prizePrev = sumField(bPrev, (r) => r.wins);

    return [
      {
        key: "balance",
        label: "Credit Balance",
        value: overview.creditBalance,
        deltaPct: pctChange(balCur, balPrev),
        accent: "gold",
        spark: history.map((h) => h.balance).slice(-14),
      },
      {
        key: "spend",
        label: "Total Spend",
        value: overview.totalSpent,
        deltaPct: pctChange(spendCur, spendPrev),
        accent: "magenta",
        spark: breakdownRaw
          .map((d) => d.entries + d.marketplace + d.withdrawals)
          .slice(-14),
      },
      {
        key: "game",
        label: "Game Earnings",
        value: gameCur || totals.gmEarnings || 0,
        deltaPct: pctChange(gameCur, gamePrev),
        accent: "cyan",
        spark: breakdownRaw.map((d) => d.gmEarnings).slice(-14),
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: overview.totalPrizesWon,
        deltaPct: pctChange(prizeCur, prizePrev),
        accent: "orange",
        spark: breakdownRaw.map((d) => d.wins).slice(-14),
      },
    ];
  }, [breakdownRaw, history, overview, totals.gmEarnings]);

  const spendSlices: SpendingSlice[] = useMemo(() => {
    const rows: SpendingSlice[] = [
      {
        key: "purchases",
        label: "Purchases",
        value: breakdownTotals.purchases,
        color: WALLET_CATEGORY.purchases,
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: breakdownTotals.prizes,
        color: WALLET_CATEGORY.prizes,
      },
      {
        key: "game",
        label: "Game Earnings",
        value: breakdownTotals.gameEarnings,
        color: WALLET_CATEGORY.gameEarnings,
      },
      {
        key: "bonuses",
        label: "Bonuses",
        value: breakdownTotals.bonuses,
        color: WALLET_CATEGORY.bonuses,
      },
      {
        key: "withdrawals",
        label: "Withdrawals",
        value: breakdownTotals.withdrawals,
        color: WALLET_CATEGORY.withdrawals,
      },
      {
        key: "deposits",
        label: "Deposits",
        value: breakdownTotals.deposits,
        color: WALLET_CATEGORY.deposits,
      },
    ].filter((s) => s.value > 0);

    if (!rows.length) {
      return [
        {
          key: "empty",
          label: "No activity yet",
          value: 1,
          color: "#334155",
        },
      ];
    }
    return rows;
  }, [breakdownTotals]);

  const insights: InsightItem[] = useMemo(() => {
    const { prev, cur } = halfWindow(breakdownRaw);
    const depositsCur = sumField(cur, (r) => r.deposits);
    const depositsPrev = sumField(prev, (r) => r.deposits);
    const withdrawCur = sumField(cur, (r) => r.withdrawals);
    const withdrawPrev = sumField(prev, (r) => r.withdrawals);
    const purchaseCur = sumField(cur, (r) => r.marketplace + r.entries);
    const purchasePrev = sumField(prev, (r) => r.marketplace + r.entries);
    const gameCur = sumField(cur, (r) => r.gmEarnings);
    const gamePrev = sumField(prev, (r) => r.gmEarnings);
    const bonusCur = sumField(cur, (r) => r.refunds);
    const bonusPrev = sumField(prev, (r) => r.refunds);
    const prizeCur = sumField(cur, (r) => r.wins);
    const prizePrev = sumField(prev, (r) => r.wins);

    const { prev: fPrev, cur: fCur } = halfWindow(flow);
    const netCur = fCur.reduce((s, d) => s + d.net, 0);
    const netPrev = fPrev.reduce((s, d) => s + d.net, 0);

    return [
      {
        key: "deposits",
        label: "Deposits",
        value: depositsCur || breakdownTotals.deposits,
        deltaPct: pctChange(depositsCur, depositsPrev),
        spark: breakdownRaw.map((d) => d.deposits).slice(-10),
      },
      {
        key: "withdrawals",
        label: "Withdrawals",
        value: withdrawCur || breakdownTotals.withdrawals,
        deltaPct: pctChange(withdrawCur, withdrawPrev),
        spark: breakdownRaw.map((d) => d.withdrawals).slice(-10),
      },
      {
        key: "purchases",
        label: "Purchases",
        // Reason: parentheses — `a + b || c` short-circuits on a alone.
        value: purchaseCur || breakdownTotals.purchases,
        deltaPct: pctChange(purchaseCur, purchasePrev),
        spark: breakdownRaw
          .map((d) => d.marketplace + d.entries)
          .slice(-10),
      },
      {
        key: "gameEarnings",
        label: "Game Earnings",
        value: gameCur || breakdownTotals.gameEarnings,
        deltaPct: pctChange(gameCur, gamePrev),
        spark: breakdownRaw.map((d) => d.gmEarnings).slice(-10),
      },
      {
        key: "bonuses",
        label: "Bonuses",
        value: bonusCur || breakdownTotals.bonuses,
        deltaPct: pctChange(bonusCur, bonusPrev),
        spark: breakdownRaw.map((d) => d.refunds).slice(-10),
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: prizeCur || breakdownTotals.prizes,
        deltaPct: pctChange(prizeCur, prizePrev),
        spark: breakdownRaw.map((d) => d.wins).slice(-10),
      },
      {
        key: "net",
        label: "Net Movement",
        value: netCur,
        deltaPct: pctChange(netCur, netPrev),
        spark: flow.map((d) => d.net).slice(-10),
      },
    ];
  }, [breakdownRaw, breakdownTotals, flow]);

  return (
    <WalletBackdrop>
      <WalletAnalyticsHeader rangeLabel={rangeLabel} />
      <WalletKpiGrid items={kpis} />

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.1fr_1fr] xl:gap-4">
        <WalletBalanceTrend
          data={history}
          range={range}
          onRangeChange={setRange}
        />
        <CreditBreakdownPanel data={breakdownDays} totals={breakdownTotals} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.1fr_1fr] xl:gap-4">
        <DailyCreditFlowPanel
          data={flow}
          range={range}
          onRangeChange={setRange}
        />
        <SpendingVsEarnings slices={spendSlices} />
      </div>

      <WalletInsights items={insights} />
    </WalletBackdrop>
  );
}
