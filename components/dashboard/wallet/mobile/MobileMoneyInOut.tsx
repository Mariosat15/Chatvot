"use client";

import Image from "next/image";
import { formatVolts } from "@/lib/utils/format-volts";
import { WALLET_ART } from "@/lib/services/games/wallet-assets";
import type { BreakdownTotals } from "../CreditBreakdownPanel";
import { WALLET_CATEGORY } from "../wallet-tokens";

type BarRow = { label: string; value: number; color: string };

function CategoryBars({ rows, max }: { rows: BarRow[]; max: number }) {
  const denom = max > 0 ? max : 1;
  return (
    <ul className="mt-3 space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }}
              />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="tabular-nums text-white">{formatVolts(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.max(4, (r.value / denom) * 100)}%`,
                backgroundColor: r.color,
                boxShadow: `0 0 10px ${r.color}88`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Money In / Money Out — two summary cards with horizontal category bars.
 */
export default function MobileMoneyInOut({
  totals,
  moneyIn,
  moneyOut,
}: {
  totals: BreakdownTotals;
  moneyIn: number;
  moneyOut: number;
}) {
  const inRows: BarRow[] = [
    { label: "Deposits", value: totals.deposits, color: WALLET_CATEGORY.deposits },
    { label: "Prizes", value: totals.prizes, color: WALLET_CATEGORY.prizes },
    {
      label: "GM Earnings",
      value: totals.gmEarnings,
      color: WALLET_CATEGORY.gmEarnings,
    },
    {
      label: "Gift Credits",
      value: totals.giftCredits,
      color: WALLET_CATEGORY.giftCredits,
    },
    { label: "Refunds", value: totals.refunds, color: WALLET_CATEGORY.refunds },
  ].filter((r) => r.value > 0);

  const outRows: BarRow[] = [
    {
      label: "Contest Entries",
      value: totals.contestEntries,
      color: WALLET_CATEGORY.contestEntries,
    },
    {
      label: "Marketplace",
      value: totals.marketplace,
      color: WALLET_CATEGORY.marketplace,
    },
    {
      label: "GM Spend",
      value: totals.gmSpend,
      color: WALLET_CATEGORY.gmSpend,
    },
    {
      label: "Withdrawals",
      value: totals.withdrawals,
      color: WALLET_CATEGORY.withdrawals,
    },
    {
      label: "Gift Credits Removed",
      value: totals.giftCreditsOut,
      color: WALLET_CATEGORY.giftCreditsOut,
    },
  ].filter((r) => r.value > 0);

  const inMax = Math.max(...inRows.map((r) => r.value), 0);
  const outMax = Math.max(...outRows.map((r) => r.value), 0);

  return (
    <section aria-label="Money in and out">
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
        <Image
          src={WALLET_ART.breakdown}
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] object-contain"
        />
        Credit Breakdown
      </h2>
      <div className="space-y-3">
        <div className="rounded-[18px] border border-emerald-400/30 bg-[linear-gradient(160deg,rgba(6,32,24,0.9)_0%,rgba(5,10,22,0.96)_100%)] p-4 shadow-[0_0_18px_rgba(16,185,129,0.12)]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Money In
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            {formatVolts(moneyIn)}
          </p>
          {inRows.length ? (
            <CategoryBars rows={inRows} max={inMax} />
          ) : (
            <p className="mt-3 text-xs text-slate-500">No inflow in this period</p>
          )}
        </div>
        <div className="rounded-[18px] border border-rose-400/30 bg-[linear-gradient(160deg,rgba(36,12,20,0.9)_0%,rgba(5,10,22,0.96)_100%)] p-4 shadow-[0_0_18px_rgba(244,63,94,0.12)]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
            Money Out
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            {formatVolts(moneyOut)}
          </p>
          {outRows.length ? (
            <CategoryBars rows={outRows} max={outMax} />
          ) : (
            <p className="mt-3 text-xs text-slate-500">No outflow in this period</p>
          )}
        </div>
      </div>
    </section>
  );
}
