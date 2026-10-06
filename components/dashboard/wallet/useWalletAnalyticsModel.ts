"use client";

import { useMemo, useState } from "react";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import type { KpiItem } from "./WalletKpiGrid";
import type { BreakdownDay, BreakdownTotals } from "./CreditBreakdownPanel";
import type { SpendingSlice } from "./SpendingVsEarnings";
import type { InsightItem } from "./WalletInsights";
import { sliceByRange, type WalletRange } from "./wallet-tokens";
import {
  WALLET_CATEGORIES,
  mapRawBreakdownRow,
  presentKeysFromRows,
  readAllTimeBucket,
  readFiniteNumber,
  resolveCategories,
  sumCategory,
  type ResolvedWalletCategory,
} from "./wallet-categories";

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

export function toBreakdownDay(r: RawBreakdown): BreakdownDay {
  return mapRawBreakdownRow(r as Record<string, unknown>);
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

function daySpend(
  day: Record<string, number | string>,
  spendKeys: string[],
): number {
  let s = 0;
  for (const k of spendKeys) {
    s += readFiniteNumber(day as Record<string, unknown>, k);
  }
  return s;
}

function allTimeTotalsRecord(
  totals: Charts["allTimeTotals"] | undefined,
): Record<string, number> {
  if (!totals) return {};
  // Reason: Map writes — object indexing trips detect-object-injection.
  const out = new Map<string, number>();
  for (const def of WALLET_CATEGORIES) {
    out.set(def.key, readAllTimeBucket(totals as Record<string, number>, def));
  }
  // Reason: surface any extra all-time fields charts.ts may add later.
  for (const [k, v] of Object.entries(totals as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (out.has(k)) continue;
    const mapped = WALLET_CATEGORIES.find(
      (c) => c.sourceKey === k || c.allTimeKey === k,
    );
    if (mapped) continue;
    out.set(k, v);
  }
  return Object.fromEntries(out);
}

/**
 * Shared Wallet Analytics model — one period drives every panel.
 * Desktop and mobile layouts both consume this; neither owns the math.
 *
 * Reason: owner 6 Oct 2026 — categories come from wallet-categories.ts plus
 * any numeric keys present on the data, so a new bucket renders without a
 * per-screen edit.
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

  const categories: ResolvedWalletCategory[] = useMemo(() => {
    const keys = [
      ...presentKeysFromRows(breakdownDays as Array<Record<string, unknown>>),
      ...presentKeysFromRows(breakdownAll as Array<Record<string, unknown>>),
      ...Object.keys(allTimeTotalsRecord(totals)),
    ];
    return resolveCategories(keys);
  }, [breakdownDays, breakdownAll, totals]);

  const spendKeys = useMemo(
    () => categories.filter((c) => c.spendMetric).map((c) => c.key),
    [categories],
  );

  const breakdownTotals: BreakdownTotals = useMemo(() => {
    // Reason: Map writes — object indexing trips detect-object-injection.
    const empty = new Map<string, number>();
    for (const c of categories) empty.set(c.key, 0);

    if (breakdownDays.length === 0) {
      const allTime = allTimeTotalsRecord(totals);
      for (const c of categories) {
        empty.set(c.key, readFiniteNumber(allTime, c.key));
      }
      return Object.fromEntries(empty);
    }

    for (const d of breakdownDays) {
      for (const c of categories) {
        const n = readFiniteNumber(d, c.key);
        empty.set(c.key, (empty.get(c.key) ?? 0) + n);
      }
    }
    return Object.fromEntries(empty);
  }, [breakdownDays, categories, totals]);

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

    const { prev: bPrev, cur: bCur } = halfWindow(breakdownDays);
    const spendCur = bCur.reduce((s, d) => s + daySpend(d, spendKeys), 0);
    const spendPrev = bPrev.reduce((s, d) => s + daySpend(d, spendKeys), 0);
    const gmCur = sumCategory(bCur, "gmEarnings");
    const gmPrev = sumCategory(bPrev, "gmEarnings");
    const prizeCur = sumCategory(bCur, "prizes");
    const prizePrev = sumCategory(bPrev, "prizes");

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
        spark: breakdownDays.map((d) => daySpend(d, spendKeys)).slice(-14),
      },
      {
        key: "game",
        label: "GM Earnings",
        value: gmCur,
        deltaPct: pctChange(gmCur, gmPrev),
        accent: "cyan",
        spark: breakdownDays.map((d) => Number(d.gmEarnings) || 0).slice(-14),
      },
      {
        key: "prizes",
        label: "Prizes Won",
        value: prizeCur,
        deltaPct: pctChange(prizeCur, prizePrev),
        accent: "orange",
        spark: breakdownDays.map((d) => Number(d.prizes) || 0).slice(-14),
      },
    ];
  }, [breakdownDays, history, overview.creditBalance, spendKeys]);

  const spendSlices: SpendingSlice[] = useMemo(() => {
    const rows: SpendingSlice[] = categories
      .filter((c) => c.spend)
      .map((c) => ({
        key: c.key,
        label: c.label,
        value: readFiniteNumber(breakdownTotals, c.key),
        color: c.color,
      }))
      .filter((s) => s.value > 0);

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
  }, [breakdownTotals, categories]);

  const insights: InsightItem[] = useMemo(() => {
    const { prev, cur } = halfWindow(breakdownDays);
    const items: InsightItem[] = categories
      .filter((c) => c.insight)
      .map((c) => {
        const valueCur = sumCategory(cur, c.key);
        const valuePrev = sumCategory(prev, c.key);
        return {
          key: c.key,
          label: c.label,
          value: valueCur,
          deltaPct: pctChange(valueCur, valuePrev),
          spark: breakdownDays
            .map((d) => readFiniteNumber(d, c.key))
            .slice(-10),
          color: c.color,
        };
      });

    const { prev: fPrev, cur: fCur } = halfWindow(flow);
    const netCur = fCur.reduce((s, d) => s + d.net, 0);
    const netPrev = fPrev.reduce((s, d) => s + d.net, 0);
    items.push({
      key: "net",
      label: "Net Movement",
      value: netCur,
      deltaPct: pctChange(netCur, netPrev),
      spark: flow.map((d) => d.net).slice(-10),
      color: "#34D399",
    });

    return items;
  }, [breakdownDays, categories, flow]);

  const moneyIn = useMemo(
    () =>
      categories
        .filter((c) => c.flow === "in")
        .reduce((s, c) => s + readFiniteNumber(breakdownTotals, c.key), 0),
    [breakdownTotals, categories],
  );
  const moneyOut = useMemo(
    () =>
      categories
        .filter((c) => c.flow === "out")
        .reduce((s, c) => s + readFiniteNumber(breakdownTotals, c.key), 0),
    [breakdownTotals, categories],
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
    categories,
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
