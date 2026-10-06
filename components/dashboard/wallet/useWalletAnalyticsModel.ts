"use client";

import { useMemo, useState } from "react";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import type { KpiItem } from "./WalletKpiGrid";
import type { BreakdownDay, BreakdownTotals } from "./CreditBreakdownPanel";
import type { SpendingSlice } from "./SpendingVsEarnings";
import type { InsightItem } from "./WalletInsights";
import {
  WALLET_CATEGORY,
  sliceByRange,
  type WalletRange,
} from "./wallet-tokens";

type Overview = ComprehensiveDashboardData["overview"];
type Charts = ComprehensiveDashboardData["charts"];
type RawBreakdown = Charts["dailyCreditBreakdown"][number];

export function pctChange(current: number, previous: number): number | null {
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

export function toBreakdownDay(r: RawBreakdown): BreakdownDay {
  return {
    date: r.date,
    deposits: r.deposits || 0,
    contestEntries: r.entries || 0,
    marketplace: r.marketplace || 0,
    gmSpend: r.gmSpend || 0,
    gmEarnings: r.gmEarnings || 0,
    giftCredits: r.giftCredits || 0,
    prizes: r.wins || 0,
    withdrawals: r.withdrawals || 0,
    refunds: r.refunds || 0,
  };
}

export function formatRangeLabel(history: { date: string }[]): string {
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

function periodSpend(r: RawBreakdown): number {
  return (
    (r.entries || 0) +
    (r.marketplace || 0) +
    (r.gmSpend || 0) +
    (r.withdrawals || 0) +
    (r.giftCreditsOut || 0)
  );
}

/**
 * Shared Wallet Analytics model — one period drives every panel.
 * Desktop and mobile layouts both consume this; neither owns the math.
 */
export function useWalletAnalyticsModel(overview: Overview, charts: Charts) {
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
      contestEntries: 0,
      marketplace: 0,
      gmSpend: 0,
      gmEarnings: 0,
      giftCredits: 0,
      giftCreditsOut: 0,
      prizes: 0,
      withdrawals: 0,
      refunds: 0,
    };
    for (const d of breakdownDays) {
      empty.deposits += d.deposits;
      empty.contestEntries += d.contestEntries;
      empty.marketplace += d.marketplace;
      empty.gmSpend += d.gmSpend;
      empty.gmEarnings += d.gmEarnings;
      empty.giftCredits += d.giftCredits;
      empty.prizes += d.prizes;
      empty.withdrawals += d.withdrawals;
      empty.refunds += d.refunds;
    }
    for (const r of breakdownRaw) {
      empty.giftCreditsOut += r.giftCreditsOut || 0;
    }
    // Reason: if the window is empty, fall back to all-time so tiles are not blank.
    if (breakdownDays.length === 0) {
      return {
        deposits: totals.deposits,
        contestEntries: totals.entries,
        marketplace: totals.marketplace,
        gmSpend: totals.gmSpend,
        gmEarnings: totals.gmEarnings,
        giftCredits: totals.giftCredits,
        giftCreditsOut: totals.giftCreditsOut,
        prizes: totals.wins,
        withdrawals: totals.withdrawals,
        refunds: totals.refunds,
      };
    }
    return empty;
  }, [breakdownDays, breakdownRaw, totals]);

  const rangeLabel = useMemo(() => formatRangeLabel(history), [history]);

  const periodChange = useMemo(() => {
    if (history.length < 2) {
      const last = history[history.length - 1];
      return { amount: last?.change ?? 0, pct: null as number | null };
    }
    const first = history[0]!.balance;
    const last = history[history.length - 1]!.balance;
    return { amount: last - first, pct: pctChange(last, first) };
  }, [history]);

  const kpis: KpiItem[] = useMemo(() => {
    const { prev: hPrev, cur: hCur } = halfWindow(history);
    const balPrev = hPrev[hPrev.length - 1]?.balance ?? history[0]?.balance ?? 0;
    const balCur =
      hCur[hCur.length - 1]?.balance ??
      history[history.length - 1]?.balance ??
      overview.creditBalance;

    const { prev: bPrev, cur: bCur } = halfWindow(breakdownRaw);
    const spendCur = sumField(bCur, periodSpend);
    const spendPrev = sumField(bPrev, periodSpend);
    const gmCur = sumField(bCur, (r) => r.gmEarnings);
    const gmPrev = sumField(bPrev, (r) => r.gmEarnings);
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
        // Reason: period spend — overview.totalSpent is all-time and mixed periods.
        value: spendCur,
        deltaPct: pctChange(spendCur, spendPrev),
        accent: "magenta",
        spark: breakdownRaw.map(periodSpend).slice(-14),
      },
      {
        key: "game",
        label: "GM Earnings",
        value: gmCur,
        deltaPct: pctChange(gmCur, gmPrev),
        accent: "cyan",
        spark: breakdownRaw.map((d) => d.gmEarnings).slice(-14),
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: prizeCur,
        deltaPct: pctChange(prizeCur, prizePrev),
        accent: "orange",
        spark: breakdownRaw.map((d) => d.wins).slice(-14),
      },
    ];
  }, [breakdownRaw, history, overview.creditBalance]);

  const spendSlices: SpendingSlice[] = useMemo(() => {
    const rows: SpendingSlice[] = [
      {
        key: "contestEntries",
        label: "Contest Entries",
        value: breakdownTotals.contestEntries,
        color: WALLET_CATEGORY.contestEntries,
      },
      {
        key: "marketplace",
        label: "Marketplace",
        value: breakdownTotals.marketplace,
        color: WALLET_CATEGORY.marketplace,
      },
      {
        key: "gmSpend",
        label: "GM Spend",
        value: breakdownTotals.gmSpend,
        color: WALLET_CATEGORY.gmSpend,
      },
      {
        key: "withdrawals",
        label: "Withdrawals",
        value: breakdownTotals.withdrawals,
        color: WALLET_CATEGORY.withdrawals,
      },
      {
        key: "giftCreditsOut",
        label: "Gift Credits Removed",
        value: breakdownTotals.giftCreditsOut,
        color: WALLET_CATEGORY.giftCreditsOut,
      },
      {
        key: "deposits",
        label: "Deposits",
        value: breakdownTotals.deposits,
        color: WALLET_CATEGORY.deposits,
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: breakdownTotals.prizes,
        color: WALLET_CATEGORY.prizes,
      },
      {
        key: "gmEarnings",
        label: "GM Earnings",
        value: breakdownTotals.gmEarnings,
        color: WALLET_CATEGORY.gmEarnings,
      },
      {
        key: "giftCredits",
        label: "Gift Credits",
        value: breakdownTotals.giftCredits,
        color: WALLET_CATEGORY.giftCredits,
      },
      {
        key: "refunds",
        label: "Refunds",
        value: breakdownTotals.refunds,
        color: WALLET_CATEGORY.refunds,
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
    const marketCur = sumField(cur, (r) => r.marketplace);
    const marketPrev = sumField(prev, (r) => r.marketplace);
    const gmCur = sumField(cur, (r) => r.gmEarnings);
    const gmPrev = sumField(prev, (r) => r.gmEarnings);
    const giftCur = sumField(cur, (r) => r.giftCredits);
    const giftPrev = sumField(prev, (r) => r.giftCredits);
    const prizeCur = sumField(cur, (r) => r.wins);
    const prizePrev = sumField(prev, (r) => r.wins);

    const { prev: fPrev, cur: fCur } = halfWindow(flow);
    const netCur = fCur.reduce((s, d) => s + d.net, 0);
    const netPrev = fPrev.reduce((s, d) => s + d.net, 0);

    return [
      {
        key: "deposits",
        label: "Deposits",
        value: depositsCur,
        deltaPct: pctChange(depositsCur, depositsPrev),
        spark: breakdownRaw.map((d) => d.deposits).slice(-10),
      },
      {
        key: "withdrawals",
        label: "Withdrawals",
        value: withdrawCur,
        deltaPct: pctChange(withdrawCur, withdrawPrev),
        spark: breakdownRaw.map((d) => d.withdrawals).slice(-10),
      },
      {
        key: "marketplace",
        label: "Marketplace",
        value: marketCur,
        deltaPct: pctChange(marketCur, marketPrev),
        spark: breakdownRaw.map((d) => d.marketplace).slice(-10),
      },
      {
        key: "gmEarnings",
        label: "GM Earnings",
        value: gmCur,
        deltaPct: pctChange(gmCur, gmPrev),
        spark: breakdownRaw.map((d) => d.gmEarnings).slice(-10),
      },
      {
        key: "giftCredits",
        label: "Gift Credits",
        value: giftCur,
        deltaPct: pctChange(giftCur, giftPrev),
        spark: breakdownRaw.map((d) => d.giftCredits).slice(-10),
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: prizeCur,
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
  }, [breakdownRaw, flow]);

  const moneyIn = useMemo(
    () =>
      breakdownTotals.deposits +
      breakdownTotals.gmEarnings +
      breakdownTotals.prizes +
      breakdownTotals.giftCredits +
      breakdownTotals.refunds,
    [breakdownTotals],
  );
  const moneyOut = useMemo(
    () =>
      breakdownTotals.contestEntries +
      breakdownTotals.marketplace +
      breakdownTotals.gmSpend +
      breakdownTotals.withdrawals +
      breakdownTotals.giftCreditsOut,
    [breakdownTotals],
  );

  return {
    range,
    setRange,
    rangeLabel,
    history,
    flow,
    breakdownDays,
    breakdownTotals,
    breakdownRaw,
    kpis,
    spendSlices,
    insights,
    periodChange,
    moneyIn,
    moneyOut,
    overview,
  };
}

export type WalletAnalyticsModel = ReturnType<typeof useWalletAnalyticsModel>;
